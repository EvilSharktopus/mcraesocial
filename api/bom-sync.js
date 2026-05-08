// Vercel serverless function — POST /api/bom-sync
// Calls the Apify BOM actor using the server-side APIFY_TOKEN env variable.
// The client never sees the token.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN env var not set on Vercel' });

  const { movies } = req.body;
  if (!movies?.length) return res.status(400).json({ error: 'movies array required' });

  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/trovevault~movie-box-office-tracker/run-sync-get-dataset-items?token=${token}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movies }),
        signal: AbortSignal.timeout(125000),
      }
    );
    if (!apifyRes.ok) {
      const text = await apifyRes.text();
      return res.status(502).json({ error: `Apify ${apifyRes.status}: ${text}` });
    }
    const data = await apifyRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Apify call failed: ' + err.message });
  }
}
