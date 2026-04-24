const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const {
  buildQuoteIdentity,
  computeNextRevisionNumber,
  formatDisplayQuoteNumber
} = require('./quote-identity-service');

function nowIso() {
  return new Date().toISOString();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function deriveRevisionStatus(row) {
  if (row.exported_at) return 'exported';
  if (row.source === 'import_pdf') return 'imported';
  return 'draft';
}

class QuoteRepository {
  constructor(dbPath) {
    ensureParentDir(dbPath);
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_code TEXT NOT NULL UNIQUE,
        current_revision_number INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quote_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        revision_number INTEGER NOT NULL,
        display_quote_number TEXT NOT NULL,
        source TEXT NOT NULL,
        customer_json TEXT NOT NULL,
        prepared_by_json TEXT NOT NULL,
        calc_options_json TEXT NOT NULL,
        stores_json TEXT NOT NULL,
        totals_json TEXT NOT NULL,
        embedded_payload_version TEXT,
        pdf_file_path TEXT,
        pdf_fingerprint TEXT,
        exported_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
        UNIQUE (quote_id, revision_number)
      );
    `);
  }

  close() {
    this.db.close();
  }

  serializeSnapshot(snapshot) {
    return {
      customer_json: JSON.stringify(snapshot.customer || {}),
      prepared_by_json: JSON.stringify(snapshot.preparedBy || {}),
      calc_options_json: JSON.stringify(snapshot.calcOptions || {}),
      stores_json: JSON.stringify(snapshot.stores || []),
      totals_json: JSON.stringify(snapshot.totals || {})
    };
  }

  hydrateRevisionRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      quoteId: row.quote_id,
      quoteCode: row.quote_code,
      revisionNumber: row.revision_number,
      displayQuoteNumber: row.display_quote_number,
      source: row.source,
      customer: safeParseJson(row.customer_json, {}),
      preparedBy: safeParseJson(row.prepared_by_json, {}),
      calcOptions: safeParseJson(row.calc_options_json, {}),
      stores: safeParseJson(row.stores_json, []),
      totals: safeParseJson(row.totals_json, {}),
      embeddedPayloadVersion: row.embedded_payload_version,
      pdfFilePath: row.pdf_file_path,
      pdfFingerprint: row.pdf_fingerprint,
      exportedAt: row.exported_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: deriveRevisionStatus(row),
      quoteIdentity: buildQuoteIdentity(row.quote_code, row.revision_number)
    };
  }

  createQuote({ quoteCode, revisionNumber = 0, status = 'draft' }) {
    const timestamp = nowIso();
    const result = this.db.prepare(`
      INSERT INTO quotes (
        quote_code,
        current_revision_number,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(quoteCode, revisionNumber, status, timestamp, timestamp);
    return Number(result.lastInsertRowid);
  }

  touchQuote(quoteId, revisionNumber, status) {
    this.db.prepare(`
      UPDATE quotes
      SET current_revision_number = MAX(current_revision_number, ?),
          status = ?,
          updated_at = ?
      WHERE id = ?
    `).run(revisionNumber, status, nowIso(), quoteId);
  }

  createRevision({
    quoteId,
    quoteCode,
    revisionNumber,
    source,
    snapshot,
    embeddedPayloadVersion = null,
    pdfFilePath = null,
    pdfFingerprint = null,
    exportedAt = null
  }) {
    const timestamp = nowIso();
    const serialized = this.serializeSnapshot(snapshot);
    const displayQuoteNumber = formatDisplayQuoteNumber(quoteCode, revisionNumber);
    const result = this.db.prepare(`
      INSERT INTO quote_revisions (
        quote_id,
        revision_number,
        display_quote_number,
        source,
        customer_json,
        prepared_by_json,
        calc_options_json,
        stores_json,
        totals_json,
        embedded_payload_version,
        pdf_file_path,
        pdf_fingerprint,
        exported_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId,
      revisionNumber,
      displayQuoteNumber,
      source,
      serialized.customer_json,
      serialized.prepared_by_json,
      serialized.calc_options_json,
      serialized.stores_json,
      serialized.totals_json,
      embeddedPayloadVersion,
      pdfFilePath,
      pdfFingerprint,
      exportedAt,
      timestamp,
      timestamp
    );
    this.touchQuote(quoteId, revisionNumber, exportedAt ? 'exported' : source === 'import_pdf' ? 'imported' : 'draft');
    return this.getRevisionById(Number(result.lastInsertRowid));
  }

  updateRevisionSnapshot({ revisionId, snapshot }) {
    const serialized = this.serializeSnapshot(snapshot);
    const timestamp = nowIso();
    this.db.prepare(`
      UPDATE quote_revisions
      SET customer_json = ?,
          prepared_by_json = ?,
          calc_options_json = ?,
          stores_json = ?,
          totals_json = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      serialized.customer_json,
      serialized.prepared_by_json,
      serialized.calc_options_json,
      serialized.stores_json,
      serialized.totals_json,
      timestamp,
      revisionId
    );
    this.db.prepare(`
      UPDATE quotes
      SET status = 'draft',
          updated_at = ?
      WHERE id = (
        SELECT quote_id
        FROM quote_revisions
        WHERE id = ?
      )
    `).run(timestamp, revisionId);
    return {
      revisionId,
      updatedAt: timestamp
    };
  }

  replaceRevisionFromImport({
    revisionId,
    snapshot,
    embeddedPayloadVersion,
    pdfFilePath,
    pdfFingerprint,
    exportedAt
  }) {
    const revision = this.getRevisionById(revisionId);
    if (!revision) return null;
    const serialized = this.serializeSnapshot(snapshot);
    this.db.prepare(`
      UPDATE quote_revisions
      SET source = 'import_pdf',
          customer_json = ?,
          prepared_by_json = ?,
          calc_options_json = ?,
          stores_json = ?,
          totals_json = ?,
          embedded_payload_version = ?,
          pdf_file_path = ?,
          pdf_fingerprint = ?,
          exported_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      serialized.customer_json,
      serialized.prepared_by_json,
      serialized.calc_options_json,
      serialized.stores_json,
      serialized.totals_json,
      embeddedPayloadVersion,
      pdfFilePath,
      pdfFingerprint,
      exportedAt,
      nowIso(),
      revisionId
    );
    this.touchQuote(revision.quoteId, revision.revisionNumber, 'imported');
    return this.getRevisionById(revisionId);
  }

  markRevisionExported({
    revisionId,
    snapshot,
    embeddedPayloadVersion,
    pdfFilePath,
    pdfFingerprint,
    exportedAt
  }) {
    const revision = this.getRevisionById(revisionId);
    if (!revision) return null;
    const serialized = this.serializeSnapshot(snapshot);
    this.db.prepare(`
      UPDATE quote_revisions
      SET customer_json = ?,
          prepared_by_json = ?,
          calc_options_json = ?,
          stores_json = ?,
          totals_json = ?,
          embedded_payload_version = ?,
          pdf_file_path = ?,
          pdf_fingerprint = ?,
          exported_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      serialized.customer_json,
      serialized.prepared_by_json,
      serialized.calc_options_json,
      serialized.stores_json,
      serialized.totals_json,
      embeddedPayloadVersion,
      pdfFilePath,
      pdfFingerprint,
      exportedAt,
      nowIso(),
      revisionId
    );
    this.touchQuote(revision.quoteId, revision.revisionNumber, 'exported');
    return this.getRevisionById(revisionId);
  }

  createBaseQuoteRevision({ quoteCode, snapshot, source = 'new' }) {
    const quoteId = this.createQuote({ quoteCode, revisionNumber: 0 });
    return this.createRevision({
      quoteId,
      quoteCode,
      revisionNumber: 0,
      source,
      snapshot
    });
  }

  createNextRevisionFromCurrent({ revisionId, snapshot, source = 'clone' }) {
    const current = this.getRevisionById(revisionId);
    if (!current) {
      throw new Error('Cannot create revision: current revision not found');
    }
    const nextRevisionNumber = computeNextRevisionNumber(
      this.getHighestRevisionNumber(current.quoteId)
    );
    return this.createRevision({
      quoteId: current.quoteId,
      quoteCode: current.quoteCode,
      revisionNumber: nextRevisionNumber,
      source,
      snapshot
    });
  }

  getHighestRevisionNumber(quoteId) {
    const row = this.db.prepare(`
      SELECT COALESCE(MAX(revision_number), 0) AS revision_number
      FROM quote_revisions
      WHERE quote_id = ?
    `).get(quoteId);
    return Number(row?.revision_number) || 0;
  }

  getLatestDraftRevision() {
    const row = this.db.prepare(`
      SELECT r.*, q.quote_code
      FROM quote_revisions r
      INNER JOIN quotes q ON q.id = r.quote_id
      ORDER BY r.updated_at DESC
      LIMIT 1
    `).get();
    return this.hydrateRevisionRow(row);
  }

  getQuoteByCode(quoteCode) {
    const row = this.db.prepare(`
      SELECT *
      FROM quotes
      WHERE quote_code = ?
    `).get(quoteCode);
    return row
      ? {
          id: row.id,
          quoteCode: row.quote_code,
          currentRevisionNumber: row.current_revision_number,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      : null;
  }

  getRevisionByIdentity(quoteCode, revisionNumber) {
    const row = this.db.prepare(`
      SELECT r.*, q.quote_code
      FROM quote_revisions r
      INNER JOIN quotes q ON q.id = r.quote_id
      WHERE q.quote_code = ?
        AND r.revision_number = ?
      LIMIT 1
    `).get(quoteCode, revisionNumber);
    return this.hydrateRevisionRow(row);
  }

  getRevisionById(revisionId) {
    const row = this.db.prepare(`
      SELECT r.*, q.quote_code
      FROM quote_revisions r
      INNER JOIN quotes q ON q.id = r.quote_id
      WHERE r.id = ?
      LIMIT 1
    `).get(revisionId);
    return this.hydrateRevisionRow(row);
  }

  listRevisionsByQuote(quoteId) {
    const rows = this.db.prepare(`
      SELECT r.*, q.quote_code
      FROM quote_revisions r
      INNER JOIN quotes q ON q.id = r.quote_id
      WHERE r.quote_id = ?
      ORDER BY r.revision_number ASC, r.created_at ASC
    `).all(quoteId);
    return rows.map((row) => this.hydrateRevisionRow(row));
  }

  getRevisionBundle(revisionId) {
    const activeRevision = this.getRevisionById(revisionId);
    if (!activeRevision) return null;
    const quote = this.getQuoteByCode(activeRevision.quoteCode);
    return {
      quote,
      activeRevision,
      revisions: this.listRevisionsByQuote(activeRevision.quoteId)
    };
  }

  findNextSequence(prefix) {
    const rows = this.db.prepare(`
      SELECT quote_code
      FROM quotes
      WHERE quote_code LIKE ?
    `).all(`${prefix}%`);
    const maxSequence = rows.reduce((max, row) => {
      const match = /^XMS-\d{6}-(\d{3})(?:-COPY\d+)?$/.exec(row.quote_code);
      if (!match) return max;
      return Math.max(max, Number(match[1]) || 0);
    }, 0);
    return maxSequence + 1;
  }

  generateDuplicateQuoteCode(baseQuoteCode) {
    const rows = this.db.prepare(`
      SELECT quote_code
      FROM quotes
      WHERE quote_code = ?
         OR quote_code LIKE ?
    `).all(baseQuoteCode, `${baseQuoteCode}-COPY%`);
    const used = new Set(rows.map((row) => row.quote_code));
    let copyNumber = 1;
    while (used.has(`${baseQuoteCode}-COPY${copyNumber}`)) {
      copyNumber += 1;
    }
    return `${baseQuoteCode}-COPY${copyNumber}`;
  }
}

module.exports = {
  QuoteRepository
};
