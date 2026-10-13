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

/** Installs the hourly trigger for sortJobSearch, replacing any existing one. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sortJobSearch')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sortJobSearch').timeBased().everyHours(1).create();
  Logger.log('Hourly trigger installed for sortJobSearch.');
}
