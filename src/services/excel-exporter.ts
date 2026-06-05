import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { EmbeddedManifest, QuotePayload } from '../shared/types';
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

function getFormula(type: string, rowIndex: number, baseCell: string) {
  const g = `G${rowIndex}`;
  let h = '', i = '', j = '';
  
  if (type === 'cafe') {
    h = `0.35*${baseCell}`;
    i = `IF(${g}<=15,0,IF(AND(15<${g},${g}<=50),(${g}-15)*0.04*${baseCell},(50-15)*0.04*${baseCell}))`;
    j = `IF(${g}<=50,0,(${g}-50)*0.02*${baseCell})`;
  } else if (type === 'restaurant') {
    h = `2.0*${baseCell}`;
    i = `IF(${g}<=50,0,IF(AND(50<${g},${g}<=100),(${g}-50)*0.05*${baseCell},(100-50)*0.05*${baseCell}))`;
    j = `IF(${g}<=100,0,(${g}-100)*0.03*${baseCell})`;
  } else if (type === 'store') {
    h = `0.35*${baseCell}`;
    i = `IF(${g}<=50,0,IF(AND(50<${g},${g}<=100),(${g}-50)*0.008*${baseCell},(100-50)*0.008*${baseCell}))`;
    j = `IF(${g}<=100,0,(${g}-100)*0.006*${baseCell})`;
  } else if (type === 'gym') {
    h = `0.5*${baseCell}`;
    i = `IF(${g}<=50,0,IF(AND(50<${g},${g}<=100),(${g}-50)*0.011*${baseCell},(100-50)*0.011*${baseCell}))`;
    j = `IF(${g}<=100,0,(${g}-100)*0.009*${baseCell})`;
  } else if (type === 'entertainment') {
    h = `0.7*${baseCell}`;
    i = `IF(${g}<=200,0,IF(AND(200<${g},${g}<=500),(${g}-200)*0.003*${baseCell},(500-200)*0.003*${baseCell}))`;
    j = `IF(${g}<=500,0,(${g}-500)*0.001*${baseCell})`;
  } else if (type === 'mall') {
    h = `1.5*${baseCell}`;
    i = `IF(${g}<=200,0,IF(AND(200<${g},${g}<=500),(${g}-200)*0.003*${baseCell},(500-200)*0.003*${baseCell}))`;
    j = `IF(${g}<=500,0,(${g}-500)*0.002*${baseCell})`;
  } else if (type === 'supermarket') {
    h = `1.25*${baseCell}`;
    i = `IF(${g}<=500,0,IF(AND(500<${g},${g}<=1000),(${g}-500)*0.003*${baseCell},(1000-500)*0.003*${baseCell}))`;
    j = `IF(${g}<=1000,0,(${g}-1000)*0.002*${baseCell})`;
  } else {
    h = `0.35*${baseCell}`;
    i = `IF(${g}<=15,0,IF(AND(15<${g},${g}<=50),(${g}-15)*0.04*${baseCell},(50-15)*0.04*${baseCell}))`;
    j = `IF(${g}<=50,0,(${g}-50)*0.02*${baseCell})`;
  }
  return { h, i, j };
}

