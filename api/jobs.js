// api/jobs.js — Vercel serverless function
// Proxies requests to JSearch so the RapidAPI key never touches the browser

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.JSEARCH_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "JSEARCH_KEY not configured on server" });
  }

  // Forward all query params to JSearch
  const params = new URLSearchParams(req.query).toString();
  const url = `https://jsearch.p.rapidapi.com/search?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
