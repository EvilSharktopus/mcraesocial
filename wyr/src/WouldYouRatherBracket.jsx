import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  getDocs,
} from "firebase/firestore";

// â”€â”€ Firebase config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Replace with your actual config from Firebase console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ Per-category brainstorm targets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// gross(10) + bad(10) + weird(12) = 32 combined bracket
// good(16) = separate randomly-seeded bracket
const CATEGORIES = ["gross", "bad", "weird", "good"];
const PROD_TARGETS   = { gross: 10, bad: 10, weird: 12, good: 16 };
const DEV_TARGETS    = { gross: 2,  bad: 2,  weird: 3,  good: 4  };
const PROD_USER_CAPS = { gross: 2,  bad: 2,  weird: 2,  good: 2  };
const DEV_USER_CAPS  = { gross: 1,  bad: 1,  weird: 1,  good: 1  };

const COMBINED_CATS = ["gross", "bad", "weird"]; // feeds the 32-entry bracket

const CATEGORY_COLORS = {
  gross: { bg: "#4B1528", text: "#FBEAF0", badge: "#993556" },
  weird: { bg: "#26215C", text: "#EEEDFE", badge: "#7F77DD" },
  bad:   { bg: "#501313", text: "#FCEBEB", badge: "#E24B4A" },
  good:  { bg: "#173404", text: "#EAF3DE", badge: "#639922" },
};
const CATEGORY_EMOJI = { gross: "🤢", weird: "🌀", bad: "💀", good: "✨" };

// â”€â”€ Bracket builders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TBD placeholder — fills empty bracket slots so every match is always clickable
function tbd(id) { return { id: `tbd-${id}`, text: 'TBD', category: null, isTBD: true }; }

// 32-entry (5 rounds): for combined gross+bad+weird
function buildBracket32(seeded) {
  const r1 = [];
  for (let i = 0; i < 16; i++)
    r1.push({ id: `r1-${i}`, top: seeded[i] ?? tbd(`r1-${i}t`), bottom: seeded[31 - i] ?? tbd(`r1-${i}b`), winner: null });
  const mk = (pfx, n) => Array.from({ length: n }, (_, i) => ({ id: `${pfx}-${i}`, top: null, bottom: null, winner: null }));
  return { r1, r2: mk("r2", 8), r3: mk("r3", 4), r4: mk("r4", 2), final: mk("final", 1) };
}

// 16-entry (4 rounds): for good bracket, randomly seeded
function buildBracket16(seeded) {
  const r1 = [];
  for (let i = 0; i < 8; i++)
    r1.push({ id: `r1-${i}`, top: seeded[i] ?? tbd(`r1-${i}t`), bottom: seeded[15 - i] ?? tbd(`r1-${i}b`), winner: null });
  const mk = (pfx, n) => Array.from({ length: n }, (_, i) => ({ id: `${pfx}-${i}`, top: null, bottom: null, winner: null }));
  return { r1, r2: mk("r2", 4), r3: mk("r3", 2), final: mk("final", 1) };
}

function getCurrentRound(bracket) {
  if (bracket.final[0].winner) return "done";
  if (bracket.r4 && bracket.r4.every(m => m.winner)) return "final";
  if (bracket.r3 && bracket.r3.every(m => m.winner)) return bracket.r4 ? "r4" : "final";
  if (bracket.r2.every(m => m.winner)) return "r3";
  if (bracket.r1.every(m => m.winner)) return "r2";
  return "r1";
}

function advanceBracket(bracket, round, matchIdx, winner) {
  const b = JSON.parse(JSON.stringify(bracket));
  b[round][matchIdx].winner = winner;
  const nextRound = { r1: "r2", r2: "r3", r3: bracket.r4 ? "r4" : "final", r4: "final" };
  const next = nextRound[round];
  if (!next || !b[next]) return b;
  const nextMatchIdx = Math.floor(matchIdx / 2);
  if (!b[next][nextMatchIdx]) b[next][nextMatchIdx] = { id: `${next}-${nextMatchIdx}`, top: null, bottom: null, winner: null };
  if (matchIdx % 2 === 0) b[next][nextMatchIdx].top = winner;
  else b[next][nextMatchIdx].bottom = winner;
  return b;
}

// Seed the combined bracket from averaged per-student rankings
async function buildCombinedFromRankings(sessionId, scenarios) {
  const snap = await getDocs(query(collection(db, "rankings")));
  const combined = scenarios.filter(s => COMBINED_CATS.includes(s.category) && !s.culled);
  const posMap = {}, countMap = {};
  combined.forEach(s => { posMap[s.id] = 0; countMap[s.id] = 0; });

  snap.docs.forEach(d => {
    const data = d.data();
    if (data.sessionId !== sessionId) return;
    COMBINED_CATS.forEach(cat => {
      (data.rankings?.[cat] || []).forEach((s, idx) => {
        const total = (data.rankings[cat].length) || 1;
        if (posMap[s.id] !== undefined) {
          posMap[s.id] += idx / (total - 1 || 1); // normalised 0“1 within category
          countMap[s.id]++;
        }
      });
    });
  });

  const scored = combined
    .map(s => ({ ...s, score: countMap[s.id] > 0 ? posMap[s.id] / countMap[s.id] : Math.random() }))
    .sort((a, b) => a.score - b.score); // lower score = higher rank = better

  return buildBracket32(scored);
}

