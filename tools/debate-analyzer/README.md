# Debate Split Analyzer — live setup

The analyzer can read responses straight from the Google Sheet behind your form,
and the questions from a Google Doc, instead of a downloaded CSV. One-time setup,
about five minutes.

## 1. Link the form to a sheet

In Google Forms open the **Responses** tab and click the green Sheets icon.
That creates (or picks) the spreadsheet that fills up as students answer.

## 2. Put the questions in a Google Doc

One question per line. Numbering like `1.` or `#1` is fine, and the numbers are
what tie each line to the form's `#1`, `#2`... columns. Update this doc each year.

Copy the doc's ID: the long string in its URL between `/d/` and `/edit`.

## 3. Add the script to the sheet

1. Open the response spreadsheet and choose **Extensions → Apps Script**.
2. Delete whatever is in the editor and paste the contents of `apps-script.gs`
   from this folder.
3. Set `QUESTIONS_DOC_ID` to the doc ID from step 2.
4. Save.

## 4. Deploy it as a web app

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Execute as: **Me**. Who has access: **Anyone**.
4. Click **Deploy**, approve the permissions it asks for (they let the script
   read this sheet and the doc, as you), and copy the **Web app URL**.

Changed the script later? Use **Deploy → Manage deployments → edit → New version**,
or the URL keeps serving the old code.

## 5. Paste the URL into the analyzer

Open the analyzer, paste the URL into **Live source**, and click **Go live**.
It remembers the URL in that browser. While results are open it refreshes every
30 seconds; the green line under the heading shows the response count and the
last update time.

## What leaves Google

Only the question columns. The script drops any column whose header contains
timestamp, name, email, score, id, class or period before responding, so names
never reach the page. Anyone who has the web app URL can read those question
columns, so don't post the URL anywhere public.

The CSV upload still works exactly as before if you'd rather not set this up.
