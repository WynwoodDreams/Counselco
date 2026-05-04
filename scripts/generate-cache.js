// scripts/generate-cache.js
//
// Run once locally to pre-generate Claude responses for the demo sample
// inputs. Writes results to api/cache.json keyed by SHA-256 hash of the
// prompt. After running and committing, every visitor click on a sample
// button costs $0 — the proxy returns the cached response without
// hitting Anthropic.
//
// One-time cost: ~10–11 Anthropic API calls (~$0.50–$1).
// Ongoing cost: $0 for samples, normal API cost for custom user inputs.
//
// Usage:
//   1. Make sure .env.local has ANTHROPIC_API_KEY=sk-ant-...
//   2. Run: npm run generate-cache
//   3. Commit api/cache.json and push.
//
// The script extracts sample data, BM25, and citation logic directly
// from src/App.jsx using @babel/parser — no duplication. If you change
// any of those in App.jsx, just regenerate.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadEnv();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY in .env.local before running.");
  console.error("Get a key from https://console.anthropic.com/settings/keys");
  process.exit(1);
}

// ── Extract data + functions from src/App.jsx ─────────────────────────
const appPath = path.join(__dirname, "..", "src", "App.jsx");
if (!fs.existsSync(appPath)) {
  console.error(`Couldn't find ${appPath}`);
  process.exit(1);
}
const appCode = fs.readFileSync(appPath, "utf-8");
const ast = parse(appCode, { sourceType: "module", plugins: ["jsx"] });

const wantedConsts = new Set([
  "SAMPLE_NDA",
  "SAMPLE_TOS",
  "SAMPLE_FIRM",
  "SAMPLE_QUERIES",
  "SAMPLE_AWARDS",
  "US_CASES",
  "VERIFY_SAMPLES",
]);
const wantedFns = new Set([
  "bm25Tokenize",
  "buildAwardCorpus",
  "bm25Search",
  "extractCitations",
  "classifyCitations",
]);

const constSrcs = {};
const fnSrcs = [];
for (const node of ast.program.body) {
  if (node.type === "VariableDeclaration") {
    for (const decl of node.declarations) {
      if (wantedConsts.has(decl.id.name)) {
        constSrcs[decl.id.name] = appCode.slice(decl.init.start, decl.init.end);
      }
    }
  }
  if (node.type === "FunctionDeclaration" && wantedFns.has(node.id.name)) {
    fnSrcs.push(appCode.slice(node.start, node.end));
  }
}

const missing = [
  ...[...wantedConsts].filter((n) => !(n in constSrcs)),
  ...[...wantedFns].filter((n) => !fnSrcs.some((s) => s.startsWith(`function ${n}`))),
];
if (missing.length) {
  console.error("Missing from src/App.jsx:", missing);
  process.exit(1);
}

// Build runnable scope, get all needed bindings out
const scopeSrc = [
  ...Object.entries(constSrcs).map(([k, v]) => `const ${k} = ${v};`),
  ...fnSrcs,
  `return { ${[...wantedConsts, ...wantedFns].join(", ")} };`,
].join("\n");

const {
  SAMPLE_NDA,
  SAMPLE_TOS,
  SAMPLE_FIRM,
  SAMPLE_QUERIES,
  SAMPLE_AWARDS,
  US_CASES,
  VERIFY_SAMPLES,
  bm25Search,
  extractCitations,
  classifyCitations,
} = new Function(scopeSrc)();

// ── Prompt builders (mirror src/App.jsx exactly) ──────────────────────
// If you change a prompt template in App.jsx, change it here too and
// re-run the script.

function redlinePrompt(text) {
  return `You are a legal review assistant. Analyze the document and return ONLY a JSON object (no markdown fences, no preamble). Schema:

{
  "documentType": "string",
  "summary": "2-3 sentence summary of purpose and key terms",
  "risks": [
    {
      "id": "r1",
      "severity": "high" | "medium" | "low",
      "title": "5-8 word risk name",
      "description": "1-2 sentences on the risk and impact",
      "clause": "specific clause this relates to (max 120 chars)"
    }
  ],
  "suggestions": [
    {
      "id": "s1",
      "category": "ambiguity" | "missing-protection" | "favorable-edit" | "compliance" | "clarity",
      "original": "exact original text being modified (max 200 chars)",
      "proposed": "the suggested replacement",
      "rationale": "1-2 sentences why this improves the document"
    }
  ]
}

Generate 3-5 risks and 3-5 suggestions. Be specific and conservative — for human review, not autonomous application. No text outside the JSON.

Document:
${text}`;
}

