// Vercel serverless function: /api/claude
//
// Receives { prompt, maxTokens } from the client. Checks api/cache.json
// for a pre-generated response keyed by SHA-256 hash of the prompt — if
// hit, returns instantly for $0. Otherwise calls Anthropic with the
// server-side API key (ANTHROPIC_API_KEY env var) and returns the
// response.
//
// Run scripts/generate-cache.js locally to populate cache.json with
// responses for all the demo sample inputs. Once committed, every
// visitor click on a sample button costs $0 — only custom user inputs
// trigger paid API calls.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Load cache once per cold start
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let cache = {};
try {
  const cachePath = path.join(__dirname, "cache.json");
  if (fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    console.log(`[claude proxy] cache loaded: ${Object.keys(cache).length} entries`);
  } else {
    console.log("[claude proxy] no cache.json found — all calls will hit Anthropic");
  }
} catch (e) {
  console.warn("[claude proxy] cache load failed:", e.message);
}

function hashPrompt(prompt) {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, maxTokens = 2000 } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' in request body" });
  }

  // Cache check — sample inputs return cached responses for $0
  const hash = hashPrompt(prompt);
  if (cache[hash]) {
    return res.status(200).json(cache[hash].response);
  }

  // Fall through to Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        "ANTHROPIC_API_KEY not configured. Set it in Vercel project settings → Environment Variables.",
    });
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
