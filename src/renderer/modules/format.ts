export const formatVND = (value: number | string): string =>
  new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0));
