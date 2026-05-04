import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Scale,
  FileText,
  ShieldCheck,
  Building2,
  History,
  Plus,
  Check,
  X,
  Edit3,
  Download,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Trash2,
  Clock,
  Filter,
  ScrollText,
  CircleDot,
  Save,
  RotateCcw,
  Search,
  BookOpen,
  GitCommit,
  Quote,
  ChevronDown,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   DESIGN SYSTEM
   Felt-navy base. Slate/lavender accents. Acoustic-panel aesthetic.
   ───────────────────────────────────────────────────────────────────────── */

const DS = {
  bg: "#EDEEF2",
  surface: "#F5F6FA",
  surface2: "#FFFFFF",
  ink: "#0F1422",
  inkMuted: "#3E4A66",
  inkFaint: "#8B95AB",
  border: "#D8DCE6",
  borderStrong: "#B6BECF",
  highlight: "#C9C5DA",
  // Module accents
  redline: "#7c2d12",
  policy: "#14532d",
  vendor: "#2A3A5C",
  research: "#134e4a",
  verify: "#581c87",
  ledger: "#0F1422",
  // Semantic
  success: "#065f46",
  warning: "#b45309",
  danger: "#991b1b",
  info: "#1e40af",
};

// Empty string = CSS ambient fallback (animated gradient + hex texture + noise).
// If the URL fails to load (e.g. Cloudinary access restrictions), the hero
// silently falls back to the CSS ambient via onError.
const HERO_VIDEO_URL = "https://res.cloudinary.com/dsu7dcqu0/video/upload/v1777923157/shootingstar_hz4jag.mp4";

const MODULES = {
  home: { label: "Home", accent: DS.ink, icon: CircleDot },
  redline: { label: "Redline", accent: DS.redline, icon: FileText },
  policy: { label: "Policy", accent: DS.policy, icon: ShieldCheck },
  vendor: { label: "Vendor", accent: DS.vendor, icon: Building2 },
  research: { label: "Research", accent: DS.research, icon: BookOpen },
  verify: { label: "Verify", accent: DS.verify, icon: Quote },
  ledger: { label: "Ledger", accent: DS.ledger, icon: ScrollText },
};

/* ─────────────────────────────────────────────────────────────────────────
   STORAGE
   Anthropic's window.storage with safe fallbacks.
   ───────────────────────────────────────────────────────────────────────── */

const SK = {
  ledger: "counselco-ledger",
  policies: "counselco-policies",
  vendors: "counselco-vendors",
};

async function sGet(key, fallback) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : fallback;
    }
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
async function sSet(key, value) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(key, JSON.stringify(value));
      return true;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   CLAUDE API
   ───────────────────────────────────────────────────────────────────────── */