function policyPrompt(firm) {
  return `You are an AI governance specialist drafting an AI use policy for a law firm. Return ONLY a JSON object (no markdown). Schema:

{
  "title": "string — formal policy title with firm name",
  "preamble": "1 paragraph stating purpose and scope",
  "sections": [
    {
      "id": "permitted-use",
      "title": "Permitted Uses",
      "body": "2-4 paragraphs of policy language as a single string"
    }
  ]
}

Generate sections covering: Permitted Uses, Prohibited Uses, Approved Tools, Confidential Information & Client Data, Client Disclosure, Output Review & Verification, Training Data Restrictions, Incident Reporting, and Sanctions for Violations. Use formal, enforceable policy language. Calibrate the strictness to the firm's risk tolerance.

Firm context:
- Name: ${firm.name || "[Firm Name]"}
- Size: ${firm.size || "unspecified"} attorneys
- Practice areas: ${firm.practiceAreas.join(", ") || "general practice"}
- Jurisdictions: ${firm.jurisdictions.join(", ") || "not specified"}
- Risk tolerance: ${firm.riskTolerance}
- Existing policy: ${firm.existingPolicy}
- Specific concerns: ${firm.concerns || "none stated"}

Return only the JSON.`;
}

function vendorPrompt(vendorName, useCase, tosText) {
  return `You are an AI vendor due diligence specialist. Analyze the vendor's terms of service for a law firm considering procurement. Return ONLY a JSON object (no markdown). Schema:

{
  "vendorName": "string",
  "overallRisk": "low" | "medium" | "high",
  "summary": "2-3 sentence assessment",
  "categories": [
    {
      "id": "data-rights",
      "title": "Data Rights & Training",
      "risk": "low" | "medium" | "high" | "unclear",
      "finding": "1-2 sentences on what the TOS says",
      "clause": "specific clause cited (max 200 chars)",
      "recommendation": "1 sentence recommended action"
    }
  ]
}

Generate findings for ALL of these categories: data-rights (training/derivative use), confidentiality (security/access), ip-ownership (inputs/outputs), indemnification, jurisdiction, termination, compliance-certifications. Be precise about what the TOS says vs. what is missing.

Vendor: ${vendorName || "Unspecified"}
Use case: ${useCase || "general legal work"}

Terms of Service:
${tosText}

Return only the JSON.`;
}

function researchPrompt(query) {
  const top = bm25Search(query, SAMPLE_AWARDS, 5);
  const awardContext = top
    .map(
      (r) => `
[${r.award.id}] ${r.award.caseName} (${r.award.tribunal}, ${r.award.year})
Subject: ${r.award.subject}
Summary: ${r.award.summary}
Holdings:
${r.award.holdings.map((h, idx) => `  ${idx + 1}. ${h}`).join("\n")}
Damages: ${r.award.damages}
Retrieval score: ${r.score.toFixed(3)}
`
    )
    .join("\n");

  return `You are a legal research analyst specializing in international arbitration. Given a query and the most relevant retrieved awards from a corpus, synthesize a research memo. Be CALIBRATED about confidence — explicitly state when the corpus has limited or no support for the query. Do not extrapolate beyond what the retrieved awards actually hold.

Return ONLY a JSON object (no markdown):

{
  "answer": "2-4 paragraph synthesis answering the query. Use inline citations in this exact format: [AW-001]. Cite only awards that genuinely support the proposition.",
  "confidence": "strong" | "moderate" | "weak" | "none",
  "confidenceRationale": "1-2 sentences explaining the confidence level — number of supporting awards, comparability of forum/subject, recency, factual distinguishability.",
  "supportingAwardIds": ["AW-001", "AW-003"],
  "caveats": "1-2 sentences on the limitations of this analysis — forum/jurisdictional differences, recency, factual distinguishability, or gaps in the corpus."
}

Confidence calibration:
- "strong": 3+ awards with directly on-point holdings from comparable tribunals
- "moderate": 2-3 awards with on-point holdings, or strong analogies from different forums
- "weak": 1 award, or only loosely analogous holdings
- "none": no award materially addresses the query

Query: ${query}

Retrieved awards (top ${top.length} by BM25):
${awardContext}

Return only the JSON.`;
}

