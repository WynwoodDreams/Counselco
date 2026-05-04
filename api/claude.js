// Vercel serverless function: /api/claude
//
// Receives { prompt, maxTokens } from the client, calls Anthropic with the
// server-side API key (ANTHROPIC_API_KEY env var), returns the response.
//
// The browser never sees the API key. CORS is not an issue because the
// browser is calling our own /api endpoint, not Anthropic directly.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "ANTHROPIC_API_KEY not configured. Set it in Vercel project settings → Environment Variables.",
    });
  }

  const { prompt, maxTokens = 2000 } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' in request body" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Change model here if you want a different one (e.g., claude-opus-4-7
        // for higher quality, claude-haiku-4-5-20251001 for cheaper/faster).
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    console.error("Claude proxy error:", e);
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}