// Randomly seed the good bracket
function buildGoodBracket(scenarios) {
  const good = scenarios.filter(s => s.category === "good" && !s.culled);
  const shuffled = [...good].sort(() => Math.random() - 0.5);
  return buildBracket16(shuffled);
}

// â”€â”€ Local fast duplicate check (runs before Gemini) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isFastDuplicate(newText, existingTexts) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const newNorm = normalize(newText);

  for (const existing of existingTexts) {
    const exNorm = normalize(existing);
    // Exact match after normalization
    if (newNorm === exNorm) return true;
    // Word-set overlap — catches reorderings like "eat ice cubes" vs "eat cubes of ice"
    const newWords = new Set(newNorm.split(' ').filter(w => w.length > 2));
    const exWords  = new Set(exNorm.split(' ').filter(w => w.length > 2));
    if (newWords.size === 0) continue;
    const overlap = [...newWords].filter(w => exWords.has(w)).length;
    if (overlap / Math.max(newWords.size, exWords.size) >= 0.6) return true;
  }
  return false;
}

// â”€â”€ Gemini duplicate check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function checkDuplicate(newScenario, existingScenarios, category) {
  if (existingScenarios.length === 0) return false;
  const prompt = `You are a duplicate detector for a classroom game. A student is submitting a "${category}" would-you-rather scenario.

New scenario: "${newScenario}"

Existing scenarios in this category:
${existingScenarios.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Is the new scenario a duplicate or very similar (same idea, just reworded) to any existing one? Reply with ONLY "yes" or "no".`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    return answer === "yes";
  } catch {
    // Fallback: keyword check
    const newWords = new Set(newScenario.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    return existingScenarios.some((s) => {
      const existing = new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const overlap = [...newWords].filter((w) => existing.has(w)).length;
      return overlap / Math.max(newWords.size, 1) > 0.6;
    });
  }
}


// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const S = {
  app: {
    minHeight: "100vh",
    background: "var(--color-background-tertiary)",
    fontFamily: "var(--font-sans)",
    padding: "0 0 4rem",
  },
  header: {
    background: "#2C2C2A",
    color: "#F1EFE8",
    padding: "1.5rem 2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 22, fontWeight: 500, margin: 0, color: "#F1EFE8" },
  headerSub: { fontSize: 13, color: "#B4B2A9", marginTop: 4 },
  container: { maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" },
  card: {
    background: "var(--color-background-primary)",
    borderRadius: 12,
    border: "0.5px solid var(--color-border-tertiary)",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  },
  h2: { fontSize: 18, fontWeight: 500, marginBottom: "1rem", marginTop: 0 },
  h3: { fontSize: 16, fontWeight: 500, marginBottom: "0.75rem", marginTop: 0 },
  btn: {
    background: "transparent",
    border: "0.5px solid var(--color-border-secondary)",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 14,
    cursor: "pointer",
    color: "var(--color-text-primary)",
    fontFamily: "var(--font-sans)",
  },
  btnPrimary: {
    background: "#2C2C2A",
    color: "#F1EFE8",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: 15,
    borderRadius: 8,
    border: "0.5px solid var(--color-border-secondary)",
    background: "var(--color-background-primary)",
    color: "var(--color-text-primary)",
    fontFamily: "var(--font-sans)",
    boxSizing: "border-box",
  },
  badge: (cat) => ({
    display: "inline-block",
    background: CATEGORY_COLORS[cat].badge,
    color: CATEGORY_COLORS[cat].text,
    fontSize: 12,
    padding: "2px 10px",
    borderRadius: 20,
    fontWeight: 500,
    marginLeft: 8,
  }),
  pill: (active) => ({
    padding: "6px 16px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    border: active ? "2px solid #2C2C2A" : "0.5px solid var(--color-border-tertiary)",
    background: active ? "#2C2C2A" : "transparent",
    color: active ? "#F1EFE8" : "var(--color-text-secondary)",
    fontFamily: "var(--font-sans)",
  }),
};

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProgressBar({ category, count, required = REQUIRED_PER_CATEGORY }) {
  const pct = Math.min((count / required) * 100, 100);
  const col = CATEGORY_COLORS[category];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 500 }}>
          {CATEGORY_EMOJI[category]} {category}
        </span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {count} / {required}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: col.badge,
            borderRadius: 4,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function CategoryToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
      {CATEGORIES.map((c) => (
        <button key={c} style={S.pill(value === c)} onClick={() => onChange(c)}>
          {CATEGORY_EMOJI[c]} {c}
        </button>
      ))}
    </div>
  );
}

