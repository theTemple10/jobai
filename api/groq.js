// api/groq.js — Vercel serverless function
// Proxies requests to Groq so the API key never touches the browser

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured on server" });
  }

  // Simple rate limiting — 30 requests per hour per IP
  // (In-memory, resets on cold start — good enough for personal use)
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  const now = Date.now();
  if (!global._rateLimits) global._rateLimits = {};
  const times = (global._rateLimits[ip] || []).filter((t) => now - t < 3600000);
  if (times.length >= 30) {
    return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
  }
  global._rateLimits[ip] = [...times, now];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
