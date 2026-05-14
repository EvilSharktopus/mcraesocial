// Vercel serverless function — POST /api/gemini-mark
// Proxies requests to Gemini using the server-side GEMINI_KEY env variable.
// The client never sees the key.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GEMINI_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_KEY env var not set on Vercel' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

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
