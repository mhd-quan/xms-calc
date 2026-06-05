import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { EmbeddedManifest, QuotePayload } from '../shared/types';
import {
  calculateCoefComponents,
  getBusinessPricingPolicy,
  type PricingIncrement
} from '../shared/calculator';
import { safeFilePart, validateQuotePayload } from './quote-exporter';

export const EXCEL_MANIFEST_SHEET = '_xms_manifest';
export const EXCEL_MANIFEST_CELL = 'A1';
const PLATFORM_FEE_DESCRIPTION =
  'Website hoặc PC App XMS tùy theo nhu cầu hạ tầng của khách hàng, prorated theo thời gian sử dụng thực tế của Cửa hàng, chi phí hàng năm';

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
  const ws = wb.addWorksheet('Báo Giá');

  ws.columns = [
    { width: 5.83 },  // A
    { width: 18.66 }, // B
    { width: 26.16 }, // C
    { width: 49.16 }, // D
    { width: 9.16 },  // E
    { width: 10.16 }, // F
    { width: 10.125 },// G
    { width: 16.33 }, // H
    { width: 17.16 }, // I
    { width: 15.66 }, // J
    { width: 18.16 }, // K
    { width: 19.16 }, // L
    { width: 19.16 }, // M
    { width: 21.5 }   // N
  ];

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' }
  };
  const alignCenter: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const alignLeft: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };
  const FONT_NAME = 'Aptos Display';

  const applyStyle = (cell: ExcelJS.Cell, bold = false, align = alignCenter, fill = false) => {
    cell.font = { name: FONT_NAME, size: 10, bold };
    cell.alignment = align;
    cell.border = borderThin;
    if (fill) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E9E9' } };
    }
  };

  ws.mergeCells('A1:N1');
  const a1 = ws.getCell('A1');
  a1.value = 'BẢNG BÁO GIÁ DỊCH VỤ BẢN QUYỀN & GIẢI PHÁP PHÁT NHẠC';
  a1.font = { name: FONT_NAME, bold: true, size: 16 };
  a1.alignment = alignCenter;

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

    for (let r = row3; r <= row7; r++) {
      for (let c = 1; c <= 14; c++) {
        const cell = ws.getCell(r, c);
        if (!cell.isMerged || cell.address === cell.master.address) {
          applyStyle(cell, true, alignCenter, true);
        } else {
          cell.border = borderThin;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E9E9' } };
        }
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

    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      applyStyle(cell, false, c === 3 || c === 4 ? alignLeft : alignCenter);
      if (c >= 8) cell.numFmt = '#,##0';
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
    applyStyle(cell, true, alignCenter);
    if (c >= 8) cell.numFmt = '#,##0';
  }

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
    applyStyle(cell, false, c === 1 ? alignLeft : alignCenter);
    if (c >= 12) cell.numFmt = '#,##0';
  }

  const netRow = rowIdx++;
  const copyrightNet = payload.totals.subtotalQTG + payload.totals.subtotalQLQ;
  ws.getCell(`A${netRow}`).value = 'Tổng giá trị phải thanh toán Phí Bản Quyền (chưa bao gồm VAT):';
  ws.mergeCells(`A${netRow}:K${netRow}`);
  ws.getCell(`L${netRow}`).value = formulaValue(`L${sumRow}-L${discRow}`, payload.totals.subtotalQTG);
  ws.getCell(`M${netRow}`).value = formulaValue(`M${sumRow}-M${discRow}`, payload.totals.subtotalQLQ);
  ws.getCell(`N${netRow}`).value = formulaValue(`N${sumRow}-N${discRow}`, copyrightNet);

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(netRow, c);
    applyStyle(cell, true, c === 1 ? alignLeft : alignCenter, true);
    if (c >= 12) cell.numFmt = '#,##0';
  }

  const avgRow = rowIdx++;
  ws.getCell(`A${avgRow}`).value = 'Mức Phí Bản Quyền trung bình trên từng cửa hàng (chưa bao gồm VAT):';
  ws.mergeCells(`A${avgRow}:K${avgRow}`);
  ws.getCell(`L${avgRow}`).value = formulaValue(`L${netRow}/${storeCount}`, payload.totals.subtotalQTG / storeCount);
  ws.getCell(`M${avgRow}`).value = formulaValue(`M${netRow}/${storeCount}`, payload.totals.subtotalQLQ / storeCount);
  ws.getCell(`N${avgRow}`).value = formulaValue(`N${netRow}/${storeCount}`, copyrightNet / storeCount);

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(avgRow, c);
    applyStyle(cell, false, c === 1 ? alignLeft : alignCenter);
    if (c >= 12) cell.numFmt = '#,##0';
  }

  rowIdx++;
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
          original: payload.totals.subtotalBoxOriginal,
          amount: payload.totals.subtotalBox
        }
      : null
  ].filter((row): row is {
    title: string;
    detail: string;
    scope: string;
    unit: string;
    original: number;
    amount: number;
  } => row !== null);

  if (platformRows.length > 0) {
    const sectionRow = rowIdx++;
    ws.mergeCells(`A${sectionRow}:N${sectionRow}`);
    ws.getCell(`A${sectionRow}`).value = 'HẠNG MỤC NỀN TẢNG & THIẾT BỊ';
    for (let c = 1; c <= 14; c++) applyStyle(ws.getCell(sectionRow, c), true, alignLeft, true);

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
    for (let c = 1; c <= 14; c++) applyStyle(ws.getCell(platformHeadRow, c), true, alignCenter, true);

    platformRows.forEach((item) => {
      const r = rowIdx++;
      ws.mergeCells(`A${r}:C${r}`);
      ws.mergeCells(`D${r}:G${r}`);
      ws.mergeCells(`H${r}:I${r}`);
      ws.mergeCells(`K${r}:L${r}`);
      ws.mergeCells(`M${r}:N${r}`);
      ws.getCell(`A${r}`).value = item.title;
      ws.getCell(`D${r}`).value = item.detail;
      ws.getCell(`H${r}`).value = item.scope;
      ws.getCell(`J${r}`).value = item.unit;
      ws.getCell(`K${r}`).value = item.original;
      ws.getCell(`M${r}`).value = item.amount;
      for (let c = 1; c <= 14; c++) {
        const cell = ws.getCell(r, c);
        applyStyle(cell, false, c === 1 || c === 4 ? alignLeft : alignCenter);
        if (c >= 11) cell.numFmt = '#,##0';
      }
    });

    const platformTotalRow = rowIdx++;
    ws.mergeCells(`A${platformTotalRow}:J${platformTotalRow}`);
    ws.mergeCells(`K${platformTotalRow}:L${platformTotalRow}`);
    ws.mergeCells(`M${platformTotalRow}:N${platformTotalRow}`);
    ws.getCell(`A${platformTotalRow}`).value = 'Tổng hạng mục Nền tảng & Thiết bị:';
    ws.getCell(`K${platformTotalRow}`).value = payload.totals.subtotalAccountOriginal + payload.totals.subtotalWebsiteOriginal + payload.totals.subtotalBoxOriginal;
    ws.getCell(`M${platformTotalRow}`).value = payload.totals.subtotalAccount + payload.totals.subtotalWebsite + payload.totals.subtotalBox;
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(platformTotalRow, c);
      applyStyle(cell, true, c === 1 ? alignLeft : alignCenter, true);
      if (c >= 11) cell.numFmt = '#,##0';
    }
  }

  rowIdx++;
  const quoteSummaryRows = [
    {
      label: 'Tổng giá trị báo giá trước VAT:',
      original: payload.totals.subtotalOriginal,
      amount: payload.totals.subtotal
    },
    {
      label: `VAT (${Math.round(payload.totals.vatRate * 100)}%):`,
      original: payload.totals.vatOriginal,
      amount: payload.totals.vat
    },
    {
      label: 'Tổng thanh toán sau VAT:',
      original: payload.totals.grandOriginal,
      amount: payload.totals.grand
    }
  ];

  quoteSummaryRows.forEach((item, index) => {
    const r = rowIdx++;
    ws.mergeCells(`A${r}:J${r}`);
    ws.mergeCells(`K${r}:L${r}`);
    ws.mergeCells(`M${r}:N${r}`);
    ws.getCell(`A${r}`).value = item.label;
    ws.getCell(`K${r}`).value = item.original;
    ws.getCell(`M${r}`).value = item.amount;
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      applyStyle(cell, index === quoteSummaryRows.length - 1, c === 1 ? alignLeft : alignCenter, index === quoteSummaryRows.length - 1);
      if (c >= 11) cell.numFmt = '#,##0';
    }
  });

  rowIdx++;
  ws.getCell(`B${rowIdx}`).value = 'Lưu ý: ';
  ws.getCell(`B${rowIdx}`).font = { name: FONT_NAME, size: 10, bold: true };
  
  rowIdx++;
  const note1 = ws.getCell(`B${rowIdx}`);
  note1.value = '- Báo giá có thời hạn trong vòng 30 ngày kể từ ngày gửi báo giá.';
  note1.font = { name: FONT_NAME, size: 10, color: { argb: 'FFC4604C' } };

  rowIdx++;
  const note2 = ws.getCell(`B${rowIdx}`);
  note2.value = '- Mức thuế suất được áp dụng tuân thủ theo quy định của pháp luật tại thời điểm phát sinh Phí dịch vụ.';
  note2.font = { name: FONT_NAME, size: 10, color: { argb: 'FFC4604C' } };

  embedManifestInWorkbook(wb, manifest);

  await wb.xlsx.writeFile(filePath);
  const fileBytes = await fs.readFile(filePath);
  return {
    filePath,
    fingerprint: createExcelFingerprint(fileBytes)
  };
}