// â”€â”€ Phase 1: Brainstorm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BrainstormPhase({ sessionId, studentName, scenarios, devMode, onAllDone }) {
  const [category, setCategory] = useState("gross");
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Keyed by category — prevents concurrent audit fires per category
  const auditInProgress = useRef({});
  const [auditingCategories, setAuditingCategories] = useState({});

  // Thresholds driven by live devMode from Firestore
  const targets  = devMode ? DEV_TARGETS  : PROD_TARGETS;
  const userCaps = devMode ? DEV_USER_CAPS : PROD_USER_CAPS;

  // Active (non-culled) count per category — drives all progress logic
  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c] = scenarios.filter((s) => s.category === c && !s.culled).length;
    return acc;
  }, {});

  const allDone = CATEGORIES.every((c) => counts[c] >= targets[c]);

  // â”€â”€ Batch duplicate audit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const runBatchAudit = useCallback(async (cat) => {
    auditInProgress.current[cat] = true;
    setAuditingCategories((prev) => ({ ...prev, [cat]: true }));
    try {
      const sessionRef = doc(db, "sessions", sessionId);
      const freshSnap = await getDoc(sessionRef);
      const freshScenarios = freshSnap.data()?.scenarios || [];
      const catScenarios = freshScenarios.filter((s) => s.category === cat && !s.culled);

      const prompt = `You are a duplicate auditor for a classroom "would you rather" game.

Below is a list of ${cat} scenarios, each with an ID and text.
Identify any that are duplicates or near-duplicates of another entry in the same list — same idea, just reworded or slightly changed.

For each duplicate found, keep the one that was submitted first (lower index) and flag the later one.

Return ONLY a valid JSON array of the IDs that should be removed. If there are no duplicates, return an empty array [].
Do not include any explanation, markdown, or extra text — only the raw JSON array.

Scenarios:
${catScenarios.map((s, i) => `${i + 1}. ID: ${s.id} | "${s.text}"`).join("\n")}`;

      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      const data = await res.json();
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
      // Strip markdown code fences if Gemini wraps the response
      rawText = rawText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

      const culledIds = JSON.parse(rawText);
      if (Array.isArray(culledIds) && culledIds.length > 0) {
        const updated = freshScenarios.map((s) =>
          culledIds.includes(s.id) ? { ...s, culled: true } : s
        );
        await setDoc(sessionRef, { scenarios: updated }, { merge: true });
      }
    } catch (err) {
      console.error("Batch audit failed:", err);
    } finally {
      auditInProgress.current[cat] = false;
      setAuditingCategories((prev) => ({ ...prev, [cat]: false }));
    }
  }, [sessionId]);

  // Trigger audit when a category hits exactly 32 active scenarios
  useEffect(() => {
    CATEGORIES.forEach((cat) => {
      const activeCount = scenarios.filter((s) => s.category === cat && !s.culled).length;
      if (activeCount === targets[cat] && !auditInProgress.current[cat]) {
        runBatchAudit(cat);
      }
    });
  }, [scenarios, runBatchAudit]);

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(onAllDone, 800);
      return () => clearTimeout(t);
    }
  }, [allDone, onAllDone]);

  // â”€â”€ Submit handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 5) { setError("Please enter a real scenario."); return; }
    if (counts[category] >= targets[category]) { setError(`${category} is already full!`); return; }

    setChecking(true);
    setError("");
    setSuccess("");

    // Fresh Firestore read — avoids snapshot race condition
    const sessionRef = doc(db, "sessions", sessionId);
    const freshSnap = await getDoc(sessionRef);
    const freshScenarios = freshSnap.data()?.scenarios || [];
    const catScenarios = freshScenarios.filter((s) => s.category === category && !s.culled);
    const existing = catScenarios.map((s) => s.text);

    const myCount = catScenarios.filter((s) => s.addedBy === studentName).length;
    if (myCount >= userCaps[category]) {
      setError(`You've already submitted ${userCaps[category]} option${userCaps[category] > 1 ? "s" : ""} in the ${category} category — that's your max!`);
      setChecking(false);
      return;
    }

    // Fast local check (catches rewording without an API call)
    if (isFastDuplicate(trimmed, existing)) {
      setError("That's too similar to an existing option. Try something more original!");
      setChecking(false);
      return;
    }

    // Gemini check for less obvious semantic duplicates
    const isDupe = await checkDuplicate(trimmed, existing, category);
    if (isDupe) {
      setError("That's too similar to an existing option. Try something more original!");
      setChecking(false);
      return;
    }

    await setDoc(sessionRef, {
      scenarios: [
        ...freshScenarios,
        { text: trimmed, category, addedBy: studentName, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ],
    }, { merge: true });

    setSuccess(`Added to ${category}!`);
    setInput("");
    setChecking(false);
  };

  const isAuditing = !!auditingCategories[category];
  const isLocked   = checking || isAuditing;

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 1 — Brainstorm</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 12 }}>
          You're submitting <strong>one half</strong> of a Would You Rather. Someone else submits the other half — the class pairs them up.
        </p>
        <div style={{
          background: "var(--color-background-secondary)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: "1.5rem",
          lineHeight: 1.6,
        }}>
          <strong style={{ color: "var(--color-text-primary)" }}>Example:</strong> You submit <em>"eat ice cubes for every meal"</em> and someone else submits <em>"eat fire sticks for every meal"</em> → the WYR becomes <em>"Would you rather eat ice cubes for every meal <strong>or</strong> eat fire sticks for every meal?"</em>
        </div>
        <div style={{
          background: "#2C2C2A",
          color: "#F1EFE8",
          borderRadius: 8,
          padding: "12px 16px",
          fontSize: 13,
          fontStyle: "italic",
          marginBottom: "1.5rem",
          lineHeight: 1.7,
          letterSpacing: "0.01em",
        }}>
          <strong style={{ fontStyle: "normal" }}>Reminder:</strong> "Would you rather be <em>perfect</em> or be <em>terrible</em>?" is absolutely no fun. Live in the grey — <strong style={{ fontStyle: "normal" }}>the grey is where the good is.</strong>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          Fill all four categories to their targets (shown below) before moving on.
        </p>
        {CATEGORIES.map((c) => (
          <div key={c}>
            <ProgressBar category={c} count={counts[c]} required={targets[c]} />
            {auditingCategories[c] && (
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "-8px 0 12px", fontStyle: "italic" }}>
                🔍 Auditing {c} for duplicates…
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Submit your half</h3>
        <CategoryToggle value={category} onChange={setCategory} />
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 4 }}>
          Write <strong>one thing</strong> someone would have to do — category: <strong>{category}</strong>. Keep it a short phrase, no "Would you rather" needed.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: "var(--color-text-tertiary)" }}>
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>Would you rather</span>
          <span style={{
            flex: 1,
            background: "var(--color-background-secondary)",
            borderRadius: 6,
            padding: "4px 10px",
            fontStyle: "italic",
            color: "var(--color-text-secondary)",
          }}>your answer goes here</span>
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>or</span>
          <span style={{
            flex: 1,
            background: "var(--color-background-tertiary)",
            borderRadius: 6,
            padding: "4px 10px",
            fontStyle: "italic",
            color: "var(--color-text-tertiary)",
          }}>someone else's answer</span>
        </div>
        <textarea
          style={{ ...S.input, minHeight: 72, resize: "vertical", opacity: isLocked ? 0.6 : 1 }}
          placeholder={category === "gross" ? `e.g. "drink a glass of warm mayonnaise"` : category === "weird" ? `e.g. "only be able to speak in rhymes"` : category === "bad" ? `e.g. "forget every song you've ever loved"` : `e.g. "always know when someone is lying to you"`}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(""); setSuccess(""); }}
          onKeyDown={(e) => e.key === "Enter" && e.metaKey && !isLocked && handleSubmit()}
          disabled={isLocked}
        />
        {isAuditing && (
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "6px 0", fontStyle: "italic" }}>
            🔍 Auditing {category} for duplicates — submit unlocks when done…
          </p>
        )}
        {error   && <p style={{ color: "var(--color-text-danger)",  fontSize: 13, margin: "6px 0" }}>{error}</p>}
        {success && <p style={{ color: "var(--color-text-success)", fontSize: 13, margin: "6px 0" }}>{success}</p>}
        <div style={{ marginTop: 12 }}>
          <button style={{ ...S.btnPrimary, opacity: isLocked ? 0.5 : 1, cursor: isLocked ? "not-allowed" : "pointer" }}
            onClick={!isLocked ? handleSubmit : undefined}
            disabled={isLocked}
          >
            {isAuditing ? "Auditing for duplicates…" : checking ? "Checking for duplicates…" : "Submit my half"}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Submitted so far — {category} {CATEGORY_EMOJI[category]}</h3>
        {scenarios.filter((s) => s.category === category).length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>Nothing yet. Be the first!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scenarios.filter((s) => s.category === category).map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `0.5px solid ${s.culled ? "var(--color-border-tertiary)" : "var(--color-border-tertiary)"}`,
                  fontSize: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: s.culled ? 0.5 : 1,
                  background: s.culled ? "var(--color-background-secondary)" : undefined,
                }}
              >
                <span style={{ textDecoration: s.culled ? "line-through" : "none" }}>{s.text}</span>
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 12, whiteSpace: "nowrap" }}>
                  {s.culled ? "removed — too similar" : s.addedBy}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// â”€â”€ Phase 2: Ranking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RankingPhase({ sessionId, studentName, scenarios, devMode, onDone }) {
  const targets = devMode ? DEV_TARGETS : PROD_TARGETS;
  const [activeCategory, setActiveCategory] = useState("gross");
  const [orderings, setOrderings] = useState(null); // { gross: [...], bad: [...], weird: [...], good: [...] }
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialise once scenarios are loaded — random shuffle within each category
  useEffect(() => {
    if (!orderings && scenarios.length > 0) {
      const init = {};
      CATEGORIES.forEach(c => {
        const cat = scenarios.filter(s => s.category === c && !s.culled);
        init[c] = [...cat].sort(() => Math.random() - 0.5);
      });
      setOrderings(init);
    }
  }, [scenarios, orderings]);

  const move = (cat, idx, dir) => {
    setOrderings(prev => {
      const arr = [...prev[cat]];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return { ...prev, [cat]: arr };
    });
  };

  const allRanked = orderings && CATEGORIES.every(c => (orderings[c]?.length ?? 0) > 0);

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, "rankings", `${sessionId}_${studentName}`), {
      studentName, sessionId,
      rankings: orderings,  // { gross: [ordered scenario objs], ... }
      submittedAt: Date.now(),
    });
    setSaved(true);
    setSaving(false);
    setTimeout(onDone, 600);
  };

  if (!orderings) return (
    <div style={{ ...S.container, textAlign: "center", paddingTop: "3rem", color: "var(--color-text-secondary)" }}>
      Loading scenarios…
    </div>
  );

  const list = orderings[activeCategory] || [];

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 2 — Rank your favourites</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          Order each category from <strong>#1 (most interesting WYR option)</strong> to last.
          Use ↑ ↓ to reorder. Do all four categories before submitting.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map(c => (
            <button key={c} style={S.pill(activeCategory === c)} onClick={() => setActiveCategory(c)}>
              {CATEGORY_EMOJI[c]} {c}
              <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>
                ({orderings[c]?.length ?? 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ ...S.h3, marginBottom: "0.5rem" }}>
          {CATEGORY_EMOJI[activeCategory]} {activeCategory} — rank {list.length} options
        </h3>
        <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginBottom: "1rem" }}>
          #1 = your favourite "Would you rather ___" half. Reorder until you're happy.
        </p>
        {list.length === 0 ? (
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>No entries yet for this category.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.map((s, idx) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                background: idx === 0
                  ? "var(--color-background-success)"
                  : idx === list.length - 1
                  ? "var(--color-background-secondary)"
                  : "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-tertiary)",
                transition: "background 0.15s",
              }}>
                <span style={{
                  width: 28, textAlign: "center", fontWeight: 700, fontSize: 13,
                  color: idx === 0 ? "var(--color-text-success)" : "var(--color-text-tertiary)",
                  flexShrink: 0,
                }}>#{idx + 1}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{s.text}</span>
                <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", flexShrink: 0 }}>{s.addedBy}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => move(activeCategory, idx, -1)}
                    disabled={idx === 0}
                    style={{ ...S.btn, padding: "1px 8px", fontSize: 12, lineHeight: 1.4, opacity: idx === 0 ? 0.3 : 1 }}
                  >↑</button>
                  <button
                    onClick={() => move(activeCategory, idx, 1)}
                    disabled={idx === list.length - 1}
                    style={{ ...S.btn, padding: "1px 8px", fontSize: 12, lineHeight: 1.4, opacity: idx === list.length - 1 ? 0.3 : 1 }}
                  >↓</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          style={{ ...S.btnPrimary, opacity: !allRanked ? 0.5 : 1, cursor: !allRanked ? "not-allowed" : "pointer" }}
          onClick={allRanked ? handleSave : undefined}
          disabled={saving || !allRanked}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Lock in rankings & continue →"}
        </button>
      </div>
    </div>
  );
}


