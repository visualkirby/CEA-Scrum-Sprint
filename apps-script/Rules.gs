/**
 * Reads the rules tab with header-based column lookup.
 * Returns rules sorted by Order (then sheet row), plus the category list in that order.
 */
function loadRules_(cfg) {
  const sheet = SpreadsheetApp.openById(cfg.rulesSheetId).getSheetByName(cfg.rulesTab);
  if (!sheet) throw new Error('Rules tab not found: ' + cfg.rulesTab);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(h => String(h).trim().toLowerCase());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error('Rules tab is missing the "' + name + '" column');
    return i;
  };
  const cOrder = col('order'), cCat = col('category'), cField = col('field'), cContains = col('contains');

  const rules = values.slice(1)
    .map((r, i) => ({
      order: Number(r[cOrder]),
      category: String(r[cCat]).trim(),
      field: String(r[cField]).trim().toLowerCase(),
      contains: normalize_(String(r[cContains]).trim()),
      row: i + 2
    }))
    .filter(r => r.category && r.contains && !isNaN(r.order))
    .sort((a, b) => a.order - b.order || a.row - b.row);

  const categories = [];
  rules.forEach(r => { if (categories.indexOf(r.category) < 0) categories.push(r.category); });
  return { rules: rules, categories: categories };
}

/**
 * Lowercases, turns curly apostrophes into straight ones, and collapses every run of
 * whitespace (including non-breaking spaces and line breaks) into one space, so a rule
 * like "other candidates" still matches when the email wraps or pads between the words.
 */
function normalize_(s) {
  return String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[\s ]+/g, ' ');
}

/**
 * First matching rule wins. Fields: from, subject, body, subject_body.
 * Returns the rule's category, or null when nothing matches.
 */
function classify_(rules, msg) {
  const text = {
    from: normalize_(msg.from),
    subject: normalize_(msg.subject),
    body: normalize_(msg.body)
  };
  text.subject_body = text.subject + '\n' + text.body;
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const haystack = text[r.field];
    if (haystack === undefined) continue;
    if (haystack.indexOf(r.contains) >= 0) return { category: r.category, rule: r };
  }
  return null;
}
