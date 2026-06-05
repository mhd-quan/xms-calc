import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { EmbeddedManifest, QuotePayload } from '../shared/types';
import {
  ACCOUNT_FEE_STANDALONE_YEARLY,
  ACCOUNT_FEE_YEARLY,
  BOX_BUY_PRICE,
  BOX_RENT_YEARLY,
  WEBSITE_FEE_YEARLY,
  calculateCoefComponents,
  getBusinessPricingPolicy,
  type PricingIncrement
} from '../shared/calculator';
import { safeFilePart, validateQuotePayload } from './quote-exporter';

export const EXCEL_MANIFEST_SHEET = '_xms_manifest';
export const EXCEL_MANIFEST_CELL = 'A1';
const PLATFORM_FEE_DESCRIPTION =
  'Website hoặc PC App XMS tùy theo nhu cầu hạ tầng của khách hàng, prorated theo thời gian sử dụng thực tế của Cửa hàng, chi phí hàng năm';
const FONT_NAME = 'Aptos Display';
const MONEY_FORMAT = '#,##0';
const COLORS = {
  ink: 'FF23272F',
  muted: 'FF667085',
  white: 'FFFFFFFF',
  paper: 'FFFFFFFF',
  sheet: 'FFF7F9FC',
  rowAlt: 'FFF1F5F9',
  line: 'FFB9C2CF',
  lineStrong: 'FF687385',
  titleFill: 'FF20242C',
  titleAccent: 'FFFFBD59',
  headerFill: 'FF2E3440',
  headerSoft: 'FFE8EEF7',
  tierFill: 'FFFFF2CC',
  sectionFill: 'FFDFE7F3',
  platformFill: 'FFE6F4EA',
  discountFill: 'FFFFE5CC',
  netFill: 'FFDFF3E6',
  summaryFill: 'FFEAF1FF',
  grandFill: 'FFFFBD59',
  note: 'FFC4604C'
} as const;

type AppLike = {
  getPath(name: 'documents'): string;
};

export type DialogLike = {
  showSaveDialog: (...args: unknown[]) => Promise<{ filePath?: string }>;
};

function createExcelFingerprint(fileBytes: Uint8Array): string {
  return crypto.createHash('sha256').update(fileBytes).digest('hex');
}

function embedManifestInWorkbook(workbook: ExcelJS.Workbook, manifest: EmbeddedManifest): void {
  const manifestSheet = workbook.addWorksheet(EXCEL_MANIFEST_SHEET, { state: 'veryHidden' });
  manifestSheet.getCell(EXCEL_MANIFEST_CELL).value = JSON.stringify(manifest);
}

function formulaNumber(value: number): string {
  return String(Number(value));
}

function incrementFormula(g: string, tier: PricingIncrement, baseCell: string): string {
  const above = formulaNumber(tier.above);
  const rate = formulaNumber(tier.rate);
  if (tier.upTo === null) {
    return `IF(${g}<=${above},0,(${g}-${above})*${rate}*${baseCell})`;
  }

  const upTo = formulaNumber(tier.upTo);
  return `IF(${g}<=${above},0,IF(AND(${above}<${g},${g}<=${upTo}),(${g}-${above})*${rate}*${baseCell},(${upTo}-${above})*${rate}*${baseCell}))`;
}

function getFormula(type: string, rowIndex: number, baseCell: string) {
  const policy = getBusinessPricingPolicy(type);
  const g = `G${rowIndex}`;
  const h = `${formulaNumber(policy.base.coefficient)}*${baseCell}`;
  const i = incrementFormula(g, policy.increments[0], baseCell);
  const j = incrementFormula(g, policy.increments[1], baseCell);
  const k = `MIN(SUM(H${rowIndex}:J${rowIndex}),${formulaNumber(policy.maxCoef)}*${baseCell})`;
  return { h, i, j, k };
}

