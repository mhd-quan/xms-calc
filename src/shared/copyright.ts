import type { CopyrightMode, CopyrightPresentation } from './types';

export const DEFAULT_COPYRIGHT_MODE: CopyrightMode = 'qlq';

const COPYRIGHT_PRESENTATIONS: Record<CopyrightMode, CopyrightPresentation> = {
  qlq: {
    mode: 'qlq',
    label: 'QLQ',
    sectionDescription: 'QLQ · Quyền tác giả VCPMC + Quyền liên quan NCT.',
    qtgProvider: 'VCPMC',
    qlqProvider: 'NCT',
    qtgUiDescription:
      'Phí quyền tác giả qua VCPMC. Tính theo diện tích × hệ số × thời gian.',
    qlqUiDescription:
      'Phí quyền liên quan qua NCT. Tính theo diện tích × hệ số × thời gian.',
    qtgExportDescription: 'Quyền tác giả âm nhạc do VCPMC quản lý và cấp phép',
    qlqExportDescription:
      'Quyền liên quan đối với bản ghi, bản thu âm do NCT Media cung cấp',
    qtgWorkbookHeader: 'QUYỀN TÁC GIẢ (VCPMC)',
    qlqWorkbookHeader: 'QUYỀN LIÊN QUAN\n(NCT)'
  },
  qsc: {
    mode: 'qsc',
    label: 'QSC',
    sectionDescription: 'QSC · Quyền tác giả + Quyền liên quan do NCT cung cấp.',
    qtgProvider: 'NCT',
    qlqProvider: 'NCT',
    qtgUiDescription:
      'Phí quyền tác giả do NCT cung cấp theo phương án QSC. Tính theo diện tích × hệ số × thời gian.',
    qlqUiDescription:
      'Phí quyền liên quan do NCT cung cấp theo phương án QSC. Tính theo diện tích × hệ số × thời gian.',
    qtgExportDescription:
      'Quyền tác giả âm nhạc do NCT Media cung cấp theo phương án QSC',
    qlqExportDescription:
      'Quyền liên quan đối với bản ghi, bản thu âm do NCT Media cung cấp theo phương án QSC',
    qtgWorkbookHeader: 'QUYỀN TÁC GIẢ\n(NCT · QSC)',
    qlqWorkbookHeader: 'QUYỀN LIÊN QUAN\n(NCT · QSC)'
  }
};

export function normalizeCopyrightMode(value: unknown): CopyrightMode {
  return value === 'qsc' ? 'qsc' : DEFAULT_COPYRIGHT_MODE;
}

export function getCopyrightPresentation(value: unknown): CopyrightPresentation {
  return COPYRIGHT_PRESENTATIONS[normalizeCopyrightMode(value)];
}