function getHeaderLabels(type: string) {
  if (type === 'cafe') {
    return { h6: 'Đến 15 m2', i6: 'Từ trên 15 m2 đến 50 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 50 m2: Cứ mỗi m2 tăng thêm', h7: '0,35/15 m2', i7: '0.04/m2', j7: '0.02/m2' };
  } else if (type === 'restaurant') {
    return { h6: 'Đến 50 m2', i6: 'Từ trên 50 m2 đến 100 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 100 m2: Cứ mỗi m2 tăng thêm', h7: '2.0/50 m2', i7: '0.05/m2', j7: '0.03/m2' };
  } else if (type === 'store') {
    return { h6: 'Đến 50 m2', i6: 'Từ trên 50 m2 đến 100 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 100 m2: Cứ mỗi m2 tăng thêm', h7: '0.35/50 m2', i7: '0.008/m2', j7: '0.006/m2' };
  } else if (type === 'gym') {
    return { h6: 'Đến 50 m2', i6: 'Từ trên 50 m2 đến 100 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 100 m2: Cứ mỗi m2 tăng thêm', h7: '0.5/50 m2', i7: '0.011/m2', j7: '0.009/m2' };
  } else if (type === 'entertainment') {
    return { h6: 'Đến 200 m2', i6: 'Từ trên 200 m2 đến 500 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 500 m2: Cứ mỗi m2 tăng thêm', h7: '0.7/200 m2', i7: '0.003/m2', j7: '0.001/m2' };
  } else if (type === 'mall') {
    return { h6: 'Đến 200 m2', i6: 'Từ trên 200 m2 đến 500 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 500 m2: Cứ mỗi m2 tăng thêm', h7: '1.5/200 m2', i7: '0.003/m2', j7: '0.002/m2' };
  } else if (type === 'supermarket') {
    return { h6: 'Đến 500 m2', i6: 'Từ trên 500 m2 đến 1000 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 1000 m2: Cứ mỗi m2 tăng thêm', h7: '1.25/500 m2', i7: '0.003/m2', j7: '0.002/m2' };
  } else {
    return { h6: 'Đến 15 m2', i6: 'Từ trên 15 m2 đến 50 m2: Cứ mỗi m2 tăng thêm', j6: 'Trên 50 m2: Cứ mỗi m2 tăng thêm', h7: '0,35/15 m2', i7: '0.04/m2', j7: '0.02/m2' };
  }
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

  const mainType = payload.computedStores[0]?.type || 'cafe';
  const hlbl = getHeaderLabels(mainType);

  ws.mergeCells('A3:A7'); ws.getCell('A3').value = 'STT';
  ws.mergeCells('B3:B7'); ws.getCell('B3').value = 'TÊN THƯƠNG HIỆU';
  ws.mergeCells('C3:C7'); ws.getCell('C3').value = 'CỬA HÀNG';
  ws.mergeCells('D3:D7'); ws.getCell('D3').value = 'ĐỊA CHỈ';
  ws.mergeCells('E3:E7'); ws.getCell('E3').value = 'PHÂN LOẠI ĐÔ THỊ';
  ws.mergeCells('F3:F7'); ws.getCell('F3').value = '% ÁP DỤNG KHUNG GIÁ THEO PHÂN LOẠI ĐÔ THỊ';
  ws.mergeCells('G3:G7'); ws.getCell('G3').value = 'DIỆN TÍCH SỬ DỤNG NHẠC\n(M2)';
  
  ws.mergeCells('H3:M3'); ws.getCell('H3').value = 'PHƯƠNG THỨC TÍNH THEO NGHỊ ĐỊNH 17 - PHỤ LỤC 02\nSố tiền bản quyền (tính theo năm) = Mức lương cơ sở x Hệ số điều chỉnh';
  ws.getCell('H4').value = 'Mức lương cơ sở:';
  ws.getCell('I4').value = payload.globals.baseSalary;
  ws.getCell('J4').value = 'VNĐ';
  ws.mergeCells('K4:K7'); ws.getCell('K4').value = 'PHÍ BẢN QUYỀN CHO MỖI QUYỀN/1 ĐỊA ĐIỂM';
  ws.mergeCells('L4:M5'); ws.getCell('L4').value = 'PHÍ BẢN QUYỀN/ NĂM\n(chưa VAT)';

  ws.mergeCells('H5:J5'); ws.getCell('H5').value = 'Hệ số điều chỉnh theo định mức diện tích';
  
  ws.getCell('H6').value = hlbl.h6;
  ws.getCell('I6').value = hlbl.i6;
  ws.getCell('J6').value = hlbl.j6;
  
  ws.mergeCells('L6:L7'); ws.getCell('L6').value = 'QUYỀN TÁC GIẢ (VCPMC)';
  ws.mergeCells('M6:M7'); ws.getCell('M6').value = 'QUYỀN LIÊN QUAN\n(NCT)';

  ws.getCell('H7').value = hlbl.h7;
  ws.getCell('I7').value = hlbl.i7;
  ws.getCell('J7').value = hlbl.j7;

  ws.mergeCells('N3:N7'); ws.getCell('N3').value = 'TỔNG CHI PHÍ GIẢI PHÁP PHÁT NHẠC ĐẦY ĐỦ BẢN QUYỀN';

  for (let r = 3; r <= 7; r++) {
    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      // Ensure all header cells are styled correctly
      if (!cell.isMerged || cell.address === cell.master.address) {
        applyStyle(cell, true, alignCenter, true);
      } else {
        cell.border = borderThin;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E9E9' } };
      }
    }
  }

  let rowIdx = 8;
  const storeCount = Math.max(1, payload.computedStores.length);

  payload.computedStores.forEach((store, idx) => {
    const r = rowIdx++;
    const f = getFormula(store.type, r, '$I$4');

    ws.getCell(`A${r}`).value = { formula: `ROW()-7`, result: idx + 1 };
    ws.getCell(`B${r}`).value = store.typeLabel || 'Cửa hàng';
    ws.getCell(`C${r}`).value = store.name;
    ws.getCell(`D${r}`).value = store.name; 
    ws.getCell(`E${r}`).value = 'Loại Đặc biệt'; 
    ws.getCell(`F${r}`).value = 1;
    ws.getCell(`G${r}`).value = store.area || 0;
    ws.getCell(`H${r}`).value = { formula: f.h, result: 0 };
    ws.getCell(`I${r}`).value = { formula: f.i, result: 0 };
    ws.getCell(`J${r}`).value = { formula: f.j, result: 0 };
    ws.getCell(`K${r}`).value = { formula: `SUM(H${r}:J${r})`, result: 0 };
    ws.getCell(`L${r}`).value = { formula: `K${r}`, result: 0 };
    ws.getCell(`M${r}`).value = { formula: `K${r}`, result: 0 };
    ws.getCell(`N${r}`).value = { formula: `L${r}+M${r}`, result: 0 };

    for (let c = 1; c <= 14; c++) {
      const cell = ws.getCell(r, c);
      applyStyle(cell, false, c === 3 || c === 4 ? alignLeft : alignCenter);
      if (c >= 8) cell.numFmt = '#,##0';
    }
  });

  const sumRow = rowIdx++;
  ws.getCell(`A${sumRow}`).value = 'Tổng cộng';
  ws.mergeCells(`A${sumRow}:G${sumRow}`);
  ws.getCell(`H${sumRow}`).value = { formula: `SUM(H8:H${sumRow-1})` };
  ws.getCell(`I${sumRow}`).value = { formula: `SUM(I8:I${sumRow-1})` };
  ws.getCell(`J${sumRow}`).value = { formula: `SUM(J8:J${sumRow-1})` };
  ws.getCell(`K${sumRow}`).value = { formula: `SUM(K8:K${sumRow-1})` };
  ws.getCell(`L${sumRow}`).value = { formula: `SUM(L8:L${sumRow-1})` };
  ws.getCell(`M${sumRow}`).value = { formula: `SUM(M8:M${sumRow-1})` };
  ws.getCell(`N${sumRow}`).value = { formula: `SUM(N8:N${sumRow-1})` };

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(sumRow, c);
    applyStyle(cell, true, alignCenter);
    if (c >= 8) cell.numFmt = '#,##0';
  }

  const qtgDiscount = payload.globals.discountEnabled.qtg ? payload.globals.globalDiscounts.qtg : 0;
  const qlqDiscount = payload.globals.discountEnabled.qlq ? payload.globals.globalDiscounts.qlq : 0;

  const discRow = rowIdx++;
  ws.getCell(`A${discRow}`).value = `Mức hỗ trợ Phí Bản Quyền: QTG ${qtgDiscount}% & QLQ ${qlqDiscount}%`;
  ws.mergeCells(`A${discRow}:K${discRow}`);
  ws.getCell(`L${discRow}`).value = { formula: `L${sumRow}*${qtgDiscount}%` };
  ws.getCell(`M${discRow}`).value = { formula: `M${sumRow}*${qlqDiscount}%` };
  ws.getCell(`N${discRow}`).value = { formula: `L${discRow}+M${discRow}` };

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(discRow, c);
    applyStyle(cell, false, c === 1 ? alignLeft : alignCenter);
    if (c >= 12) cell.numFmt = '#,##0';
  }

  const netRow = rowIdx++;
  ws.getCell(`A${netRow}`).value = 'Tổng giá trị phải thanh toán Phí Bản Quyền (chưa bao gồm VAT):';
  ws.mergeCells(`A${netRow}:K${netRow}`);
  ws.getCell(`L${netRow}`).value = { formula: `L${sumRow}-L${discRow}` };
  ws.getCell(`M${netRow}`).value = { formula: `M${sumRow}-M${discRow}` };
  ws.getCell(`N${netRow}`).value = { formula: `N${sumRow}-N${discRow}` };

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(netRow, c);
    applyStyle(cell, true, c === 1 ? alignLeft : alignCenter, true);
    if (c >= 12) cell.numFmt = '#,##0';
  }

  const avgRow = rowIdx++;
  ws.getCell(`A${avgRow}`).value = 'Mức Phí Bản Quyền trung bình trên từng cửa hàng (chưa bao gồm VAT):';
  ws.mergeCells(`A${avgRow}:K${avgRow}`);
  ws.getCell(`L${avgRow}`).value = { formula: `L${netRow}/${storeCount}` };
  ws.getCell(`M${avgRow}`).value = { formula: `M${netRow}/${storeCount}` };
  ws.getCell(`N${avgRow}`).value = { formula: `N${netRow}/${storeCount}` };

  for (let c = 1; c <= 14; c++) {
    const cell = ws.getCell(avgRow, c);
    applyStyle(cell, false, c === 1 ? alignLeft : alignCenter);
    if (c >= 12) cell.numFmt = '#,##0';
  }

  rowIdx++;
  const platformRows = [
    payload.totals.subtotalAccountOriginal > 0
      ? {
          title: 'Phí sử dụng tài khoản',
          detail:
            payload.globals.accountFeeMode === 'standalone' && !payload.globals.hasQTG && !payload.globals.hasQLQ
              ? 'Tài khoản độc lập: 1.500.000 VND/năm/cửa hàng; chỉ áp dụng khi không tính Quyền tác giả và Quyền liên quan.'
              : 'Tài khoản NCT: 600.000 VND/năm, prorated theo thời hạn từng chi nhánh.',
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
          title: payload.globals.boxMode === 'buy' ? 'Box phát nhạc - Mua' : 'Box phát nhạc - Thuê',
          detail:
            payload.globals.boxMode === 'buy'
              ? 'Mua thiết bị: 2.000.000 VND/thiết bị, chi phí một lần.'
              : 'Thuê thiết bị: 900.000 VND/năm/thiết bị, prorated theo thời hạn và có thể áp dụng chiết khấu giao diện.',
          scope: `${storeCount * Math.max(1, Number(payload.globals.globalBoxCount) || 1)} box`,
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