function getHeaderLabels(type: string) {
  const policy = getBusinessPricingPolicy(type);
  const [firstIncrement, secondIncrement] = policy.increments;
  return {
    h6: `Đến ${policy.base.upTo} m2`,
    i6:
      firstIncrement.upTo === null
        ? `Trên ${firstIncrement.above} m2: Cứ mỗi m2 tăng thêm`
        : `Từ trên ${firstIncrement.above} m2 đến ${firstIncrement.upTo} m2: Cứ mỗi m2 tăng thêm`,
    j6:
      secondIncrement.upTo === null
        ? `Trên ${secondIncrement.above} m2: Cứ mỗi m2 tăng thêm`
        : `Từ trên ${secondIncrement.above} m2 đến ${secondIncrement.upTo} m2: Cứ mỗi m2 tăng thêm`,
    h7: `${formulaNumber(policy.base.coefficient)}/${policy.base.upTo} m2`,
    i7: `${formulaNumber(firstIncrement.rate)}/m2`,
    j7: `${formulaNumber(secondIncrement.rate)}/m2`
  };
}

type ComputedStore = QuotePayload['computedStores'][number];

function formulaValue(formula: string, result: number): ExcelJS.CellValue {
  return { formula, result };
}

function sumCells(column: string, rows: number[]): string {
  if (rows.length === 0) return '0';
  return `SUM(${rows.map((row) => `${column}${row}`).join(',')})`;
}

function durationFactor(duration: number): string {
  return formulaNumber(duration / 12);
}

function sumFormula(parts: string[]): string {
  if (parts.length === 0) return '0';
  return `SUM(${parts.join(',')})`;
}

function accountFeeYearly(payload: QuotePayload): number {
  return payload.globals.accountFeeMode === 'standalone' && !payload.globals.hasQTG && !payload.globals.hasQLQ
    ? ACCOUNT_FEE_STANDALONE_YEARLY
    : ACCOUNT_FEE_YEARLY;
}

function proratedStoreFormula(yearlyFee: number, stores: ComputedStore[], multiplier = 1): string {
  return sumFormula(
    stores.map((store) => `${formulaNumber(yearlyFee)}*${durationFactor(store.duration)}*${formulaNumber(multiplier)}`)
  );
}

function platformDiscount(payload: QuotePayload, key: keyof QuotePayload['globals']['globalDiscounts']): number {
  return payload.globals.discountEnabled[key] ? payload.globals.globalDiscounts[key] : 0;
}