async function callClaude(prompt, maxTokens = 2000) {
  // In claude.ai artifact runtime, window.storage exists and Anthropic API
  // is callable directly without auth. In any other environment (e.g. a
  // Vite + Vercel deployment), we hit our own /api/claude proxy which adds
  // the API key server-side from process.env.ANTHROPIC_API_KEY.
  const isArtifact = typeof window !== "undefined" && !!window.storage;

  const url = isArtifact
    ? "https://api.anthropic.com/v1/messages"
    : "/api/claude";

  const body = isArtifact
    ? {
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }
    : { prompt, maxTokens };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const data = await response.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function parseJSON(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

/* ─────────────────────────────────────────────────────────────────────────
   AUDIT EVENT FACTORY
   ───────────────────────────────────────────────────────────────────────── */

function makeEvent(module, action, payload) {
  return {
    id: `${module}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    module,
    action,
    payload,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   SAMPLE DATA
   ───────────────────────────────────────────────────────────────────────── */

const SAMPLE_NDA = `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of the Effective Date by and between Acme Corp. and the Counterparty.

1. CONFIDENTIAL INFORMATION. "Confidential Information" means all information disclosed by one party to the other, whether orally or in writing, that is designated as confidential or that reasonably should be understood to be confidential.

2. OBLIGATIONS. The receiving party shall use reasonable efforts to protect the Confidential Information and shall not disclose it to third parties.

3. TERM. This Agreement shall remain in effect indefinitely.

4. REMEDIES. In the event of a breach, the disclosing party may seek any and all remedies available at law or equity, including damages.

5. GOVERNING LAW. This Agreement shall be governed by the laws of the applicable jurisdiction.

6. ENTIRE AGREEMENT. This Agreement constitutes the entire agreement between the parties.`;

const SAMPLE_TOS = `MODELCO PLATFORM TERMS OF SERVICE

1. CUSTOMER DATA. Customer grants ModelCo a worldwide, perpetual, royalty-free license to use Customer Data, including inputs and outputs, to improve, train, and develop ModelCo's models and services.

2. AVAILABILITY. ModelCo will use commercially reasonable efforts to maintain service availability but provides no SLA. Service may be modified or discontinued at any time without notice.

3. CONFIDENTIALITY. ModelCo shall treat Customer Data as confidential, except as needed for service operation, model improvement, or to comply with legal obligations.

4. INDEMNIFICATION. Customer shall indemnify ModelCo against all claims arising from Customer's use of the service. ModelCo provides no indemnification to Customer.

5. LIMITATION OF LIABILITY. ModelCo's total liability shall not exceed fees paid in the prior three months. ModelCo is not liable for any indirect, consequential, or special damages.

6. GOVERNING LAW. This Agreement is governed by the laws of the Cayman Islands. Disputes shall be resolved by binding arbitration in the Cayman Islands.

7. TERMINATION. Either party may terminate with 30 days notice. Upon termination, ModelCo will delete Customer Data within 90 days, except as retained for legal or operational purposes.`;

const SAMPLE_FIRM = {
  name: "Hartwell & Associates",
  size: "75",
  practiceAreas: ["Corporate", "Litigation", "M&A"],
  jurisdictions: ["United States"],
  riskTolerance: "moderate",
  concerns: "Concerned about client confidentiality when using AI, and about associates using consumer AI tools without oversight.",
  existingPolicy: "none",
};

/* ─────────────────────────────────────────────────────────────────────────
   ARBITRATION AWARDS CORPUS
   12 fictional-but-realistic awards covering common arbitration topics.
   Used by the Research module (BM25 + LLM synthesis).
   ───────────────────────────────────────────────────────────────────────── */

const SAMPLE_AWARDS = [
  {
    id: "AW-001",
    caseName: "Pacific Resources Holdings v. Republic of Andoria",
    year: 2018,
    tribunal: "ICSID",
    subject: "Indirect expropriation — mining concession",
    summary: "Canadian mining company sought USD 487M for revocation of copper mining concession through cumulative regulatory measures. Tribunal found indirect expropriation.",
    holdings: [
      "Cumulative regulatory measures may amount to indirect expropriation when they substantially deprive an investor of the value of its investment.",
      "The police powers doctrine does not apply where measures are disproportionate to stated environmental objectives.",
      "Damages calculated using discounted cash flow (DCF) method based on pre-revocation valuation.",
      "Costs allocated 70% to respondent state given disproportionality of state conduct.",
    ],
    damages: "USD 312 million awarded",
    tags: ["expropriation", "mining", "regulatory measures", "DCF", "police powers"],
  },
  {
    id: "AW-002",
    caseName: "Meridian Construction International v. Karthax Ministry of Infrastructure",
    year: 2020,
    tribunal: "ICC",
    subject: "Construction delay — FIDIC contract",
    summary: "Highway construction dispute. Contractor sought USD 89M for delays caused by ministry's failure to deliver site access and design changes.",
    holdings: [
      "Owner-caused delays excuse contractor performance under FIDIC Red Book Sub-Clause 8.4.",
      "Concurrent delay does not bar recovery where contractor delays are not on the critical path.",
      "Liquidated damages clause unenforceable as penalty under governing law where amount bears no relation to genuine pre-estimate of loss.",
      "Prolongation costs recoverable based on actual cost evidence, not formula-based calculations.",
    ],
    damages: "USD 67.4 million to contractor",
    tags: ["construction", "FIDIC", "delay damages", "concurrent delay", "liquidated damages", "commercial"],
  },
  {
    id: "AW-003",
    caseName: "Sterling Energy Holdings v. Republic of Vermosa",
    year: 2017,
    tribunal: "ICSID",
    subject: "Fair and equitable treatment — taxation",
    summary: "UK energy company challenged windfall profits tax on oil production. Tribunal upheld jurisdiction but rejected FET claim on the merits.",
    holdings: [
      "Tax measures fall within tribunal's jurisdiction where they are not bona fide tax measures within the treaty's tax carve-out.",
      "FET standard does not require regulatory stability absent specific commitments by the host state.",
      "Investor's legitimate expectations must be based on objective representations, not unilateral expectations or general legal framework.",
      "Burden of proof on claimant to establish breach of FET; mere economic loss insufficient.",
    ],
    damages: "None — claim dismissed on merits",
    tags: ["FET", "taxation", "legitimate expectations", "regulatory stability", "oil and gas", "carve-out"],
  },
  {
    id: "AW-004",
    caseName: "Voltari AG v. Eastland Shipping Company",
    year: 2019,
    tribunal: "LCIA",
    subject: "Charter party — off-hire and bunkers",
    summary: "Time charter dispute over off-hire periods due to engine breakdowns and substandard bunker fuel quality. Charterer counterclaimed for redelivery damages.",
    holdings: [
      "Off-hire clauses are strictly construed against the owner; 'any other cause' clauses require ejusdem generis interpretation limiting them to causes similar to those listed.",
      "Bunker specifications in charter parties are conditions, not warranties; breach justifies off-hire and damages.",
      "Wrongful redelivery damages calculated as difference between charter rate and prevailing market rate at time of breach.",
      "LCIA Rules permit emergency arbitrator interim relief without affecting substantive tribunal's authority.",
    ],
    damages: "USD 4.2 million to claimant",
    tags: ["charter party", "off-hire", "bunker quality", "maritime", "redelivery", "commercial"],
  },
  {
    id: "AW-005",
    caseName: "NewCo Holdings Ltd. v. Republic of Saravia",
    year: 2021,
    tribunal: "UNCITRAL (PCA-administered)",
    subject: "Jurisdiction — investor nationality",
    summary: "Tribunal declined jurisdiction finding claimant lacked genuine economic link to UK as required by the underlying BIT.",
    holdings: [
      "The treaty's requirement of 'siège social' requires more than a registered office; substance over form.",
      "Recently incorporated holding companies without economic substance fail nationality test under modern BITs.",
      "Denial of benefits clause may be invoked at the jurisdictional stage if invoked clearly and unequivocally before merits.",
      "Costs follow the event in jurisdictional dismissals where the nationality structure was opportunistic.",
    ],
    damages: "None — jurisdiction declined",
    tags: ["jurisdiction", "nationality", "denial of benefits", "BIT", "holding company", "siège social"],
  },
  {
    id: "AW-006",
    caseName: "Apex Pharma Group v. Ministry of Health of Calistria",
    year: 2016,
    tribunal: "PCA (UNCITRAL Rules)",
    subject: "Compulsory licensing — TRIPS flexibilities",
    summary: "Pharmaceutical company challenged compulsory licensing of patented HIV medication during public health emergency. Tribunal upheld measure.",
    holdings: [
      "Compulsory licensing under public health emergency falls within TRIPS Article 31 flexibilities and does not constitute expropriation.",
      "National treatment standard does not require commercial viability of investment — only non-discrimination between domestic and foreign investors.",
      "Reasonable royalty determination requires consideration of comparable licenses, not lost profits.",
      "Treaty interpretation must give effect to public health objectives expressed in the preamble.",
    ],
    damages: "USD 18 million royalty determination",
    tags: ["IP", "compulsory licensing", "TRIPS", "public health", "pharmaceutical", "patent"],
  },
  {
    id: "AW-007",
    caseName: "Bridgehead Capital Partners v. Federation of Niskara",
    year: 2022,
    tribunal: "ICSID",
    subject: "Damages valuation — toll road concession",
    summary: "Award addressed damages methodology for stranded toll road concession during sovereign debt crisis. Detailed treatment of country risk premium.",
    holdings: [
      "DCF method appropriate where investment has track record of cash flows; not speculative for going concerns.",
      "Country risk premium must reflect conditions at the valuation date, not the award date.",
      "The 'but for' counterfactual scenario must be plausible; speculative growth assumptions rejected.",
      "Pre-award interest accrues from date of breach at LIBOR plus 2 percent compounded annually.",
    ],
    damages: "USD 142 million awarded",
    tags: ["damages", "DCF", "country risk", "valuation", "infrastructure", "concession", "interest"],
  },
  {
    id: "AW-008",
    caseName: "Atlantis Telecom Holdings v. Republic of Druzhba",
    year: 2019,
    tribunal: "ICSID",
    subject: "Provisional measures — criminal proceedings",
    summary: "Tribunal granted provisional measures requiring respondent to suspend criminal proceedings against claimant's local subsidiary employees pending merits.",
    holdings: [
      "Prima facie jurisdiction is sufficient for provisional measures under ICSID Article 47 and Arbitration Rule 39.",
      "Aggravation of the dispute is a recognized ground for provisional measures, alongside preservation of rights.",
      "A tribunal may order suspension of domestic criminal proceedings where they are functionally connected to the investment dispute.",
      "Provisional measures must be necessary and urgent; principle of proportionality required.",
    ],
    damages: "N/A — procedural order",
    tags: ["provisional measures", "prima facie jurisdiction", "criminal proceedings", "telecommunications", "Article 47"],
  },
  {
    id: "AW-009",
    caseName: "Coastal Logistics International v. Port Authority of Tashomet",
    year: 2020,
    tribunal: "SIAC",
    subject: "Concession termination — material breach",
    summary: "Concession dispute over termination of port operations. Authority alleged operator breach of operational standards; operator alleged wrongful termination.",
    holdings: [
      "Material breach standard requires substantial deprivation of the contractual benefit, not mere technical default.",
      "Cure periods must be reasonable in context; expedited cure may waive future strict enforcement.",
      "Termination for convenience clauses are construed strictly and require explicit fee and notice provisions.",
      "Mitigation duty extends to claimant operator post-termination; failure to seek alternative engagements reduces recoverable damages.",
    ],
    damages: "USD 23 million to operator; counterclaim dismissed",
    tags: ["concession", "termination", "material breach", "mitigation", "port", "commercial"],
  },
  {
    id: "AW-010",
    caseName: "Eldorado Mining Holdings v. Republic of Kavarna",
    year: 2015,
    tribunal: "ICSID Annulment Committee",
    subject: "Annulment — manifest excess of powers",
    summary: "Annulment committee partially annulled an underlying award for manifest excess of powers regarding the damages calculation methodology.",
    holdings: [
      "Manifest excess of powers under ICSID Article 52(1)(b) requires both excess and that the excess be obvious without elaborate reasoning.",
      "A tribunal's failure to apply the applicable law constitutes manifest excess; mere misapplication of law does not.",
      "Partial annulment is permissible where annulled grounds are severable from non-annulled findings.",
      "Annulment review is not appellate; committees do not substitute their judgment for that of the original tribunal.",
    ],
    damages: "Award partially annulled; damages portion remitted",
    tags: ["annulment", "manifest excess", "applicable law", "damages", "ICSID Article 52", "review"],
  },
  {
    id: "AW-011",
    caseName: "Helios Solar Energy v. Republic of Levantine",
    year: 2021,
    tribunal: "PCA (UNCITRAL Rules)",
    subject: "Renewable energy — feed-in tariff cuts",
    summary: "Solar investor challenged retroactive cuts to feed-in tariff (FIT) scheme. Tribunal awarded partial damages on legitimate expectations grounds.",
    holdings: [
      "Specific statutory commitments may give rise to legitimate expectations under the FET standard, even absent contractual stabilization clauses.",
      "A reasonable rate of return may be modified prospectively but not retroactively without breaching FET.",
      "FIT regime changes that destroy investment economics breach FET when no transition mechanism is provided.",
      "Damages limited to investment losses, not lost profits, where regulatory change was foreseeable in some form.",
    ],
    damages: "USD 71 million awarded",
    tags: ["renewable energy", "FIT", "legitimate expectations", "regulatory change", "FET", "solar"],
  },
  {
    id: "AW-012",
    caseName: "Borealis Mining Corp v. Republic of Frontania",
    year: 2018,
    tribunal: "ICSID",
    subject: "Counterclaim — environmental damages",
    summary: "State counterclaim for environmental remediation costs admitted; the resulting set-off significantly reduced primary claim damages.",
    holdings: [
      "State counterclaims are admissible where they arise out of the same investment and the underlying BIT permits.",
      "Environmental obligations under domestic law are admissible counterclaim grounds, not merely defensive set-offs.",
      "Counterclaim damages must be proven with the same evidentiary rigor as primary claims.",
      "Set-off applied where both claims succeed; no separate enforcement of counterclaim against the foreign investor.",
    ],
    damages: "USD 24M net to claimant (USD 89M primary award reduced by USD 65M counterclaim)",
    tags: ["counterclaim", "environmental", "BIT", "set-off", "mining", "remediation"],
  },
];

const SAMPLE_QUERIES = [
  "What is the standard for indirect expropriation through cumulative regulatory measures?",
  "When can a tribunal grant provisional measures in ICSID arbitration?",
  "What damages methodology applies in stranded infrastructure asset cases?",
  "Are state counterclaims for environmental damages admissible under BITs?",
  "What is required for legitimate expectations to support an FET claim?",
];

/* ─────────────────────────────────────────────────────────────────────────
   US CASE LAW CORPUS
   30 real federal cases used by the Verify module. Heavy on aviation /
   Warsaw Convention (the domain Mata v. Avianca was in), plus civil
   procedure landmarks, constitutional cases, federal arbitration, torts.
   Research module continues to use the arbitration corpus above.
   ───────────────────────────────────────────────────────────────────────── */

const US_CASES = [
  {
    id: "C-001",
    caseName: "Air France v. Saks",
    citation: "470 U.S. 392 (1985)",
    court: "U.S. Supreme Court",
    year: 1985,
    subject: "Warsaw Convention — definition of 'accident' under Article 17",
    summary: "Plaintiff suffered hearing loss from cabin pressure changes during normal descent. Court held this was not an 'accident' under the Warsaw Convention.",
    holdings: [
      "An 'accident' under Warsaw Convention Article 17 requires an unexpected or unusual event external to the passenger.",
      "Internal reactions to normal aircraft operations do not constitute accidents.",
    ],
    topics: ["aviation", "warsaw convention", "accident", "international transport"],
  },
  {
    id: "C-002",
    caseName: "Eastern Airlines v. Floyd",
    citation: "499 U.S. 530 (1991)",
    court: "U.S. Supreme Court",
    year: 1991,
    subject: "Warsaw Convention — purely mental injury",
    summary: "Passengers experienced engine failure and feared death; sued for emotional distress. Court held purely mental injuries are not recoverable under the Warsaw Convention.",
    holdings: [
      "Article 17 does not allow recovery for purely mental injury unaccompanied by physical injury.",
      "The treaty's text and drafting history indicate the parties did not intend to allow mental-injury claims.",
    ],
    topics: ["aviation", "warsaw convention", "mental injury", "damages"],
  },
  {
    id: "C-003",
    caseName: "El Al Israel Airlines v. Tseng",
    citation: "525 U.S. 155 (1999)",
    court: "U.S. Supreme Court",
    year: 1999,
    subject: "Warsaw Convention — preemption of state law",
    summary: "Passenger subjected to security search sued under state law. Court held the Warsaw Convention preempts state-law claims for personal injury during international air travel.",
    holdings: [
      "Recovery for personal injury during international flight is governed exclusively by the Warsaw Convention.",
      "State-law tort claims are preempted whether or not the Convention provides an actionable claim.",
    ],
    topics: ["aviation", "warsaw convention", "preemption", "state law"],
  },
  {
    id: "C-004",
    caseName: "Olympic Airways v. Husain",
    citation: "540 U.S. 644 (2004)",
    court: "U.S. Supreme Court",
    year: 2004,
    subject: "Warsaw Convention — accident through inaction",
    summary: "Asthmatic passenger died after flight attendant repeatedly refused to move him away from smoking section. Court held the inaction constituted an 'accident.'",
    holdings: [
      "A flight attendant's refusal to assist a passenger in distress can constitute an 'accident' under Article 17.",
      "An accident need not be a single event; a course of inaction can qualify.",
    ],
    topics: ["aviation", "warsaw convention", "accident", "inaction"],
  },
  {
    id: "C-005",
    caseName: "Zicherman v. Korean Air Lines",
    citation: "516 U.S. 217 (1996)",
    court: "U.S. Supreme Court",
    year: 1996,
    subject: "Warsaw Convention — recoverable damages",
    summary: "Passengers killed when KAL flight 007 was shot down. Court held the Warsaw Convention permits recovery of damages allowed by applicable law, not state common law.",
    holdings: [
      "The Warsaw Convention does not itself prescribe the substantive law governing damages.",
      "U.S. Death on the High Seas Act applies for compensable damages, not state common law.",
    ],
    topics: ["aviation", "warsaw convention", "damages", "wrongful death"],
  },
  {
    id: "C-006",
    caseName: "International Shoe Co. v. Washington",
    citation: "326 U.S. 310 (1945)",
    court: "U.S. Supreme Court",
    year: 1945,
    subject: "Personal jurisdiction — minimum contacts",
    summary: "Foundational case establishing the minimum-contacts standard for personal jurisdiction over out-of-state defendants.",
    holdings: [
      "Due process requires a defendant have certain minimum contacts with the forum state such that maintenance of the suit does not offend traditional notions of fair play and substantial justice.",
      "Continuous and systematic contacts can support general jurisdiction; isolated contacts may support specific jurisdiction over related claims.",
    ],
    topics: ["civil procedure", "personal jurisdiction", "minimum contacts", "due process"],
  },
  {
    id: "C-007",
    caseName: "World-Wide Volkswagen Corp. v. Woodson",
    citation: "444 U.S. 286 (1980)",
    court: "U.S. Supreme Court",
    year: 1980,
    subject: "Personal jurisdiction — foreseeability and stream of commerce",
    summary: "Plaintiff sued NY car dealer in Oklahoma after accident there. Court held mere foreseeability of product reaching forum state insufficient for jurisdiction.",
    holdings: [
      "Foreseeability that a product may reach the forum state is not sufficient for personal jurisdiction.",
      "Defendant's conduct must constitute purposeful availment of the privilege of doing business in the forum state.",
    ],
    topics: ["civil procedure", "personal jurisdiction", "stream of commerce", "purposeful availment"],
  },
  {
    id: "C-008",
    caseName: "Hertz Corp. v. Friend",
    citation: "559 U.S. 77 (2010)",
    court: "U.S. Supreme Court",
    year: 2010,
    subject: "Diversity jurisdiction — corporate citizenship 'nerve center'",
    summary: "Adopted the 'nerve center' test for determining a corporation's principal place of business under 28 U.S.C. Section 1332(c)(1).",
    holdings: [
      "A corporation's principal place of business is its 'nerve center' — typically corporate headquarters where high-level officers direct business activities.",
      "The nerve center is a single place, not a circuit-by-circuit determination based on business activities.",
    ],
    topics: ["civil procedure", "diversity jurisdiction", "corporate citizenship", "nerve center"],
  },
  {
    id: "C-009",
    caseName: "Bell Atlantic Corp. v. Twombly",
    citation: "550 U.S. 544 (2007)",
    court: "U.S. Supreme Court",
    year: 2007,
    subject: "Pleading standard — plausibility",
    summary: "Antitrust conspiracy case establishing complaints must contain factual allegations plausibly suggesting an agreement, not just parallel conduct.",
    holdings: [
      "A complaint must contain enough factual matter to state a claim that is plausible on its face, not merely conceivable.",
      "Parallel conduct unaccompanied by allegations of agreement is insufficient to plead an antitrust conspiracy.",
    ],
    topics: ["civil procedure", "pleading", "plausibility", "antitrust", "rule 12"],
  },
  {
    id: "C-010",
    caseName: "Ashcroft v. Iqbal",
    citation: "556 U.S. 662 (2009)",
    court: "U.S. Supreme Court",
    year: 2009,
    subject: "Pleading standard — Twombly extended",
    summary: "Extended Twombly's plausibility standard from antitrust to all civil cases. Plaintiff alleging discrimination by federal officials must plead specific factual content.",
    holdings: [
      "Twombly's plausibility standard applies to all civil actions, not just antitrust.",
      "Conclusory allegations entitled to no presumption of truth; only well-pleaded factual content evaluated.",
      "Plausibility is a context-specific task requiring judicial experience and common sense.",
    ],
    topics: ["civil procedure", "pleading", "plausibility", "rule 12", "discrimination"],
  },
  {
    id: "C-011",
    caseName: "Daubert v. Merrell Dow Pharmaceuticals",
    citation: "509 U.S. 579 (1993)",
    court: "U.S. Supreme Court",
    year: 1993,
    subject: "Expert testimony — admissibility under Rule 702",
    summary: "Established the modern standard for admissibility of expert scientific testimony under Federal Rule of Evidence 702.",
    holdings: [
      "Trial judges serve as gatekeepers, ensuring expert testimony rests on a reliable foundation and is relevant.",
      "Frye 'general acceptance' test superseded by Federal Rules of Evidence.",
      "Relevant factors include testability, peer review, error rate, and general acceptance.",
    ],
    topics: ["evidence", "expert testimony", "scientific evidence", "rule 702", "gatekeeper"],
  },
  {
    id: "C-012",
    caseName: "Erie Railroad Co. v. Tompkins",
    citation: "304 U.S. 64 (1938)",
    court: "U.S. Supreme Court",
    year: 1938,
    subject: "Federal courts — applicable substantive law in diversity",
    summary: "Overruled Swift v. Tyson; held federal courts in diversity must apply state substantive law, not federal general common law.",
    holdings: [
      "There is no federal general common law; federal courts in diversity must apply state substantive law.",
      "Swift v. Tyson is overruled.",
    ],
    topics: ["federal courts", "diversity", "choice of law", "common law", "Erie doctrine"],
  },
  {
    id: "C-013",
    caseName: "Marbury v. Madison",
    citation: "5 U.S. (1 Cranch) 137 (1803)",
    court: "U.S. Supreme Court",
    year: 1803,
    subject: "Judicial review — power to invalidate legislation",
    summary: "Established the principle of judicial review: courts have the power to declare acts of Congress unconstitutional.",
    holdings: [
      "It is emphatically the province and duty of the judicial department to say what the law is.",
      "An act of Congress repugnant to the Constitution is void; courts must follow the Constitution when conflicts arise.",
    ],
    topics: ["constitutional law", "judicial review", "separation of powers"],
  },
  {
    id: "C-014",
    caseName: "Brown v. Board of Education of Topeka",
    citation: "347 U.S. 483 (1954)",
    court: "U.S. Supreme Court",
    year: 1954,
    subject: "Equal protection — school segregation",
    summary: "Unanimously held racial segregation in public schools violates the Equal Protection Clause of the Fourteenth Amendment.",
    holdings: [
      "Separate educational facilities are inherently unequal.",
      "Plessy v. Ferguson's 'separate but equal' doctrine has no place in public education.",
    ],
    topics: ["constitutional law", "equal protection", "segregation", "fourteenth amendment"],
  },
  {
    id: "C-015",
    caseName: "Miranda v. Arizona",
    citation: "384 U.S. 436 (1966)",
    court: "U.S. Supreme Court",
    year: 1966,
    subject: "Self-incrimination — custodial interrogation warnings",
    summary: "Required police inform suspects of their constitutional rights before custodial interrogation.",
    holdings: [
      "Prosecution may not use statements from custodial interrogation unless the suspect was warned of rights to silence and counsel.",
      "Suspects must be informed they have the right to remain silent, that statements can be used against them, and that they have the right to counsel.",
    ],
    topics: ["criminal procedure", "self-incrimination", "fifth amendment", "interrogation"],
  },
  {
    id: "C-016",
    caseName: "Gideon v. Wainwright",
    citation: "372 U.S. 335 (1963)",
    court: "U.S. Supreme Court",
    year: 1963,
    subject: "Right to counsel — indigent defendants in state court",
    summary: "Held the Sixth Amendment right to counsel applies to state criminal proceedings via the Fourteenth Amendment.",
    holdings: [
      "The Sixth Amendment right to counsel is fundamental and applies to states through the Fourteenth Amendment.",
      "Any person hauled into court who is too poor to hire a lawyer cannot be assured a fair trial unless counsel is provided.",
    ],
    topics: ["criminal procedure", "right to counsel", "sixth amendment", "indigent"],
  },
  {
    id: "C-017",
    caseName: "AT&T Mobility LLC v. Concepcion",
    citation: "563 U.S. 333 (2011)",
    court: "U.S. Supreme Court",
    year: 2011,
    subject: "Federal Arbitration Act — class action waivers",
    summary: "Held the FAA preempts state laws conditioning enforceability of arbitration agreements on availability of class procedures.",
    holdings: [
      "The Federal Arbitration Act preempts California's Discover Bank rule barring class action waivers in consumer arbitration.",
      "Requiring availability of class arbitration interferes with fundamental attributes of arbitration.",
    ],
    topics: ["arbitration", "FAA", "class actions", "preemption", "consumer"],
  },
  {
    id: "C-018",
    caseName: "Stolt-Nielsen v. AnimalFeeds International",
    citation: "559 U.S. 662 (2010)",
    court: "U.S. Supreme Court",
    year: 2010,
    subject: "Arbitration — class arbitration consent",
    summary: "Held a party may not be compelled to submit to class arbitration absent a contractual agreement to do so.",
    holdings: [
      "Class arbitration cannot be imposed on parties whose arbitration agreements are silent on the question.",
      "A party's consent to class arbitration cannot be inferred from agreement to arbitrate.",
    ],
    topics: ["arbitration", "class arbitration", "consent", "FAA"],
  },
  {
    id: "C-019",
    caseName: "MacPherson v. Buick Motor Co.",
    citation: "217 N.Y. 382 (1916)",
    court: "New York Court of Appeals",
    year: 1916,
    subject: "Tort — privity in negligence and products liability",
    summary: "Foundational products-liability case. Held a manufacturer owes a duty of care to the ultimate consumer regardless of privity.",
    holdings: [
      "A manufacturer of products that may reasonably be expected to cause injury when negligently made owes a duty of care to all foreseeable users.",
      "Privity of contract is not required to maintain a negligence action against the manufacturer.",
    ],
    topics: ["torts", "products liability", "negligence", "privity"],
  },
  {
    id: "C-020",
    caseName: "Palsgraf v. Long Island Railroad Co.",
    citation: "248 N.Y. 339 (1928)",
    court: "New York Court of Appeals",
    year: 1928,
    subject: "Tort — proximate cause and foreseeability of plaintiff",
    summary: "Foundational duty/foreseeability case. Cardozo's majority held defendant owes no duty to unforeseeable plaintiffs.",
    holdings: [
      "Negligence requires a duty owed to the plaintiff; defendant is not liable for injuries to plaintiffs whose harm was not reasonably foreseeable.",
      "The risk reasonably to be perceived defines the duty to be obeyed.",
    ],
    topics: ["torts", "negligence", "proximate cause", "foreseeability", "duty"],
  },
  {
    id: "C-021",
    caseName: "Tarasoff v. Regents of the University of California",
    citation: "17 Cal. 3d 425 (1976)",
    court: "Supreme Court of California",
    year: 1976,
    subject: "Tort — duty to warn third parties",
    summary: "Held that a therapist has a duty to take reasonable steps to protect identifiable third parties from violent threats made by patients.",
    holdings: [
      "A therapist who knows or should know that a patient poses a serious danger to a third party has a duty to take reasonable steps to protect that party.",
      "The duty may include warning the intended victim or others likely to apprise the victim of danger.",
    ],
    topics: ["torts", "duty to warn", "psychotherapy", "third parties"],
  },
  {
    id: "C-022",
    caseName: "SEC v. W.J. Howey Co.",
    citation: "328 U.S. 293 (1946)",
    court: "U.S. Supreme Court",
    year: 1946,
    subject: "Securities — definition of investment contract",
    summary: "Established the test for what constitutes an 'investment contract' under the Securities Act of 1933.",
    holdings: [
      "An investment contract exists where there is an investment of money in a common enterprise with profits to come solely from the efforts of others.",
      "Form should be disregarded for substance in determining whether an arrangement is a security.",
    ],
    topics: ["securities", "investment contract", "Howey test", "1933 act"],
  },
  {
    id: "C-023",
    caseName: "Smith v. Van Gorkom",
    citation: "488 A.2d 858 (Del. 1985)",
    court: "Supreme Court of Delaware",
    year: 1985,
    subject: "Corporate law — duty of care",
    summary: "Held directors breached their duty of care by approving a merger after only two hours of consideration without adequate inquiry.",
    holdings: [
      "Directors must inform themselves of all material information reasonably available before making a business decision.",
      "Gross negligence in the decision-making process is not protected by the business judgment rule.",
    ],
    topics: ["corporate law", "directors duties", "duty of care", "business judgment", "merger"],
  },
  {
    id: "C-024",
    caseName: "Monell v. Department of Social Services",
    citation: "436 U.S. 658 (1978)",
    court: "U.S. Supreme Court",
    year: 1978,
    subject: "Section 1983 — municipal liability",
    summary: "Held municipalities are 'persons' subject to suit under 42 U.S.C. Section 1983, but only for their own policies, not respondeat superior.",
    holdings: [
      "Local governments are 'persons' for purposes of Section 1983 and may be sued directly for constitutional violations.",
      "Municipal liability requires that the constitutional violation result from official policy or custom, not respondeat superior.",
    ],
    topics: ["civil rights", "section 1983", "municipal liability", "respondeat superior"],
  },
  {
    id: "C-025",
    caseName: "Bivens v. Six Unknown Named Agents",
    citation: "403 U.S. 388 (1971)",
    court: "U.S. Supreme Court",
    year: 1971,
    subject: "Implied cause of action against federal officials",
    summary: "Recognized an implied private right of action for damages against federal officials who violate constitutional rights.",
    holdings: [
      "An individual whose Fourth Amendment rights are violated by federal agents has a federal cause of action for damages.",
      "Damages may be obtained even in the absence of express statutory authorization.",
    ],
    topics: ["civil rights", "implied cause of action", "fourth amendment", "federal officials"],
  },
  {
    id: "C-026",
    caseName: "Strickland v. Washington",
    citation: "466 U.S. 668 (1984)",
    court: "U.S. Supreme Court",
    year: 1984,
    subject: "Sixth Amendment — ineffective assistance of counsel",
    summary: "Established the two-part test for ineffective assistance of counsel claims under the Sixth Amendment.",
    holdings: [
      "An ineffective-assistance claim requires showing both deficient performance and resulting prejudice.",
      "Performance is evaluated for reasonableness under prevailing professional norms; prejudice requires reasonable probability the result would have differed.",
    ],
    topics: ["criminal procedure", "ineffective assistance", "sixth amendment", "Strickland test"],
  },
  {
    id: "C-027",
    caseName: "Terry v. Ohio",
    citation: "392 U.S. 1 (1968)",
    court: "U.S. Supreme Court",
    year: 1968,
    subject: "Fourth Amendment — investigatory stops and frisks",
    summary: "Held police may stop and frisk a person based on reasonable suspicion of criminal activity, less than probable cause.",
    holdings: [
      "Police officer may stop a person briefly for investigation upon reasonable suspicion of criminal activity.",
      "Officer may pat down for weapons if reasonable suspicion the person is armed and dangerous.",
    ],
    topics: ["criminal procedure", "fourth amendment", "search and seizure", "Terry stop"],
  },
  {
    id: "C-028",
    caseName: "Hadley v. Baxendale",
    citation: "9 Exch. 341 (1854)",
    court: "Court of Exchequer",
    year: 1854,
    subject: "Contracts — consequential damages and foreseeability",
    summary: "Established the rule limiting consequential damages to those reasonably foreseeable at contract formation.",
    holdings: [
      "Damages for breach of contract are limited to those that arise naturally from the breach or were reasonably contemplated by both parties at formation.",
      "Special circumstances must be communicated to render special damages recoverable.",
    ],
    topics: ["contracts", "damages", "consequential damages", "foreseeability", "Hadley rule"],
  },
  {
    id: "C-029",
    caseName: "Lucy v. Zehmer",
    citation: "196 Va. 493 (1954)",
    court: "Supreme Court of Virginia",
    year: 1954,
    subject: "Contracts — objective theory of assent",
    summary: "Held contracts are formed based on objective manifestations of assent, regardless of subjective intent.",
    holdings: [
      "If a party's words or acts have but one reasonable meaning, the undisclosed intention is immaterial to contract formation.",
      "The objective theory of assent governs contract formation; secret jokes do not negate apparent agreement.",
    ],
    topics: ["contracts", "formation", "objective theory", "assent", "intent"],
  },
  {
    id: "C-030",
    caseName: "Hickman v. Taylor",
    citation: "329 U.S. 495 (1947)",
    court: "U.S. Supreme Court",
    year: 1947,
    subject: "Discovery — work-product doctrine",
    summary: "Established the work-product doctrine protecting attorney materials prepared in anticipation of litigation from discovery.",
    holdings: [
      "Materials prepared by an attorney in anticipation of litigation are generally not discoverable absent showing of necessity.",
      "Discovery cannot be used to obtain the mental impressions and strategies of opposing counsel.",
    ],
    topics: ["civil procedure", "discovery", "work product", "attorney-client", "rule 26"],
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   HALL OF HALLUCINATIONS
   Real publicly documented cases where lawyers were sanctioned for
   submitting AI-hallucinated citations. These are factual case
   summaries (public record). The "representativeText" fields are
   illustrative excerpts — they exhibit the same hallucination pattern
   as the real briefs without reproducing court documents verbatim,
   and they reference the existing arbitration corpus so the BM25
   layer does meaningful work in the demo.
   ───────────────────────────────────────────────────────────────────────── */

const HALLUCINATION_CASES = [
  {
    id: "hc-mata",
    caseName: "Mata v. Avianca, Inc.",
    court: "S.D.N.Y.",
    year: 2023,
    summary:
      "The original ChatGPT-lawyer case. Counsel filed a brief opposing motion to dismiss containing six fabricated case citations and quoted holdings invented by ChatGPT. The lawyer asked ChatGPT whether the cases were real; the bot said yes.",
    sanction: "USD 5,000 fine; mandatory CLE; public reprimand",
    pattern: "fabricated case citations + invented holdings",
  },
  {
    id: "hc-park",
    caseName: "Park v. Kim",
    court: "2nd Circuit",
    year: 2024,
    summary:
      "Attorney filed an appellate brief containing citations to non-existent cases generated by ChatGPT. Court referred counsel to the Grievance Panel and struck the brief.",
    sanction: "Brief stricken; referral to disciplinary committee",
    pattern: "fabricated citations on appeal",
  },
  {
    id: "hc-crabill",
    caseName: "People v. Crabill",
    court: "Colorado Supreme Court",
    year: 2023,
    summary:
      "Attorney used ChatGPT to draft a motion to set aside a judgment. The motion contained citations to cases that did not exist. One of the most severe sanctions issued for AI hallucinations in legal filings.",
    sanction: "Two-year suspension from practice",
    pattern: "fabricated citations + failure to verify",
  },
];

const VERIFY_SAMPLES = [
  {
    label: "Mata excerpt — fabricated citations",
    description: "Three of the actual fake citations from Mata v. Avianca (the 2023 ChatGPT-lawyer case). Should all return not-in-corpus.",
    text: `Counsel respectfully submits that bankruptcy proceedings tolled the two-year limitations period under the Montreal Convention. As established in Varghese v. China Southern Airlines Co., 925 F.3d 1339 (11th Cir. 2019), bankruptcy automatically extends the time to file under Article 35. This holding was reaffirmed in Shaboon v. EgyptAir, where the court found similar tolling appropriate. Additionally, in Petersen v. Iran Air, 905 F. Supp. 2d 121 (D.D.C. 2013), the court held that procedural delays attributable to the defendant must extend the limitations period.`,
  },
  {
    label: "Real aviation precedent — clean",
    description: "Real Supreme Court Warsaw Convention cases. Should all verify against the corpus.",
    text: `The Warsaw Convention establishes a framework for liability during international air carriage. The Supreme Court's decision in Air France v. Saks, 470 U.S. 392 (1985), defined "accident" under Article 17 as an unexpected or unusual event external to the passenger. This principle was extended in Olympic Airways v. Husain, 540 U.S. 644 (2004), which held that flight attendant inaction in response to a foreseeable medical emergency could itself constitute an accident.`,
  },
  {
    label: "Mixed — real and fabricated",
    description: "One genuine Supreme Court case, one invented. Should produce one verified, one not-in-corpus.",
    text: `The Supreme Court in Air France v. Saks, 470 U.S. 392 (1985), defined "accident" under the Warsaw Convention as an unexpected event external to the passenger. This principle was extended in Varghese v. China Southern Airlines, 925 F.3d 1339 (11th Cir. 2019), where the court held that mechanical malfunctions during normal flight constitute accidents per se.`,
  },
  {
    label: "Distorted holding — real case, wrong holding",
    description: "Cites a real Supreme Court case but materially misstates what it held. Should flag the distortion.",
    text: `As the Supreme Court made clear in Air France v. Saks, 470 U.S. 392 (1985), any injury suffered during international air travel automatically constitutes an "accident" triggering Warsaw Convention liability, regardless of cause or external factors. This principle of strict liability for all in-flight injuries is foundational to aviation law.`,
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   SHARED PRIMITIVES
   ───────────────────────────────────────────────────────────────────────── */

// Word-by-word pull-up reveal for editorial headlines.
function WordPullUp({ children, className, style, delayChildren = 0.1, stagger = 0.06 }) {
  const text = typeof children === "string" ? children : "";
  const parts = text.split(" ");
  return (
    <motion.span
      className={className}
      style={{ display: "inline-block", ...style }}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { delayChildren, staggerChildren: stagger } },
      }}
    >
      {parts.map((word, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { y: "0.5em", opacity: 0 },
            visible: { y: 0, opacity: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
          }}
          style={{ display: "inline-block", marginRight: i === parts.length - 1 ? 0 : "0.28em" }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

function Btn({ children, variant = "primary", icon: Icon, accent, ...rest }) {
  const styles = {
    primary: { bg: DS.ink, color: DS.bg, border: DS.ink },
    secondary: { bg: DS.surface2, color: DS.ink, border: DS.borderStrong },
    ghost: { bg: "transparent", color: DS.ink, border: DS.borderStrong },
    accent: { bg: accent || DS.ink, color: DS.bg, border: accent || DS.ink },
    subtle: { bg: DS.surface, color: DS.ink, border: DS.borderStrong },
  }[variant];
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "10px 16px",
        fontSize: 13,
        fontFamily: "inherit",
        fontWeight: 500,
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        borderRadius: 6,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.5 : 1,
        transition: "all 0.15s",
        ...rest.style,
      }}
    >
      {Icon && <Icon size={13} strokeWidth={2} />}
      {children}
    </button>
  );
}

function Pill({ children, color, bg }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-block",
        fontSize: 10,
        letterSpacing: "0.05em",
        padding: "2px 8px",
        background: bg || color + "18",
        color: color,
        borderRadius: 4,
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children, accent = DS.ink }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 11,
        color: accent,
        letterSpacing: "0.12em",
        marginBottom: 8,
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function Loader({ accent = DS.ink, label = "Working", sublabel }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 360,
      }}
    >
      <Loader2 size={28} className="animate-spin" style={{ color: accent }} />
      <div className="fr" style={{ fontSize: 22, fontWeight: 500, marginTop: 18 }}>
        {label}…
      </div>
      {sublabel && (
        <div className="mono" style={{ fontSize: 11, color: DS.inkFaint, marginTop: 6, letterSpacing: "0.08em" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function Empty({ icon: Icon, title, body, action }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        border: `1px dashed ${DS.borderStrong}`,
        borderRadius: 2,
        background: DS.surface,
      }}
    >
      {Icon && <Icon size={28} strokeWidth={1.25} style={{ color: DS.inkFaint, marginBottom: 12 }} />}
      <div className="fr" style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: 13, color: DS.inkMuted, maxWidth: 340, margin: "0 auto 16px", lineHeight: 1.5 }}>
          {body}
        </div>
      )}
      {action}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DIFF UTILITY — word-level LCS diff for policy version comparison
   ───────────────────────────────────────────────────────────────────────── */

function tokenizeForDiff(s) {
  if (!s) return [];
  return s.split(/(\s+)/).filter((t) => t.length > 0);
}

function diffTokens(oldT, newT) {
  const m = oldT.length;
  const n = newT.length;
  // LCS table
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldT[i - 1] === newT[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldT[i - 1] === newT[j - 1]) {
      out.unshift({ type: "eq", value: oldT[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.unshift({ type: "add", value: newT[j - 1] });
      j--;
    } else {
      out.unshift({ type: "rm", value: oldT[i - 1] });
      i--;
    }
  }
  // Coalesce consecutive same-type tokens for cleaner rendering
  const coalesced = [];
  for (const tok of out) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.type === tok.type) last.value += tok.value;
    else coalesced.push({ ...tok });
  }
  return coalesced;
}

function DiffView({ before, after, compact = false }) {
  const tokens = diffTokens(tokenizeForDiff(before), tokenizeForDiff(after));
  const stats = tokens.reduce(
    (a, t) => {
      if (t.type === "add") a.added += t.value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
      if (t.type === "rm") a.removed += t.value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
      return a;
    },
    { added: 0, removed: 0 }
  );

  return (
    <div>
      {!compact && (
        <div className="mono" style={{ fontSize: 10, color: DS.inkFaint, marginBottom: 6, letterSpacing: "0.05em" }}>
          <span style={{ color: "#065f46" }}>+{stats.added}</span>
          {"  "}
          <span style={{ color: "#991b1b" }}>−{stats.removed}</span>
          {"  WORDS"}
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          padding: 14,
          background: DS.surface2,
          border: `1px solid ${DS.border}`,
          borderRadius: 2,
        }}
      >
        {tokens.map((t, i) => {
          if (t.type === "eq") return <span key={i}>{t.value}</span>;
          if (t.type === "add")
            return (
              <span
                key={i}
                style={{ background: "#dcfce7", color: "#065f46", padding: "1px 2px", borderRadius: 1 }}
              >
                {t.value}
              </span>
            );
          return (
            <span
              key={i}
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                textDecoration: "line-through",
                padding: "1px 2px",
                borderRadius: 1,
              }}
            >
              {t.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   BM25 SEARCH — keyword-based retrieval over the awards corpus
   No embeddings endpoint is exposed in the artifact API, so we use BM25.
   In production legal RAG, BM25 + LLM rerank often beats vanilla vector
   search anyway because exact terminology matters ("FET breach" ≠
   "fairness violation").
   ───────────────────────────────────────────────────────────────────────── */

function bm25Tokenize(s) {
  return (s || "").toLowerCase().match(/[a-z][a-z'-]{1,}/g) || [];
}

function buildAwardCorpus(awards) {
  return awards.map((a) =>
    bm25Tokenize(
      [
        a.caseName,
        a.subject,
        a.summary,
        ...(a.holdings || []),
        (a.tags || []).join(" "),
        a.tribunal,
      ].join(" ")
    )
  );
}

function bm25Search(query, awards, k = 5) {
  const k1 = 1.5;
  const b = 0.75;
  const corpus = buildAwardCorpus(awards);
  const N = corpus.length;
  const avgLen = corpus.reduce((s, d) => s + d.length, 0) / N;
  const qTokens = [...new Set(bm25Tokenize(query))];

  // Document frequencies
  const df = {};
  for (const term of qTokens) {
    df[term] = corpus.filter((d) => d.includes(term)).length;
  }

  const scored = awards.map((a, idx) => {
    const doc = corpus[idx];
    let score = 0;
    for (const term of qTokens) {
      const tf = doc.filter((t) => t === term).length;
      if (tf === 0) continue;
      const idf = Math.log((N - df[term] + 0.5) / (df[term] + 0.5) + 1);
      const norm = tf * (k1 + 1);
      const denom = tf + k1 * (1 - b + (b * doc.length) / avgLen);
      score += idf * (norm / denom);
    }
    return { award: a, score };
  });

  return scored.sort((x, y) => y.score - x.score).slice(0, k);
}

/* ─────────────────────────────────────────────────────────────────────────
   CITATION VERIFICATION ENGINE
   Used by the Verify module to validate AI-generated text.

   The pipeline:
     1. extractCitations(text) — regex over the input, finds AW-### refs
        and case-name patterns ("X v. Y").
     2. classifyCitations(citations, awards) — for each, run BM25 +
        case-name overlap against the corpus, classify as:
          verified      — strong match, name overlap confirmed
          partial       — moderate match (case name present in corpus
                          but unclear which award; or weak overlap)
          not-in-corpus — no match against indexed corpus (fabricated,
                          or cites a real case from another corpus)
          unknown       — couldn't analyze
     3. Verify component layers a Claude call on top to detect
        DISTORTED holdings — citations that pass step 2 but where the
        asserted proposition contradicts the actual award holdings.
   ───────────────────────────────────────────────────────────────────────── */

const VERIFY_STATUS = {
  verified: { label: "Verified", color: DS.success, bg: "#ecfdf5" },
  partial: { label: "Partial match", color: DS.warning, bg: "#fdf6ec" },
  distorted: { label: "Distorted holding", color: "#c2410c", bg: "#fff7ed" },
  "not-in-corpus": { label: "Not in corpus", color: DS.danger, bg: "#fdf2f2" },
  unknown: { label: "Unrecognized", color: DS.inkFaint, bg: DS.surface },
};

function extractCitations(text) {
  if (!text) return [];
  const citations = [];
  const seen = new Set();

  // 1. AW-XXX identifiers (specific to our corpus)
  for (const m of text.matchAll(/\bAW-\d{3}\b/g)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    citations.push({
      id: `cit-${citations.length}`,
      type: "aw-id",
      text: m[0],
      position: m.index,
      length: m[0].length,
    });
  }

  // 2. Case names (Plaintiff v. Defendant pattern)
  // Allows lowercase connector words (of, the, and, for, in) between
  // capitalized tokens — handles "Brown v. Board of Education",
  // "Securities and Exchange Commission v. Howey", etc.
  const caseRegex = /\b([A-Z][\w&.\-']+(?:\s+(?:[A-Z][\w&.\-']+|of|the|and|for|in)){0,6})\s+v\.?\s+([A-Z][\w&.\-']+(?:\s+(?:[A-Z][\w&.\-']+|of|the|and|for|in)){0,6})\b/g;
  for (const m of text.matchAll(caseRegex)) {
    const fullName = m[0];
    if (seen.has(fullName)) continue;
    seen.add(fullName);
    citations.push({
      id: `cit-${citations.length}`,
      type: "case-name",
      text: fullName,
      plaintiff: m[1].trim(),
      defendant: m[2].trim(),
      position: m.index,
      length: fullName.length,
    });
  }

  return citations.sort((a, b) => a.position - b.position);
}

function classifyCitations(citations, awards) {
  return citations.map((cite) => {
    // Direct AW-### lookup
    if (cite.type === "aw-id") {
      const award = awards.find((a) => a.id === cite.text);
      return award
        ? { ...cite, status: "verified", match: award, score: 1.0 }
        : { ...cite, status: "not-in-corpus", match: null, score: 0 };
    }

    // Case-name BM25 search
    if (cite.type === "case-name") {
      const results = bm25Search(cite.text, awards, 3);
      const top = results[0];
      if (!top || top.score === 0) {
        return { ...cite, status: "not-in-corpus", match: null, score: 0 };
      }

      // Stricter overlap: count DISTINCTIVE token overlaps between the
      // citation and the matched case name. Generic legal tokens like
      // "airlines" or "corp" don't count — otherwise "Varghese v. China
      // Southern Airlines" falsely verifies against "Eastern Airlines v.
      // Floyd" purely on the shared word "airlines".
      const STOP_LEGAL = new Set([
        "airlines", "airline", "airways", "company", "corp", "corporation",
        "incorporated", "inc", "ltd", "co", "llc", "lp", "group", "holdings",
        "international", "services", "systems", "industries", "enterprises",
        "republic", "department", "ministry", "states", "united",
      ]);
      const matchedNameLower = top.award.caseName.toLowerCase();
      const citeTokensRaw = cite.text.toLowerCase().split(/[\s.,&]+/);
      const citeTokens = citeTokensRaw.filter((t) => t.length > 3);
      const overlapping = citeTokens.filter((t) => matchedNameLower.includes(t));
      const distinctive = overlapping.filter((t) => !STOP_LEGAL.has(t));

      if (top.score >= 3.0 && distinctive.length >= 2) {
        return { ...cite, status: "verified", match: top.award, score: top.score };
      }
      if (top.score >= 1.5 && distinctive.length >= 1) {
        return { ...cite, status: "partial", match: top.award, score: top.score };
      }
      return { ...cite, status: "not-in-corpus", match: null, score: top.score };
    }

    return { ...cite, status: "unknown", match: null, score: 0 };
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   MODULE 1: REDLINE — contract review with accept/edit/reject
   ───────────────────────────────────────────────────────────────────────── */

const SEV_STYLES = {
  high: { border: "#991b1b", bg: "#fdf2f2", label: "HIGH" },
  medium: { border: "#b45309", bg: "#fdf6ec", label: "MEDIUM" },
  low: { border: "#78716c", bg: DS.surface, label: "LOW" },
};

function Redline({ logEvent }) {
  const [stage, setStage] = useState("input");
  const [docText, setDocText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [states, setStates] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState(null);
  const editRef = useRef(null);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editingId]);

  const run = async () => {
    if (!docText.trim()) return;
    setStage("analyzing");
    setError(null);
    try {
      const raw = await callClaude(`You are a legal review assistant. Analyze the document and return ONLY a JSON object (no markdown fences, no preamble). Schema:

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
${docText}`);
      const parsed = parseJSON(raw);
      const init = {};
      (parsed.suggestions || []).forEach((s) => {
        init[s.id] = { status: "pending", finalText: s.proposed };
      });
      setAnalysis(parsed);
      setStates(init);
      setStage("review");
      logEvent(makeEvent("redline", "analyzed", {
        documentType: parsed.documentType,
        riskCount: parsed.risks?.length || 0,
        suggestionCount: parsed.suggestions?.length || 0,
      }));
    } catch (e) {
      console.error(e);
      setError("Analysis failed. Try a shorter excerpt or check the API connection.");
      setStage("input");
    }
  };

  const decide = (id, action, finalText) => {
    const s = analysis.suggestions.find((x) => x.id === id);
    setStates((p) => ({ ...p, [id]: { status: action, finalText } }));
    logEvent(makeEvent("redline", action, {
      suggestionId: id,
      category: s.category,
      original: s.original,
      aiProposed: s.proposed,
      humanFinal: finalText,
      rationale: s.rationale,
    }));
  };

  const reset = () => {
    setStage("input");
    setDocText("");
    setAnalysis(null);
    setStates({});
    setError(null);
  };

  const counts = Object.values(states).reduce(
    (a, s) => ({ ...a, [s.status]: (a[s.status] || 0) + 1 }),
    { pending: 0, accepted: 0, edited: 0, rejected: 0 }
  );

  /* — INPUT STAGE — */
  if (stage === "input") {
    return (
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SectionLabel accent={DS.redline}>01 — Intake</SectionLabel>
          <h1 className="fr" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05, marginBottom: 16 }}>
            Paste a contract.<br />
            <span style={{ fontStyle: "italic", color: DS.redline }}>Get</span> a redline.<br />
            Keep the receipts.
          </h1>
          <p style={{ fontSize: 15, color: DS.inkMuted, maxWidth: 520, lineHeight: 1.6, marginBottom: 24 }}>
            Every AI suggestion is presented for explicit human review. Accept, edit, or reject — each
            decision is timestamped to the unified ledger. No autonomous edits, ever.
          </p>

          {error && (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                background: "#fdf2f2",
                border: `1px solid ${DS.danger}`,
                color: DS.danger,
                fontSize: 13,
                borderRadius: 2,
              }}
            >
              {error}
            </div>
          )}

          <textarea
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder="Paste the agreement, NDA, MSA, or clause text here…"
            className="mono"
            style={{
              width: "100%",
              minHeight: 280,
              padding: 16,
              fontSize: 13,
              background: DS.surface,
              border: `1px solid ${DS.borderStrong}`,
              borderRadius: 2,
              color: DS.ink,
              resize: "vertical",
              lineHeight: 1.6,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          />

          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <Btn onClick={run} disabled={!docText.trim()} icon={ArrowRight} variant="accent" accent={DS.redline}>
              Analyze document
            </Btn>
            <Btn onClick={() => setDocText(SAMPLE_NDA)} variant="ghost">
              Load sample NDA
            </Btn>
            <span className="mono" style={{ fontSize: 11, color: DS.inkFaint }}>
              {docText.length.toLocaleString()} chars
            </span>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 24, borderRadius: 2 }}>
            <SectionLabel accent={DS.redline}>How it works</SectionLabel>
            {[
              { n: "I", t: "AI surfaces risks", d: "Flags ambiguity, missing protections, unfavorable language." },
              { n: "II", t: "Counsel decides", d: "Each suggestion requires explicit accept, edit, or reject." },
              { n: "III", t: "Audit trail builds", d: "Every decision logged with timestamp, AI proposal, human final." },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div className="fr" style={{ color: DS.redline, fontStyle: "italic", minWidth: 28, fontSize: 22, lineHeight: 1 }}>
                  {s.n}
                </div>
                <div>
                  <div className="fr" style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: DS.inkMuted, lineHeight: 1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    );
  }

  /* — ANALYZING STAGE — */
  if (stage === "analyzing") {
    return <Loader accent={DS.redline} label="Reviewing the document" sublabel="IDENTIFYING RISKS · DRAFTING SUGGESTIONS" />;
  }

  /* — REVIEW STAGE — */
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <SectionLabel accent={DS.redline}>Review · {analysis.documentType}</SectionLabel>
        <Btn onClick={reset} variant="ghost" icon={Plus}>New document</Btn>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <SectionLabel>Source document</SectionLabel>
          <div
            style={{
              background: DS.surface,
              border: `1px solid ${DS.borderStrong}`,
              padding: 20,
              borderRadius: 2,
              maxHeight: "65vh",
              overflowY: "auto",
            }}
          >
            <pre className="mono" style={{ fontSize: 12, whiteSpace: "pre-wrap", color: DS.ink, lineHeight: 1.7, margin: 0 }}>
              {docText}
            </pre>
          </div>
        </div>

        <div className="lg:col-span-7" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <section>
            <SectionLabel accent={DS.redline}>Summary</SectionLabel>
            <p className="fr" style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 400 }}>
              {analysis.summary}
            </p>
          </section>

          {analysis.risks?.length > 0 && (
            <section>
              <SectionLabel accent={DS.redline}>Risk inventory · {analysis.risks.length}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.risks.map((r) => {
                  const sev = SEV_STYLES[r.severity] || SEV_STYLES.low;
                  return (
                    <div
                      key={r.id}
                      style={{
                        background: sev.bg,
                        borderLeft: `3px solid ${sev.border}`,
                        padding: "12px 16px",
                        borderRadius: 2,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Pill color={sev.border} bg={sev.border}>
                          <span style={{ color: DS.bg }}>{sev.label}</span>
                        </Pill>
                        <span className="fr" style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{r.description}</div>
                      {r.clause && (
                        <div className="mono" style={{ fontSize: 11, color: DS.inkFaint, fontStyle: "italic", marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${DS.borderStrong}` }}>
                          {r.clause}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {analysis.suggestions?.length > 0 && (
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <SectionLabel accent={DS.redline}>Suggested redlines · {analysis.suggestions.length}</SectionLabel>
                <span className="mono" style={{ fontSize: 11, color: DS.inkFaint }}>
                  {counts.accepted}A · {counts.edited}E · {counts.rejected}R
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {analysis.suggestions.map((s) => {
                  const st = states[s.id] || { status: "pending", finalText: s.proposed };
                  const isEditing = editingId === s.id;
                  const statusColor =
                    st.status === "accepted" ? DS.success
                      : st.status === "edited" ? DS.info
                      : st.status === "rejected" ? DS.danger
                      : DS.inkFaint;
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: DS.surface,
                        border: `1px solid ${st.status === "pending" ? DS.borderStrong : statusColor + "40"}`,
                        padding: 16,
                        borderRadius: 2,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <Pill color={DS.inkFaint}>{s.category.replace("-", " ")}</Pill>
                        <Pill color={statusColor}>{st.status}</Pill>
                      </div>

                      <SectionLabel>Original</SectionLabel>
                      <div className="mono" style={{ fontSize: 12, textDecoration: "line-through", color: DS.inkFaint, marginBottom: 10, lineHeight: 1.5 }}>
                        "{s.original}"
                      </div>

                      <SectionLabel accent={DS.redline}>{st.status === "edited" ? "Your edit" : "Proposed"}</SectionLabel>
                      {isEditing ? (
                        <textarea
                          ref={editRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="mono"
                          style={{
                            width: "100%",
                            padding: 10,
                            fontSize: 12,
                            background: DS.surface2,
                            border: `1px solid ${DS.ink}`,
                            borderRadius: 2,
                            minHeight: 80,
                            lineHeight: 1.5,
                            fontFamily: "'IBM Plex Mono', monospace",
                            marginBottom: 10,
                          }}
                        />
                      ) : (
                        <div
                          className="mono"
                          style={{
                            fontSize: 12,
                            padding: 10,
                            marginBottom: 10,
                            background: st.status === "rejected" ? "transparent" : "#EFEDF5",
                            color: st.status === "rejected" ? DS.inkFaint : DS.ink,
                            textDecoration: st.status === "rejected" ? "line-through" : "none",
                            lineHeight: 1.5,
                            borderRadius: 2,
                          }}
                        >
                          "{st.finalText}"
                        </div>
                      )}

                      <div style={{ fontSize: 12, fontStyle: "italic", color: DS.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>
                        <span className="mono" style={{ fontStyle: "normal", color: DS.inkFaint }}>Why:</span> {s.rationale}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        {isEditing ? (
                          <>
                            <Btn onClick={() => { decide(s.id, "edited", editText); setEditingId(null); }} icon={Check} variant="accent" accent={DS.info}>
                              Save edit
                            </Btn>
                            <Btn onClick={() => setEditingId(null)} variant="ghost">Cancel</Btn>
                          </>
                        ) : (
                          <>
                            <Btn
                              onClick={() => decide(s.id, "accepted", s.proposed)}
                              disabled={st.status === "accepted"}
                              icon={Check}
                              variant={st.status === "accepted" ? "accent" : "ghost"}
                              accent={DS.success}
                              style={{ borderColor: DS.success, color: st.status === "accepted" ? DS.bg : DS.success }}
                            >
                              Accept
                            </Btn>
                            <Btn
                              onClick={() => { setEditingId(s.id); setEditText(st.finalText); }}
                              icon={Edit3}
                              variant={st.status === "edited" ? "accent" : "ghost"}
                              accent={DS.info}
                              style={{ borderColor: DS.info, color: st.status === "edited" ? DS.bg : DS.info }}
                            >
                              Edit
                            </Btn>
                            <Btn
                              onClick={() => decide(s.id, "rejected", s.original)}
                              disabled={st.status === "rejected"}
                              icon={X}
                              variant={st.status === "rejected" ? "accent" : "ghost"}
                              accent={DS.danger}
                              style={{ borderColor: DS.danger, color: st.status === "rejected" ? DS.bg : DS.danger }}
                            >
                              Reject
                            </Btn>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODULE 2: POLICY — AI use policy generator
   ───────────────────────────────────────────────────────────────────────── */

const PRACTICE_AREAS = ["Corporate", "Litigation", "M&A", "IP", "Tax", "Real Estate", "Employment", "Healthcare", "Privacy"];
const JURISDICTIONS = ["United States", "European Union", "United Kingdom", "Canada", "Latin America", "Asia-Pacific"];
const RISK_TOLERANCES = [
  { v: "conservative", l: "Conservative", d: "Restrictive defaults; explicit approvals required" },
  { v: "moderate", l: "Moderate", d: "Permitted use cases with disclosure and oversight" },
  { v: "progressive", l: "Progressive", d: "Broad permitted use; light-touch governance" },
];

function Policy({ logEvent, savedPolicies, savePolicy, deletePolicy }) {
  const [stage, setStage] = useState("form"); // form | generating | review
  const [firm, setFirm] = useState({
    name: "",
    size: "",
    practiceAreas: [],
    jurisdictions: [],
    riskTolerance: "moderate",
    concerns: "",
    existingPolicy: "none",
  });
  const [policy, setPolicy] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionEdit, setSectionEdit] = useState("");
  const [error, setError] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const togglePractice = (a) => setFirm((f) => ({
    ...f,
    practiceAreas: f.practiceAreas.includes(a)
      ? f.practiceAreas.filter((x) => x !== a)
      : [...f.practiceAreas, a],
  }));
  const toggleJurisdiction = (j) => setFirm((f) => ({
    ...f,
    jurisdictions: f.jurisdictions.includes(j)
      ? f.jurisdictions.filter((x) => x !== j)
      : [...f.jurisdictions, j],
  }));

  const generate = async () => {
    setStage("generating");
    setError(null);
    try {
      const raw = await callClaude(`You are an AI governance specialist drafting an AI use policy for a law firm. Return ONLY a JSON object (no markdown). Schema:

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

Return only the JSON.`, 3000);
      const parsed = parseJSON(raw);
      const policyId = `pol-${Date.now()}`;
      const fullPolicy = {
        id: policyId,
        firmName: firm.name || "Unnamed Firm",
        createdAt: new Date().toISOString(),
        firmInput: firm,
        ...parsed,
        versions: [{ at: new Date().toISOString(), action: "generated", sections: parsed.sections }],
      };
      setPolicy(fullPolicy);
      setStage("review");
      logEvent(makeEvent("policy", "generated", {
        policyId,
        firmName: fullPolicy.firmName,
        sectionCount: parsed.sections.length,
        riskTolerance: firm.riskTolerance,
      }));
    } catch (e) {
      console.error(e);
      setError("Generation failed. Try again or adjust the firm context.");
      setStage("form");
    }
  };

  const saveSection = (sectionId) => {
    const before = policy.sections.find((s) => s.id === sectionId).body;
    const updated = {
      ...policy,
      sections: policy.sections.map((s) => s.id === sectionId ? { ...s, body: sectionEdit } : s),
      versions: [...policy.versions, { at: new Date().toISOString(), action: "edited", sectionId, before, after: sectionEdit }],
    };
    setPolicy(updated);
    setEditingSection(null);
    setSectionEdit("");
    logEvent(makeEvent("policy", "section-edited", {
      policyId: policy.id,
      firmName: policy.firmName,
      sectionId,
      before: before.slice(0, 200),
      after: sectionEdit.slice(0, 200),
    }));
  };

  const reset = () => {
    setStage("form");
    setPolicy(null);
    setEditingSection(null);
    setError(null);
  };

  const handleSave = () => {
    if (!policy) return;
    savePolicy(policy);
    logEvent(makeEvent("policy", "saved", { policyId: policy.id, firmName: policy.firmName }));
  };

  const exportMd = () => {
    if (!policy) return;
    const md = [
      `# ${policy.title}`,
      "",
      `_Generated for ${policy.firmName} on ${new Date(policy.createdAt).toLocaleDateString()}_`,
      "",
      policy.preamble,
      "",
      ...policy.sections.flatMap((s) => [`## ${s.title}`, "", s.body, ""]),
      "---",
      `_Document version: ${policy.versions.length} · Last updated ${new Date(policy.versions.at(-1).at).toLocaleString()}_`,
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${policy.firmName.replace(/\s+/g, "-")}-AI-Policy.md`;
    a.click();
    URL.revokeObjectURL(url);
    logEvent(makeEvent("policy", "exported", { policyId: policy.id, firmName: policy.firmName }));
  };

  /* — FORM — */
  if (stage === "form") {
    return (
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <SectionLabel accent={DS.policy}>02 — Generate</SectionLabel>
          <h1 className="fr" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05, marginBottom: 16 }}>
            Generate an AI use policy.<br />
            <span style={{ fontStyle: "italic", color: DS.policy }}>Calibrated</span> to your firm.
          </h1>
          <p style={{ fontSize: 15, color: DS.inkMuted, maxWidth: 540, lineHeight: 1.6, marginBottom: 32 }}>
            Parameterize by size, practice mix, jurisdiction, and risk posture. Edit any section
            inline — every change creates a version snapshot in the audit ledger.
          </p>

          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: "#fdf2f2", border: `1px solid ${DS.danger}`, color: DS.danger, fontSize: 13, borderRadius: 2 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Firm name + size */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Firm name">
                <input
                  type="text"
                  value={firm.name}
                  onChange={(e) => setFirm({ ...firm, name: e.target.value })}
                  placeholder="Hartwell & Associates"
                  style={inputStyle}
                />
              </Field>
              <Field label="Attorneys">
                <input
                  type="number"
                  value={firm.size}
                  onChange={(e) => setFirm({ ...firm, size: e.target.value })}
                  placeholder="75"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Practice areas" hint={`${firm.practiceAreas.length} selected`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PRACTICE_AREAS.map((a) => (
                  <Chip key={a} active={firm.practiceAreas.includes(a)} onClick={() => togglePractice(a)} accent={DS.policy}>
                    {a}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Jurisdictions" hint={`${firm.jurisdictions.length} selected`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {JURISDICTIONS.map((j) => (
                  <Chip key={j} active={firm.jurisdictions.includes(j)} onClick={() => toggleJurisdiction(j)} accent={DS.policy}>
                    {j}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Risk tolerance">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {RISK_TOLERANCES.map((r) => (
                  <label
                    key={r.v}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: 12,
                      border: `1px solid ${firm.riskTolerance === r.v ? DS.policy : DS.borderStrong}`,
                      background: firm.riskTolerance === r.v ? DS.policy + "08" : DS.surface,
                      borderRadius: 2,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={firm.riskTolerance === r.v}
                      onChange={() => setFirm({ ...firm, riskTolerance: r.v })}
                      style={{ marginTop: 2, accentColor: DS.policy }}
                    />
                    <div>
                      <div className="fr" style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{r.l}</div>
                      <div style={{ fontSize: 12, color: DS.inkMuted }}>{r.d}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Specific concerns or context" hint="optional">
              <textarea
                value={firm.concerns}
                onChange={(e) => setFirm({ ...firm, concerns: e.target.value })}
                placeholder="e.g., concerns about associate use of consumer AI tools, client confidentiality requirements…"
                style={{ ...inputStyle, minHeight: 80, resize: "vertical", lineHeight: 1.5 }}
              />
            </Field>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Btn onClick={generate} icon={Sparkles} variant="accent" accent={DS.policy}>
                Generate policy
              </Btn>
              <Btn onClick={() => setFirm(SAMPLE_FIRM)} variant="ghost">
                Load sample firm
              </Btn>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2, marginBottom: 16 }}>
            <SectionLabel accent={DS.policy}>What gets drafted</SectionLabel>
            <div style={{ fontSize: 13, color: DS.inkMuted, lineHeight: 1.7 }}>
              Permitted Uses · Prohibited Uses · Approved Tools · Confidentiality &
              Client Data · Client Disclosure · Output Review · Training Data
              Restrictions · Incident Reporting · Sanctions for Violations
            </div>
          </div>

          {savedPolicies.length > 0 && (
            <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <SectionLabel accent={DS.policy}>Saved policies · {savedPolicies.length}</SectionLabel>
                <button onClick={() => setShowSaved(!showSaved)} className="mono" style={{ fontSize: 11, color: DS.inkFaint, background: "none", border: "none", cursor: "pointer" }}>
                  {showSaved ? "hide" : "show"}
                </button>
              </div>
              {showSaved && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {savedPolicies.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 8, border: `1px solid ${DS.border}`, borderRadius: 2 }}>
                      <div>
                        <div className="fr" style={{ fontSize: 13, fontWeight: 600 }}>{p.firmName}</div>
                        <div className="mono" style={{ fontSize: 10, color: DS.inkFaint }}>
                          {new Date(p.createdAt).toLocaleDateString()} · v{p.versions.length}
                        </div>
                      </div>
                      <button
                        onClick={() => { setPolicy(p); setStage("review"); }}
                        style={{ fontSize: 11, color: DS.policy, background: "none", border: "none", cursor: "pointer" }}
                      >
                        Open →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    );
  }

  /* — GENERATING — */
  if (stage === "generating") {
    return <Loader accent={DS.policy} label="Drafting policy" sublabel="CALIBRATING TO FIRM CONTEXT" />;
  }

  /* — REVIEW — */
  // History view: show version timeline with diffs
  if (showHistory) {
    // Reconstruct each version's full sections by replaying edits
    const timeline = [];
    let currentSections = null;
    for (let i = 0; i < policy.versions.length; i++) {
      const v = policy.versions[i];
      if (v.action === "generated") {
        currentSections = v.sections;
        timeline.push({
          version: i + 1,
          at: v.at,
          action: "generated",
          sections: currentSections,
          diff: null,
        });
      } else if (v.action === "edited") {
        const prevSections = currentSections;
        currentSections = currentSections.map((s) =>
          s.id === v.sectionId ? { ...s, body: v.after } : s
        );
        timeline.push({
          version: i + 1,
          at: v.at,
          action: "edited",
          sectionId: v.sectionId,
          sectionTitle: prevSections.find((s) => s.id === v.sectionId)?.title || v.sectionId,
          before: v.before,
          after: v.after,
          diff: { before: v.before, after: v.after },
        });
      }
    }

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <SectionLabel accent={DS.policy}>Version history · {policy.firmName} · {policy.versions.length} {policy.versions.length === 1 ? "snapshot" : "snapshots"}</SectionLabel>
          <Btn onClick={() => setShowHistory(false)} icon={ArrowLeft} variant="ghost">Back to policy</Btn>
        </div>

        <div style={{ position: "relative", paddingLeft: 24 }}>
          {/* Vertical rail */}
          <div style={{ position: "absolute", left: 7, top: 8, bottom: 8, width: 1, background: DS.borderStrong }} />

          {timeline.slice().reverse().map((entry, idx) => (
            <div key={idx} style={{ position: "relative", marginBottom: 28 }}>
              {/* Dot */}
              <div
                style={{
                  position: "absolute",
                  left: -24,
                  top: 6,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: entry.action === "generated" ? DS.policy : DS.info,
                  border: `3px solid ${DS.bg}`,
                  boxShadow: `0 0 0 1px ${DS.borderStrong}`,
                }}
              />
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span className="fr" style={{ fontSize: 15, fontWeight: 600 }}>
                  v{entry.version}
                </span>
                <Pill color={entry.action === "generated" ? DS.policy : DS.info}>
                  {entry.action === "generated" ? "Generated" : `Edit · §${entry.sectionTitle}`}
                </Pill>
                <span className="mono" style={{ fontSize: 11, color: DS.inkFaint, marginLeft: "auto" }}>
                  {new Date(entry.at).toLocaleString()}
                </span>
              </div>
              {entry.diff ? (
                <DiffView before={entry.diff.before} after={entry.diff.after} />
              ) : (
                <div className="mono" style={{ fontSize: 11, color: DS.inkFaint, fontStyle: "italic" }}>
                  Initial generation · {entry.sections.length} sections drafted
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <SectionLabel accent={DS.policy}>Policy · {policy.firmName} · v{policy.versions.length}</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {policy.versions.length > 1 && (
            <Btn onClick={() => setShowHistory(true)} icon={GitCommit} variant="ghost">
              History · {policy.versions.length}
            </Btn>
          )}
          <Btn onClick={handleSave} icon={Save} variant="ghost">Save</Btn>
          <Btn onClick={exportMd} icon={Download} variant="ghost">Export .md</Btn>
          <Btn onClick={reset} icon={Plus} variant="accent" accent={DS.policy}>New policy</Btn>
        </div>
      </div>

      <div style={{ background: DS.surface, border: `1px solid ${DS.borderStrong}`, padding: 32, borderRadius: 2, maxWidth: 820 }}>
        <h1 className="fr" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.15, marginBottom: 8 }}>
          {policy.title}
        </h1>
        <div className="mono" style={{ fontSize: 11, color: DS.inkFaint, marginBottom: 24, letterSpacing: "0.05em" }}>
          GENERATED {new Date(policy.createdAt).toLocaleDateString()} · {policy.firmInput.size || "—"} ATTORNEYS · {policy.firmInput.riskTolerance.toUpperCase()} POSTURE
        </div>

        <p className="fr" style={{ fontSize: 16, lineHeight: 1.6, color: DS.ink, fontStyle: "italic", marginBottom: 32, paddingLeft: 16, borderLeft: `2px solid ${DS.policy}` }}>
          {policy.preamble}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {policy.sections.map((s, i) => {
            const isEditing = editingSection === s.id;
            return (
              <section key={s.id}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <h2 className="fr" style={{ fontSize: 20, fontWeight: 600 }}>
                    <span style={{ color: DS.policy, fontStyle: "italic", marginRight: 10 }}>§{i + 1}</span>
                    {s.title}
                  </h2>
                  {!isEditing && (
                    <button
                      onClick={() => { setEditingSection(s.id); setSectionEdit(s.body); }}
                      className="mono"
                      style={{ fontSize: 11, color: DS.policy, background: "none", border: "none", cursor: "pointer", letterSpacing: "0.05em" }}
                    >
                      EDIT →
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={sectionEdit}
                      onChange={(e) => setSectionEdit(e.target.value)}
                      style={{ ...inputStyle, minHeight: 200, lineHeight: 1.6, fontSize: 14 }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <Btn onClick={() => saveSection(s.id)} icon={Check} variant="accent" accent={DS.policy}>Save changes</Btn>
                      <Btn onClick={() => setEditingSection(null)} variant="ghost">Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: DS.ink, whiteSpace: "pre-wrap" }}>
                    {s.body}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label className="mono" style={{ fontSize: 11, color: DS.ink, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
          {label}
        </label>
        {hint && <span className="mono" style={{ fontSize: 10, color: DS.inkFaint }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  fontSize: 14,
  background: DS.surface,
  border: `1px solid ${DS.borderStrong}`,
  borderRadius: 2,
  color: DS.ink,
  fontFamily: "inherit",
};

function Chip({ active, onClick, accent, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 12,
        background: active ? accent : "transparent",
        color: active ? DS.bg : DS.ink,
        border: `1px solid ${active ? accent : DS.borderStrong}`,
        borderRadius: 2,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODULE 3: VENDOR — AI vendor TOS due diligence
   ───────────────────────────────────────────────────────────────────────── */

const VENDOR_DECISIONS = {
  approve: { label: "Approve", color: DS.success },
  negotiate: { label: "Negotiate", color: DS.warning },
  block: { label: "Block", color: DS.danger },
};

function Vendor({ logEvent, savedVendors, saveVendor }) {
  const [stage, setStage] = useState("input"); // input | analyzing | review
  const [vendorName, setVendorName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [tosText, setTosText] = useState("");
  const [assessment, setAssessment] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [error, setError] = useState(null);

  const run = async () => {
    if (!tosText.trim()) return;
    setStage("analyzing");
    setError(null);
    try {
      const raw = await callClaude(`You are an AI vendor due diligence specialist. Analyze the vendor's terms of service for a law firm considering procurement. Return ONLY a JSON object (no markdown). Schema:

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

Return only the JSON.`, 2500);
      const parsed = parseJSON(raw);
      const initDecisions = {};
      parsed.categories.forEach((c) => { initDecisions[c.id] = null; });
      setAssessment(parsed);
      setDecisions(initDecisions);
      setStage("review");
      logEvent(makeEvent("vendor", "analyzed", {
        vendorName: parsed.vendorName,
        overallRisk: parsed.overallRisk,
        categoryCount: parsed.categories.length,
      }));
    } catch (e) {
      console.error(e);
      setError("Analysis failed. Try a shorter excerpt or check the API.");
      setStage("input");
    }
  };

  const decide = (categoryId, decision) => {
    const cat = assessment.categories.find((c) => c.id === categoryId);
    setDecisions((p) => ({ ...p, [categoryId]: decision }));
    logEvent(makeEvent("vendor", `${decision}-${categoryId}`, {
      vendorName: assessment.vendorName,
      categoryId,
      categoryTitle: cat.title,
      risk: cat.risk,
      decision,
      finding: cat.finding,
    }));
  };

  const reset = () => {
    setStage("input");
    setVendorName("");
    setUseCase("");
    setTosText("");
    setAssessment(null);
    setDecisions({});
    setError(null);
  };

  const handleSave = () => {
    if (!assessment) return;
    const record = {
      id: `v-${Date.now()}`,
      ...assessment,
      decisions,
      decidedAt: new Date().toISOString(),
    };
    saveVendor(record);
    logEvent(makeEvent("vendor", "saved", { vendorName: assessment.vendorName, id: record.id }));
  };

  const counts = Object.values(decisions).reduce((a, d) => {
    if (d) a[d] = (a[d] || 0) + 1;
    return a;
  }, { approve: 0, negotiate: 0, block: 0 });

  /* — INPUT — */
  if (stage === "input") {
    return (
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SectionLabel accent={DS.vendor}>03 — Diligence</SectionLabel>
          <h1 className="fr" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05, marginBottom: 16 }}>
            Score a vendor.<br />
            <span style={{ fontStyle: "italic", color: DS.vendor }}>Clause</span> by clause.
          </h1>
          <p style={{ fontSize: 15, color: DS.inkMuted, maxWidth: 540, lineHeight: 1.6, marginBottom: 24 }}>
            Paste an AI vendor's terms. Get a per-category risk assessment with cited clauses.
            Approve, negotiate, or block — each call written to the audit ledger.
          </p>

          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: "#fdf2f2", border: `1px solid ${DS.danger}`, color: DS.danger, fontSize: 13, borderRadius: 2 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vendor name">
                <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="ModelCo" style={inputStyle} />
              </Field>
              <Field label="Use case">
                <input value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="Document drafting" style={inputStyle} />
              </Field>
            </div>

            <Field label="Terms of service / DPA / model card">
              <textarea
                value={tosText}
                onChange={(e) => setTosText(e.target.value)}
                placeholder="Paste the vendor's terms…"
                className="mono"
                style={{ ...inputStyle, minHeight: 280, fontSize: 12, lineHeight: 1.6, resize: "vertical", fontFamily: "'IBM Plex Mono', monospace" }}
              />
            </Field>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Btn onClick={run} disabled={!tosText.trim()} icon={ArrowRight} variant="accent" accent={DS.vendor}>
                Run diligence
              </Btn>
              <Btn onClick={() => { setVendorName("ModelCo"); setUseCase("Document drafting"); setTosText(SAMPLE_TOS); }} variant="ghost">
                Load sample TOS
              </Btn>
              <span className="mono" style={{ fontSize: 11, color: DS.inkFaint }}>
                {tosText.length.toLocaleString()} chars
              </span>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2 }}>
            <SectionLabel accent={DS.vendor}>Categories scored</SectionLabel>
            <div style={{ fontSize: 13, color: DS.inkMuted, lineHeight: 1.8 }}>
              Data rights & training · Confidentiality · IP ownership · Indemnification ·
              Jurisdiction · Termination · Compliance certifications
            </div>
          </div>

          {savedVendors.length > 0 && (
            <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2, marginTop: 16 }}>
              <SectionLabel accent={DS.vendor}>Recent · {savedVendors.length}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {savedVendors.slice(0, 5).map((v) => (
                  <div key={v.id} style={{ padding: 8, border: `1px solid ${DS.border}`, borderRadius: 2, fontSize: 12 }}>
                    <div className="fr" style={{ fontWeight: 600 }}>{v.vendorName}</div>
                    <div className="mono" style={{ fontSize: 10, color: DS.inkFaint }}>
                      {new Date(v.decidedAt).toLocaleDateString()} · {v.overallRisk?.toUpperCase()} risk
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  }

  if (stage === "analyzing") {
    return <Loader accent={DS.vendor} label="Reviewing vendor terms" sublabel="SCORING CLAUSES · CITING SOURCES" />;
  }

  /* — REVIEW — */
  const overallSev = SEV_STYLES[assessment.overallRisk] || SEV_STYLES.medium;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <SectionLabel accent={DS.vendor}>Vendor · {assessment.vendorName}</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={handleSave} icon={Save} variant="ghost">Save assessment</Btn>
          <Btn onClick={reset} icon={Plus} variant="accent" accent={DS.vendor}>New vendor</Btn>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: 20, background: overallSev.bg, borderLeft: `4px solid ${overallSev.border}`, borderRadius: 2 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: overallSev.border, letterSpacing: "0.1em", marginBottom: 4 }}>OVERALL RISK</div>
          <div className="fr" style={{ fontSize: 28, fontWeight: 600, color: overallSev.border, lineHeight: 1 }}>{overallSev.label}</div>
        </div>
        <div style={{ flex: 1, fontSize: 14, color: DS.ink, lineHeight: 1.5 }}>
          {assessment.summary}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <SectionLabel accent={DS.vendor}>Categories · {assessment.categories.length}</SectionLabel>
        <span className="mono" style={{ fontSize: 11, color: DS.inkFaint }}>
          {counts.approve}A · {counts.negotiate}N · {counts.block}B
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {assessment.categories.map((c) => {
          const sev = SEV_STYLES[c.risk] || SEV_STYLES.low;
          const decision = decisions[c.id];
          return (
            <div key={c.id} style={{ background: DS.surface, border: `1px solid ${DS.borderStrong}`, padding: 18, borderRadius: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Pill color={sev.border}>{c.risk?.toUpperCase()}</Pill>
                  <span className="fr" style={{ fontWeight: 600, fontSize: 16 }}>{c.title}</span>
                </div>
                {decision && (
                  <Pill color={VENDOR_DECISIONS[decision].color}>{VENDOR_DECISIONS[decision].label}</Pill>
                )}
              </div>

              <div style={{ fontSize: 13, color: DS.ink, lineHeight: 1.5, marginBottom: 8 }}>
                {c.finding}
              </div>

              {c.clause && (
                <div className="mono" style={{ fontSize: 11, color: DS.inkFaint, fontStyle: "italic", padding: "8px 12px", background: DS.bg, borderLeft: `2px solid ${DS.borderStrong}`, marginBottom: 8, lineHeight: 1.5 }}>
                  "{c.clause}"
                </div>
              )}

              <div style={{ fontSize: 12, color: DS.inkMuted, fontStyle: "italic", marginBottom: 12 }}>
                <span className="mono" style={{ fontStyle: "normal", color: DS.inkFaint }}>Recommendation:</span> {c.recommendation}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(VENDOR_DECISIONS).map(([key, v]) => (
                  <Btn
                    key={key}
                    onClick={() => decide(c.id, key)}
                    variant={decision === key ? "accent" : "ghost"}
                    accent={v.color}
                    style={{ borderColor: v.color, color: decision === key ? DS.bg : v.color }}
                  >
                    {v.label}
                  </Btn>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODULE 4: RESEARCH — BM25 retrieval + LLM synthesis with calibrated confidence
   ───────────────────────────────────────────────────────────────────────── */

const CONFIDENCE_STYLES = {
  strong: { label: "Strong support", color: DS.success, bg: "#ecfdf5" },
  moderate: { label: "Moderate support", color: DS.warning, bg: "#fdf6ec" },
  weak: { label: "Weak support", color: "#c2410c", bg: "#fff7ed" },
  none: { label: "No precedent in corpus", color: DS.danger, bg: "#fdf2f2" },
};

function renderAnswerWithCitations(text, onCite) {
  if (!text) return null;
  const parts = text.split(/(\[AW-\d{3}\])/g);
  return parts.map((p, i) => {
    const m = p.match(/\[(AW-\d{3})\]/);
    if (m) {
      return (
        <button
          key={i}
          onClick={() => onCite(m[1])}
          className="mono"
          style={{
            display: "inline",
            padding: "1px 6px",
            margin: "0 1px",
            fontSize: 11,
            fontWeight: 600,
            background: DS.research + "12",
            color: DS.research,
            border: `1px solid ${DS.research}30`,
            borderRadius: 2,
            cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {m[1]}
        </button>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function AwardCard({ award, score, isCited, expanded, onToggle, highlight }) {
  return (
    <div
      id={`award-${award.id}`}
      style={{
        background: DS.surface,
        border: `1px solid ${highlight ? DS.research : DS.borderStrong}`,
        borderLeft: `3px solid ${isCited ? DS.research : DS.borderStrong}`,
        padding: 16,
        borderRadius: 2,
        transition: "border-color 0.2s",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <Pill color={DS.research}>{award.id}</Pill>
              {isCited && <Pill color={DS.success}>CITED</Pill>}
              <span className="mono" style={{ fontSize: 11, color: DS.inkFaint, letterSpacing: "0.05em" }}>
                {award.tribunal} · {award.year}
              </span>
              {typeof score === "number" && (
                <span className="mono" style={{ fontSize: 10, color: DS.inkFaint }}>
                  · score {score.toFixed(2)}
                </span>
              )}
            </div>
            <div className="fr" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
              {award.caseName}
            </div>
            <div style={{ fontSize: 12, color: DS.inkMuted, fontStyle: "italic" }}>{award.subject}</div>
          </div>
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            style={{
              color: DS.inkFaint,
              transform: expanded ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 0.2s",
              flexShrink: 0,
            }}
          />
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${DS.border}` }}>
          <SectionLabel accent={DS.research}>Summary</SectionLabel>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>{award.summary}</div>

          <SectionLabel accent={DS.research}>Holdings</SectionLabel>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.65, color: DS.ink }}>
            {award.holdings.map((h, i) => (
              <li key={i} style={{ marginBottom: 6 }}>{h}</li>
            ))}
          </ol>

          <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
            <div>
              <SectionLabel accent={DS.research}>Damages</SectionLabel>
              <div className="mono" style={{ fontSize: 12 }}>{award.damages}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <SectionLabel accent={DS.research}>Tags</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {award.tags.map((t) => (
                  <span
                    key={t}
                    className="mono"
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      background: DS.bg,
                      color: DS.inkMuted,
                      borderRadius: 2,
                      border: `1px solid ${DS.border}`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Research({ logEvent }) {
  const [stage, setStage] = useState("input"); // input | searching | results
  const [query, setQuery] = useState("");
  const [retrieved, setRetrieved] = useState([]);
  const [synthesis, setSynthesis] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [highlightId, setHighlightId] = useState(null);
  const [error, setError] = useState(null);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goToCitation = (awardId) => {
    setExpandedIds((prev) => new Set([...prev, awardId]));
    setHighlightId(awardId);
    setTimeout(() => {
      const el = document.getElementById(`award-${awardId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setHighlightId(null), 2000);
  };

  const run = async () => {
    if (!query.trim()) return;
    setStage("searching");
    setError(null);
    try {
      // Step 1: BM25 retrieval
      const top = bm25Search(query, SAMPLE_AWARDS, 5);
      setRetrieved(top);

      // If all scores are zero, skip the LLM call — nothing to synthesize
      if (top.length === 0 || top[0].score === 0) {
        const noResult = {
          answer: "The corpus contains no awards relevant to this query. Consider rephrasing the question with different terminology, or expanding the corpus before drawing conclusions.",
          confidence: "none",
          confidenceRationale: "BM25 retrieval returned no relevant matches against the query terms.",
          supportingAwardIds: [],
          caveats: "This determination reflects only the available corpus of 12 awards and is not a statement that no precedent exists generally.",
        };
        setSynthesis(noResult);
        setStage("results");
        logEvent(makeEvent("research", "researched", {
          query,
          retrievedIds: [],
          confidence: "none",
          citedIds: [],
        }));
        return;
      }

      // Step 2: LLM synthesis with calibrated confidence
      const awardContext = top.map((r, i) => `
[${r.award.id}] ${r.award.caseName} (${r.award.tribunal}, ${r.award.year})
Subject: ${r.award.subject}
Summary: ${r.award.summary}
Holdings:
${r.award.holdings.map((h, idx) => `  ${idx + 1}. ${h}`).join("\n")}
Damages: ${r.award.damages}
Retrieval score: ${r.score.toFixed(3)}
`).join("\n");

      const raw = await callClaude(`You are a legal research analyst specializing in international arbitration. Given a query and the most relevant retrieved awards from a corpus, synthesize a research memo. Be CALIBRATED about confidence — explicitly state when the corpus has limited or no support for the query. Do not extrapolate beyond what the retrieved awards actually hold.

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

Return only the JSON.`, 1500);

      const parsed = parseJSON(raw);
      setSynthesis(parsed);
      setStage("results");

      // Auto-expand cited awards
      setExpandedIds(new Set(parsed.supportingAwardIds || []));

      logEvent(makeEvent("research", "researched", {
        query,
        retrievedIds: top.map((r) => r.award.id),
        confidence: parsed.confidence,
        citedIds: parsed.supportingAwardIds || [],
        answerSnippet: (parsed.answer || "").slice(0, 200),
      }));
    } catch (e) {
      console.error(e);
      setError("Synthesis failed. Try rephrasing the query.");
      setStage("input");
    }
  };

  const reset = () => {
    setStage("input");
    setQuery("");
    setRetrieved([]);
    setSynthesis(null);
    setExpandedIds(new Set());
    setError(null);
  };

  const exportMemo = () => {
    if (!synthesis) return;
    const md = [
      `# Research Memo`,
      "",
      `**Query:** ${query}`,
      `**Generated:** ${new Date().toLocaleString()}`,
      `**Confidence:** ${synthesis.confidence.toUpperCase()} — ${synthesis.confidenceRationale}`,
      "",
      "## Synthesis",
      "",
      synthesis.answer,
      "",
      "## Caveats",
      "",
      synthesis.caveats,
      "",
      "## Cited Awards",
      "",
      ...(synthesis.supportingAwardIds || []).flatMap((id) => {
        const award = SAMPLE_AWARDS.find((a) => a.id === id);
        if (!award) return [];
        return [
          `### [${award.id}] ${award.caseName}`,
          `*${award.tribunal}, ${award.year} — ${award.subject}*`,
          "",
          award.summary,
          "",
          "**Holdings:**",
          ...award.holdings.map((h) => `- ${h}`),
          "",
          `**Damages:** ${award.damages}`,
          "",
        ];
      }),
      "---",
      `_Retrieved via BM25 from a corpus of ${SAMPLE_AWARDS.length} awards. Synthesized by Claude. Subject to attorney verification._`,
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-memo-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    logEvent(makeEvent("research", "memo-exported", { query }));
  };

  /* — INPUT — */
  if (stage === "input") {
    return (
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SectionLabel accent={DS.research}>04 — Research</SectionLabel>
          <h1 className="fr" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05, marginBottom: 16 }}>
            Ask the corpus.<br />
            <span style={{ fontStyle: "italic", color: DS.research }}>Calibrated</span> citations.<br />
            No bluffing.
          </h1>
          <p style={{ fontSize: 15, color: DS.inkMuted, maxWidth: 540, lineHeight: 1.6, marginBottom: 24 }}>
            Natural-language query over {SAMPLE_AWARDS.length} international arbitration awards.
            BM25 retrieval, LLM synthesis, explicit confidence calibration. The system tells you
            when the corpus is thin — instead of pretending it isn't.
          </p>

          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: "#fdf2f2", border: `1px solid ${DS.danger}`, color: DS.danger, fontSize: 13, borderRadius: 2 }}>
              {error}
            </div>
          )}

          <Field label="Research query">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., What is the standard for indirect expropriation through cumulative regulatory measures?"
              style={{ ...inputStyle, minHeight: 100, fontSize: 14, lineHeight: 1.5, resize: "vertical" }}
            />
          </Field>

          <div style={{ marginTop: 14, marginBottom: 20 }}>
            <SectionLabel>Sample queries</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 12,
                    background: DS.surface,
                    border: `1px solid ${DS.border}`,
                    borderRadius: 2,
                    cursor: "pointer",
                    color: DS.inkMuted,
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <Btn onClick={run} disabled={!query.trim()} icon={Search} variant="accent" accent={DS.research}>
            Run research
          </Btn>
        </div>

        <aside className="lg:col-span-2">
          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2, marginBottom: 16 }}>
            <SectionLabel accent={DS.research}>How it works</SectionLabel>
            {[
              { n: "I", t: "BM25 retrieval", d: `Tokenized query scored against the corpus of ${SAMPLE_AWARDS.length} awards. Top 5 returned.` },
              { n: "II", t: "LLM synthesis", d: "Claude reads only the retrieved awards — not full training memory — and drafts a memo." },
              { n: "III", t: "Calibrated confidence", d: "Explicit strong / moderate / weak / none signal. Citations link to the full award." },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div className="fr" style={{ color: DS.research, fontStyle: "italic", minWidth: 28, fontSize: 22, lineHeight: 1 }}>{s.n}</div>
                <div>
                  <div className="fr" style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: DS.inkMuted, lineHeight: 1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2 }}>
            <SectionLabel accent={DS.research}>Corpus</SectionLabel>
            <div className="mono" style={{ fontSize: 11, color: DS.inkMuted, lineHeight: 1.7 }}>
              {SAMPLE_AWARDS.length} AWARDS · ICSID · ICC · LCIA · PCA · SIAC · UNCITRAL · 2015–2022
            </div>
            <div style={{ fontSize: 12, color: DS.inkFaint, marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>
              Demo corpus is fictional but structurally realistic. Production deployment would
              ingest ICSID Resolved Cases, PCA awards, and firm-internal work product.
            </div>
          </div>
        </aside>
      </div>
    );
  }

  /* — SEARCHING — */
  if (stage === "searching") {
    return <Loader accent={DS.research} label="Searching the corpus" sublabel="BM25 RETRIEVAL · LLM SYNTHESIS" />;
  }

  /* — RESULTS — */
  const conf = CONFIDENCE_STYLES[synthesis.confidence] || CONFIDENCE_STYLES.weak;
  const citedSet = new Set(synthesis.supportingAwardIds || []);
  const citedAwards = retrieved.filter((r) => citedSet.has(r.award.id));
  const otherRetrieved = retrieved.filter((r) => !citedSet.has(r.award.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <SectionLabel accent={DS.research}>Research result</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={exportMemo} icon={Download} variant="ghost">Export memo</Btn>
          <Btn onClick={reset} icon={Plus} variant="accent" accent={DS.research}>New query</Btn>
        </div>
      </div>

      {/* Query echo */}
      <div
        style={{
          padding: 16,
          background: DS.surface,
          border: `1px solid ${DS.borderStrong}`,
          borderLeft: `3px solid ${DS.research}`,
          borderRadius: 2,
          marginBottom: 20,
        }}
      >
        <SectionLabel accent={DS.research}>Query</SectionLabel>
        <div className="fr" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.4, color: DS.ink, fontStyle: "italic" }}>
          "{query}"
        </div>
      </div>

      {/* Confidence panel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 18,
          marginBottom: 24,
          background: conf.bg,
          borderLeft: `4px solid ${conf.color}`,
          borderRadius: 2,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 10, color: conf.color, letterSpacing: "0.1em", marginBottom: 4 }}>
            CONFIDENCE
          </div>
          <div className="fr" style={{ fontSize: 22, fontWeight: 600, color: conf.color, lineHeight: 1 }}>
            {conf.label}
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 13, color: DS.ink, lineHeight: 1.5 }}>
          {synthesis.confidenceRationale}
        </div>
      </div>

      {/* Synthesis */}
      <section style={{ marginBottom: 32 }}>
        <SectionLabel accent={DS.research}>Synthesis</SectionLabel>
        <div className="fr" style={{ fontSize: 16, lineHeight: 1.7, color: DS.ink, fontWeight: 400 }}>
          {renderAnswerWithCitations(synthesis.answer, goToCitation)}
        </div>

        {synthesis.caveats && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: DS.surface,
              border: `1px dashed ${DS.borderStrong}`,
              borderRadius: 2,
              fontSize: 12,
              color: DS.inkMuted,
              lineHeight: 1.6,
              fontStyle: "italic",
            }}
          >
            <span className="mono" style={{ fontStyle: "normal", color: DS.inkFaint, marginRight: 6 }}>
              CAVEATS:
            </span>
            {synthesis.caveats}
          </div>
        )}
      </section>

      {/* Cited awards */}
      {citedAwards.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionLabel accent={DS.research}>Cited awards · {citedAwards.length}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {citedAwards.map((r) => (
              <AwardCard
                key={r.award.id}
                award={r.award}
                score={r.score}
                isCited={true}
                expanded={expandedIds.has(r.award.id)}
                onToggle={() => toggleExpanded(r.award.id)}
                highlight={highlightId === r.award.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Other retrieved */}
      {otherRetrieved.length > 0 && (
        <section>
          <SectionLabel>Also retrieved · not cited · {otherRetrieved.length}</SectionLabel>
          <div className="mono" style={{ fontSize: 11, color: DS.inkFaint, marginBottom: 10, fontStyle: "italic" }}>
            These awards ranked highly on keyword match but the synthesis did not rely on them. Useful as adjacent reading.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {otherRetrieved.map((r) => (
              <AwardCard
                key={r.award.id}
                award={r.award}
                score={r.score}
                isCited={false}
                expanded={expandedIds.has(r.award.id)}
                onToggle={() => toggleExpanded(r.award.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MODULE 5: VERIFY — citation validation against the corpus
   Layered over the citation engine from earlier. Pipeline:
     1. extractCitations — local regex
     2. classifyCitations — local BM25 + name overlap
     3. distortion detection — Claude reads input + actual holdings,
        flags assertions that misstate what cases held
   ───────────────────────────────────────────────────────────────────────── */

function AnnotatedText({ text, citations, onCitationClick, highlightId }) {
  if (!citations || citations.length === 0) {
    return (
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14, color: DS.ink }}>
        {text}
      </div>
    );
  }

  // Walk the text, splitting at citation boundaries
  const parts = [];
  let lastEnd = 0;

  citations.forEach((cit, i) => {
    if (cit.position > lastEnd) {
      parts.push(<span key={`gap-${i}`}>{text.slice(lastEnd, cit.position)}</span>);
    }
    const status = VERIFY_STATUS[cit.status] || VERIFY_STATUS.unknown;
    const isHighlighted = highlightId === cit.id;
    parts.push(
      <button
        key={cit.id}
        onClick={() => onCitationClick(cit.id)}
        style={{
          display: "inline",
          padding: "2px 5px",
          margin: "0 1px",
          background: status.bg,
          color: status.color,
          border: `1px solid ${isHighlighted ? status.color : status.color + "55"}`,
          borderRadius: 2,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: 500,
          transition: "border-color 0.2s",
        }}
        title={`${status.label}${cit.score ? ` · score ${cit.score.toFixed(2)}` : ""}`}
      >
        {text.slice(cit.position, cit.position + cit.length)}
      </button>
    );
    lastEnd = cit.position + cit.length;
  });

  if (lastEnd < text.length) {
    parts.push(<span key="end">{text.slice(lastEnd)}</span>);
  }

  return (
    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: DS.ink }}>
      {parts}
    </div>
  );
}

function CitationDetail({ cit, expanded, onToggle, highlight }) {
  const status = VERIFY_STATUS[cit.status] || VERIFY_STATUS.unknown;
  return (
    <div
      id={`cit-detail-${cit.id}`}
      style={{
        background: DS.surface,
        border: `1px solid ${highlight ? status.color : DS.borderStrong}`,
        borderLeft: `3px solid ${status.color}`,
        padding: 14,
        borderRadius: 2,
        transition: "border-color 0.2s",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          <Pill color={status.color}>{status.label}</Pill>
          <span className="mono" style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
            {cit.text}
          </span>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          style={{
            color: DS.inkFaint,
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${DS.border}` }}>
          {cit.match && (
            <>
              <SectionLabel>Matched against</SectionLabel>
              <div className="mono" style={{ fontSize: 12, lineHeight: 1.6 }}>
                {cit.match.caseName}
                {cit.match.citation ? `, ${cit.match.citation}` : ""}
                <br />
                <span style={{ color: DS.inkFaint }}>
                  {cit.match.court || cit.match.tribunal}
                  {cit.match.court ? "" : `, ${cit.match.year}`}
                  {" · BM25 score "}
                  {cit.score?.toFixed(2)}
                </span>
              </div>
            </>
          )}

          {cit.status === "verified" && cit.match && (
            <div style={{ marginTop: 10 }}>
              <SectionLabel>Actual holdings</SectionLabel>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: DS.inkMuted }}>
                {cit.match.holdings.slice(0, 3).map((h, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{h}</li>
                ))}
                {cit.match.holdings.length > 3 && (
                  <li style={{ fontStyle: "italic", color: DS.inkFaint }}>
                    + {cit.match.holdings.length - 3} more
                  </li>
                )}
              </ol>
            </div>
          )}

          {cit.status === "distorted" && cit.distortion && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "#fff7ed",
                border: `1px solid #c2410c40`,
                borderRadius: 2,
              }}
            >
              <SectionLabel accent="#c2410c">Distortion detected</SectionLabel>
              <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                <span className="mono" style={{ fontSize: 10, color: "#c2410c", letterSpacing: "0.05em", marginRight: 6 }}>
                  ASSERTED:
                </span>
                "{cit.distortion.asserted}"
              </div>
              <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                <span className="mono" style={{ fontSize: 10, color: DS.success, letterSpacing: "0.05em", marginRight: 6 }}>
                  ACTUAL:
                </span>
                "{cit.distortion.actual}"
              </div>
              <div style={{ fontSize: 12, fontStyle: "italic", color: DS.inkMuted, lineHeight: 1.5 }}>
                {cit.distortion.explanation}
              </div>
            </div>
          )}

          {cit.status === "partial" && (
            <div style={{ marginTop: 10, fontSize: 12, color: DS.inkMuted, fontStyle: "italic", lineHeight: 1.5 }}>
              Weak match — case name partially overlaps with a corpus award but the BM25 confidence
              is below the verification threshold. Review manually before relying.
            </div>
          )}

          {cit.status === "not-in-corpus" && (
            <div style={{ marginTop: 10, fontSize: 12, color: DS.inkMuted, fontStyle: "italic", lineHeight: 1.5 }}>
              No matching case found in the indexed corpus. This citation may be fabricated, or
              may be a real authority from a corpus we don't index. In production, would extend
              search to full Westlaw / Lexis / CourtListener indices before flagging definitively.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Verify({ logEvent }) {
  const [stage, setStage] = useState("input"); // input | analyzing | results
  const [text, setText] = useState("");
  const [citations, setCitations] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [highlightId, setHighlightId] = useState(null);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  const run = async () => {
    if (!text.trim()) return;
    setStage("analyzing");
    setError(null);
    setWarning(null);

    try {
      // Step 1+2: extract and classify (local, fast)
      const extracted = extractCitations(text);
      const classified = classifyCitations(extracted, US_CASES);

      // No citations? Skip Claude, go straight to results.
      if (classified.length === 0) {
        setCitations([]);
        setStage("results");
        logEvent(makeEvent("verify", "verified", {
          textLength: text.length,
          citationCount: 0,
          verified: 0,
          partial: 0,
          distorted: 0,
          notInCorpus: 0,
        }));
        return;
      }

      // Step 3: distortion detection — Claude reads input + actual holdings
      const verified = classified.filter((c) => c.status === "verified");
      let distortionMap = {};

      if (verified.length > 0) {
        try {
          const verifiedContext = verified.map((v) => ({
            citationId: v.id,
            caseName: v.match.caseName,
            citation: v.match.citation,
            court: v.match.court,
            year: v.match.year,
            holdings: v.match.holdings,
          }));

          const raw = await callClaude(
            `You are reviewing a piece of legal text that contains citations to court decisions. For each verified citation provided, determine whether the input text accurately characterizes the cited case's holdings, or whether the text materially misstates what the case held (a "distorted holding").

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

Return only the JSON.`,
            1500
          );

          const parsed = parseJSON(raw);
          for (const d of parsed.distortions || []) {
            distortionMap[d.citationId] = d;
          }
        } catch (e) {
          console.warn("Distortion detection failed:", e);
          setWarning("Distortion detection unavailable for this run. Citations classified by BM25 retrieval only.");
        }
      }

      // Step 4: apply distortion findings
      const final = classified.map((c) =>
        distortionMap[c.id]
          ? { ...c, status: "distorted", distortion: distortionMap[c.id] }
          : c
      );

      setCitations(final);
      setStage("results");

      // Auto-expand any flagged citations
      const flaggedIds = final
        .filter((c) => c.status === "distorted" || c.status === "not-in-corpus")
        .map((c) => c.id);
      setExpandedIds(new Set(flaggedIds));

      const counts = final.reduce(
        (a, c) => ({ ...a, [c.status]: (a[c.status] || 0) + 1 }),
        {}
      );
      logEvent(makeEvent("verify", "verified", {
        textLength: text.length,
        citationCount: final.length,
        verified: counts.verified || 0,
        partial: counts.partial || 0,
        distorted: counts.distorted || 0,
        notInCorpus: counts["not-in-corpus"] || 0,
      }));
    } catch (e) {
      console.error(e);
      setError("Verification failed. " + (e.message || "Unknown error"));
      setStage("input");
    }
  };

  const reset = () => {
    setStage("input");
    setText("");
    setCitations([]);
    setExpandedIds(new Set());
    setHighlightId(null);
    setError(null);
    setWarning(null);
  };

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const focusCitation = (id) => {
    setExpandedIds((prev) => new Set([...prev, id]));
    setHighlightId(id);
    setTimeout(() => {
      const el = document.getElementById(`cit-detail-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    setTimeout(() => setHighlightId(null), 2000);
  };

  /* — INPUT — */
  if (stage === "input") {
    return (
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <SectionLabel accent={DS.verify}>05 — Verify</SectionLabel>
          <h1 className="fr" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1.05, marginBottom: 16 }}>
            Catch what the<br />
            <span style={{ fontStyle: "italic", color: DS.verify }}>other tools</span><br />
            didn't.
          </h1>
          <p style={{ fontSize: 15, color: DS.inkMuted, maxWidth: 540, lineHeight: 1.6, marginBottom: 24 }}>
            Paste AI-generated legal text. Verify extracts every citation, validates each against
            the corpus, and flags both fabricated citations <em>and</em> distorted holdings —
            cases where a real authority is cited but its holding is materially misstated.
          </p>

          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: "#fdf2f2", border: `1px solid ${DS.danger}`, color: DS.danger, fontSize: 13, borderRadius: 2 }}>
              {error}
            </div>
          )}

          <Field label="Text to verify">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a paragraph, brief excerpt, or memo with citations…"
              className="mono"
              style={{
                width: "100%",
                minHeight: 200,
                padding: 14,
                fontSize: 13,
                background: DS.surface,
                border: `1px solid ${DS.borderStrong}`,
                borderRadius: 2,
                color: DS.ink,
                resize: "vertical",
                lineHeight: 1.6,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            />
          </Field>

          <div style={{ marginTop: 14, marginBottom: 20 }}>
            <SectionLabel>Sample inputs</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {VERIFY_SAMPLES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setText(s.text)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    background: DS.surface,
                    border: `1px solid ${DS.border}`,
                    borderRadius: 2,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div className="fr" style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 12, color: DS.inkMuted, lineHeight: 1.5 }}>
                    {s.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Btn onClick={run} disabled={!text.trim()} icon={Quote} variant="accent" accent={DS.verify}>
            Run verification
          </Btn>
          <span className="mono" style={{ marginLeft: 12, fontSize: 11, color: DS.inkFaint }}>
            {text.length.toLocaleString()} chars
          </span>
        </div>

        <aside className="lg:col-span-2">
          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2, marginBottom: 16 }}>
            <SectionLabel accent={DS.verify}>Hall of hallucinations</SectionLabel>
            <p style={{ fontSize: 12, color: DS.inkMuted, lineHeight: 1.5, marginBottom: 14, fontStyle: "italic" }}>
              Real cases. Real sanctions. Lawyers caught submitting AI-fabricated citations.
            </p>
            {HALLUCINATION_CASES.map((c) => (
              <div key={c.id} style={{ paddingTop: 12, marginTop: 12, borderTop: `1px solid ${DS.border}` }}>
                <div className="fr" style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                  {c.caseName}
                </div>
                <div className="mono" style={{ fontSize: 10, color: DS.verify, letterSpacing: "0.05em", marginBottom: 6 }}>
                  {c.court.toUpperCase()} · {c.year}
                </div>
                <div style={{ fontSize: 12, color: DS.inkMuted, lineHeight: 1.5, marginBottom: 6 }}>
                  {c.summary}
                </div>
                <div className="mono" style={{ fontSize: 11, color: DS.danger, lineHeight: 1.4 }}>
                  → {c.sanction}
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${DS.borderStrong}`, background: DS.surface, padding: 20, borderRadius: 2 }}>
            <SectionLabel accent={DS.verify}>How it works</SectionLabel>
            {[
              { n: "I", t: "Extract", d: "Regex-detect AW-### IDs and case-name patterns from the input." },
              { n: "II", t: "Match", d: "BM25 against the corpus + case-name token overlap. Two-signal verification." },
              { n: "III", t: "Detect distortion", d: "Claude compares input assertions against actual holdings. Catches misstatement, not just fabrication." },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div className="fr" style={{ color: DS.verify, fontStyle: "italic", minWidth: 24, fontSize: 20, lineHeight: 1 }}>
                  {s.n}
                </div>
                <div>
                  <div className="fr" style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: DS.inkMuted, lineHeight: 1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    );
  }

  /* — ANALYZING — */
  if (stage === "analyzing") {
    return (
      <Loader
        accent={DS.verify}
        label="Verifying citations"
        sublabel="EXTRACTING · MATCHING · DETECTING DISTORTION"
      />
    );
  }

  /* — RESULTS — */
  const counts = citations.reduce(
    (a, c) => ({ ...a, [c.status]: (a[c.status] || 0) + 1 }),
    { verified: 0, partial: 0, distorted: 0, "not-in-corpus": 0, unknown: 0 }
  );

  const stats = [
    { l: "Verified", v: counts.verified, c: DS.success, bg: "#ecfdf5" },
    { l: "Partial", v: counts.partial, c: DS.warning, bg: "#fdf6ec" },
    { l: "Distorted", v: counts.distorted, c: "#c2410c", bg: "#fff7ed" },
    { l: "Not in corpus", v: counts["not-in-corpus"], c: DS.danger, bg: "#fdf2f2" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <SectionLabel accent={DS.verify}>Verification result</SectionLabel>
        <Btn onClick={reset} icon={Plus} variant="accent" accent={DS.verify}>New verification</Btn>
      </div>

      {warning && (
        <div style={{ padding: 12, marginBottom: 16, background: "#fdf6ec", border: `1px solid ${DS.warning}`, color: "#92400e", fontSize: 13, borderRadius: 2 }}>
          {warning}
        </div>
      )}

      {citations.length === 0 ? (
        <Empty
          icon={Quote}
          title="No citations detected"
          body="The verifier couldn't find any AW-### references or Plaintiff v. Defendant patterns in this text. The text may not contain citable authority — or may use citation patterns the regex doesn't recognize."
          action={<Btn onClick={reset} variant="ghost" icon={ArrowLeft}>Back to input</Btn>}
        />
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: 24 }}>
            {stats.map((s) => (
              <div
                key={s.l}
                style={{
                  border: `1px solid ${DS.borderStrong}`,
                  borderTop: `2px solid ${s.c}`,
                  background: s.v > 0 ? s.bg : DS.surface,
                  padding: 14,
                  borderRadius: 2,
                }}
              >
                <div className="fr" style={{ fontSize: 30, color: s.c, fontWeight: 600, lineHeight: 1 }}>
                  {s.v}
                </div>
                <div className="mono" style={{ fontSize: 10, color: DS.inkMuted, marginTop: 4, letterSpacing: "0.08em" }}>
                  {s.l.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Annotated text */}
          <section style={{ marginBottom: 28 }}>
            <SectionLabel accent={DS.verify}>Annotated text · {citations.length} citation{citations.length === 1 ? "" : "s"}</SectionLabel>
            <div
              style={{
                background: DS.surface,
                border: `1px solid ${DS.borderStrong}`,
                padding: 20,
                borderRadius: 2,
              }}
            >
              <AnnotatedText
                text={text}
                citations={citations}
                onCitationClick={focusCitation}
                highlightId={highlightId}
              />
            </div>
            <div className="mono" style={{ fontSize: 10, color: DS.inkFaint, marginTop: 8, letterSpacing: "0.05em" }}>
              CLICK ANY CITATION TO JUMP TO ITS ANALYSIS BELOW
            </div>
          </section>

          {/* Citation details */}
          <section>
            <SectionLabel accent={DS.verify}>Citation analysis</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {citations.map((c) => (
                <CitationDetail
                  key={c.id}
                  cit={c}
                  expanded={expandedIds.has(c.id)}
                  onToggle={() => toggleExpanded(c.id)}
                  highlight={highlightId === c.id}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   LEDGER — unified audit view across all modules
   ───────────────────────────────────────────────────────────────────────── */

function Ledger({ events, onClear }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? events : events.filter((e) => e.module === filter);

  const counts = events.reduce((a, e) => ({ ...a, [e.module]: (a[e.module] || 0) + 1 }), {});

  const exportLedger = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), events }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `counselco-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <SectionLabel>Audit ledger</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {events.length > 0 && (
            <>
              <Btn onClick={exportLedger} icon={Download} variant="ghost">Export JSON</Btn>
              <Btn onClick={onClear} icon={RotateCcw} variant="ghost">Clear</Btn>
            </>
          )}
        </div>
      </div>
      <h1 className="fr" style={{ fontSize: 36, fontWeight: 500, lineHeight: 1.1, marginBottom: 24 }}>
        {events.length} {events.length === 1 ? "decision" : "decisions"} on record
      </h1>

      {/* Filter row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
        <Chip active={filter === "all"} onClick={() => setFilter("all")} accent={DS.ink}>
          All · {events.length}
        </Chip>
        {Object.entries(MODULES).filter(([k]) => k !== "home" && k !== "ledger").map(([key, m]) => (
          <Chip key={key} active={filter === key} onClick={() => setFilter(key)} accent={m.accent}>
            {m.label} · {counts[key] || 0}
          </Chip>
        ))}
      </div>

      {events.length === 0 ? (
        <Empty
          icon={ScrollText}
          title="No decisions logged yet"
          body="Use any module — the ledger fills automatically as you accept, edit, reject, or generate."
        />
      ) : filtered.length === 0 ? (
        <Empty icon={Filter} title="No events match this filter" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {filtered.slice().reverse().map((e, i) => {
            const m = MODULES[e.module] || MODULES.home;
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "16px 0",
                  borderTop: i === 0 ? `1px solid ${DS.border}` : "none",
                  borderBottom: `1px solid ${DS.border}`,
                }}
              >
                <div style={{ minWidth: 110 }}>
                  <div className="mono" style={{ fontSize: 10, color: DS.inkFaint, letterSpacing: "0.05em" }}>
                    {new Date(e.timestamp).toLocaleDateString()}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: DS.ink, marginTop: 2 }}>
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>
                <div style={{ minWidth: 90 }}>
                  <Pill color={m.accent}>{m.label}</Pill>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fr" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {humanizeAction(e.action)}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: DS.inkMuted, lineHeight: 1.6 }}>
                    {summarizePayload(e)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function humanizeAction(action) {
  const map = {
    analyzed: "Document analyzed",
    accepted: "Suggestion accepted",
    edited: "Suggestion edited",
    rejected: "Suggestion rejected",
    generated: "Policy generated",
    "section-edited": "Policy section edited",
    saved: "Saved to library",
    exported: "Exported",
    researched: "Research query run",
    "memo-exported": "Research memo exported",
    verified: "Citations verified",
  };
  if (map[action]) return map[action];
  if (action.startsWith("approve-")) return "Vendor category approved";
  if (action.startsWith("negotiate-")) return "Vendor flagged for negotiation";
  if (action.startsWith("block-")) return "Vendor category blocked";
  return action;
}

function summarizePayload(e) {
  const p = e.payload || {};
  if (e.module === "redline") {
    if (e.action === "analyzed") return `${p.documentType || "Document"} · ${p.riskCount} risks · ${p.suggestionCount} suggestions`;
    if (p.suggestionId) return `${p.category || ""} · ${p.suggestionId} · "${(p.humanFinal || "").slice(0, 80)}${(p.humanFinal || "").length > 80 ? "…" : ""}"`;
  }
  if (e.module === "policy") {
    if (e.action === "generated") return `${p.firmName} · ${p.sectionCount} sections · ${p.riskTolerance} posture`;
    if (e.action === "section-edited") return `${p.firmName} · §${p.sectionId} · "${(p.after || "").slice(0, 80)}…"`;
    if (e.action === "saved") return `${p.firmName} · saved to library`;
    return p.firmName || "";
  }
  if (e.module === "vendor") {
    if (e.action === "analyzed") return `${p.vendorName} · ${p.overallRisk?.toUpperCase()} overall · ${p.categoryCount} categories`;
    if (p.categoryId) return `${p.vendorName} · ${p.categoryTitle} · ${p.risk?.toUpperCase()} risk`;
  }
  if (e.module === "research") {
    if (e.action === "researched") {
      const cited = (p.citedIds || []).length;
      const retrieved = (p.retrievedIds || []).length;
      return `"${(p.query || "").slice(0, 80)}${(p.query || "").length > 80 ? "…" : ""}" · ${p.confidence?.toUpperCase()} · ${cited}/${retrieved} cited`;
    }
    if (e.action === "memo-exported") return `"${(p.query || "").slice(0, 80)}${(p.query || "").length > 80 ? "…" : ""}"`;
  }
  if (e.module === "verify") {
    if (e.action === "verified") {
      if (p.citationCount === 0) {
        return `${p.textLength} chars · no citations detected`;
      }
      const flagged = (p.distorted || 0) + (p.notInCorpus || 0);
      return `${p.citationCount} cite${p.citationCount === 1 ? "" : "s"} · ${p.verified}V ${p.partial}P ${p.distorted}D ${p.notInCorpus}N · ${flagged} flagged`;
    }
  }
  return JSON.stringify(p).slice(0, 100);
}

/* ─────────────────────────────────────────────────────────────────────────
   HOME / DASHBOARD
   ───────────────────────────────────────────────────────────────────────── */

function Home({ events, onNavigate, savedPolicies, savedVendors }) {
  const counts = events.reduce((a, e) => ({ ...a, [e.module]: (a[e.module] || 0) + 1 }), {});
  const recent = events.slice(-3).reverse();
  const [videoFailed, setVideoFailed] = useState(false);

  const tiles = [
    {
      key: "redline",
      title: "Redline",
      subtitle: "Contract review with audit",
      body: "Paste a contract. AI surfaces risks and suggests redlines. Every accept, edit, reject is logged.",
      accent: DS.redline,
      icon: MODULES.redline.icon,
      stat: counts.redline || 0,
      statLabel: "decisions",
      featured: true,
    },
    {
      key: "policy",
      title: "Policy",
      subtitle: "AI use policy generator",
      body: "Parameterize by firm size, practice mix, jurisdiction, risk tolerance. Edit sections inline; every change snapshots.",
      accent: DS.policy,
      icon: MODULES.policy.icon,
      stat: savedPolicies.length,
      statLabel: "saved",
    },
    {
      key: "vendor",
      title: "Vendor",
      subtitle: "AI vendor TOS diligence",
      body: "Score vendor terms by category. Cite clauses. Approve, negotiate, or block — rationale captured.",
      accent: DS.vendor,
      icon: MODULES.vendor.icon,
      stat: savedVendors.length,
      statLabel: "assessed",
    },
    {
      key: "research",
      title: "Research",
      subtitle: "Arbitration corpus search",
      body: "Natural-language query over arbitration awards. BM25 retrieval, calibrated confidence — no bluffing when the corpus is thin.",
      accent: DS.research,
      icon: MODULES.research.icon,
      stat: counts.research || 0,
      statLabel: "queries",
    },
    {
      key: "verify",
      title: "Verify",
      subtitle: "Citation validation",
      body: "Validates every citation against the corpus. Flags fabrication AND distorted holdings — cases cited but materially misstated.",
      accent: DS.verify,
      icon: MODULES.verify.icon,
      stat: counts.verify || 0,
      statLabel: "verifications",
    },
  ];

  const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

  const Tile = ({ t, featured }) => {
    const Icon = t.icon;
    return (
      <button
        onClick={() => onNavigate(t.key)}
        className={`tile-backlit responsive-tile${featured ? " responsive-featured-tile" : ""}`}
        style={{
          position: "relative",
          textAlign: "left",
          padding: featured ? 32 : 22,
          background: `linear-gradient(180deg, #FFFFFF 0%, ${DS.surface} 100%)`,
          border: `1px solid ${DS.border}`,
          borderLeft: `4px solid ${t.accent}`,
          borderRadius: 10,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "transform 0.25s ease, box-shadow 0.3s ease, border-color 0.2s ease",
          overflow: "hidden",
          minHeight: featured ? 280 : 200,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          flex: 1,
          // Resting backlit halo — accent-colored ambient glow + soft drop shadow
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 0 0 1px ${DS.border},
            0 8px 24px ${t.accent}1f,
            0 24px 60px ${t.accent}14,
            0 4px 12px rgba(15,20,34,0.05)
          `,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = `
            inset 0 1px 0 rgba(255,255,255,0.95),
            0 0 0 1px ${t.accent}66,
            0 0 80px ${t.accent}40,
            0 16px 48px ${t.accent}33,
            0 8px 20px rgba(15,20,34,0.08)
          `;
          e.currentTarget.style.borderLeftColor = t.accent;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 0 0 1px ${DS.border},
            0 8px 24px ${t.accent}1f,
            0 24px 60px ${t.accent}14,
            0 4px 12px rgba(15,20,34,0.05)
          `;
          e.currentTarget.style.borderLeftColor = t.accent;
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: featured ? 20 : 14, gap: 12 }}>
          <div
            style={{
              width: featured ? 56 : 44,
              height: featured ? 64 : 50,
              background: t.accent + "14",
              color: t.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              clipPath: HEX_CLIP,
              flexShrink: 0,
            }}
          >
            <Icon size={featured ? 24 : 20} strokeWidth={1.75} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: featured ? 22 : 16, fontWeight: 600, color: DS.ink, lineHeight: 1 }}>
              {t.stat}
            </div>
            <div className="mono" style={{ fontSize: 9, color: DS.inkFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
              {t.statLabel}
            </div>
          </div>
        </div>

        <SectionLabel accent={t.accent}>{t.subtitle}</SectionLabel>
        <h3 className="fr" style={{ fontSize: featured ? 36 : 24, fontWeight: 500, marginTop: 6, marginBottom: 10, letterSpacing: "-0.01em" }}>
          {t.title}
        </h3>
        <p style={{ fontSize: featured ? 15 : 13, color: DS.inkMuted, lineHeight: 1.55, marginBottom: 16, flex: 1 }}>
          {t.body}
        </p>
        <div className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.accent, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Open module
          <ArrowRight size={12} strokeWidth={2.5} />
        </div>
      </button>
    );
  };

  const featured = tiles.find((t) => t.featured);
  const others = tiles.filter((t) => !t.featured);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  // Dim only to 0.5 — readability priority. Slight upward parallax.
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.5]);
  // Content moves up faster than the video — classic parallax separation.
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  // Video lingers slightly + slow zoom for a "diving in" feel.
  const videoY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const headlineWords = [
    { t: "AI" },
    { t: "you" },
    { t: "can" },
    { t: "defend", italic: true, color: DS.redline },
    { t: "in" },
    { t: "front" },
    { t: "of" },
    { t: "the" },
    { t: "partners." },
  ];

  const heroStats = [
    { v: "5", l: "modules" },
    { v: "1", l: "ledger" },
    { v: events.length, l: events.length === 1 ? "decision logged" : "decisions logged" },
    { v: savedPolicies.length + savedVendors.length, l: "artifacts saved" },
  ];

  return (
    <div style={{ position: "relative", isolation: "isolate" }}>
      {/* Drifting smoke — atmospheric depth between sections.
          z-index:-1 + isolation on the parent keeps these visually behind
          all content while staying inside Home's stacking context. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: -1 }}>
        <div className="smoke smoke-a" style={{ top: "62vh", right: "-180px" }} />
        <div className="smoke smoke-b" style={{ top: "92vh", left: "-160px" }} />
        <div className="smoke smoke-c" style={{ top: "150vh", right: "-220px" }} />
        <div className="smoke smoke-a" style={{ top: "210vh", left: "-200px", animationDelay: "-12s" }} />
      </div>
      {/* Hero — full-bleed cinematic intro */}
      <motion.section
        ref={heroRef}
        className="noise-overlay responsive-hero"
        style={{
          position: "relative",
          // Break out of the page max-width container into full viewport width
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          marginTop: -40, // pull up to meet the header (cancels main's 40px top padding)
          marginBottom: 64,
          minHeight: "78vh",
          display: "flex",
          // Headline used to sit pinned to the bottom — leaves a dead zone in
          // the upper third. Center vertically so the chip can live up top
          // and the SCROLL affordance has its own room down below.
          alignItems: "center",
          opacity: heroOpacity,
          willChange: "opacity",
          overflow: "hidden",
        }}
      >
        {/* Full-bleed video / ambient backdrop */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
          }}
        >
          <motion.div
            style={{
              width: "100%",
              height: "100%",
              y: videoY,
              scale: videoScale,
              willChange: "transform",
              transformOrigin: "center center",
            }}
          >
            {HERO_VIDEO_URL && !videoFailed ? (
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                onError={() => setVideoFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
                src={HERO_VIDEO_URL}
              />
            ) : (
              <div className="hero-ambient" style={{ width: "100%", height: "100%" }} />
            )}
          </motion.div>
          {/* Directional wash: heavy cream on the left (headline backdrop),
              fading to transparent on the right (video breathes through). */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(95deg, ${DS.bg}f2 0%, ${DS.bg}d9 30%, ${DS.bg}80 58%, ${DS.bg}26 100%)`,
            }}
          />
          {/* Top/bottom vignette: top fades from header, bottom fades into page bg
              so the hero hands off cleanly to the rest of the content. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, ${DS.bg}99 0%, transparent 18%, transparent 70%, ${DS.bg} 100%)`,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Live status chip — anchored to the upper-left of the hero,
            mirrors the content's max-width gutter so it aligns with the
            headline's left edge. Sits outside the parallaxed content so it
            stays pinned in the upper-left as you scroll. */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            right: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <div className="responsive-live-chip-wrap" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
            <motion.div
              className="responsive-live-chip"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                background: `${DS.surface2}f0`,
                backdropFilter: "blur(10px)",
                border: `1px solid ${DS.border}`,
                borderRadius: 999,
                pointerEvents: "auto",
                boxShadow: `0 4px 16px ${DS.ink}14`,
              }}
            >
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 8,
                  height: 8,
                  background: DS.success,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 2px ${DS.success}33, 0 0 10px ${DS.success}80`,
                }}
              />
              <span
                className="mono"
                style={{ fontSize: 10, letterSpacing: "0.16em", color: DS.ink, fontWeight: 600, textTransform: "uppercase" }}
              >
                Live · Audit Ledger ·{" "}
                {events.length === 0
                  ? "monitoring 5 modules"
                  : `${events.length} ${events.length === 1 ? "decision" : "decisions"} logged`}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Inner content — re-constrained to page max-width.
            Tailwind classes are present in this codebase but no Tailwind is
            configured, so the maxWidth + auto margins are set inline. */}
        <motion.div
          className="responsive-hero-inner"
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 32px",
            y: contentY,
            willChange: "transform",
          }}
        >
        <div className="responsive-hero-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 32, alignItems: "end" }}>
          <div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <SectionLabel>Counsel·Co</SectionLabel>
            </motion.div>
            <motion.h1
              className="fr responsive-hero-headline"
              style={{ fontSize: 56, fontWeight: 500, lineHeight: 1.02, marginTop: 8, marginBottom: 20, letterSpacing: "-0.02em", textShadow: `0 1px 0 ${DS.bg}, 0 0 12px ${DS.bg}80` }}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { delayChildren: 0.18, staggerChildren: 0.07 } },
              }}
            >
              {headlineWords.map((w, i) => (
                <motion.span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: i === headlineWords.length - 1 ? 0 : "0.28em",
                    fontStyle: w.italic ? "italic" : "normal",
                    color: w.color || "inherit",
                  }}
                  variants={{
                    hidden: { y: "0.55em", opacity: 0 },
                    visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
                  }}
                >
                  {w.t}
                </motion.span>
              ))}
            </motion.h1>
            <motion.p
              className="responsive-hero-copy"
              style={{ fontSize: 16, color: DS.inkMuted, lineHeight: 1.6, maxWidth: 560 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.85, ease: "easeOut" }}
            >
              A governance toolkit for law firms using AI. Five modules sharing one tamper-evident audit ledger. Every suggestion reviewable, every decision recorded.
            </motion.p>
          </div>
          <motion.div
            className="responsive-stats-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { delayChildren: 0.55, staggerChildren: 0.08 } },
            }}
          >
            {heroStats.map((s, i) => (
              <motion.div
                key={i}
                className="responsive-stat-card"
                style={{ padding: "14px 16px", background: `${DS.surface2}f0`, backdropFilter: "blur(8px)", border: `1px solid ${DS.border}`, borderRadius: 6 }}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
                }}
              >
                <div className="fr responsive-stat-numeral" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1, color: DS.ink }}>{s.v}</div>
                <div className="mono" style={{ fontSize: 10, color: DS.inkFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 6 }}>{s.l}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
        </motion.div>
        {/* Scroll affordance — pinned to viewport-center bottom of the hero,
            outside the parallaxed content so it doesn't drift on scroll. */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.6 }}
          style={{
            position: "absolute",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          <span className="mono" style={{ fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: DS.inkFaint }}>
            Scroll
          </span>
          <motion.span
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 1, height: 22, background: DS.inkFaint }}
          />
        </motion.div>
      </motion.section>

      {/* Module tiles — featured + 2x2 grid, viewport-triggered entrance */}
      <motion.div
        className="responsive-tiles-grid"
        style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 16, marginBottom: 56 }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
      >
        {featured && (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16, scale: 0.985 },
              visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            <Tile t={featured} featured />
          </motion.div>
        )}
        <motion.div
          className="responsive-tiles-secondary"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
          }}
        >
          {others.map((t) => (
            <motion.div
              key={t.key}
              variants={{
                hidden: { opacity: 0, y: 14, scale: 0.985 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
              }}
              style={{ display: "flex" }}
            >
              <Tile t={t} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Ledger preview */}
      <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <div>
            <SectionLabel>Audit ledger · live</SectionLabel>
            <h2 className="fr" style={{ fontSize: 24, fontWeight: 500, marginTop: 6 }}>
              {events.length === 0
                ? "Empty. Start in any module."
                : `${events.length} ${events.length === 1 ? "decision" : "decisions"} on record`}
            </h2>
          </div>
          {events.length > 0 && (
            <Btn onClick={() => onNavigate("ledger")} icon={ArrowRight} variant="ghost">View all</Btn>
          )}
        </div>

        {events.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recent.map((e, i) => {
              const m = MODULES[e.module] || MODULES.home;
              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 4px",
                    borderTop: i === 0 ? `1px solid ${DS.border}` : "none",
                    borderBottom: `1px solid ${DS.border}`,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 12,
                      background: m.accent,
                      clipPath: HEX_CLIP,
                      flexShrink: 0,
                    }}
                  />
                  <div className="mono" style={{ fontSize: 10, color: DS.inkFaint, letterSpacing: "0.1em", textTransform: "uppercase", minWidth: 80 }}>
                    {m.label}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: DS.ink }}>{humanizeAction(e.action)}</div>
                  <div className="mono" style={{ fontSize: 11, color: DS.inkFaint }}>
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SHELL — top-level component
   ───────────────────────────────────────────────────────────────────────── */

export default function CounselCo() {
  const [route, setRoute] = useState("home");
  const [events, setEvents] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from persistent storage on mount
  useEffect(() => {
    (async () => {
      const [le, p, v] = await Promise.all([
        sGet(SK.ledger, []),
        sGet(SK.policies, []),
        sGet(SK.vendors, []),
      ]);
      setEvents(le);
      setPolicies(p);
      setVendors(v);
      setHydrated(true);
    })();
  }, []);

  // Persist
  useEffect(() => { if (hydrated) sSet(SK.ledger, events); }, [events, hydrated]);
  useEffect(() => { if (hydrated) sSet(SK.policies, policies); }, [policies, hydrated]);
  useEffect(() => { if (hydrated) sSet(SK.vendors, vendors); }, [vendors, hydrated]);

  const logEvent = useCallback((event) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const savePolicy = useCallback((p) => {
    setPolicies((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) return prev.map((x) => x.id === p.id ? p : x);
      return [...prev, p];
    });
  }, []);

  const deletePolicy = useCallback((id) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const saveVendor = useCallback((v) => {
    setVendors((prev) => [...prev, v]);
  }, []);

  const clearLedger = useCallback(() => {
    if (window.confirm("Clear the entire audit ledger? This cannot be undone.")) {
      setEvents([]);
    }
  }, []);

  const currentAccent = MODULES[route]?.accent || DS.ink;

  return (
    <div
      className="bg-noise"
      style={{
        minHeight: "100vh",
        background: DS.bg,
        color: DS.ink,
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .fr { font-family: 'Fraunces', Georgia, serif; font-feature-settings: "ss01"; letter-spacing: -0.01em; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        body {
          background-color: ${DS.bg};
          background-image:
            radial-gradient(ellipse 55% 45% at 78% -8%, ${DS.warning}1f 0%, transparent 60%),
            radial-gradient(ellipse 65% 55% at 12% 38%, ${DS.highlight}33 0%, transparent 65%),
            radial-gradient(ellipse 75% 65% at 92% 88%, ${DS.vendor}1f 0%, transparent 65%),
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='84' height='96' viewBox='0 0 84 96'><g fill='none' stroke='%230F1422' stroke-opacity='0.04' stroke-width='1'><polygon points='42,2 80,24 80,72 42,94 4,72 4,24'/><polygon points='0,48 14,40 14,56'/><polygon points='84,48 70,40 70,56'/></g></svg>");
          background-size: 200% 200%, 200% 200%, 200% 200%, 168px 192px;
          background-attachment: fixed, fixed, fixed, scroll;
          animation: page-ambient-drift 38s ease-in-out infinite;
        }
        @keyframes page-ambient-drift {
          0%, 100% { background-position: 0% 0%, 0% 0%, 0% 0%, 0 0; }
          50%      { background-position: 6% 4%, -5% 8%, 4% -5%, 0 0; }
        }
        button:focus-visible, textarea:focus-visible, input:focus-visible {
          outline: 2px solid ${currentAccent};
          outline-offset: 2px;
        }
        textarea, input {
          font-family: inherit;
        }
        textarea:focus, input:focus {
          border-color: ${currentAccent};
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        /* Tactile noise grain — pairs with the hex bg pattern for a felt-panel feel. */
        .noise-overlay {
          position: relative;
          isolation: isolate;
        }
        .noise-overlay::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.035;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          mix-blend-mode: multiply;
        }
        .bg-noise::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.025;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          mix-blend-mode: multiply;
        }

        /* Slow-pan ambient gradient for the hero — used when no video URL is set. */
        @keyframes hero-pan {
          0%   { background-position: 0% 50%, 0% 50%, 50% 50%; }
          50%  { background-position: 100% 50%, 100% 50%, 50% 50%; }
          100% { background-position: 0% 50%, 0% 50%, 50% 50%; }
        }
        .hero-ambient {
          background:
            radial-gradient(ellipse 60% 80% at 20% 30%, ${DS.highlight}55 0%, transparent 60%),
            radial-gradient(ellipse 70% 60% at 80% 70%, ${DS.vendor}30 0%, transparent 65%),
            linear-gradient(135deg, ${DS.surface} 0%, ${DS.bg} 100%);
          background-size: 200% 200%, 200% 200%, 100% 100%;
          animation: hero-pan 28s ease-in-out infinite;
        }

        /* Drifting smoke clouds — large blurred radial pools that slowly
           translate, suggesting atmospheric depth as you scroll. */
        .smoke {
          position: absolute;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(48px);
          mix-blend-mode: screen;
          will-change: transform, opacity;
        }
        .smoke-a {
          width: 720px; height: 480px;
          background: radial-gradient(ellipse, ${DS.highlight}66 0%, ${DS.highlight}1a 40%, transparent 70%);
          animation: smoke-a 30s ease-in-out infinite;
        }
        .smoke-b {
          width: 620px; height: 420px;
          background: radial-gradient(ellipse, ${DS.surface2}d9 0%, ${DS.surface2}40 40%, transparent 70%);
          animation: smoke-b 36s ease-in-out infinite;
        }
        .smoke-c {
          width: 800px; height: 520px;
          background: radial-gradient(ellipse, ${DS.vendor}40 0%, ${DS.vendor}14 40%, transparent 70%);
          animation: smoke-c 42s ease-in-out infinite;
        }
        @keyframes smoke-a {
          0%, 100% { transform: translate(0, 0) scale(1);     opacity: 0.55; }
          50%      { transform: translate(90px, -34px) scale(1.08); opacity: 0.85; }
        }
        @keyframes smoke-b {
          0%, 100% { transform: translate(0, 0) scale(1);     opacity: 0.5; }
          50%      { transform: translate(-80px, 44px) scale(1.1);  opacity: 0.78; }
        }
        @keyframes smoke-c {
          0%, 100% { transform: translate(0, 0) scale(1);     opacity: 0.45; }
          50%      { transform: translate(60px, 40px) scale(1.06);  opacity: 0.7; }
        }

        /* Backlit card glow — strong accent-colored halo at rest, brighter on
           hover. Top-edge highlight suggests light coming from above. */
        .tile-backlit {
          background-image: linear-gradient(180deg, #FFFFFF 0%, ${DS.surface} 100%);
        }

        /* ─── Responsive: tablet (≤1024px) ─────────────────────────────────
           Featured-plus-2x2 tile grid collapses to a 2-up grid; nav labels
           hide so 6 module icons fit in the header beside the wordmark. */
        @media (max-width: 1024px) {
          .responsive-header-row { padding: 12px 20px !important; }
          .responsive-nav { gap: 0 !important; }
          .responsive-nav-label { display: none !important; }
          .responsive-nav button { padding: 10px 10px !important; }
          .responsive-tiles-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
          .responsive-tiles-secondary {
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
          }
          .responsive-featured-tile { min-height: 220px !important; padding: 24px !important; }
          .responsive-featured-tile h3 { font-size: 30px !important; }
        }

        /* ─── Responsive: phone (≤720px) ──────────────────────────────────
           Hero stacks vertically (text above stats), headline and stat
           numerals shrink, padding tightens, tile grid goes 1-up. */
        @media (max-width: 720px) {
          .responsive-main { padding: 24px 16px 60px !important; }
          .responsive-header-row { padding: 10px 14px !important; flex-wrap: wrap; gap: 8px; }
          .responsive-wordmark-tagline { display: none !important; }
          .responsive-hero {
            min-height: 70vh !important;
            margin-top: -24px !important;
          }
          .responsive-hero-inner { padding: 0 16px !important; }
          .responsive-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            align-items: start !important;
          }
          .responsive-hero-headline { font-size: 36px !important; }
          .responsive-hero-copy { font-size: 14px !important; }
          .responsive-stats-grid { gap: 10px !important; }
          .responsive-stat-card { padding: 12px 14px !important; }
          .responsive-stat-numeral { font-size: 22px !important; }
          .responsive-live-chip-wrap { padding: 0 16px !important; top: 16px !important; }
          .responsive-live-chip { font-size: 9px !important; }
          .responsive-tiles-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .responsive-tiles-secondary {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .responsive-tile { min-height: 160px !important; padding: 18px !important; }
          .responsive-featured-tile h3 { font-size: 26px !important; }
        }

        /* ─── Responsive: very narrow (≤380px) ─────────────────────────── */
        @media (max-width: 380px) {
          .responsive-hero-headline { font-size: 30px !important; }
          .responsive-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${DS.border}`,
          background: "rgba(237,238,242,0.88)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div className="max-w-7xl mx-auto px-6 responsive-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", maxWidth: 1280, margin: "0 auto" }}>
          <button
            onClick={() => setRoute("home")}
            style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
          >
            <div
              style={{
                width: 34,
                height: 38,
                background: DS.ink,
                color: DS.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
              }}
            >
              <Scale size={16} strokeWidth={1.75} />
            </div>
            <div style={{ textAlign: "left" }}>
              <div
                className="mono"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: DS.ink,
                }}
              >
                COUNSEL<span style={{ color: currentAccent }}>·</span>CO
              </div>
              <div className="mono responsive-wordmark-tagline" style={{ fontSize: 9, color: DS.inkFaint, marginTop: 4, letterSpacing: "0.14em" }}>
                AI GOVERNANCE · LAW FIRMS
              </div>
            </div>
          </button>

          {/* Nav */}
          <nav className="responsive-nav" style={{ display: "flex", gap: 2, alignItems: "center" }}>
            {Object.entries(MODULES).filter(([k]) => k !== "home").map(([key, m]) => {
              const active = route === key;
              const Icon = m.icon;
              const showBadge = key === "ledger" && events.length > 0;
              return (
                <button
                  key={key}
                  onClick={() => setRoute(key)}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    fontWeight: active ? 600 : 500,
                    background: "transparent",
                    color: active ? DS.ink : DS.inkMuted,
                    border: "1px solid transparent",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "color 120ms ease",
                  }}
                >
                  <Icon size={15} strokeWidth={1.75} style={{ color: active ? m.accent : DS.inkFaint }} />
                  <span className="responsive-nav-label">{m.label}</span>
                  {showBadge && (
                    <span className="mono" style={{ fontSize: 10, padding: "1px 5px", background: active ? m.accent : DS.borderStrong, color: active ? DS.bg : DS.ink, borderRadius: 3 }}>
                      {events.length}
                    </span>
                  )}
                  {active && (
                    <span style={{ position: "absolute", left: 14, right: 14, bottom: 2, height: 2, background: m.accent, borderRadius: 2 }} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 responsive-main" style={{ padding: "40px 24px 80px", maxWidth: 1280, margin: "0 auto" }}>
        {!hydrated ? (
          <Loader label="Loading workspace" />
        ) : route === "home" ? (
          <Home events={events} onNavigate={setRoute} savedPolicies={policies} savedVendors={vendors} />
        ) : route === "redline" ? (
          <Redline logEvent={logEvent} />
        ) : route === "policy" ? (
          <Policy logEvent={logEvent} savedPolicies={policies} savePolicy={savePolicy} deletePolicy={deletePolicy} />
        ) : route === "vendor" ? (
          <Vendor logEvent={logEvent} savedVendors={vendors} saveVendor={saveVendor} />
        ) : route === "research" ? (
          <Research logEvent={logEvent} />
        ) : route === "verify" ? (
          <Verify logEvent={logEvent} />
        ) : route === "ledger" ? (
          <Ledger events={events} onClear={clearLedger} />
        ) : null}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${DS.border}`, padding: "20px 24px" }}>
        <div className="max-w-7xl mx-auto" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div className="mono" style={{ fontSize: 10, color: DS.inkFaint, letterSpacing: "0.08em" }}>
            COUNSEL·CO · AI GOVERNANCE TOOLKIT · v0.1
          </div>
          <div style={{ fontSize: 11, color: DS.inkFaint, fontStyle: "italic" }}>
            Not legal advice. AI output requires review by qualified counsel.
          </div>
        </div>
      </footer>
    </div>
  );
}
