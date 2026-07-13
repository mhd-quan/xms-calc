import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BUSINESS_TYPES, DEFAULT_BASE_SALARY } from '../shared/calculator';
import { normalizeCopyrightMode } from '../shared/copyright';
import type { EmbeddedManifest } from '../shared/types';
import { EXCEL_MANIFEST_CELL, EXCEL_MANIFEST_SHEET } from './excel-exporter';
import { validateManifestSchema } from './pdf-import-service';
import { EMBEDDED_PAYLOAD_SCHEMA_VERSION } from './quote-identity-service';
import { normalizeCalcOptions, normalizeProfile, normalizeStores, normalizePreparedBy } from './quote-payload';

export function createExcelFingerprint(fileBytes: Uint8Array): string {
  return crypto.createHash('sha256').update(fileBytes).digest('hex');
}

export async function extractManifestFromExcelFile(
  filePath: string
): Promise<{ manifest: EmbeddedManifest; fingerprint: string; filePath: string; fileName: string }> {
  const fileBytes = await fs.readFile(filePath);
  const fingerprint = createExcelFingerprint(fileBytes);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const embeddedManifest = readEmbeddedManifest(wb);
  if (embeddedManifest) {
    return {
      manifest: embeddedManifest,
      fingerprint,
      filePath,
      fileName: path.basename(filePath)
    };
  }

  const ws = wb.worksheets[0];

  if (!ws) {
    throw new Error('File Excel không có trang tính (worksheet) nào hợp lệ.');
  }

  // Khôi phục Base Salary
  let baseSalary = DEFAULT_BASE_SALARY;
  const baseSalaryCell = ws.getCell('I4').value;
  if (baseSalaryCell != null && !isNaN(Number(baseSalaryCell))) {
    baseSalary = Number(baseSalaryCell);
  }

  const qtgHeader = cellText(ws.getCell('L6').value).toUpperCase();
  const copyrightMode = normalizeCopyrightMode(
    qtgHeader.includes('NCT') || qtgHeader.includes('QSC') ? 'qsc' : 'qlq'
  );

  // Khôi phục Danh sách Cửa hàng
  const stores = [];
  let rowIndex = 8;

  // Lặp qua các dòng cho đến khi gặp dòng có chữ "Tổng cộng" ở cột A
  while (rowIndex < 1000) {
    const sttCell = ws.getCell(`A${rowIndex}`);
    let sttValue = sttCell.value;
    if (sttValue && typeof sttValue === 'object' && 'result' in sttValue) {
      sttValue = sttValue.result;
    }
    
    // Nếu STT là "Tổng cộng" thì dừng
    if (String(sttValue).includes('Tổng cộng')) {
      break;
    }
    
    // Nếu STT rỗng, có thể là dòng trống, tiếp tục hoặc dừng tùy ý. Chúng ta dừng cho chắc.
    if (!sttValue) {
      break;
    }

    const typeLabelCell = ws.getCell(`B${rowIndex}`).value;
    const nameCell = ws.getCell(`C${rowIndex}`).value;
    const areaCell = ws.getCell(`G${rowIndex}`).value;

    let area = 0;
    if (areaCell && typeof areaCell === 'object' && 'result' in areaCell) {
      area = Number(areaCell.result) || 0;
    } else {
      area = Number(areaCell) || 0;
    }

    const typeLabel = cellText(typeLabelCell);
    const name = cellText(nameCell);

    // Map typeLabel to type key
    let typeKey = 'cafe';
    for (const [key, val] of Object.entries(BUSINESS_TYPES)) {
      if (val.label === typeLabel) {
        typeKey = key;
        break;
      }
    }

    stores.push({
      name: name || `Chi nhánh ${stores.length + 1}`,
      type: typeKey,
      area: area,
      startDate: '',
      endDate: ''
    });

    rowIndex++;
  }

  // Tìm thông tin Discount
  let qtgDiscount = 0;
  let qlqDiscount = 0;
  for (let r = rowIndex; r <= rowIndex + 5; r++) {
    let aValue = ws.getCell(`A${r}`).value;
    if (aValue && typeof aValue === 'object' && 'result' in aValue) {
      aValue = aValue.result;
    }
    const aStr = String(aValue || '');
    const match = aStr.match(/QTG (\d+(\.\d+)?)% & QLQ (\d+(\.\d+)?)%/);
    if (match) {
      qtgDiscount = Number(match[1]);
      qlqDiscount = Number(match[3]);
      break;
    }
  }

  // Giả lập Manifest
  const manifest: EmbeddedManifest = {
    schemaVersion: EMBEDDED_PAYLOAD_SCHEMA_VERSION,
    appVersion: 'imported-from-excel',
    quoteIdentity: {
      quoteCode: '',
      revisionNumber: 0,
      displayQuoteNumber: 'EXCEL-IMPORT'
    },
    quoteDate: new Date().toISOString(),
    customer: normalizeProfile({}),
    preparedBy: normalizePreparedBy({}),
    calcOptions: normalizeCalcOptions({
      baseSalary,
      copyrightMode,
      hasAccountFee: false, // Export Excel không có phí duy trì
      hasWebsiteFee: false,
      hasQTG: true,
      hasQLQ: true,
      boxMode: 'none', // Không có phí box
      accountFeeMode: 'standard',
      platformFeeMode: 'website',
      globalPlatformStoreCount: 1,
      globalDiscounts: {
        account: 0,
        website: 0,
        box: 0,
        qtg: qtgDiscount,
        qlq: qlqDiscount
      },
      discountEnabled: {
        account: false,
        website: false,
        box: false,
        qtg: qtgDiscount > 0,
        qlq: qlqDiscount > 0
      }
    }),
    stores: normalizeStores(stores),
    totals: {},
    exportedAt: new Date().toISOString(),
    pdfFingerprintSource: 'sha256:file'
  };

  return { manifest, fingerprint, filePath, fileName: path.basename(filePath) };
}

function cellResult(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('text' in value) return value.text;
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
  }
  return value;
}

function cellText(value: ExcelJS.CellValue): string {
  return String(cellResult(value) ?? '').trim();
}

function readEmbeddedManifest(workbook: ExcelJS.Workbook): EmbeddedManifest | null {
  const manifestSheet = workbook.getWorksheet(EXCEL_MANIFEST_SHEET);
  if (!manifestSheet) return null;

  const rawManifest = cellText(manifestSheet.getCell(EXCEL_MANIFEST_CELL).value);
  if (!rawManifest) {
    throw new Error('Workbook có manifest XMS nhưng nội dung bị rỗng.');
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(rawManifest);
  } catch {
    throw new Error('Workbook có manifest XMS nhưng JSON bị hỏng.');
  }

  validateManifestSchema(manifest);
  return manifest;
}
