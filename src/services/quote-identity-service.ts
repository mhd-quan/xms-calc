export const QUOTE_CODE_PREFIX = 'XMS';
export const EMBEDDED_PAYLOAD_SCHEMA_VERSION = '1.6';

function padSequence(sequenceNumber: number): string {
  return String(sequenceNumber).padStart(3, '0');
}

function formatDateSegment(dateInput: Date | string | number = new Date()): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function generateBaseQuoteCode(dateInput: Date | string | number, sequenceNumber: number): string {
  return `${QUOTE_CODE_PREFIX}-${formatDateSegment(dateInput)}-${padSequence(sequenceNumber)}`;
}

export function formatRevisionLabel(revisionNumber: number): string {
  return Number(revisionNumber) > 0 ? `R${Number(revisionNumber)}` : '';
}

export function formatDisplayQuoteNumber(quoteCode: string, revisionNumber: number): string {
  const revisionLabel = formatRevisionLabel(revisionNumber);
  return revisionLabel ? `${quoteCode}-${revisionLabel}` : quoteCode;
}

export function computeNextRevisionNumber(currentRevisionNumber: number): number {
  return Math.max(0, Number(currentRevisionNumber) || 0) + 1;
}

export function buildQuoteIdentity(quoteCode: string, revisionNumber: number) {
  return {
    quoteCode,
    revisionNumber: Number(revisionNumber) || 0,
    revisionLabel: formatRevisionLabel(revisionNumber),
    displayQuoteNumber: formatDisplayQuoteNumber(quoteCode, revisionNumber)
  };
}

export function getQuoteSequencePrefix(dateInput: Date | string | number = new Date()): string {
  return `${QUOTE_CODE_PREFIX}-${formatDateSegment(dateInput)}-`;
}
