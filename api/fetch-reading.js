// Vercel serverless function — POST /api/fetch-reading
// Fetches a Google Doc's HTML export server-side so the raw URL
// is never exposed to students and CORS is not an issue.

module.exports = async function handler(req, res) {
  // Allow calls from mcraesocial.com and local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { docUrl } = req.body || {};
  if (!docUrl) return res.status(400).json({ error: 'docUrl is required' });

  // Extract the document ID from any Google Docs URL format
  const match = docUrl.match(/\/document\/d\/([\w-]+)/);
  if (!match) return res.status(400).json({ error: 'Could not extract Google Doc ID from URL' });

  const docId = match[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;

  try {
    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; mcraesocial/1.0)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Google returned ${response.status}. Make sure the doc is set to "Anyone with the link can view".`,
      });
    }

    const rawHtml = await response.text();

    // Strip everything outside <body> and clean up Google's inline styles
    // to get just the readable content
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : rawHtml;

    // Remove Google's header/footer div wrappers but keep the content
    const cleaned = bodyHtml
      // Remove style tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove script tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Strip all inline style attributes (we'll apply our own)
      .replace(/\s*style="[^"]*"/gi, '')
      // Strip class attributes from Google's generated classes
      .replace(/\s*class="[^"]*"/gi, '')
      // Strip span wrappers that Google uses for font rendering
      .replace(/<span>/gi, '')
      .replace(/<\/span>/gi, '')
      // Remove empty tags
      .replace(/<p[^>]*>\s*<\/p>/gi, '')
      .trim();

    return res.status(200).json({ html: cleaned, docId });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch Google Doc: ' + err.message });
  }
};
