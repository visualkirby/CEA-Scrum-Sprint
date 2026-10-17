/**
 * CEA-4: save each response thread as a PDF in RESPONSES_FOLDER_ID/<Company>.
 * Works from the sort log: rows whose sub-label is in RESPONSE_CATEGORIES and whose
 * Drive Link cell is empty. The Drive Link cell is the "saved once" check.
 */

/** Run from the editor, or called at the end of each hourly sortJobSearch. */
function saveResponses() {
  const result = saveResponses_(getConfig_());
  Logger.log('Saved %s PDFs (%s left for the next run).', result.saved, result.remaining);
  result.lines.forEach(l => Logger.log(l));
  return result;
}

function saveResponses_(cfg) {
  const ss = SpreadsheetApp.openById(cfg.rulesSheetId);
  const sheet = ss.getSheetByName(cfg.logTab);
  if (!sheet || sheet.getLastRow() < 2) return { saved: 0, remaining: 0, lines: [] };

  const linkCol = ensureDriveLinkColumn_(sheet);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error('Log tab is missing the "' + name + '" column');
    return i;
  };
  const cDate = col('Date Received'), cFrom = col('From'), cSubject = col('Subject');
  const cCat = col('Sub-label'), cThread = col('Thread ID'), cLink = linkCol - 1;

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).getValues();
  const todo = [];
  rows.forEach((r, i) => {
    if (cfg.responseCategories.indexOf(String(r[cCat]).trim()) < 0) return;
    if (String(r[cLink]).trim()) return;
    if (!String(r[cThread]).trim()) return;
    todo.push({ row: i + 2, date: r[cDate], from: String(r[cFrom]), subject: String(r[cSubject]), threadId: String(r[cThread]) });
  });

  const senders = loadSenders_(ss, cfg.sendersTab);
  const root = DriveApp.getFolderById(cfg.responsesFolderId);
  const folderCache = {};
  const lines = [];
  let saved = 0;

  todo.slice(0, cfg.maxSaves).forEach(item => {
    const thread = GmailApp.getThreadById(item.threadId);
    if (!thread) {
      lines.push('row ' + item.row + ': thread not found, skipped');
      return;
    }
    const company = companyFor_(item.from, item.subject, senders, cfg.unsortedFolder);
    if (!folderCache[company]) folderCache[company] = childFolder_(root, company);
    const name = fileName_(item.date, item.subject);
    const pdf = threadPdf_(thread, name);
    const file = folderCache[company].createFile(pdf);
    sheet.getRange(item.row, linkCol).setValue(file.getUrl());
    saved++;
    lines.push('row ' + item.row + ': ' + company + ' / ' + file.getName());
  });

  return { saved: saved, remaining: Math.max(0, todo.length - saved), lines: lines };
}

/** Adds a "Drive Link" header at the end of the log if it isn't there. Returns its 1-based column. */
function ensureDriveLinkColumn_(sheet) {
  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const i = header.indexOf(DRIVE_LINK_HEADER);
  if (i >= 0) return i + 1;
  sheet.getRange(1, lastCol + 1).setValue(DRIVE_LINK_HEADER).setFontWeight('bold');
  return lastCol + 1;
}

/**
 * Senders tab: Domain, Company. Company is a folder name, or one of three markers:
 *   ATS          the domain sends for many employers; use the sender's display name
 *   ATS_ADDRESS  like ATS, but the employer is in the address itself (ADP, Workday, iCIMS)
 *   UNSORTED     never guess a company for this domain (free mail, personal addresses)
 */
function loadSenders_(ss, tabName) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(h => String(h).trim().toLowerCase());
  const cDomain = header.indexOf('domain'), cCompany = header.indexOf('company');
  if (cDomain < 0 || cCompany < 0) throw new Error('Senders tab needs Domain and Company columns');
  const map = {};
  values.slice(1).forEach(r => {
    const d = String(r[cDomain]).trim().toLowerCase();
    const c = String(r[cCompany]).trim();
    if (d && c) map[d] = c;
  });
  return map;
}

/**
 * Company folder for a From header like "Acme Recruiting <jobs@acme.com>".
 * Order: Senders tab company; for ATS, ATS_ADDRESS and UNSORTED domains the subject line, then
 * (ATS_ADDRESS only) the address, then (ATS and ATS_ADDRESS) the display name; for any other
 * domain the domain name.
 */
