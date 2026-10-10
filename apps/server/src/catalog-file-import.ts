import { createHash } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { catalogMetadataSchema, type CatalogItem, type CatalogMetadata } from '@firelaunch/contracts';
import { RepositoryError } from './repository.js';

export type FileFormat = 'csv' | 'json';
export type ImportedRow = { line: number; externalId: string; rawExternalId?: string; kind: CatalogItem['kind']; metadata: CatalogMetadata };
export type ImportIssue = { line: number; code: 'INVALID' | 'DUPLICATE' | 'AMBIGUOUS'; message: string };
export type ParsedFile = { rows: ImportedRow[]; issues: ImportIssue[]; fingerprint: string };
const MAX_BYTES = 512_000;
const MAX_ROWS = 1000;
const MAX_CELLS = 8;
const HEADERS = ['externalId', 'rawExternalId', 'kind', 'title', 'description', 'artworkUrl'];

function bad(message: string): never { throw new RepositoryError('INVALID_INPUT', message); }

function csvRecords(content: string): { line: number; cells: string[] }[] {
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], cell = '', line = 1, start = 1, quoted = false, closed = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else { cell += char; if (char === '\n') line++; }
      continue;
    }
    if (char === '"') { if (cell || closed) bad(`Malformed CSV at line ${line}`); quoted = true; continue; }
    if (char === ',' || char === '\n' || char === '\r') {
      cells.push(cell); cell = ''; closed = false;
      if (cells.length > MAX_CELLS) bad('Too many CSV columns');
      if (char !== ',') {
        if (char === '\r' && content[i + 1] === '\n') i++;
        records.push({ line: start, cells }); cells = []; line++; start = line;
        if (records.length > MAX_ROWS + 1) bad('Too many rows');
      }
      continue;
    }
    if (closed) bad(`Malformed CSV at line ${line}`);
    cell += char;
  }
  if (quoted) bad('Unclosed CSV quote');
  if (cell || closed || cells.length) records.push({ line: start, cells: [...cells, cell] });
  return records;
}

function rawRows(format: FileFormat, content: string): { line: number; value: unknown }[] {
  if (format === 'csv') {
    const records = csvRecords(content);
    const header = records.shift()?.cells;
    if (!header || header.length !== new Set(header).size || header.some(key => !HEADERS.includes(key)) ||
      !['externalId', 'kind', 'title'].every(key => header.includes(key))) bad('Expected unique CSV headers externalId,kind,title with optional description,artworkUrl');
    return records.map(record => ({ line: record.line, value: record.cells.length === header.length
      ? Object.fromEntries(header.map((key, index) => [key, record.cells[index]])) : null }));
  }
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return bad('Malformed JSON'); }
  if (!Array.isArray(parsed)) bad('Expected a JSON array');
  if (parsed.length > MAX_ROWS) bad('Too many rows');
  // File rows are flat records. Reject nested structures before field validation.
  if (parsed.some(value => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).some(field => field !== null && typeof field === 'object'))) bad('Nested JSON records are unsupported');
  return parsed.map((value, index) => ({ line: index + 1, value }));
}

export function parseCatalogFile(format: FileFormat, content: string, sourceId: string): ParsedFile {
  if (!['csv', 'json'].includes(format)) bad('Unsupported file format');
  const bytes = new TextEncoder().encode(content);
  if (bytes.length > MAX_BYTES) bad('File exceeds 512000 bytes');
  if (new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== content || content.includes('\u0000') || content.startsWith('\uFEFF')) bad('Invalid UTF-8 text');
  const fingerprint = createHash('sha256').update(JSON.stringify([format, sourceId, content])).digest('hex');
  const rows: ImportedRow[] = [], issues: ImportIssue[] = [];
  const seen = new Map<string, ImportedRow>();
  for (const { line, value } of rawRows(format, content)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { issues.push({ line, code: 'INVALID', message: 'Expected a row object with matching columns' }); continue; }
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some(key => !HEADERS.includes(key))) { issues.push({ line, code: 'INVALID', message: 'Unknown field' }); continue; }
    const externalId = typeof record.externalId === 'string' ? record.externalId.normalize('NFC').trim() : '';
    const kind = record.kind;
    const metadata = catalogMetadataSchema.safeParse({ title: record.title,
      ...(record.description === undefined || record.description === '' ? {} : { description: record.description }),
      ...(record.artworkUrl === undefined || record.artworkUrl === '' ? {} : { artworkUrl: record.artworkUrl }) });
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(externalId) ||
      !['video', 'audio', 'book', 'listing'].includes(String(kind)) || !metadata.success) {
      issues.push({ line, code: 'INVALID', message: 'Invalid externalId, kind, title or metadata' }); continue;
    }
    const rawExternalId = record.rawExternalId;
    if (rawExternalId !== undefined && (typeof rawExternalId !== 'string' || !rawExternalId || rawExternalId.length > 2048)) {
      issues.push({ line, code: 'INVALID', message: 'Invalid raw source identifier' }); continue;
    }
    const row: ImportedRow = { line, externalId, ...(rawExternalId ? { rawExternalId } : {}), kind: kind as ImportedRow['kind'], metadata: metadata.data };
    const prior = seen.get(externalId);
    if (prior) {
      issues.push({ line, code: JSON.stringify({ kind: prior.kind, metadata: prior.metadata, rawExternalId: prior.rawExternalId }) === JSON.stringify({ kind: row.kind, metadata: row.metadata, rawExternalId: row.rawExternalId }) ? 'DUPLICATE' : 'AMBIGUOUS', message: `Repeated externalId ${externalId}` });
      continue;
    }
    seen.set(externalId, row); rows.push(row);
  }
  return { rows, issues, fingerprint };
}
