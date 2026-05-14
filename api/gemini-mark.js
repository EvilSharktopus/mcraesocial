// Vercel serverless function — POST /api/gemini-mark
// Proxies requests to Gemini using the server-side GEMINI_KEY env variable.
// The client never sees the key.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Accept either name in case Vercel env var was saved under old VITE_ prefix
  const key = process.env.GEMINI_KEY || process.env.VITE_GEMINI_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_KEY not found in Vercel environment variables. Add it under Settings → Environment Variables and redeploy.' });

  // Vercel parses JSON bodies automatically, but guard against edge cases
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const prompt = body?.prompt;
  if (!prompt) return res.status(400).json({ error: 'prompt field required in request body' });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      return res.status(502).json({ error: `Gemini ${geminiRes.status}: ${text}` });
    }
    const data = await geminiRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Gemini call failed: ' + err.message });
  }
};