function companyFor_(from, subject, senders, unsorted) {
  const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const display = m ? m[1].trim() : '';
  const email = (m ? m[2] : String(from)).trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  if (!domain) return unsorted;

  const parts = domain.split('.');
  let entry = null;
  for (let i = 0; i < parts.length - 1 && entry === null; i++) {
    const d = parts.slice(i).join('.');
    if (senders[d]) entry = senders[d];
  }

  const marker = entry ? entry.toUpperCase() : '';
  if (marker === 'UNSORTED' || marker === 'ATS' || marker === 'ATS_ADDRESS') {
    const fromSubject = companyFromSubject_(subject);
    if (fromSubject) return safeName_(fromSubject);
    if (marker === 'UNSORTED') return unsorted;
    if (marker === 'ATS_ADDRESS') {
      const fromAddress = companyFromAddress_((m ? m[2] : String(from)).trim().split('@')[0]);
      if (fromAddress) return safeName_(fromAddress);
    }
    const name = cleanDisplayName_(display, domain);
    return name ? safeName_(name) : unsorted;
  }
  if (entry) return safeName_(entry);

  const stem = domainStem_(domain);
  return stem ? safeName_(stem.charAt(0).toUpperCase() + stem.slice(1)) : unsorted;
}

/**
 * Company named in a subject: "Thank you for applying to Chewy!", "opportunity at Scalian",
 * "a job opportunity with Reworld". Cut at " - ", "(", "|" or end punctuation.
 * Returns '' when no pattern fits or the result reads like a job title or a sentence.
 */
