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
 *   LOG_TAB              tab in the same spreadsheet where each sorted thread is logged (CEA-3)
 *   RESPONSES_FOLDER_ID  Drive folder "Job Search Responses"; setupResponses() creates it (CEA-4)
 *   RESPONSE_CATEGORIES  comma list of sub-labels saved as PDFs, e.g. Confirmation,Recruiter,Interview,Rejection,Offer
 *   UNSORTED_FOLDER      folder under the root for PDFs with no known company, e.g. _Unsorted
 *   SENDERS_TAB          tab mapping sender domains to companies (Domain, Company)
 *   MAX_SAVES_PER_RUN    PDFs saved per run
 */
const CONFIG_KEYS = [
  'RULES_SHEET_ID',
  'RULES_TAB',
  'LOG_TAB',
  'PARENT_LABEL',
  'REVIEW_CATEGORY',
  'MAX_THREADS_PER_RUN',
  'BODY_CHARS',
  'RESPONSES_FOLDER_ID',
  'RESPONSE_CATEGORIES',
  'UNSORTED_FOLDER',
  'SENDERS_TAB',
  'MAX_SAVES_PER_RUN'
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
    logTab: props.LOG_TAB,
    parentLabel: props.PARENT_LABEL,
    reviewCategory: props.REVIEW_CATEGORY,
    maxThreads: Number(props.MAX_THREADS_PER_RUN),
    bodyChars: Number(props.BODY_CHARS),
    responsesFolderId: props.RESPONSES_FOLDER_ID,
    responseCategories: props.RESPONSE_CATEGORIES.split(',').map(s => s.trim()).filter(Boolean),
    unsortedFolder: props.UNSORTED_FOLDER,
    sendersTab: props.SENDERS_TAB,
    maxSaves: Number(props.MAX_SAVES_PER_RUN)
  };
}

/** Run from the editor: logs each setting, or what is missing. */
function checkConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  CONFIG_KEYS.forEach(k => Logger.log('%s = %s', k, props[k] || '(missing)'));
}

/** Setter for one Script Property, so values never need to be typed into code. */
function setConfig_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}
