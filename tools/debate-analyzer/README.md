# Debate Split Analyzer — live setup

The analyzer can read responses straight from the Google Sheet behind any of
your forms, and the questions from a Google Doc, instead of a downloaded CSV.

The script is set up **once**. After that, each class is just a sheet link
pasted into the page.

## One-time: the script

1. Keep the questions in a Google Doc, one per line, numbered `1.` `2.` ...
   The numbers tie each line to the form's `#1`, `#2` columns. Copy the doc's
   ID: the long string in its URL between `/d/` and `/edit`.
2. Go to **script.google.com**, click **New project**, delete what's in the
   editor and paste in `apps-script.gs` from this folder.
3. Set `QUESTIONS_DOC_ID` to the doc ID. Save.
4. **Deploy → New deployment**, gear icon → **Web app**, Execute as **Me**,
   Who has access **Anyone**, **Deploy**. Approve the permissions (they let the
   script read your sheets and docs, as you). Copy the **Web app URL**.
5. In the analyzer, open **Web app URL** under the Live source box, paste it
   there. It's saved in that browser.

Edit the script later? **Deploy → Manage deployments → edit → New version**,
or the URL keeps serving the old code.

## Each class

1. In the form's **Responses** tab, click the Sheets icon so responses land in a
   spreadsheet (once per form).
2. Copy that spreadsheet's link, paste it into **Live source**, click **Go live**.
   If the link ends in `#gid=...` the analyzer reads that tab; otherwise the first.

The page remembers the last ten sheets you've used, so the box offers them as
you type. While results are open it refreshes every 30 seconds; the green line
under the heading shows the sheet, the response count and the last update.

## What leaves Google

Only the question columns. The script drops any column whose header contains
timestamp, name, email, score, id, class or period before responding, so names
never reach the page. Anyone holding the web app URL can read those question
columns from any sheet you own that they can name, so don't post the URL
anywhere public.

The CSV upload still works exactly as before if you'd rather not set this up.
