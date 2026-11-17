/**
 * Debate Split Analyzer — live source
 *
 * Paste this into the Apps Script editor of the Google Sheet that collects your
 * form's responses (Extensions → Apps Script), fill in the two settings below,
 * then Deploy → New deployment → Web app, "Execute as: Me", "Who has access:
 * Anyone". Paste the web app URL it gives you into the analyzer's Live source box.
 *
 * It returns only the question columns (names, emails, timestamps are dropped
 * here, before anything leaves Google) plus the questions read from your doc.
 */

// ── Settings ───────────────────────────────────────────────────────────────
// Google Doc that lists this year's questions, one per line ("1. ..." is fine).
// The ID is the long string in the doc's URL between /d/ and /edit.
const QUESTIONS_DOC_ID = 'PASTE_DOC_ID_HERE';

// Name of the sheet tab holding the responses. Leave '' to use the first tab.
const RESPONSES_SHEET_NAME = '';

// Any column whose header contains one of these words is never sent.
const PRIVATE_HEADER_WORDS = ['timestamp', 'name', 'email', 'score', 'id', 'class', 'period'];
// ───────────────────────────────────────────────────────────────────────────

function doGet() {
  const out = { fetchedAt: new Date().toISOString() };
  try {
    const sheet = RESPONSES_SHEET_NAME
      ? SpreadsheetApp.getActive().getSheetByName(RESPONSES_SHEET_NAME)
      : SpreadsheetApp.getActive().getSheets()[0];
    if (!sheet) throw new Error('Responses sheet not found');

    const values = sheet.getDataRange().getValues();
    const headers = (values.shift() || []).map(h => String(h).trim());

    const keep = headers
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h && !PRIVATE_HEADER_WORDS.some(w => h.toLowerCase().includes(w)));

    out.columns = keep.map(k => k.h);
    out.rows = values
      .filter(row => row.some(v => v !== '' && v !== null))
      .map(row => keep.map(k => row[k.i] === null || row[k.i] === undefined ? '' : String(row[k.i])));
  } catch (e) {
    out.error = 'Responses: ' + e.message;
  }

  try {
    if (QUESTIONS_DOC_ID && QUESTIONS_DOC_ID !== 'PASTE_DOC_ID_HERE') {
      const text = DocumentApp.openById(QUESTIONS_DOC_ID).getBody().getText();
      out.questions = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
  } catch (e) {
    out.questionsError = 'Questions doc: ' + e.message;
  }

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
