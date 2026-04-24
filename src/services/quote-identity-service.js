(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BDQuoteIdentityService = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const QUOTE_CODE_PREFIX = 'XMS';
  const EMBEDDED_PAYLOAD_SCHEMA_VERSION = '1.6';

  function padSequence(sequenceNumber) {
    return String(sequenceNumber).padStart(3, '0');
  }

  function formatDateSegment(dateInput = new Date()) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  function generateBaseQuoteCode(dateInput, sequenceNumber) {
    return `${QUOTE_CODE_PREFIX}-${formatDateSegment(dateInput)}-${padSequence(sequenceNumber)}`;
  }

  function formatRevisionLabel(revisionNumber) {
    return Number(revisionNumber) > 0 ? `R${Number(revisionNumber)}` : '';
  }

  function formatDisplayQuoteNumber(quoteCode, revisionNumber) {
    const revisionLabel = formatRevisionLabel(revisionNumber);
    return revisionLabel ? `${quoteCode}-${revisionLabel}` : quoteCode;
  }

  function computeNextRevisionNumber(currentRevisionNumber) {
    return Math.max(0, Number(currentRevisionNumber) || 0) + 1;
  }

  function buildQuoteIdentity(quoteCode, revisionNumber) {
    return {
      quoteCode,
      revisionNumber: Number(revisionNumber) || 0,
      revisionLabel: formatRevisionLabel(revisionNumber),
      displayQuoteNumber: formatDisplayQuoteNumber(quoteCode, revisionNumber)
    };
  }

  function getQuoteSequencePrefix(dateInput = new Date()) {
    return `${QUOTE_CODE_PREFIX}-${formatDateSegment(dateInput)}-`;
  }

  return {
    EMBEDDED_PAYLOAD_SCHEMA_VERSION,
    QUOTE_CODE_PREFIX,
    buildQuoteIdentity,
    computeNextRevisionNumber,
    formatDisplayQuoteNumber,
    formatRevisionLabel,
    generateBaseQuoteCode,
    getQuoteSequencePrefix
  };
});