// Phase 3: Bracket
function BracketPhase({ sessionId, studentName, scenarios, onDone }) {
  const [bracketType, setBracketType] = useState(null);
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  // roundPicks: tentative picks for the CURRENT round only; map of matchId -> scenario
  // Picks are NOT locked in until the user clicks "Advance Round"
  const [roundPicks, setRoundPicks] = useState({});

  const loadBracket = useCallback(async (type) => {
    setLoading(true);
    setBracket(null);
    setRoundPicks({});
    if (type === "combined") {
      setBracket(await buildCombinedFromRankings(sessionId, scenarios));
    } else {
      setBracket(buildGoodBracket(scenarios));
    }
    setLoading(false);
  }, [sessionId, scenarios]);

  const handleSelect = async (type) => {
    setBracketType(type);
    setSaved(false);
    setRoundPicks({});
    await loadBracket(type);
  };

  // Tentative pick — can be changed any time before advancing
  const handlePick = (match, scenario) => {
    setRoundPicks(prev => ({ ...prev, [match.id]: scenario }));
  };

  // Lock in the current round and advance to the next
  const handleAdvanceRound = () => {
    let b = bracket;
    (b[currentRound] || []).forEach((match, idx) => {
      const pick = roundPicks[match.id];
      if (pick) b = advanceBracket(b, currentRound, idx, pick);
    });
    setBracket(b);
    setRoundPicks({});
  };

  const handleSave = async () => {
    setSaved(true);
    await setDoc(doc(db, "brackets", `${sessionId}_${studentName}`), {
      studentName, sessionId, bracketType, bracket, savedAt: Date.now(),
    });
  };

  const currentRound = bracket ? getCurrentRound(bracket) : null;
  const isDone = currentRound === "done";

  const ROUND_LABELS_32 = { r1: "Round 1 of 5", r2: "Round 2 of 5", r3: "Quarterfinals", r4: "Semifinals", final: "Championship" };
  const ROUND_LABELS_16 = { r1: "Round 1 of 4", r2: "Quarterfinals", r3: "Semifinals", final: "Championship" };
  const roundLabels = bracketType === "good" ? ROUND_LABELS_16 : ROUND_LABELS_32;

  // All matches in the current round have a tentative pick
  const allPicked = bracket && currentRound && currentRound !== "done" &&
    bracket[currentRound].every(m => roundPicks[m.id]);

  const renderMatchup = (match, idx) => {
    const pick = roundPicks[match.id];  // tentative pick for this match
    return (
      <div key={match.id} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
        {[match.top, match.bottom].map((scenario, side) => {
          const isPicked = pick && pick.id === scenario.id;
          const isOtherPicked = pick && pick.id !== scenario.id;
          return (
            <div key={side}
              onClick={() => handlePick(match, scenario)}
              style={{
                padding: "14px 16px", fontSize: 14,
                background: isPicked ? "var(--color-background-success)" : isOtherPicked ? "var(--color-background-secondary)" : "var(--color-background-primary)",
                color: isOtherPicked ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                cursor: "pointer",
                borderBottom: side === 0 ? "0.5px solid var(--color-border-tertiary)" : "none",
                display: "flex", alignItems: "center", gap: 10, transition: "background 0.15s",
              }}
            >
              {isPicked && <span style={{ color: "var(--color-text-success)", fontSize: 16 }}>{String.fromCodePoint(0x2713)}</span>}
              {scenario?.category && !scenario.isTBD && <span style={S.badge(scenario.category)}>{scenario.category}</span>}
              <span style={{ flex: 1 }}>{scenario.isTBD ? <em style={{ color: "var(--color-text-tertiary)" }}>TBD</em> : scenario.text}</span>
              {!pick && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>tap to pick</span>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 3 — The Bracket</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          Pick a bracket, then vote match-by-match. Switch any time before saving.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={{ ...S.pill(bracketType === "combined"), fontSize: 14, padding: "8px 20px" }} onClick={() => handleSelect("combined")}>
            {String.fromCodePoint(0x1F922)}{String.fromCodePoint(0x1F480)}{String.fromCodePoint(0x1F300)} Big Bracket (32)
          </button>
          <button style={{ ...S.pill(bracketType === "good"), fontSize: 14, padding: "8px 20px" }} onClick={() => handleSelect("good")}>
            {String.fromCodePoint(0x2728)} Good Bracket (16)
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>
          {bracketType === "combined" ? "Computing class rankings..." : "Seeding bracket..."}
        </div>
      )}

      {bracket && !loading && (
        <div style={S.card}>
          <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ ...S.h3, marginBottom: 4 }}>
              {isDone ? String.fromCodePoint(0x1F3C6) + " Champion crowned!" : roundLabels[currentRound]}
            </h3>
            {!isDone && (
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
                Pick a winner for each match — you can change your mind before advancing.
              </p>
            )}
          </div>

          {isDone && bracket.final[0].winner && (
            <div style={{ padding: "1.5rem", background: "var(--color-background-success)", borderRadius: 10, textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 13, color: "var(--color-text-success)", marginBottom: 6 }}>Champion</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{bracket.final[0].winner.text}</div>
              {!bracket.final[0].winner.isTBD && <span style={S.badge(bracket.final[0].winner.category)}>{bracket.final[0].winner.category}</span>}
            </div>
          )}

          {currentRound && currentRound !== "done" && bracket[currentRound] && (
            <div>
              {bracket[currentRound].map((match, idx) => renderMatchup(match, idx))}
            </div>
          )}

          {allPicked && !isDone && (
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button style={S.btnPrimary} onClick={handleAdvanceRound}>
                Advance to {roundLabels[{ r1:"r2",r2:"r3",r3:"r4",r4:"final",final:"done" }[currentRound]] || "next round"} {String.fromCodePoint(0x2192)}
              </button>
            </div>
          )}

          {isDone && !saved && (
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button style={S.btnPrimary} onClick={handleSave}>Save my bracket</button>
            </div>
          )}
          {saved && <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-success)", marginTop: "1rem" }}>{String.fromCodePoint(0x2713)} Saved!</p>}
        </div>
      )}

      {isDone && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button style={S.btnPrimary} onClick={onDone}>Continue to reflection</button>
        </div>
      )}
    </div>
  );
}

// Phase 4: Reflection
function ReflectionPhase({ sessionId, studentName, scenarios }) {
  const [hardest, setHardest] = useState("");
  const [best, setBest] = useState("");
  const [worst, setWorst] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!hardest.trim() || !best.trim() || !worst.trim()) return;
    setSaving(true);
    await setDoc(doc(db, "reflections", `${sessionId}_${studentName}`), {
      studentName,
      sessionId,
      hardest: hardest.trim(),
      best: best.trim(),
      worst: worst.trim(),
      submittedAt: Date.now(),
    });
    setSubmitted(true);
    setSaving(false);
  };

  if (submitted) {
    return (
      <div style={S.container}>
        <div style={{ ...S.card, textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: 40, marginBottom: "1rem" }}>{String.fromCodePoint(0x2713)}</div>
          <h2 style={S.h2}>Reflection submitted</h2>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Nice work, {studentName}. Your responses have been saved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 4 — Reflection</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          Take a moment to reflect on the whole activity. Answer all three questions to finish.
        </p>
      </div>

      {[
        { label: "What was the hardest choice you had to make?", val: hardest, set: setHardest },
        { label: "What was the best outcome in your bracket?", val: best, set: setBest },
        { label: "What was the worst outcome in your bracket?", val: worst, set: setWorst },
      ].map(({ label, val, set }) => (
        <div key={label} style={S.card}>
          <label style={{ fontSize: 14, fontWeight: 500, display: "block", marginBottom: 8 }}>{label}</label>
          <textarea
            style={{ ...S.input, minHeight: 80, resize: "vertical" }}
            value={val}
            onChange={e => set(e.target.value)}
            placeholder="Write your response..."
          />
        </div>
      ))}

      <div style={{ textAlign: "center" }}>
        <button
          style={{ ...S.btnPrimary, opacity: (!hardest.trim() || !best.trim() || !worst.trim() || saving) ? 0.5 : 1 }}
          onClick={handleSubmit}
          disabled={!hardest.trim() || !best.trim() || !worst.trim() || saving}
        >
          {saving ? "Submitting..." : "Submit reflection"}
        </button>
      </div>
    </div>
  );
}

