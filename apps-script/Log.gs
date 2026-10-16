/**
 * CEA-3: one row per classified message, in the tab named by LOG_TAB.
 * Columns are matched by header name, so they can be reordered in the sheet.
 * CEA-9: the "already logged" key is Thread ID + Date Received, so a new message in a
 * thread gets its own row while the same message is never written twice.
 */
const LOG_HEADERS = ['Logged At', 'Date Received', 'From', 'Subject', 'Sub-label', 'Rule', 'Thread Link', 'Thread ID'];

/** CEA-4 writes each saved PDF's link here; saveResponses_ adds the column if it's missing. */
const DRIVE_LINK_HEADER = 'Drive Link';

function appendLog_(cfg, entries) {
  if (!entries.length) return 0;
  const ss = SpreadsheetApp.openById(cfg.rulesSheetId);
  let sheet = ss.getSheetByName(cfg.logTab);
  if (!sheet) {
    sheet = ss.insertSheet(cfg.logTab);
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const col = {};
  LOG_HEADERS.forEach(h => {
    const i = header.indexOf(h);
    if (i < 0) throw new Error('Log tab is missing the "' + h + '" column');
    col[h] = i;
  });

  const lastRow = sheet.getLastRow();
  const seen = readLogged_(sheet, col);

  const loggedAt = new Date();
  const rows = [];
  entries.forEach(e => {
    const key = logKey_(e.threadId, e.date);
    if (seen.has(key)) return;
    seen.add(key);
    const row = new Array(lastCol).fill('');
    row[col['Logged At']] = loggedAt;
    row[col['Date Received']] = e.date;
    row[col['From']] = e.from;
    row[col['Subject']] = e.subject;
    row[col['Sub-label']] = e.category;
    row[col['Rule']] = e.rule;
    row[col['Thread Link']] = e.link;
    row[col['Thread ID']] = e.threadId;
    rows.push(row);
  });
  if (rows.length) sheet.getRange(lastRow + 1, 1, rows.length, lastCol).setValues(rows);
  return rows.length;
}

/** Set of message keys (Thread ID + Date Received, see logKey_) already in the log. */
function loggedMessages_(cfg) {
  const sheet = SpreadsheetApp.openById(cfg.rulesSheetId).getSheetByName(cfg.logTab);
  if (!sheet) return new Set();
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const col = {};
  ['Date Received', 'Thread ID'].forEach(h => {
    const i = header.indexOf(h);
    if (i < 0) throw new Error('Log tab is missing the "' + h + '" column');
    col[h] = i;
  });
  return readLogged_(sheet, col);
}

function readLogged_(sheet, col) {
  const keys = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return keys;
  const width = Math.max(col['Date Received'], col['Thread ID']) + 1;
  sheet.getRange(2, 1, lastRow - 1, width).getValues().forEach(r => {
    const id = String(r[col['Thread ID']]).trim();
    if (id) keys.add(logKey_(id, r[col['Date Received']]));
  });
  return keys;
}

/** Thread ID + message date to the second (Sheets drops milliseconds on a stored date). */
function logKey_(threadId, date) {
  const ms = toMs_(date);
  return String(threadId) + '|' + (isNaN(ms) ? 'undated' : Math.floor(ms / 1000));
}

function toMs_(date) {
  return (date instanceof Date ? date : new Date(date)).getTime();
}
