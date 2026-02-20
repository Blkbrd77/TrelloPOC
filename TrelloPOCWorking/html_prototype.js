#!/usr/bin/env node
/**
 * HTML Prototype Builder — TrelloPOC
 *
 * PURPOSE:
 *   Simulates what Power Automate Action 7 (Compose - Build HTML Content)
 *   will produce, using real or sample Placker API data.
 *
 *   Run this in Codespaces (or locally with Node.js) to:
 *     1. Confirm the Placker API field names before building Power Automate expressions
 *     2. Preview the generated HTML in a browser before committing to Power Automate
 *     3. Iterate on the HTML template without touching the flow
 *
 * USAGE (two modes):
 *
 *   Mode A — Live API (needs your Placker API key and a card ID):
 *     PLACKER_API_KEY=your_key PLACKER_CARD_ID=57175086 node html_prototype.js
 *
 *   Mode B — Sample data (no API key needed, uses built-in sample):
 *     node html_prototype.js
 *
 * OUTPUT:
 *   Writes output.html to the same directory.
 *   Open it in a browser to preview the PDF content.
 *   The script also prints the discovered field names so you can update
 *   the Power Automate expressions in PowerAutomate_Flow_Definition.json.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────────────

const PLACKER_BASE = 'https://placker.com';
const API_KEY = process.env.PLACKER_API_KEY || '';
const CARD_ID = process.env.PLACKER_CARD_ID || '';
const OUTPUT_FILE = path.join(__dirname, 'output.html');

// ── Sample data (used when no API key is provided) ─────────────────────────
// Replace these with real Placker API responses once you've run Postman Requests 6 & 7.
// Field names here are best guesses — the script will print what it finds vs what it expects.

const SAMPLE_CARD = {
  id: 57175086,
  title: 'USER STORY: Editable Cable Form for Engineers (CoPilot Estimate 14 Hours)',
  status: 'COMPLETED',
  endDates: { actual: '2026-02-19T21:13:51+01:00' },
  description: 'As an engineer, I want an editable form for cable updates...\n\n[COED Word and Access Files](https://hosemccann1.sharepoint.com/:f:/r/sites/HMCJOBS/Shared%20Documents/FRC-ITAR/68+/Engineering/COED%20Word%20and%20Access%20Files?csf=1&web=1&e=HRdTpP "‌")',
};

// Best-guess field names from Power_Automate_Flow_Design.md.
// The script will log what it actually finds and flag mismatches.
const SAMPLE_COMMENTS = [
  {
    content: 'Initial review complete. Cable form prototype looks good.',
    author: { name: 'Jay Samples' },
    created: '2026-02-18T14:30:00+01:00',
  },
  {
    content: 'QA passed. Moving to Done.',
    author: { name: 'Jane Engineer' },
    created: '2026-02-19T09:15:00+01:00',
  },
];

const SAMPLE_CHECKLISTS = [
  {
    title: 'Definition of Done',
    items: [
      { title: 'Form is functional and tested with real data', status: 'complete' },
      { title: 'Engineer confirms usability and accuracy', status: 'complete' },
      { title: 'Data integrity is maintained', status: 'complete' },
    ],
  },
  {
    title: 'Acceptance Criteria',
    items: [
      { title: 'Engineer can select a cable by CBL_NUM', status: 'complete' },
      { title: 'Validation prevents incomplete entries', status: 'incomplete' },
    ],
  },
];

// ── HTTP helper ────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'X-API-Key': API_KEY } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}: ${body}`));
        } else {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${body.slice(0, 200)}`));
          }
        }
      });
    }).on('error', reject);
  });
}

// ── Field name inspector ───────────────────────────────────────────────────

function inspectFields(label, data, expectedFields) {
  console.log(`\n── ${label} field report ──`);
  if (!Array.isArray(data) || data.length === 0) {
    console.log('  (empty array — no field names to inspect)');
    return;
  }
  const first = data[0];
  const actual = Object.keys(first);
  console.log(`  Actual top-level fields: ${actual.join(', ')}`);
  for (const f of expectedFields) {
    const found = getNestedValue(first, f) !== undefined;
    console.log(`  ${found ? '[OK]' : '[MISSING]'} ${f}${found ? ` = ${JSON.stringify(getNestedValue(first, f))}` : ' -- UPDATE FIELD NAME IN EXPRESSIONS'}`);
  }
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

// ── SharePoint URL extractor ───────────────────────────────────────────────
// Mirrors the Power Automate Action 8 expression logic.

function extractSharePointUrl(description) {
  const startMarker = '](';
  const endMarker = ' "';
  const startIdx = description.indexOf(startMarker);
  const endIdx = description.indexOf(endMarker, startIdx);
  if (startIdx === -1 || endIdx === -1) return '(no SharePoint URL found in description)';
  return description.substring(startIdx + 2, endIdx);
}

// ── HTML builder ───────────────────────────────────────────────────────────
// This function mirrors what the Power Automate Compose Action 7 expressions produce.
// Keep this logic in sync with the Select + join() approach in the flow.

function buildHtml(card, comments, checklists) {
  const commentsHtml = comments.map((c) =>
    `<p><strong>${c?.author?.name ?? '(unknown)'}</strong> — ${c?.created ?? c?.createdAt ?? ''}<br/>${c?.content ?? c?.text ?? ''}</p>`
  ).join('');

  const checklistsHtml = checklists.map((cl) => {
    const itemsHtml = (cl?.items ?? []).map((item) => {
      const done = item?.status === 'complete' || item?.checked === true || item?.state === 'complete';
      return `<p>${done ? '&#10003;' : '&#9744;'} ${item?.title ?? item?.name ?? ''}</p>`;
    }).join('');
    return `<h3>${cl?.title ?? cl?.name ?? ''}</h3>${itemsHtml}`;
  }).join('');

  const spUrl = extractSharePointUrl(card.description ?? '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #222; }
    h1 { color: #1a3a5c; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 32px; }
    h3 { color: #444; margin-bottom: 4px; }
    p  { margin: 6px 0; }
    hr { border: 0; border-top: 2px solid #1a3a5c; }
    .meta { background: #f0f4f8; padding: 12px; border-radius: 4px; }
    .sp-link { font-size: 0.85em; color: #555; }
  </style>
</head>
<body>
  <h1>${card.title ?? ''}</h1>
  <hr/>
  <div class="meta">
    <p><strong>Status:</strong> ${card.status ?? ''}</p>
    <p><strong>Completed:</strong> ${card.endDates?.actual ?? ''}</p>
    <p class="sp-link"><strong>SharePoint folder:</strong> <a href="${spUrl}">${spUrl}</a></p>
  </div>

  <h2>Description</h2>
  <p>${(card.description ?? '').replace(/\n/g, '<br/>')}</p>

  <h2>Comments (${comments.length})</h2>
  ${commentsHtml || '<p><em>No comments.</em></p>'}

  <h2>Checklists (${checklists.length})</h2>
  ${checklistsHtml || '<p><em>No checklists.</em></p>'}
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  let card, comments, checklists;

  if (API_KEY && CARD_ID) {
    console.log(`Mode A — Live API  (card ID: ${CARD_ID})`);
    console.log('Fetching card, comments, and checklists from Placker...');
    [card, comments, checklists] = await Promise.all([
      get(`${PLACKER_BASE}/card/${CARD_ID}`),
      get(`${PLACKER_BASE}/card/${CARD_ID}/comment`),
      get(`${PLACKER_BASE}/card/${CARD_ID}/checklist`),
    ]);
    // Placker returns the body directly (not wrapped in a 'body' key)
    // The shape below matches what Action 2 (Parse_JSON) would produce
    card      = Array.isArray(card)      ? card[0]      : card;
    comments  = Array.isArray(comments)  ? comments     : comments?.data ?? [];
    checklists = Array.isArray(checklists) ? checklists : checklists?.data ?? [];
  } else {
    console.log('Mode B — Sample data (set PLACKER_API_KEY and PLACKER_CARD_ID for live mode)');
    card = SAMPLE_CARD;
    comments = SAMPLE_COMMENTS;
    checklists = SAMPLE_CHECKLISTS;
  }

  // ── Field inspection — update Power Automate expressions based on output ──
  inspectFields('Comments', comments, [
    'content',        // expected comment body field
    'text',           // alternative
    'author.name',    // expected author name
    'created',        // expected date field
    'createdAt',      // alternative
  ]);

  inspectFields('Checklists', checklists, [
    'title',          // checklist name
    'items',          // nested items array
  ]);

  if (checklists.length > 0 && checklists[0].items?.length > 0) {
    inspectFields('Checklist items (first checklist)', checklists[0].items, [
      'title',        // item text
      'status',       // completion state
      'state',        // alternative
      'checked',      // alternative
    ]);
  }

  // ── SharePoint URL extraction test ────────────────────────────────────────
  const spUrl = extractSharePointUrl(card.description ?? '');
  console.log(`\n── SharePoint URL extraction ──`);
  console.log(`  Result: ${spUrl}`);

  // ── Generate HTML ─────────────────────────────────────────────────────────
  const html = buildHtml(card, comments, checklists);
  fs.writeFileSync(OUTPUT_FILE, html, 'utf8');
  console.log(`\n✓ HTML written to: ${OUTPUT_FILE}`);
  console.log('  Open output.html in a browser to preview the PDF content.');

  // ── Power Automate expression hints ───────────────────────────────────────
  console.log(`
── Power Automate expressions to use in Action 7 (Select - Format Comments) ──

  From:  body('HTTP_-_Get_Comments')
  Map:   concat(
           '<p><strong>', item()?['author']?['name'], '</strong> — ',
           item()?['created'], '<br/>',
           item()?['content'], '</p>'
         )

── Power Automate expressions to use in Action 7 (Select - Format Checklists) ──

  From:  body('HTTP_-_Get_Checklists')
  Map:   concat('<h3>', item()?['title'], '</h3>')
         (items array requires a nested loop — see Option B in the guide)

── Compose - Build HTML Content (Action 7 final expression) ──

  concat(
    '<html><body>',
    '<h1>', first(body('Filter_array'))?['title'], '</h1>',
    '<hr/>',
    '<p><strong>Status:</strong> ', first(body('Filter_array'))?['status'], '</p>',
    '<p><strong>Completed:</strong> ', first(body('Filter_array'))?['endDates']?['actual'], '</p>',
    '<h2>Description</h2>',
    '<p>', first(body('Filter_array'))?['description'], '</p>',
    '<h2>Comments</h2>',
    join(body('Select_-_Format_Comments'), ''),
    '<h2>Checklists</h2>',
    join(body('Select_-_Format_Checklists'), ''),
    '</body></html>'
  )

  NOTE: Verify field names above match what the ── field report ── printed.
  If any field showed ✗ MISSING, update item()?['fieldname'] in the Select Map expressions.
`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
