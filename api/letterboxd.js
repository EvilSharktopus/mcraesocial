// Vercel serverless function — fetches a Letterboxd user's RSS and returns
// their rating for a specific film slug.
// GET /api/letterboxd?username=mcraesocial&film=mortal-kombat-ii

export default async function handler(req, res) {
  const { username, film } = req.query;

  if (!username || !film) {
    return res.status(400).json({ error: 'username and film are required' });
  }

  // Sanitise inputs
  const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFilm = film.replace(/[^a-zA-Z0-9_-]/g, '');

  const rssUrl = `https://letterboxd.com/${safeUser}/rss/`;

  let xml;
  try {
    const response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mcraesocial/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return res.status(502).json({ error: `Letterboxd returned ${response.status}` });
    }
    xml = await response.text();
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach Letterboxd: ' + err.message });
  }

  // Parse the RSS for the matching film
  // Letterboxd RSS items have a <link> like https://letterboxd.com/user/film/film-slug/
  // and <letterboxd:memberRating> for the star rating (out of 5, half-stars allowed)
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  let rating = null;
  let filmTitle = null;
  let reviewUrl = null;

  for (const [, item] of items) {
    // Check if this item is for our film (link contains the slug)
    const linkMatch = item.match(/<link>(https?:\/\/letterboxd\.com\/[^<]+\/film\/([^/<]+)\/[^<]*)<\/link>/);
    if (!linkMatch) continue;

    const itemSlug = linkMatch[2].toLowerCase();
    if (itemSlug !== safeFilm.toLowerCase()) continue;

    reviewUrl = linkMatch[1];

    const ratingMatch = item.match(/<letterboxd:memberRating>([\d.]+)<\/letterboxd:memberRating>/);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);

    const titleMatch = item.match(/<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/);
    if (titleMatch) filmTitle = titleMatch[1].trim();

    break;
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // cache 5 min
  res.status(200).json({ username: safeUser, film: safeFilm, filmTitle, rating, reviewUrl });
}