function verifyDistortionPrompt(text, verifiedContext) {
  return `You are reviewing a piece of legal text that contains citations to court decisions. For each verified citation provided, determine whether the input text accurately characterizes the cited case's holdings, or whether the text materially misstates what the case held (a "distorted holding").

Be conservative: only flag a distortion if the text makes an assertion about the case that genuinely contradicts the actual holdings. Mere imprecision or summarization is not distortion.

Return ONLY a JSON object (no markdown, no preamble):

{
  "distortions": [
    {
      "citationId": "cit-N",
      "asserted": "what the input text claims the case held — paraphrase or short quote from the text (max 200 chars)",
      "actual": "what the case actually held — paraphrase from the holdings list (max 200 chars)",
      "explanation": "1-2 sentences on why these conflict"
    }
  ]
}

If the text accurately characterizes all verified citations, return: {"distortions": []}

Input text:
${text}

Verified citations and their actual holdings:
${JSON.stringify(verifiedContext, null, 2)}

Return only the JSON.`;
}

// ── Claude API ────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 2000) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`API ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

const hashPrompt = (p) => crypto.createHash("sha256").update(p).digest("hex");

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const cache = {};
  let count = 0;

  async function add(label, prompt, maxTokens = 2000) {
    process.stdout.write(`  [${++count}] ${label.slice(0, 60).padEnd(60)} `);
    try {
      const response = await callClaude(prompt, maxTokens);
      cache[hashPrompt(prompt)] = { label, response };
      const kb = (JSON.stringify(response).length / 1024).toFixed(1);
      console.log(`✓ ${kb}KB`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
      throw e;
    }
  }

  console.log("Generating cache for Counsel·Co demo samples...\n");

  console.log("REDLINE");
  await add("redline:NDA", redlinePrompt(SAMPLE_NDA), 2000);

  console.log("\nPOLICY");
  await add("policy:firm", policyPrompt(SAMPLE_FIRM), 3000);

  console.log("\nVENDOR");
  await add("vendor:TOS", vendorPrompt("ModelCo", "Document drafting", SAMPLE_TOS), 2500);

  console.log("\nRESEARCH");
  for (const q of SAMPLE_QUERIES) {
    await add(`research: ${q}`, researchPrompt(q), 1500);
  }

  console.log("\nVERIFY (distortion detection only — citations-only samples skip Claude)");
  for (const sample of VERIFY_SAMPLES) {
    const cls = classifyCitations(extractCitations(sample.text), US_CASES);
    const verified = cls.filter((c) => c.status === "verified");
    if (verified.length === 0) {
      console.log(`  -- ${sample.label}: no verified citations, no Claude call needed`);
      continue;
    }
    const ctx = verified.map((v) => ({
      citationId: v.id,
      caseName: v.match.caseName,
      citation: v.match.citation,
      court: v.match.court,
      year: v.match.year,
      holdings: v.match.holdings,
    }));
    await add(`verify: ${sample.label}`, verifyDistortionPrompt(sample.text, ctx), 1500);
  }

  const out = path.join(__dirname, "..", "api", "cache.json");
  fs.writeFileSync(out, JSON.stringify(cache, null, 2));

  const totalKb = (JSON.stringify(cache).length / 1024).toFixed(1);
  console.log(
    `\n✓ Wrote ${Object.keys(cache).length} cached responses → api/cache.json (${totalKb}KB total)`
  );
  console.log("  Commit api/cache.json and push. Sample button clicks now cost $0.");
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
