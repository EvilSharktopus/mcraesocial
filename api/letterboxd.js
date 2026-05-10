// Vercel serverless function — fetches a Letterboxd user's RSS and returns
// their rating for a specific film slug, or a list of recent reviews.
// GET /api/letterboxd?username=mcraesocial

export default async function handler(req, res) {
  const { username, film } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  // Sanitise inputs
  const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFilm = film ? film.replace(/[^a-zA-Z0-9_-]/g, '') : null;

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

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  
  if (safeFilm) {
    // Legacy single-film lookup
    let rating = null;
    let filmTitle = null;
    let reviewUrl = null;

    for (const [, item] of items) {
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

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ username: safeUser, film: safeFilm, filmTitle, rating, reviewUrl });
  }

  // Feed mode: return all items
  const feed = [];
  for (const [, item] of items) {
    const linkMatch = item.match(/<link>(https?:\/\/letterboxd\.com\/[^<]+\/film\/([^/<]+)\/[^<]*)<\/link>/);
    if (!linkMatch) continue;

    const reviewUrl = linkMatch[1];
    const slug = linkMatch[2].toLowerCase();
    
    let rating = null;
    const ratingMatch = item.match(/<letterboxd:memberRating>([\d.]+)<\/letterboxd:memberRating>/);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);

    let filmTitle = null;
    const titleMatch = item.match(/<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/);
    if (titleMatch) filmTitle = titleMatch[1].trim();

    let pubDate = null;
    const dateMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);
    if (dateMatch) pubDate = new Date(dateMatch[1]).toISOString();

    feed.push({ filmTitle, slug, rating, reviewUrl, pubDate });
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({ username: safeUser, feed });
}