function companyFromSubject_(subject) {
  const m = String(subject || '').match(
    /\b(?:applying to|applied to|application to|opportunity at|opportunity with|position at|role at|job at|interest in joining)\s+(.+)$/i);
  if (!m) return '';
  const name = m[1].split(/\s[-–|]\s|\(|[!?.,:;]/)[0].trim();
  if (!name || name.length > 40) return '';
  if (/^(the|a|an|our|your|this|that)\b/i.test(name)) return '';
  return name;
}

/**
 * CEA-10: company from the local part of an ATS address. Cuts at the first "+" (iCIMS
 * "herbalife+email+6do6@talent.icims.com"), drops a role suffix after a dot ("EaglePhysicians.hr")
 * and a trailing Inc/LLC/Corp, then splits CamelCase, including a lowercase "of" glued to the
 * word before it ("PiedmontMetalsofBurlington" -> "Piedmont Metals of Burlington"). Only "of":
 * "and" would break "HighlandPark". All-lowercase names stay whole ("waynefarms" -> "Waynefarms").
 * Returns '' for a generic local part (noreply, careers, ...), so the caller falls through.
 */
function companyFromAddress_(local) {
  const generic = /^(no-?reply|do-?not-?reply|careers?|jobs?|hr|talent|recruiting|notifications?|autoreply|email)$/i;
  let s = String(local || '').split('+')[0];
  s = s.split('.').filter(p => p && !generic.test(p)).join(' ');
  if (!s || generic.test(s)) return '';
  s = s.replace(/(?:inc|llc|corp)$/i, m => (s.length - m.length >= 3 ? '' : m));
  s = s.replace(/([a-z]{3})of(?=[A-Z])/g, '$1 of ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || generic.test(s)) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Strips recruiting filler from a display name ("Acme Talent Acquisition via Indeed" -> "Acme"),
 * plus any word that is part of the ATS's own domain ("Reworld Workday" from myworkday.com -> "Reworld").
 * CEA-11: a name joined with "from", "by", "at" or "/" is split into parts first, then one part is
 * kept: a part that repeats ("Tractor Supply Careers from Tractor Supply/Petsense by Tractor Supply"
 * -> "Tractor Supply"), else the part after "from" ("Olivia from Acme" -> "Acme"), else the first.
 * Returns '' when nothing company-like is left, or when the name is just the ATS itself.
 */
function cleanDisplayName_(display, domain) {
  const stem = domainStem_(domain).replace(/[^a-z0-9]/g, '');
  const raw = String(display).replace(/\s+via\s+.*$/i, '');
  const fromMatch = raw.match(/\s+from\s+(.+)$/i);
  const parts = raw.split(/\s+(?:from|by|at)\s+|\//i).map(p => cleanNamePart_(p, stem)).filter(Boolean);
  if (!parts.length) return '';

  const key = p => p.toLowerCase().replace(/[^a-z0-9]/g, '');
  const counts = {};
  parts.forEach(p => { counts[key(p)] = (counts[key(p)] || 0) + 1; });
  let s = parts.find(p => counts[key(p)] > 1);
  if (!s && fromMatch) {
    s = cleanNamePart_(fromMatch[1].split(/\s+(?:by|at)\s+|\//i)[0], stem);
  }
  if (!s) s = parts[0];

  const flat = key(s);
  if (!flat || (stem && (stem.indexOf(flat) >= 0 || flat.indexOf(stem) >= 0))) return '';
  return s;
}

/** One part of a display name with recruiting filler and ATS-brand words removed. */
function cleanNamePart_(part, stem) {
  return String(part)
    .replace(/\b(talent acquisition|recruiting|recruitment|careers?|hiring|team|jobs?|hr|human resources|notifications?|no-?reply|do not reply)\b/gi, ' ')
    .replace(/[|,:\-]+/g, ' ')
    .split(/\s+/)
    .filter(w => {
      const t = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      return t && !(t.length >= 3 && stem.indexOf(t) >= 0);
    })
    .join(' ')
    .trim();
}

/** Dry run of refileResponses(): lists every saved PDF that would move, and where. */
function previewRefile() {
  const result = refile_(true);
  result.lines.forEach(l => Logger.log(l));
  Logger.log('Preview: %s of %s saved PDFs would move.', result.moved, result.checked);
}

/**
 * CEA-11: works out the company again for every log row with a Drive Link and moves the PDF
 * when it sits in a different folder, then trashes company folders left empty (recoverable
 * for 30 days). Run after a change to companyFor_ so existing PDFs follow the new names.
 */
function refileResponses() {
  const result = refile_(false);
  result.lines.forEach(l => Logger.log(l));
  Logger.log('Moved %s of %s saved PDFs; trashed %s empty folders.', result.moved, result.checked, result.trashed);
}

function refile_(dryRun) {
  const cfg = getConfig_();
  const ss = SpreadsheetApp.openById(cfg.rulesSheetId);
  const sheet = ss.getSheetByName(cfg.logTab);
  const out = { checked: 0, moved: 0, trashed: 0, lines: [] };
  if (!sheet || sheet.getLastRow() < 2) return out;

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error('Log tab is missing the "' + name + '" column');
    return i;
  };
  const cFrom = col('From'), cSubject = col('Subject'), cLink = col(DRIVE_LINK_HEADER);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).getValues();
  const senders = loadSenders_(ss, cfg.sendersTab);
  const root = DriveApp.getFolderById(cfg.responsesFolderId);
  const folderCache = {};

  rows.forEach((r, i) => {
    const link = String(r[cLink]);
    const m = link.match(/\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
    if (!m) return;
    out.checked++;
    const file = DriveApp.getFileById(m[1]);
    const parents = file.getParents();
    const current = parents.hasNext() ? parents.next().getName() : '(none)';
    const company = companyFor_(String(r[cFrom]), String(r[cSubject]), senders, cfg.unsortedFolder);
    if (current === company) return;
    out.moved++;
    out.lines.push('row ' + (i + 2) + ': ' + current + ' -> ' + company + ' | ' + file.getName());
    if (dryRun) return;
    if (!folderCache[company]) folderCache[company] = childFolder_(root, company);
    file.moveTo(folderCache[company]);
  });

  if (!dryRun) {
    const it = root.getFolders();
    while (it.hasNext()) {
      const f = it.next();
      if (!f.getFiles().hasNext() && !f.getFolders().hasNext()) { f.setTrashed(true); out.trashed++; }
    }
  }
  return out;
}

/** "careers.acme.co.uk" -> "acme", "mail.acme.com" -> "acme". */
function domainStem_(domain) {
  const parts = String(domain).toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const twoPart = tld.length === 2 && sld.length <= 3 && parts.length >= 3;
  return twoPart ? parts[parts.length - 3] : sld;
}

function childFolder_(root, name) {
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

/** "2026-10-13 Your application to Acme" with characters Drive and Windows dislike removed. */
function fileName_(date, subject) {
  const d = date instanceof Date ? date : new Date(date);
  const day = isNaN(d) ? 'undated' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const subj = safeName_(subject || '(no subject)').slice(0, 120);
  return day + ' ' + subj;
}

function safeName_(s) {
  return String(s).replace(/[\\\/:*?"<>|#%\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** One PDF for the whole thread: each message's From / To / Date / Subject, then its HTML body. */
function threadPdf_(thread, name) {
  const tz = Session.getScriptTimeZone();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts = thread.getMessages().map(msg =>
    '<div style="font-family:Arial,sans-serif;font-size:11px;border-bottom:1px solid #999;padding:6px 0;margin:12px 0 8px">' +
      '<b>From:</b> ' + esc(msg.getFrom()) + '<br>' +
      '<b>To:</b> ' + esc(msg.getTo()) + '<br>' +
      '<b>Date:</b> ' + esc(Utilities.formatDate(msg.getDate(), tz, 'yyyy-MM-dd HH:mm z')) + '<br>' +
      '<b>Subject:</b> ' + esc(msg.getSubject()) +
    '</div>' + msg.getBody()
  );
  const html = '<html><head><meta charset="utf-8"></head><body>' + parts.join('<br>') + '</body></html>';
  return Utilities.newBlob(html, 'text/html', name + '.html').getAs('application/pdf').setName(name + '.pdf');
}
