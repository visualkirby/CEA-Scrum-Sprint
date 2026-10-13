/**
 * Settings live in Script Properties (Project Settings > Script Properties).
 * Nothing here is hardcoded: checkConfig() lists anything missing.
 *
 *   RULES_SHEET_ID       ID of the "CEA Job Search Sorter" spreadsheet
 *   RULES_TAB            tab holding the rules (Order, Category, Field, Contains)
 *   PARENT_LABEL         Gmail label the sorter reads from, e.g. Job Search
 *   REVIEW_CATEGORY      sub-label for anything no rule places, e.g. Review
 *   MAX_THREADS_PER_RUN  threads sorted per run (Gmail search returns at most 500)
 *   BODY_CHARS           how much of the newest message body the rules read
 */
const CONFIG_KEYS = [
  'RULES_SHEET_ID',
  'RULES_TAB',
  'PARENT_LABEL',
  'REVIEW_CATEGORY',
  'MAX_THREADS_PER_RUN',
  'BODY_CHARS'
];

function getConfig_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const missing = CONFIG_KEYS.filter(k => !props[k]);
  if (missing.length) {
    throw new Error('Missing Script Properties: ' + missing.join(', '));
  }
  return {
    rulesSheetId: props.RULES_SHEET_ID,
    rulesTab: props.RULES_TAB,
    parentLabel: props.PARENT_LABEL,
    reviewCategory: props.REVIEW_CATEGORY,
    maxThreads: Number(props.MAX_THREADS_PER_RUN),
    bodyChars: Number(props.BODY_CHARS)
  };
}

/** Run from the editor: logs each setting, or what is missing. */
function checkConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  CONFIG_KEYS.forEach(k => Logger.log('%s = %s', k, props[k] || '(missing)'));
}
