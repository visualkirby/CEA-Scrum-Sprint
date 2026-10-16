/**
 * One-time setup, run from the editor after the Script Properties are filled in.
 * Names the rules tab if the sheet still has its single default tab, then checks the rules load.
 */
function setup() {
  const cfg = getConfig_();
  const ss = SpreadsheetApp.openById(cfg.rulesSheetId);
  if (!ss.getSheetByName(cfg.rulesTab)) {
    const sheets = ss.getSheets();
    if (sheets.length !== 1) {
      throw new Error('No tab named ' + cfg.rulesTab + ' and more than one tab exists; rename the rules tab by hand.');
    }
    const oldName = sheets[0].getName();
    sheets[0].setName(cfg.rulesTab);
    Logger.log('Renamed tab "%s" to "%s"', oldName, cfg.rulesTab);
  }
  const loaded = loadRules_(cfg);
  Logger.log('Loaded %s rules across categories: %s', loaded.rules.length, loaded.categories.join(', '));
}

/**
 * CEA-4 one-time setup. Fills any missing CEA-4 Script Properties with their defaults,
 * creates the "Job Search Responses" folder in My Drive if RESPONSES_FOLDER_ID is unset,
 * and creates the Senders tab, then adds any starter row whose domain isn't on it yet.
 * Existing values, tabs and rows are left alone, so it is safe to run again.
 */
function setupResponses() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const defaults = {
    RESPONSE_CATEGORIES: 'Confirmation,Recruiter,Interview,Rejection,Offer',
    UNSORTED_FOLDER: '_Unsorted',
    SENDERS_TAB: 'Senders',
    MAX_SAVES_PER_RUN: '25'
  };
  Object.keys(defaults).forEach(k => { if (!props[k]) setConfig_(k, defaults[k]); });

  if (!props.RESPONSES_FOLDER_ID) {
    const folder = DriveApp.createFolder('Job Search Responses');
    setConfig_('RESPONSES_FOLDER_ID', folder.getId());
    Logger.log('Created folder %s', folder.getUrl());
  }

  const cfg = getConfig_();
  const ss = SpreadsheetApp.openById(cfg.rulesSheetId);
  let sheet = ss.getSheetByName(cfg.sendersTab);
  if (!sheet) {
    sheet = ss.insertSheet(cfg.sendersTab);
    sheet.getRange(1, 1, 1, 2).setValues([['Domain', 'Company']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Created %s tab.', cfg.sendersTab);
  }
  const starter = [
    'myworkday.com', 'myworkdayjobs.com', 'greenhouse.io', 'greenhouse-mail.io', 'icims.com',
    'lever.co', 'hire.lever.co', 'indeed.com', 'indeedemail.com', 'linkedin.com', 'smartrecruiters.com',
    'jobvite.com', 'taleo.net', 'successfactors.com', 'ziprecruiter.com', 'clinchtalent.com',
    'paylocity.com', 'paycomonline.net', 'ultipro.com', 'adp.com', 'appone.com', 'applytojob.com',
    'bamboohr.com', 'paradox.ai'
  ].map(d => [d, 'ATS']).concat([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'
  ].map(d => [d, 'UNSORTED'])).concat([
    ['pg.com', 'P&G']
  ]);
  const have = new Set(Object.keys(loadSenders_(ss, cfg.sendersTab)));
  const add = starter.filter(r => !have.has(r[0]));
  if (add.length) sheet.getRange(sheet.getLastRow() + 1, 1, add.length, 2).setValues(add);
  Logger.log('Senders tab: added %s starter rows.', add.length);
  checkConfig();
}

/** CEA-9 one-time setup: sets RECHECK_DAYS to 2 if it isn't set. Safe to run again. */
function setupRecheck() {
  const props = PropertiesService.getScriptProperties().getProperties();
  if (!props.RECHECK_DAYS) setConfig_('RECHECK_DAYS', '2');
  checkConfig();
}

/**
 * Test helper for CEA-4: moves every PDF linked in the log's Drive Link column to the Drive
 * trash (recoverable for 30 days) and clears those cells, so saveResponses() redoes them.
 */
function resetSavedResponses() {
  const cfg = getConfig_();
  const sheet = SpreadsheetApp.openById(cfg.rulesSheetId).getSheetByName(cfg.logTab);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const c = header.indexOf(DRIVE_LINK_HEADER);
  if (c < 0 || sheet.getLastRow() < 2) { Logger.log('Nothing to reset.'); return; }
  const range = sheet.getRange(2, c + 1, sheet.getLastRow() - 1, 1);
  let trashed = 0;
  const cleared = range.getValues().map(r => {
    const m = String(r[0]).match(/\/d\/([\w-]+)/) || String(r[0]).match(/[?&]id=([\w-]+)/);
    if (m) { DriveApp.getFileById(m[1]).setTrashed(true); trashed++; }
    return [''];
  });
  range.setValues(cleared);
  let folders = 0;
  const it = DriveApp.getFolderById(cfg.responsesFolderId).getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (!f.getFiles().hasNext() && !f.getFolders().hasNext()) { f.setTrashed(true); folders++; }
  }
  Logger.log('Trashed %s PDFs and %s empty company folders; cleared the Drive Link column.', trashed, folders);
}

/** Installs the hourly trigger for sortJobSearch, replacing any existing one. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sortJobSearch')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sortJobSearch').timeBased().everyHours(1).create();
  Logger.log('Hourly trigger installed for sortJobSearch.');
}