export async function exportExcel({
  app,
  dialog,
  payload,
  manifest,
  parentWindow = null
}: {
  app: AppLike;
  dialog: DialogLike;
  payload: QuotePayload;
  manifest: EmbeddedManifest;
  parentWindow?: unknown;
}): Promise<{ filePath: string; fingerprint: string } | null> {
  validateQuotePayload(payload);
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid workbook export manifest');
  }

  const customerFileName = safeFilePart(
    payload.customer?.companyName || payload.meta.customer?.companyName || payload.meta.customerName,
    'KhachHang'
  );
  const quoteNumber = safeFilePart(payload.quoteIdentity.displayQuoteNumber || payload.meta.displayQuoteNumber, 'BaoGia');
  const defaultPath = path.join(app.getPath('documents'), `${quoteNumber}_${customerFileName}.xlsx`);
  
  const dialogOptions = {
    title: 'Lưu báo giá Excel',
    defaultPath,
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  };

  const { filePath } = parentWindow
    ? await dialog.showSaveDialog(parentWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (!filePath) return null;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'XMS Calculator';
  wb.created = new Date();
  const ws = wb.addWorksheet('Báo Giá');
  ws.properties.defaultRowHeight = 24;
  ws.properties.defaultColWidth = 12;
  ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  ws.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.45,
      bottom: 0.45,
      header: 0.15,
      footer: 0.15
    }
  };

  ws.columns = [
    { width: 6 },    // A
    { width: 24 },   // B
    { width: 22 },   // C
    { width: 28 },   // D
    { width: 14 },   // E
    { width: 15 },   // F
    { width: 12 },   // G
    { width: 18 },   // H
    { width: 22 },   // I
    { width: 20 },   // J
    { width: 22 },   // K
    { width: 21 },   // L
    { width: 21 },   // M
    { width: 25 }    // N
  ];

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: COLORS.line } },
    left: { style: 'thin', color: { argb: COLORS.line } },
    bottom: { style: 'thin', color: { argb: COLORS.line } },
    right: { style: 'thin', color: { argb: COLORS.line } }
  };
  const borderStrong: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: COLORS.lineStrong } },
    left: { style: 'thin', color: { argb: COLORS.line } },
    bottom: { style: 'medium', color: { argb: COLORS.lineStrong } },
    right: { style: 'thin', color: { argb: COLORS.line } }
  };
  const alignCenter: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const alignLeft: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const alignRight: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'right', wrapText: true };

  const fillCell = (cell: ExcelJS.Cell, color: string) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  };

  const applyStyle = (
    cell: ExcelJS.Cell,
    {
      bold = false,
      align = alignCenter,
      fill = COLORS.paper,
      fontColor = COLORS.ink,
      size = 10,
      border = borderThin
    }: {
      bold?: boolean;
      align?: Partial<ExcelJS.Alignment>;
      fill?: string;
      fontColor?: string;
      size?: number;
      border?: Partial<ExcelJS.Borders>;
    } = {}
  ) => {
    cell.font = { name: FONT_NAME, size, bold, color: { argb: fontColor } };
    cell.alignment = align;
    cell.border = border;
    fillCell(cell, fill);
  };

  ws.mergeCells('A1:N1');
  const a1 = ws.getCell('A1');
  a1.value = 'BẢNG BÁO GIÁ DỊCH VỤ BẢN QUYỀN & GIẢI PHÁP PHÁT NHẠC';
  a1.font = { name: FONT_NAME, bold: true, size: 16, color: { argb: COLORS.titleAccent } };
  a1.alignment = alignCenter;
  fillCell(a1, COLORS.titleFill);
  a1.border = borderStrong;
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 8;

  const writePricingHeader = (startRow: number, type: string): number => {
    const hlbl = getHeaderLabels(type);
    const row3 = startRow;
    const row4 = startRow + 1;
    const row5 = startRow + 2;
    const row6 = startRow + 3;
    const row7 = startRow + 4;

    ws.mergeCells(`A${row3}:A${row7}`); ws.getCell(`A${row3}`).value = 'STT';
    ws.mergeCells(`B${row3}:B${row7}`); ws.getCell(`B${row3}`).value = 'TÊN THƯƠNG HIỆU';
    ws.mergeCells(`C${row3}:C${row7}`); ws.getCell(`C${row3}`).value = 'CỬA HÀNG';
    ws.mergeCells(`D${row3}:D${row7}`); ws.getCell(`D${row3}`).value = 'ĐỊA CHỈ';
    ws.mergeCells(`E${row3}:E${row7}`); ws.getCell(`E${row3}`).value = 'PHÂN LOẠI ĐÔ THỊ';
    ws.mergeCells(`F${row3}:F${row7}`); ws.getCell(`F${row3}`).value = '% ÁP DỤNG KHUNG GIÁ THEO PHÂN LOẠI ĐÔ THỊ';
    ws.mergeCells(`G${row3}:G${row7}`); ws.getCell(`G${row3}`).value = 'DIỆN TÍCH SỬ DỤNG NHẠC\n(M2)';

    ws.mergeCells(`H${row3}:M${row3}`);
    ws.getCell(`H${row3}`).value =
      'PHƯƠNG THỨC TÍNH THEO NGHỊ ĐỊNH 17 - PHỤ LỤC 02\nSố tiền bản quyền (tính theo năm) = Mức lương cơ sở x Hệ số điều chỉnh';
    ws.getCell(`H${row4}`).value = 'Mức lương cơ sở:';
    ws.getCell(`I${row4}`).value = payload.globals.baseSalary;
    ws.getCell(`J${row4}`).value = 'VNĐ';
    ws.mergeCells(`K${row4}:K${row7}`);
    ws.getCell(`K${row4}`).value = 'PHÍ BẢN QUYỀN/NĂM CHO MỖI QUYỀN/1 ĐỊA ĐIỂM\n(đã áp trần hệ số)';
    ws.mergeCells(`L${row4}:M${row5}`);
    ws.getCell(`L${row4}`).value = 'PHÍ BẢN QUYỀN THEO THỜI HẠN\n(chưa VAT)';

    ws.mergeCells(`H${row5}:J${row5}`);
    ws.getCell(`H${row5}`).value = 'Hệ số điều chỉnh theo định mức diện tích';

    ws.getCell(`H${row6}`).value = hlbl.h6;
    ws.getCell(`I${row6}`).value = hlbl.i6;
    ws.getCell(`J${row6}`).value = hlbl.j6;

    ws.mergeCells(`L${row6}:L${row7}`); ws.getCell(`L${row6}`).value = 'QUYỀN TÁC GIẢ (VCPMC)';
    ws.mergeCells(`M${row6}:M${row7}`); ws.getCell(`M${row6}`).value = 'QUYỀN LIÊN QUAN\n(NCT)';

    ws.getCell(`H${row7}`).value = hlbl.h7;
    ws.getCell(`I${row7}`).value = hlbl.i7;
    ws.getCell(`J${row7}`).value = hlbl.j7;

    ws.mergeCells(`N${row3}:N${row7}`);
    ws.getCell(`N${row3}`).value = 'TỔNG CHI PHÍ GIẢI PHÁP PHÁT NHẠC ĐẦY ĐỦ BẢN QUYỀN';

    ws.getRow(row3).height = 34;
    ws.getRow(row4).height = 24;
    ws.getRow(row5).height = 24;
    ws.getRow(row6).height = 42;
    ws.getRow(row7).height = 30;

    for (let r = row3; r <= row7; r++) {
      const fill =
        r === row3
          ? COLORS.headerFill
          : r === row6 || r === row7
            ? COLORS.tierFill
            : COLORS.headerSoft;
      const fontColor = r === row3 ? COLORS.white : COLORS.ink;
      for (let c = 1; c <= 14; c++) {
        const cell = ws.getCell(r, c);
        applyStyle(cell, {
          bold: true,
          align: alignCenter,
          fill,
          fontColor,
          border: r === row3 ? borderStrong : borderThin
        });
      }
    }

    return startRow + 5;
  };

  let rowIdx = 3;
  const storeCount = Math.max(1, payload.computedStores.length);
  const dataRows: number[] = [];
  const componentTotals: [number, number, number] = [0, 0, 0];
  let annualRightTotal = 0;
  let lastType: string | null = null;

  if (payload.computedStores.length === 0) {
    rowIdx = writePricingHeader(rowIdx, 'cafe');
  }

  payload.computedStores.forEach((store: ComputedStore, idx) => {
    if (lastType !== store.type) {
      if (dataRows.length > 0) rowIdx++;
      rowIdx = writePricingHeader(rowIdx, store.type || 'cafe');
      lastType = store.type;
    }

    const r = rowIdx++;
    const f = getFormula(store.type, r, '$I$4');
    const area = Number(store.area) || 0;
    const breakdown = calculateCoefComponents(store.type, area);
    const componentAmounts = breakdown.components.map((component) => component * payload.globals.baseSalary) as [
      number,
      number,
      number
    ];
    componentTotals[0] += componentAmounts[0];
    componentTotals[1] += componentAmounts[1];
    componentTotals[2] += componentAmounts[2];
    annualRightTotal += store.yearly;
    dataRows.push(r);

    ws.getCell(`A${r}`).value = idx + 1;
    ws.getCell(`B${r}`).value = store.typeLabel || 'Cửa hàng';
    ws.getCell(`C${r}`).value = store.name;
    ws.getCell(`D${r}`).value = store.name; 
    ws.getCell(`E${r}`).value = 'Loại Đặc biệt'; 
    ws.getCell(`F${r}`).value = 1;
    ws.getCell(`G${r}`).value = area;
    ws.getCell(`H${r}`).value = formulaValue(f.h, componentAmounts[0]);
    ws.getCell(`I${r}`).value = formulaValue(f.i, componentAmounts[1]);
    ws.getCell(`J${r}`).value = formulaValue(f.j, componentAmounts[2]);
    ws.getCell(`K${r}`).value = formulaValue(f.k, store.yearly);
    ws.getCell(`L${r}`).value = formulaValue(
      payload.globals.hasQTG ? `K${r}*${durationFactor(store.duration)}` : '0',
      store.qtgAmountOriginal
    );
    ws.getCell(`M${r}`).value = formulaValue(
      payload.globals.hasQLQ ? `K${r}*${durationFactor(store.duration)}` : '0',
      store.qlqAmountOriginal
    );
    ws.getCell(`N${r}`).value = formulaValue(`L${r}+M${r}`, store.qtgAmountOriginal + store.qlqAmountOriginal);
    ws.getRow(r).height = 28;

    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      applyStyle(cell, {
        align: c === 3 || c === 4 ? alignLeft : c >= 8 ? alignRight : alignCenter,
        fill: c >= 11 ? COLORS.sheet : idx % 2 === 0 ? COLORS.paper : COLORS.rowAlt
      });
      if (c >= 8) cell.numFmt = MONEY_FORMAT;
    }
  });

  const sumRow = rowIdx++;
  const copyrightOriginal = payload.totals.subtotalQTGOriginal + payload.totals.subtotalQLQOriginal;
  ws.getCell(`A${sumRow}`).value = 'Tổng cộng';
  ws.mergeCells(`A${sumRow}:G${sumRow}`);
  ws.getCell(`H${sumRow}`).value = formulaValue(sumCells('H', dataRows), componentTotals[0]);
  ws.getCell(`I${sumRow}`).value = formulaValue(sumCells('I', dataRows), componentTotals[1]);
  ws.getCell(`J${sumRow}`).value = formulaValue(sumCells('J', dataRows), componentTotals[2]);
  ws.getCell(`K${sumRow}`).value = formulaValue(sumCells('K', dataRows), annualRightTotal);
  ws.getCell(`L${sumRow}`).value = formulaValue(sumCells('L', dataRows), payload.totals.subtotalQTGOriginal);
  ws.getCell(`M${sumRow}`).value = formulaValue(sumCells('M', dataRows), payload.totals.subtotalQLQOriginal);
  ws.getCell(`N${sumRow}`).value = formulaValue(sumCells('N', dataRows), copyrightOriginal);

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(sumRow, c);
    applyStyle(cell, {
      bold: true,
      align: c >= 8 ? alignRight : alignCenter,
      fill: COLORS.sectionFill,
      border: borderStrong
    });
    if (c >= 8) cell.numFmt = MONEY_FORMAT;
  }
  ws.getRow(sumRow).height = 28;

  const qtgDiscount = payload.globals.discountEnabled.qtg ? payload.globals.globalDiscounts.qtg : 0;
  const qlqDiscount = payload.globals.discountEnabled.qlq ? payload.globals.globalDiscounts.qlq : 0;
  const qtgDiscountAmount = payload.totals.subtotalQTGOriginal * (qtgDiscount / 100);
  const qlqDiscountAmount = payload.totals.subtotalQLQOriginal * (qlqDiscount / 100);

  const discRow = rowIdx++;
  ws.getCell(`A${discRow}`).value = `Mức hỗ trợ Phí Bản Quyền: QTG ${qtgDiscount}% & QLQ ${qlqDiscount}%`;
  ws.mergeCells(`A${discRow}:K${discRow}`);
  ws.getCell(`L${discRow}`).value = formulaValue(`L${sumRow}*${qtgDiscount}%`, qtgDiscountAmount);
  ws.getCell(`M${discRow}`).value = formulaValue(`M${sumRow}*${qlqDiscount}%`, qlqDiscountAmount);
  ws.getCell(`N${discRow}`).value = formulaValue(`L${discRow}+M${discRow}`, qtgDiscountAmount + qlqDiscountAmount);

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(discRow, c);
    applyStyle(cell, {
      align: c === 1 ? alignLeft : c >= 12 ? alignRight : alignCenter,
      fill: COLORS.discountFill
    });
    if (c >= 12) cell.numFmt = MONEY_FORMAT;
  }
  ws.getRow(discRow).height = 26;

  const netRow = rowIdx++;
  const copyrightNet = payload.totals.subtotalQTG + payload.totals.subtotalQLQ;
  ws.getCell(`A${netRow}`).value = 'Tổng giá trị phải thanh toán Phí Bản Quyền (chưa bao gồm VAT):';
  ws.mergeCells(`A${netRow}:K${netRow}`);
  ws.getCell(`L${netRow}`).value = formulaValue(`L${sumRow}-L${discRow}`, payload.totals.subtotalQTG);
  ws.getCell(`M${netRow}`).value = formulaValue(`M${sumRow}-M${discRow}`, payload.totals.subtotalQLQ);
  ws.getCell(`N${netRow}`).value = formulaValue(`N${sumRow}-N${discRow}`, copyrightNet);

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(netRow, c);
    applyStyle(cell, {
      bold: true,
      align: c === 1 ? alignLeft : c >= 12 ? alignRight : alignCenter,
      fill: COLORS.netFill,
      border: borderStrong
    });
    if (c >= 12) cell.numFmt = MONEY_FORMAT;
  }
  ws.getRow(netRow).height = 30;

  const avgRow = rowIdx++;
  ws.getCell(`A${avgRow}`).value = 'Mức Phí Bản Quyền trung bình trên từng cửa hàng (chưa bao gồm VAT):';
  ws.mergeCells(`A${avgRow}:K${avgRow}`);
  ws.getCell(`L${avgRow}`).value = formulaValue(`L${netRow}/${storeCount}`, payload.totals.subtotalQTG / storeCount);
  ws.getCell(`M${avgRow}`).value = formulaValue(`M${netRow}/${storeCount}`, payload.totals.subtotalQLQ / storeCount);
  ws.getCell(`N${avgRow}`).value = formulaValue(`N${netRow}/${storeCount}`, copyrightNet / storeCount);

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(avgRow, c);
    applyStyle(cell, {
      align: c === 1 ? alignLeft : c >= 12 ? alignRight : alignCenter,
      fill: COLORS.summaryFill
    });
    if (c >= 12) cell.numFmt = MONEY_FORMAT;
  }
  ws.getRow(avgRow).height = 26;

  rowIdx++;
  const boxCount = Math.max(1, Number(payload.globals.globalBoxCount) || 1);
  const platformRows = [
    payload.totals.subtotalAccountOriginal > 0
      ? {
          title: 'Phí Sử dụng Tài khoản XMS',
          detail:
            payload.globals.accountFeeMode === 'standalone' && !payload.globals.hasQTG && !payload.globals.hasQLQ
              ? 'Tài khoản XMS độc lập: 1.500.000 VND/năm/cửa hàng; chỉ áp dụng khi không tính Quyền tác giả và Quyền liên quan.'
              : 'Tài khoản XMS: 600.000 VND/năm, prorated theo thời hạn từng chi nhánh.',
          scope: `${storeCount} cửa hàng`,
          unit: 'Năm prorated',
          originalFormula: proratedStoreFormula(accountFeeYearly(payload), payload.computedStores),
          amountFormula: (row: number) => `K${row}*(1-${formulaNumber(platformDiscount(payload, 'account'))}%)`,
          original: payload.totals.subtotalAccountOriginal,
          amount: payload.totals.subtotalAccount
        }
      : null,
    payload.totals.subtotalWebsiteOriginal > 0
      ? {
          title: 'Phí Nền tảng',
          detail: PLATFORM_FEE_DESCRIPTION,
          scope: `${storeCount} cửa hàng`,
          unit: 'Năm prorated',
          originalFormula: proratedStoreFormula(WEBSITE_FEE_YEARLY, payload.computedStores),
          amountFormula: (row: number) => `K${row}*(1-${formulaNumber(platformDiscount(payload, 'website'))}%)`,
          original: payload.totals.subtotalWebsiteOriginal,
          amount: payload.totals.subtotalWebsite
        }
      : null,
    payload.totals.subtotalBoxOriginal > 0 && payload.globals.boxMode !== 'none'
      ? {
          title: payload.globals.boxMode === 'buy' ? 'Thiết bị phát (Boxset) - Mua' : 'Thiết bị phát (Boxset) - Thuê',
          detail:
            payload.globals.boxMode === 'buy'
              ? 'Mua Thiết bị phát (Boxset): 2.000.000 VND/thiết bị, chi phí một lần.'
              : 'Thuê Thiết bị phát (Boxset): 900.000 VND/năm/thiết bị, prorated theo thời hạn và có thể áp dụng chiết khấu giao diện.',
          scope: `${storeCount * Math.max(1, Number(payload.globals.globalBoxCount) || 1)} boxset`,
          unit: payload.globals.boxMode === 'buy' ? 'Một lần' : 'Năm prorated',
          originalFormula:
            payload.globals.boxMode === 'buy'
              ? `${formulaNumber(BOX_BUY_PRICE)}*${formulaNumber(boxCount)}*${formulaNumber(storeCount)}`
              : proratedStoreFormula(BOX_RENT_YEARLY, payload.computedStores, boxCount),
          amountFormula: (row: number) => `K${row}*(1-${formulaNumber(platformDiscount(payload, 'box'))}%)`,
          original: payload.totals.subtotalBoxOriginal,
          amount: payload.totals.subtotalBox
        }
      : null
  ].filter((row): row is {
    title: string;
    detail: string;
    scope: string;
    unit: string;
    originalFormula: string;
    amountFormula: (row: number) => string;
    original: number;
    amount: number;
  } => row !== null);

  let platformTotalRow: number | null = null;
  const platformDataRows: number[] = [];
  if (platformRows.length > 0) {
    const sectionRow = rowIdx++;
    ws.mergeCells(`A${sectionRow}:N${sectionRow}`);
    ws.getCell(`A${sectionRow}`).value = 'HẠNG MỤC NỀN TẢNG & THIẾT BỊ';
    ws.getRow(sectionRow).height = 28;
    for (let c = 1; c <= 14; c++) {
      applyStyle(ws.getCell(sectionRow, c), {
        bold: true,
        align: alignLeft,
        fill: COLORS.platformFill,
        border: borderStrong
      });
    }

    const platformHeadRow = rowIdx++;
    ws.mergeCells(`A${platformHeadRow}:C${platformHeadRow}`);
    ws.mergeCells(`D${platformHeadRow}:G${platformHeadRow}`);
    ws.mergeCells(`H${platformHeadRow}:I${platformHeadRow}`);
    ws.mergeCells(`K${platformHeadRow}:L${platformHeadRow}`);
    ws.mergeCells(`M${platformHeadRow}:N${platformHeadRow}`);
    ws.getCell(`A${platformHeadRow}`).value = 'Hạng mục';
    ws.getCell(`D${platformHeadRow}`).value = 'Mô tả';
    ws.getCell(`H${platformHeadRow}`).value = 'Phạm vi';
    ws.getCell(`J${platformHeadRow}`).value = 'Đơn vị tính';
    ws.getCell(`K${platformHeadRow}`).value = 'Giá gốc';
    ws.getCell(`M${platformHeadRow}`).value = 'Thành tiền';
    ws.getRow(platformHeadRow).height = 26;
    for (let c = 1; c <= 14; c++) {
      applyStyle(ws.getCell(platformHeadRow, c), {
        bold: true,
        align: alignCenter,
        fill: COLORS.headerSoft
      });
    }

    platformRows.forEach((item) => {
      const r = rowIdx++;
      platformDataRows.push(r);
      ws.mergeCells(`A${r}:C${r}`);
      ws.mergeCells(`D${r}:G${r}`);
      ws.mergeCells(`H${r}:I${r}`);
      ws.mergeCells(`K${r}:L${r}`);
      ws.mergeCells(`M${r}:N${r}`);
      ws.getCell(`A${r}`).value = item.title;
      ws.getCell(`D${r}`).value = item.detail;
      ws.getCell(`H${r}`).value = item.scope;
      ws.getCell(`J${r}`).value = item.unit;
      ws.getCell(`K${r}`).value = formulaValue(item.originalFormula, item.original);
      ws.getCell(`M${r}`).value = formulaValue(item.amountFormula(r), item.amount);
      ws.getRow(r).height = 44;
      for (let c = 1; c <= 14; c++) {
        const cell = ws.getCell(r, c);
        applyStyle(cell, {
          align: c === 1 || c === 4 ? alignLeft : c >= 11 ? alignRight : alignCenter,
          fill: c >= 11 ? COLORS.sheet : COLORS.paper
        });
        if (c >= 11) cell.numFmt = MONEY_FORMAT;
      }
    });

    platformTotalRow = rowIdx++;
    ws.mergeCells(`A${platformTotalRow}:J${platformTotalRow}`);
    ws.mergeCells(`K${platformTotalRow}:L${platformTotalRow}`);
    ws.mergeCells(`M${platformTotalRow}:N${platformTotalRow}`);
    ws.getCell(`A${platformTotalRow}`).value = 'Tổng hạng mục Nền tảng & Thiết bị:';
    ws.getCell(`K${platformTotalRow}`).value = formulaValue(
      sumCells('K', platformDataRows),
      payload.totals.subtotalAccountOriginal + payload.totals.subtotalWebsiteOriginal + payload.totals.subtotalBoxOriginal
    );
    ws.getCell(`M${platformTotalRow}`).value = formulaValue(
      sumCells('M', platformDataRows),
      payload.totals.subtotalAccount + payload.totals.subtotalWebsite + payload.totals.subtotalBox
    );
    ws.getRow(platformTotalRow).height = 30;
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(platformTotalRow, c);
      applyStyle(cell, {
        bold: true,
        align: c === 1 ? alignLeft : c >= 11 ? alignRight : alignCenter,
        fill: COLORS.netFill,
        border: borderStrong
      });
      if (c >= 11) cell.numFmt = MONEY_FORMAT;
    }
  }

  rowIdx++;
  const platformOriginalRef = platformTotalRow ? `K${platformTotalRow}` : '0';
  const platformAmountRef = platformTotalRow ? `M${platformTotalRow}` : '0';
  const subtotalSummaryRow = rowIdx;
  const vatSummaryRow = rowIdx + 1;
  const quoteSummaryRows = [
    {
      label: 'Tổng giá trị báo giá trước VAT:',
      originalFormula: `N${sumRow}+${platformOriginalRef}`,
      amountFormula: `N${netRow}+${platformAmountRef}`,
      original: payload.totals.subtotalOriginal,
      amount: payload.totals.subtotal,
      fill: COLORS.summaryFill
    },
    {
      label: `VAT (${Math.round(payload.totals.vatRate * 100)}%):`,
      originalFormula: `K${subtotalSummaryRow}*${formulaNumber(payload.totals.vatRate)}`,
      amountFormula: `M${subtotalSummaryRow}*${formulaNumber(payload.totals.vatRate)}`,
      original: payload.totals.vatOriginal,
      amount: payload.totals.vat,
      fill: COLORS.summaryFill
    },
    {
      label: 'Tổng thanh toán sau VAT:',
      originalFormula: `K${subtotalSummaryRow}+K${vatSummaryRow}`,
      amountFormula: `M${subtotalSummaryRow}+M${vatSummaryRow}`,
      original: payload.totals.grandOriginal,
      amount: payload.totals.grand,
      fill: COLORS.grandFill
    }
  ];

  quoteSummaryRows.forEach((item, index) => {
    const r = rowIdx++;
    ws.mergeCells(`A${r}:J${r}`);
    ws.mergeCells(`K${r}:L${r}`);
    ws.mergeCells(`M${r}:N${r}`);
    ws.getCell(`A${r}`).value = item.label;
    ws.getCell(`K${r}`).value = formulaValue(item.originalFormula, item.original);
    ws.getCell(`M${r}`).value = formulaValue(item.amountFormula, item.amount);
    ws.getRow(r).height = index === quoteSummaryRows.length - 1 ? 34 : 28;
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      applyStyle(cell, {
        bold: index === quoteSummaryRows.length - 1,
        align: c === 1 ? alignLeft : c >= 11 ? alignRight : alignCenter,
        fill: item.fill,
        border: index === quoteSummaryRows.length - 1 ? borderStrong : borderThin,
        fontColor: COLORS.ink,
        size: index === quoteSummaryRows.length - 1 ? 11 : 10
      });
      if (c >= 11) cell.numFmt = MONEY_FORMAT;
    }
  });

  rowIdx++;
  ws.getCell(`B${rowIdx}`).value = 'Lưu ý: ';
  ws.getCell(`B${rowIdx}`).font = { name: FONT_NAME, size: 10, bold: true };
  ws.getRow(rowIdx).height = 22;
  
  rowIdx++;
  const note1 = ws.getCell(`B${rowIdx}`);
  note1.value = '- Báo giá có thời hạn trong vòng 30 ngày kể từ ngày gửi báo giá.';
  note1.font = { name: FONT_NAME, size: 10, color: { argb: COLORS.note } };
  ws.getRow(rowIdx).height = 22;

  rowIdx++;
  const note2 = ws.getCell(`B${rowIdx}`);
  note2.value = '- Mức thuế suất được áp dụng tuân thủ theo quy định của pháp luật tại thời điểm phát sinh Phí dịch vụ.';
  note2.font = { name: FONT_NAME, size: 10, color: { argb: COLORS.note } };
  ws.getRow(rowIdx).height = 22;

  embedManifestInWorkbook(wb, manifest);

  await wb.xlsx.writeFile(filePath);
  const fileBytes = await fs.readFile(filePath);
  return {
    filePath,
    fingerprint: createExcelFingerprint(fileBytes)
  };
}
