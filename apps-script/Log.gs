/**
 * CEA-3: one row per thread the sorter labels, in the tab named by LOG_TAB.
 * Columns are matched by header name, so they can be reordered in the sheet.
 * A thread ID already in the log is never written again.
 */
const LOG_HEADERS = ['Logged At', 'Date Received', 'From', 'Subject', 'Sub-label', 'Rule', 'Thread Link', 'Thread ID'];

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
  const seen = new Set();
  if (lastRow > 1) {
    sheet.getRange(2, col['Thread ID'] + 1, lastRow - 1, 1).getValues()
      .forEach(r => { if (r[0]) seen.add(String(r[0])); });
  }

  const loggedAt = new Date();
  const rows = [];
  entries.forEach(e => {
    if (seen.has(e.threadId)) return;
    seen.add(e.threadId);
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
