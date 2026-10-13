/**
 * CEA-2: sort Job Search threads that have no sub-label yet into exactly one sub-label.
 * Runs hourly from the trigger installed by installTrigger().
 */
function sortJobSearch() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('Previous run still active, skipping.');
    return;
  }
  try {
    const result = runSort_(false);
    Logger.log('Sorted %s threads: %s', result.count, JSON.stringify(result.tally));
  } finally {
    lock.releaseLock();
  }
}

/** Dry run: classifies the newest unsorted threads and logs the result without labeling anything. */
function previewSort() {
  const result = runSort_(true);
  result.lines.forEach(l => Logger.log(l));
  Logger.log('Preview of %s threads: %s', result.count, JSON.stringify(result.tally));
}

function runSort_(dryRun) {
  const cfg = getConfig_();
  const loaded = loadRules_(cfg);
  const allCategories = loaded.categories.concat([cfg.reviewCategory]);
  const labels = dryRun ? null : ensureLabels_(cfg.parentLabel, allCategories);

  const query = 'label:' + searchName_(cfg.parentLabel) + ' ' +
    allCategories.map(c => '-label:' + searchName_(cfg.parentLabel + '/' + c)).join(' ');
  const threads = GmailApp.search(query, 0, cfg.maxThreads);

  const tally = {};
  const lines = [];
  threads.forEach(thread => {
    const messages = thread.getMessages();
    const last = messages[messages.length - 1];
    const hit = classify_(loaded.rules, {
      from: last.getFrom(),
      subject: last.getSubject(),
      body: last.getPlainBody().slice(0, cfg.bodyChars)
    });
    const category = hit ? hit.category : cfg.reviewCategory;
    tally[category] = (tally[category] || 0) + 1;
    lines.push(category + ' | ' + last.getFrom() + ' | ' + last.getSubject() +
      (hit ? ' | rule row ' + hit.rule.row + ' "' + hit.rule.contains + '"' : ' | no rule'));
    if (!dryRun) thread.addLabel(labels[category]);
  });
  return { count: threads.length, tally: tally, lines: lines };
}

/** Creates any missing Parent/Category labels and returns them keyed by category. */
function ensureLabels_(parent, categories) {
  const out = {};
  categories.forEach(c => {
    const name = parent + '/' + c;
    out[c] = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
  });
  return out;
}

/** Gmail search form of a label name: "Job Search/Review" -> "job-search-review". */
function searchName_(labelName) {
  return labelName.toLowerCase().replace(/[\s\/]+/g, '-');
}
