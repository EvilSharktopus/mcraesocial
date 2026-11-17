/**
 * Debate Split Analyzer — live source (set up ONCE, works for every form)
 *
 * This is a standalone script, not tied to any one spreadsheet. The analyzer
 * tells it which response sheet to read each time, so a new form only needs
 * its sheet link pasted into the page.
 *
 * Setup: go to script.google.com → New project, paste this in, set
 * QUESTIONS_DOC_ID, then Deploy → New deployment → Web app, "Execute as: Me",
 * "Who has access: Anyone". Paste the web app URL into the analyzer once.
 *
 * It returns only the question columns (names, emails, timestamps are dropped
 * here, before anything leaves Google) plus the questions read from your doc.
 */

// ── Settings ───────────────────────────────────────────────────────────────
// Google Doc that lists the current questions, one per line ("1. ..." is fine).
// The ID is the long string in the doc's URL between /d/ and /edit.
const QUESTIONS_DOC_ID = 'PASTE_DOC_ID_HERE';

// Any column whose header contains one of these words is never sent.
const PRIVATE_HEADER_WORDS = ['timestamp', 'name', 'email', 'score', 'id', 'class', 'period'];
// ───────────────────────────────────────────────────────────────────────────

function doGet(e) {
  const p = (e && e.parameter) || {};
  const out = { fetchedAt: new Date().toISOString() };

  try {
    const sheetId = extractId_(p.sheet || '');
    if (!sheetId) throw new Error('No response sheet given. Paste the spreadsheet link into the analyzer.');
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = null;
    if (p.gid) sheet = ss.getSheets().find(s => String(s.getSheetId()) === String(p.gid)) || null;
    if (!sheet) sheet = ss.getSheets()[0];
    out.sheetName = ss.getName() + ' · ' + sheet.getName();

    const values = sheet.getDataRange().getValues();
    const headers = (values.shift() || []).map(h => String(h).trim());
    const keep = headers
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h && !PRIVATE_HEADER_WORDS.some(w => h.toLowerCase().includes(w)));

    out.columns = keep.map(k => k.h);
    out.rows = values
      .filter(row => row.some(v => v !== '' && v !== null))
      .map(row => keep.map(k => row[k.i] === null || row[k.i] === undefined ? '' : String(row[k.i])));
  } catch (err) {
    out.error = 'Responses: ' + err.message;
  }

  try {
    const docId = extractId_(p.doc || '') || QUESTIONS_DOC_ID;
    if (docId && docId !== 'PASTE_DOC_ID_HERE') {
      const text = DocumentApp.openById(docId).getBody().getText();
      out.questions = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
  } catch (err) {
    out.questionsError = 'Questions doc: ' + err.message;
  }

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// Accepts a bare ID or a full Docs/Sheets URL.
function extractId_(s) {
  s = String(s).trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : '';
}
