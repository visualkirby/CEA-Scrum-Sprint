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
    Logger.log('Logged %s new rows to the log tab.', result.logged);
    const re = runRecheck_(false);
    Logger.log('Re-checked %s threads with new messages: %s moved, %s logged.', re.count, re.moved, re.logged);
    const saved = saveResponses_(getConfig_());
    Logger.log('Saved %s response PDFs (%s waiting).', saved.saved, saved.remaining);
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
  const me = ownAddresses_();

  const tally = {};
  const lines = [];
  const entries = [];
  threads.forEach(thread => {
    // My own replies say nothing about the employer's answer, so classify the newest message
    // I didn't send. A thread with only my messages falls back to its newest message.
    const messages = thread.getMessages();
    const last = newestIncoming_(thread, me) || messages[messages.length - 1];
    const hit = classify_(loaded.rules, {
      from: last.getFrom(),
      subject: last.getSubject(),
      body: last.getPlainBody().slice(0, cfg.bodyChars)
    });
    const category = hit ? hit.category : cfg.reviewCategory;
    tally[category] = (tally[category] || 0) + 1;
    lines.push(category + ' | ' + last.getFrom() + ' | ' + last.getSubject() +
      (hit ? ' | rule row ' + hit.rule.row + ' "' + hit.rule.contains + '"' : ' | no rule'));
    if (!dryRun) {
      thread.addLabel(labels[category]);
      entries.push({
        date: last.getDate(),
        from: last.getFrom(),
        subject: last.getSubject(),
        category: category,
        rule: hit ? 'row ' + hit.rule.row + ': "' + hit.rule.contains + '"' : 'no rule',
        link: thread.getPermalink(),
        threadId: thread.getId()
      });
    }
  });
  const logged = dryRun ? 0 : appendLog_(cfg, entries);
  return { count: threads.length, tally: tally, lines: lines, logged: logged };
}

/** Dry run of the CEA-9 re-check: lists sorted threads with a new message and what they'd become. */
function previewRecheck() {
  const result = runRecheck_(true);
  result.lines.forEach(l => Logger.log(l));
  Logger.log('Preview: %s threads with new messages, %s would move.', result.count, result.moved);
}

/**
 * CEA-9: a thread keeps its sub-label after the first sort, so a rejection that replies to a
 * confirmation thread used to stay in Confirmation. This pass looks at sorted threads with
 * activity in the last RECHECK_DAYS days, takes the newest message not sent by me, and when
 * the log doesn't have that message yet, classifies it: the sub-label moves if a different
 * rule matches, and either way the message gets its own log row (and so its own PDF when
 * it's a response category, through saveResponses_).
 */
function runRecheck_(dryRun) {
  const cfg = getConfig_();
  const loaded = loadRules_(cfg);
  const allCategories = loaded.categories.concat([cfg.reviewCategory]);
  const labels = dryRun ? null : ensureLabels_(cfg.parentLabel, allCategories);
  const prefix = cfg.parentLabel + '/';

  const query = 'label:' + searchName_(cfg.parentLabel) + ' newer_than:' + cfg.recheckDays + 'd {' +
    allCategories.map(c => 'label:' + searchName_(prefix + c)).join(' ') + '}';
  const threads = GmailApp.search(query, 0, cfg.maxThreads);
  const logged = loggedMessages_(cfg);
  const me = ownAddresses_();

  const lines = [];
  const entries = [];
  let count = 0, moved = 0;
  threads.forEach(thread => {
    const current = thread.getLabels().map(l => l.getName())
      .filter(n => n.indexOf(prefix) === 0).map(n => n.slice(prefix.length))
      .filter(c => allCategories.indexOf(c) >= 0);
    if (!current.length) return;
    const msg = newestIncoming_(thread, me);
    if (!msg) return;
    const id = thread.getId();
    // Only the message key, not "newer than the last log row": that row can be my own reply,
    // which is later than the message that actually matters (the Herbalife invite, 10/16).
    if (logged.has(logKey_(id, msg.getDate()))) return;

    count++;
    const hit = classify_(loaded.rules, {
      from: msg.getFrom(),
      subject: msg.getSubject(),
      body: msg.getPlainBody().slice(0, cfg.bodyChars)
    });
    const category = hit ? hit.category : cfg.reviewCategory;
    const changes = current.length !== 1 || current[0] !== category;
    if (changes) moved++;
    lines.push((changes ? current.join('+') + ' -> ' + category : category + ' (unchanged)') +
      ' | ' + msg.getFrom() + ' | ' + msg.getSubject() +
      (hit ? ' | rule row ' + hit.rule.row + ' "' + hit.rule.contains + '"' : ' | no rule'));
    if (dryRun) return;

    if (changes) {
      current.forEach(c => { if (c !== category) thread.removeLabel(labels[c]); });
      thread.addLabel(labels[category]);
    }
    entries.push({
      date: msg.getDate(),
      from: msg.getFrom(),
      subject: msg.getSubject(),
      category: category,
      rule: 're-check' + (changes ? ' (was ' + current.join('+') + ')' : '') + ': ' +
        (hit ? 'row ' + hit.rule.row + ': "' + hit.rule.contains + '"' : 'no rule'),
      link: thread.getPermalink(),
      threadId: id
    });
  });
  const loggedCount = dryRun ? 0 : appendLog_(cfg, entries);
  return { count: count, moved: moved, logged: loggedCount, lines: lines };
}

/** Newest non-draft message in the thread that I didn't send, or null. */
function newestIncoming_(thread, me) {
  const messages = thread.getMessages();
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.isDraft()) continue;
    if (me.has(emailOf_(m.getFrom()))) continue;
    return m;
  }
  return null;
}

/** My account address plus my Gmail send-as aliases, lowercased. */
function ownAddresses_() {
  const out = new Set([Session.getEffectiveUser().getEmail().toLowerCase()]);
  GmailApp.getAliases().forEach(a => out.add(String(a).toLowerCase()));
  return out;
}

/** "Acme <jobs@acme.com>" -> "jobs@acme.com". */
function emailOf_(from) {
  const m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : String(from)).trim().toLowerCase();
}

/**
 * Removes the Review sub-label from every thread that has it, so the next sortJobSearch
 * run classifies them again with the current rules. Threads already in the log keep their
 * original log row; the log never writes a thread twice.
 */
function clearReview() {
  const cfg = getConfig_();
  const label = GmailApp.getUserLabelByName(cfg.parentLabel + '/' + cfg.reviewCategory);
  if (!label) { Logger.log('No Review label found.'); return; }
  let total = 0;
  let batch;
  do {
    batch = label.getThreads(0, 100);
    if (batch.length) label.removeFromThreads(batch);
    total += batch.length;
  } while (batch.length === 100);
  Logger.log('Removed the Review label from %s threads.', total);
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