// Teacher Panel
function TeacherPanel({ sessionId, scenarios, onClose }) {
  const [devMode, setDevMode] = useState(true);
  const [working, setWorking] = useState(false);
  const [brackets, setBrackets] = useState([]);
  const [expandedBracket, setExpandedBracket] = useState(null);
  const [expandedReflection, setExpandedReflection] = useState(null);
  const [activeTab, setActiveTab] = useState("entries"); // "entries" | "brackets" | "reflections"
  const [reflections, setReflections] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sessions", sessionId), snap => {
      if (snap.exists()) {
        const dm = snap.data().devMode;
        if (dm !== undefined) setDevMode(dm);
      }
    });
    return unsub;
  }, [sessionId]);

  // Load all saved student brackets for this session
  useEffect(() => {
    const fetchBrackets = async () => {
      const snap = await getDocs(query(collection(db, "brackets")));
      const sessionBrackets = snap.docs
        .map(d => d.data())
        .filter(b => b.sessionId === sessionId)
        .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
      setBrackets(sessionBrackets);
    };
    fetchBrackets();
  }, [sessionId]);

  useEffect(() => {
    const fetchReflections = async () => {
      const snap = await getDocs(query(collection(db, "reflections")));
      const sessionReflections = snap.docs
        .map(d => d.data())
        .filter(r => r.sessionId === sessionId)
        .sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));
      setReflections(sessionReflections);
    };
    fetchReflections();
  }, [sessionId]);

  const toggleDevMode = async () => {
    setWorking(true);
    await setDoc(doc(db, "sessions", sessionId), { devMode: !devMode }, { merge: true });
    setWorking(false);
  };

  const clearAllEntries = async () => {
    if (!window.confirm("Clear ALL brainstorm entries? This cannot be undone.")) return;
    setWorking(true);
    await setDoc(doc(db, "sessions", sessionId), { scenarios: [] }, { merge: true });
    setWorking(false);
  };

  const cullEntry = async (id) => {
    setWorking(true);
    const ref = doc(db, "sessions", sessionId);
    const snap = await getDoc(ref);
    const all = snap.data()?.scenarios || [];
    await setDoc(ref, { scenarios: all.map(s => s.id === id ? { ...s, culled: true } : s) }, { merge: true });
    setWorking(false);
  };

  return (
    <div style={{ ...S.container, position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto", margin: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ ...S.h2, margin: 0 }}>Teacher Mode</h2>
          <button style={S.btn} onClick={onClose}>Close</button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
          {["entries", "brackets", "reflections"].map(tab => (
            <button key={tab} style={{ ...S.pill(activeTab === tab), textTransform: "capitalize" }} onClick={() => setActiveTab(tab)}>
              {tab === "entries" ? "Entries & Settings" : tab === "brackets" ? `Brackets (${brackets.length})` : `Reflections (${reflections.length})`}
            </button>
          ))}
        </div>

        {activeTab === "brackets" && (
          <div>
            {brackets.length === 0 ? (
              <div style={{ ...S.card, color: "var(--color-text-secondary)", fontSize: 14 }}>
                No brackets saved yet.
              </div>
            ) : brackets.map(b => {
              const champion = b.bracket?.final?.[0]?.winner;
              const isExpanded = expandedBracket === b.studentName;
              const ROUND_LABELS = b.bracketType === "good"
                ? { r1: "Round 1", r2: "Quarterfinals", r3: "Semifinals", final: "Championship" }
                : { r1: "Round 1", r2: "Round 2", r3: "Quarterfinals", r4: "Semifinals", final: "Championship" };
              return (
                <div key={b.studentName} style={{ ...S.card, marginBottom: "0.75rem", padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{b.studentName}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {b.bracketType === "combined" ? "🤢💀🌀 Big Bracket" : "✨ Good Bracket"}
                        {champion && !champion.isTBD && ` · Champion: "${champion.text}"`}
                        {champion && champion.isTBD && " · Champion: TBD"}
                        {!champion && " · In progress"}
                      </div>
                    </div>
                    <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setExpandedBracket(isExpanded ? null : b.studentName)}>
                      {isExpanded ? "Hide" : "View bracket"}
                    </button>
                  </div>

                  {isExpanded && b.bracket && (
                    <div style={{ marginTop: "1rem", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem" }}>
                      {Object.entries(ROUND_LABELS).filter(([rnd]) => b.bracket[rnd]).map(([rnd, label]) => (
                        <div key={rnd} style={{ marginBottom: "1rem" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)", marginBottom: 6 }}>{label}</div>
                          {b.bracket[rnd].filter(m => m.winner).map(m => (
                            <div key={m.id} style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, background: "var(--color-background-secondary)", marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
                              {m.winner?.category && !m.winner?.isTBD && <span style={S.badge(m.winner.category)}>{m.winner.category}</span>}
                              <span>{m.winner?.isTBD ? "TBD" : m.winner?.text}</span>
                              <span style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}>defeated</span>
                              <span style={{ color: "var(--color-text-tertiary)" }}>{m.winner?.id === m.top?.id ? (m.bottom?.isTBD ? "TBD" : m.bottom?.text) : (m.top?.isTBD ? "TBD" : m.top?.text)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "reflections" && (
          <div>
            {reflections.length === 0 ? (
              <div style={{ ...S.card, color: "var(--color-text-secondary)", fontSize: 14 }}>
                No reflections submitted yet.
              </div>
            ) : reflections.map(r => {
              const isExpanded = expandedReflection === r.studentName;
              return (
                <div key={r.studentName} style={{ ...S.card, marginBottom: "0.75rem", padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.studentName}</div>
                    <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setExpandedReflection(isExpanded ? null : r.studentName)}>
                      {isExpanded ? "Hide" : "View answers"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: "1rem", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem" }}>
                      {[
                        { q: "Hardest choice", a: r.hardest },
                        { q: "Best outcome", a: r.best },
                        { q: "Worst outcome", a: r.worst },
                      ].map(({ q, a }) => (
                        <div key={q} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{q}</div>
                          <div style={{ fontSize: 14, padding: "8px 12px", background: "var(--color-background-secondary)", borderRadius: 6, lineHeight: 1.5 }}>{a}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "entries" && <div>
        <div style={S.card}>
          <h3 style={S.h3}>Session settings</h3>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{String.fromCodePoint(0x26A1)} Dev Mode</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                {devMode ? "ON — small targets for testing" : "OFF — full 32 entries per category (2 per person)"}
              </div>
            </div>
            <button onClick={toggleDevMode} disabled={working}
              style={{ ...S.btnPrimary, background: devMode ? "#C94B4B" : "#2C7A2C", minWidth: 100 }}>
              {devMode ? "Turn OFF" : "Turn ON"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{String.fromCodePoint(0x1F5D1)} Reset entire session</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                Clears all entries. Bracket and reflection data stays in Firestore.
              </div>
            </div>
            <button onClick={clearAllEntries} disabled={working}
              style={{ ...S.btn, color: "var(--color-text-danger)", borderColor: "var(--color-text-danger)" }}>
              Clear entries
            </button>
          </div>
        </div>

        <div style={S.card}>
          <h3 style={S.h3}>All entries — click to remove</h3>
          {CATEGORIES.map(cat => (
            <div key={cat} style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{CATEGORY_EMOJI[cat]} {cat}</div>
              {scenarios.filter(s => s.category === cat).map(s => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, marginBottom: 4, background: s.culled ? "var(--color-background-secondary)" : "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", opacity: s.culled ? 0.5 : 1 }}>
                  <span style={{ fontSize: 13, textDecoration: s.culled ? "line-through" : "none" }}>{s.text}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{s.addedBy}</span>
                    {!s.culled && <button style={{ ...S.btn, fontSize: 11, padding: "3px 10px", color: "var(--color-text-danger)" }} onClick={() => cullEntry(s.id)} disabled={working}>Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        </div>}
      </div>
    </div>
  );
}

// Root App
export default function WouldYouRatherBracket() {
  const SESSION_ID = "wyr-session-001";

  const [studentName, setStudentName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [phase, setPhase] = useState(1);
  const [scenarios, setScenarios] = useState([]);
  const [devMode, setDevMode] = useState(true);
  const [showTeacher, setShowTeacher] = useState(false);
  const [teacherInput, setTeacherInput] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sessions", SESSION_ID), snap => {
      if (snap.exists()) {
        setScenarios(snap.data().scenarios || []);
        const dm = snap.data().devMode;
        if (dm !== undefined) setDevMode(dm);
      }
    });
    return unsub;
  }, []);

  const handleNameSubmit = async () => {
    const name = nameInput.trim();
    if (name.length < 2) return;
    if (name === "Mr.Teach") { setShowTeacher(true); return; }
    setStudentName(name);
    const ref = doc(db, "sessions", SESSION_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { scenarios: [], devMode: true, createdAt: Date.now() });
    }
  };

  // Teacher mode check via name input
  useEffect(() => {
    if (teacherInput === "Mr.Teach") { setShowTeacher(true); setTeacherInput(""); }
  }, [teacherInput]);

  const PHASE_LABELS = ["Brainstorm", "Ranking", "Bracket", "Reflection"];

  if (showTeacher) {
    return <TeacherPanel sessionId={SESSION_ID} scenarios={scenarios} onClose={() => setShowTeacher(false)} />;
  }

  if (!studentName) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ ...S.card, maxWidth: 400, width: "90%", textAlign: "center" }}>
          <h1 style={{ ...S.h2, marginBottom: 8 }}>Would You Rather</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
            Enter your name to join the session.
          </p>
          <input
            style={S.input}
            placeholder="Your name..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleNameSubmit()}
          />
          <button style={{ ...S.btnPrimary, marginTop: 12, width: "100%" }} onClick={handleNameSubmit}>
            Join session {String.fromCodePoint(0x2192)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {showTeacher && <TeacherPanel sessionId={SESSION_ID} scenarios={scenarios} onClose={() => setShowTeacher(false)} />}
      <div style={S.header}>
        <div>
          <h1 style={S.headerTitle}>Would You Rather {String.fromCodePoint(0x2014)} Class Bracket</h1>
          <p style={S.headerSub}>
            Phase {phase} of 4 {String.fromCodePoint(0x00B7)} {PHASE_LABELS[phase - 1]} {String.fromCodePoint(0x00B7)} Playing as{" "}
            <strong style={{ color: "#F1EFE8" }}>{studentName}</strong>
            {devMode && <span style={{ marginLeft: 10, fontSize: 11, color: "#FFA94D" }}>{String.fromCodePoint(0x26A1)} dev</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4].map(p => (
            <div key={p} style={{ width: 28, height: 28, borderRadius: "50%", background: p === phase ? "#F1EFE8" : p < phase ? "#5F5E5A" : "#444441", color: p === phase ? "#2C2C2A" : p < phase ? "#D3D1C7" : "#888780", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500 }}>{p}</div>
          ))}
        </div>
      </div>

      {phase === 1 && (
        <BrainstormPhase sessionId={SESSION_ID} studentName={studentName} scenarios={scenarios} devMode={devMode} onAllDone={() => setPhase(2)} />
      )}
      {phase === 2 && (
        <RankingPhase sessionId={SESSION_ID} studentName={studentName} scenarios={scenarios} onDone={() => setPhase(3)} />
      )}
      {phase === 3 && (
        <BracketPhase sessionId={SESSION_ID} studentName={studentName} scenarios={scenarios} onDone={() => setPhase(4)} />
      )}
      {phase === 4 && (
        <ReflectionPhase sessionId={SESSION_ID} studentName={studentName} scenarios={scenarios} />
      )}
    </div>
  );
}
