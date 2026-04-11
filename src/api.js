// The API key is injected at build time via Vite's env system.
// In development: add to .env.local
// In production: add to your hosting provider's environment variables UI
export const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

export async function callClaude({ system, userContent, maxTokens = 1000 }) {
  if (!ANTHROPIC_KEY) {
    throw new Error("Missing VITE_ANTHROPIC_API_KEY. See README for setup instructions.");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}
