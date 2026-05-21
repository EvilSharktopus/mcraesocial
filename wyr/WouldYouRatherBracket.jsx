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

// ── Firebase config ──────────────────────────────────────────────
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

// ── Constants ────────────────────────────────────────────────────
const CATEGORIES = ["gross", "weird", "bad", "good"];
const REQUIRED_PER_CATEGORY = 32;
const TIERS = ["S", "A", "B", "C"];
const TIER_LABELS = {
  S: "Tier 1 — Best / Hardest",
  A: "Tier 2 — Pretty Good",
  B: "Tier 3 — So-so",
  C: "Tier 4 — Weakest",
};
const CATEGORY_COLORS = {
  gross: { bg: "#4B1528", text: "#FBEAF0", badge: "#993556" },
  weird: { bg: "#26215C", text: "#EEEDFE", badge: "#7F77DD" },
  bad: { bg: "#501313", text: "#FCEBEB", badge: "#E24B4A" },
  good: { bg: "#173404", text: "#EAF3DE", badge: "#639922" },
};
const CATEGORY_EMOJI = { gross: "🤢", weird: "🌀", bad: "💀", good: "✨" };

// ── Gemini duplicate check ───────────────────────────────────────
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

// ── Bracket builder from ranked list ────────────────────────────
function buildBracket(rankedScenarios) {
  // Seeds: 1v32, 2v31, ... standard bracket seeding
  const r1 = [];
  for (let i = 0; i < 16; i++) {
    r1.push({ id: `r1-${i}`, top: rankedScenarios[i], bottom: rankedScenarios[31 - i], winner: null });
  }
  const r2 = Array.from({ length: 8 }, (_, i) => ({ id: `r2-${i}`, top: null, bottom: null, winner: null }));
  const r3 = Array.from({ length: 4 }, (_, i) => ({ id: `r3-${i}`, top: null, bottom: null, winner: null }));
  const r4 = Array.from({ length: 2 }, (_, i) => ({ id: `r4-${i}`, top: null, bottom: null, winner: null }));
  const final = [{ id: "final", top: null, bottom: null, winner: null }];
  return { r1, r2, r3, r4, final };
}

function getCurrentRound(bracket) {
  if (bracket.final[0].winner) return "done";
  if (bracket.r4.every((m) => m.winner)) return "final";
  if (bracket.r3.every((m) => m.winner)) return "r4";
  if (bracket.r2.every((m) => m.winner)) return "r3";
  if (bracket.r1.every((m) => m.winner)) return "r2";
  return "r1";
}

function advanceBracket(bracket, round, matchIdx, winner) {
  const b = JSON.parse(JSON.stringify(bracket));
  b[round][matchIdx].winner = winner;

  const nextRound = { r1: "r2", r2: "r3", r3: "r4", r4: "final" };
  const next = nextRound[round];
  if (!next) return b;

  const nextMatchIdx = Math.floor(matchIdx / 2);
  const isTop = matchIdx % 2 === 0;
  if (!b[next][nextMatchIdx]) b[next][nextMatchIdx] = { id: `${next}-${nextMatchIdx}`, top: null, bottom: null, winner: null };
  if (isTop) b[next][nextMatchIdx].top = winner;
  else b[next][nextMatchIdx].bottom = winner;

  return b;
}

// ── Styles ───────────────────────────────────────────────────────
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

// ── Sub-components ───────────────────────────────────────────────

function ProgressBar({ category, count }) {
  const pct = Math.min((count / REQUIRED_PER_CATEGORY) * 100, 100);
  const col = CATEGORY_COLORS[category];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 500 }}>
          {CATEGORY_EMOJI[category]} {category}
        </span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {count} / {REQUIRED_PER_CATEGORY}
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

// ── Phase 1: Brainstorm ──────────────────────────────────────────
function BrainstormPhase({ sessionId, studentName, scenarios, onAllDone }) {
  const [category, setCategory] = useState("gross");
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c] = scenarios.filter((s) => s.category === c).length;
    return acc;
  }, {});

  const allDone = CATEGORIES.every((c) => counts[c] >= REQUIRED_PER_CATEGORY);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 5) { setError("Please enter a real scenario."); return; }
    if (counts[category] >= REQUIRED_PER_CATEGORY) { setError(`${category} is already full!`); return; }

    setChecking(true);
    setError("");
    setSuccess("");

    const existing = scenarios.filter((s) => s.category === category).map((s) => s.text);
    const isDupe = await checkDuplicate(trimmed, existing, category);

    if (isDupe) {
      setError("That's too similar to an existing scenario. Try something more original!");
      setChecking(false);
      return;
    }

    const sessionRef = doc(db, "sessions", sessionId);
    const snap = await getDoc(sessionRef);
    const current = snap.data()?.scenarios || [];
    await setDoc(sessionRef, {
      scenarios: [
        ...current,
        { text: trimmed, category, addedBy: studentName, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
      ],
    }, { merge: true });

    setSuccess(`Added to ${category}!`);
    setInput("");
    setChecking(false);
  };

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(onAllDone, 800);
      return () => clearTimeout(t);
    }
  }, [allDone, onAllDone]);

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 1 — Brainstorm scenarios</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
          Come up with "would you rather" scenarios for each category. Aim for the grey zone — not too extreme, but interesting enough to debate. The class needs <strong>32 of each type</strong> before moving on.
        </p>
        {CATEGORIES.map((c) => (
          <ProgressBar key={c} category={c} count={counts[c]} />
        ))}
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Add a scenario</h3>
        <CategoryToggle value={category} onChange={setCategory} />
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 8 }}>
          Write a scenario for the <strong>{category}</strong> category. It'll be framed as "Would you rather _____ or _____?"
        </p>
        <textarea
          style={{ ...S.input, minHeight: 80, resize: "vertical" }}
          placeholder={`e.g. "eat a spoonful of mustard every morning for a year" or "sneeze every time you laugh"`}
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(""); setSuccess(""); }}
          onKeyDown={(e) => e.key === "Enter" && e.metaKey && handleSubmit()}
          disabled={checking}
        />
        {error && <p style={{ color: "var(--color-text-danger)", fontSize: 13, margin: "6px 0" }}>{error}</p>}
        {success && <p style={{ color: "var(--color-text-success)", fontSize: 13, margin: "6px 0" }}>{success}</p>}
        <div style={{ marginTop: 12 }}>
          <button style={S.btnPrimary} onClick={handleSubmit} disabled={checking}>
            {checking ? "Checking for duplicates…" : "Submit scenario"}
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
                  border: "0.5px solid var(--color-border-tertiary)",
                  fontSize: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{s.text}</span>
                <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 12, whiteSpace: "nowrap" }}>
                  {s.addedBy}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Phase 2: Ranking ─────────────────────────────────────────────
function RankingPhase({ sessionId, studentName, scenarios, onDone }) {
  const [activeCategory, setActiveCategory] = useState("gross");
  const [tiers, setTiers] = useState(() => {
    const init = {};
    CATEGORIES.forEach((c) => { init[c] = { S: [], A: [], B: [], C: [] }; });
    return init;
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const catScenarios = scenarios.filter((s) => s.category === activeCategory);
  const assigned = Object.values(tiers[activeCategory]).flat().map((s) => s.id);
  const unassigned = catScenarios.filter((s) => !assigned.includes(s.id));

  const assign = (scenarioId, tier) => {
    setTiers((prev) => {
      const cat = { ...prev[activeCategory] };
      TIERS.forEach((t) => { cat[t] = cat[t].filter((s) => s.id !== scenarioId); });
      const scenario = catScenarios.find((s) => s.id === scenarioId);
      if (tier) cat[tier] = [...cat[tier], scenario];
      return { ...prev, [activeCategory]: cat };
    });
  };

  const allRanked = CATEGORIES.every((c) => {
    const catS = scenarios.filter((s) => s.category === c);
    const assignedIds = Object.values(tiers[c]).flat().map((s) => s.id);
    return catS.every((s) => assignedIds.includes(s.id));
  });

  const handleSave = async () => {
    setSaving(true);
    // Compute average tier score per scenario and rank 1-32 within each category
    const ranked = {};
    CATEGORIES.forEach((c) => {
      const tierScore = { S: 4, A: 3, B: 2, C: 1 };
      const allCat = scenarios.filter((s) => s.category === c);
      // Load existing votes
      const scores = allCat.map((s) => {
        const tier = TIERS.find((t) => tiers[c][t].some((x) => x.id === s.id));
        return { ...s, score: tier ? tierScore[tier] : 0 };
      });
      ranked[c] = scores.sort((a, b) => b.score - a.score);
    });

    await setDoc(doc(db, "rankings", `${sessionId}_${studentName}`), {
      studentName,
      sessionId,
      tiers,
      submittedAt: Date.now(),
    });

    setSaved(true);
    setSaving(false);
    setTimeout(onDone, 600);
  };

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 2 — Tier ranking</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          Sort all 32 scenarios in each category into 4 tiers — 8 per tier. Tier 1 = the best/hardest choices. Once you've ranked all four categories, you'll build your bracket.
        </p>
        <CategoryToggle value={activeCategory} onChange={setActiveCategory} />
      </div>

      {unassigned.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h3}>Unranked — drag or click a tier to assign</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {unassigned.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "0.5px solid var(--color-border-secondary)",
                  fontSize: 14,
                }}
              >
                <div style={{ marginBottom: 8 }}>{s.text}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {TIERS.map((t) => {
                    const full = tiers[activeCategory][t].length >= 8;
                    return (
                      <button
                        key={t}
                        onClick={() => !full && assign(s.id, t)}
                        style={{
                          ...S.btn,
                          fontSize: 12,
                          padding: "4px 12px",
                          opacity: full ? 0.4 : 1,
                          cursor: full ? "not-allowed" : "pointer",
                        }}
                        title={full ? "This tier is full (8/8)" : TIER_LABELS[t]}
                      >
                        {t} {full ? "(full)" : `${tiers[activeCategory][t].length}/8`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {TIERS.map((tier) => (
        <div key={tier} style={S.card}>
          <h3 style={{ ...S.h3, display: "flex", alignItems: "center", gap: 8 }}>
            {TIER_LABELS[tier]}
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontWeight: 400 }}>
              {tiers[activeCategory][tier].length}/8
            </span>
          </h3>
          {tiers[activeCategory][tier].length === 0 ? (
            <p style={{ color: "var(--color-text-tertiary)", fontSize: 13 }}>Empty</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tiers[activeCategory][tier].map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 14,
                    background: "var(--color-background-secondary)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span>{s.text}</span>
                  <button
                    onClick={() => assign(s.id, null)}
                    style={{ ...S.btn, fontSize: 12, padding: "2px 8px", color: "var(--color-text-danger)" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button
          style={{ ...S.btnPrimary, opacity: !allRanked ? 0.5 : 1, cursor: !allRanked ? "not-allowed" : "pointer" }}
          onClick={allRanked ? handleSave : undefined}
          disabled={saving || !allRanked}
        >
          {saving ? "Saving…" : saved ? "Saved!" : allRanked ? "Save rankings & continue" : `Rank all scenarios first (${CATEGORIES.map(c => { const left = scenarios.filter(s => s.category === c).length - Object.values(tiers[c]).flat().length; return left > 0 ? `${left} left in ${c}` : null; }).filter(Boolean).join(", ")})`}
        </button>
      </div>
    </div>
  );
}

// ── Phase 3: Bracket ─────────────────────────────────────────────
function BracketPhase({ sessionId, studentName, scenarios, onDone }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [bracket, setBracket] = useState(null);
  const [rankedScenarios, setRankedScenarios] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bracketLocked, setBracketLocked] = useState(false);

  const buildFromRankings = useCallback(async (category) => {
    setLoading(true);
    // Fetch all student rankings for this category, average scores
    const q = query(collection(db, "rankings"));
    const snap = await getDocs(q);
    const catScenarios = scenarios.filter((s) => s.category === category);
    const tierScore = { S: 4, A: 3, B: 2, C: 1 };
    const scoreMap = {};
    const countMap = {};
    catScenarios.forEach((s) => { scoreMap[s.id] = 0; countMap[s.id] = 0; });

    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.sessionId !== sessionId) return;
      const catTiers = data.tiers?.[category];
      if (!catTiers) return;
      TIERS.forEach((t) => {
        (catTiers[t] || []).forEach((s) => {
          if (scoreMap[s.id] !== undefined) {
            scoreMap[s.id] += tierScore[t];
            countMap[s.id] += 1;
          }
        });
      });
    });

    const ranked = catScenarios
      .map((s) => ({ ...s, avgScore: countMap[s.id] > 0 ? scoreMap[s.id] / countMap[s.id] : 0 }))
      .sort((a, b) => b.avgScore - a.avgScore);

    setRankedScenarios(ranked);
    setBracket(buildBracket(ranked));
    setLoading(false);
  }, [sessionId, scenarios]);

  const handleCategorySelect = async (cat) => {
    if (bracketLocked && selectedCategory && selectedCategory !== cat) return;
    setSelectedCategory(cat);
    await buildFromRankings(cat);
  };

  const handleVote = (round, matchIdx, winner) => {
    setBracket((prev) => advanceBracket(prev, round, matchIdx, winner));
  };

  const handleLock = async () => {
    setBracketLocked(true);
    await setDoc(doc(db, "brackets", `${sessionId}_${studentName}`), {
      studentName,
      sessionId,
      category: selectedCategory,
      bracket,
      lockedAt: Date.now(),
    });
  };

  const handleChangeBracket = () => {
    setBracketLocked(false);
    setBracket(null);
    setSelectedCategory(null);
    setRankedScenarios(null);
  };

  const currentRound = bracket ? getCurrentRound(bracket) : null;
  const isDone = currentRound === "done";

  const ROUND_LABELS = { r1: "Round 1 of 5", r2: "Round 2 of 5", r3: "Quarterfinals", r4: "Semifinals", final: "Championship" };

  const renderMatchup = (match, round, idx) => {
    const isCurrentRound = currentRound === round;
    const bothPresent = match.top && match.bottom;
    return (
      <div
        key={match.id}
        style={{
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 12,
          opacity: !isCurrentRound ? 0.55 : 1,
        }}
      >
        {[match.top, match.bottom].map((scenario, side) => {
          const isWinner = match.winner?.id === scenario?.id;
          const isLoser = match.winner && !isWinner;
          return (
            <div
              key={side}
              onClick={() => isCurrentRound && bothPresent && !match.winner && handleVote(round, idx, scenario)}
              style={{
                padding: "12px 16px",
                fontSize: 14,
                background: isWinner
                  ? "var(--color-background-success)"
                  : isLoser
                  ? "var(--color-background-secondary)"
                  : "var(--color-background-primary)",
                color: isLoser ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
                cursor: isCurrentRound && bothPresent && !match.winner ? "pointer" : "default",
                borderBottom: side === 0 ? "0.5px solid var(--color-border-tertiary)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "background 0.2s",
              }}
            >
              {isWinner && <span style={{ color: "var(--color-text-success)", fontSize: 16 }}>✓</span>}
              <span>{scenario ? scenario.text : <em style={{ color: "var(--color-text-tertiary)" }}>TBD</em>}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={S.container}>
      <div style={S.card}>
        <h2 style={S.h2}>Phase 3 — Your bracket</h2>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
          Choose a category bracket to compete in. Vote scenario by scenario — one round at a time. You can switch until you lock in your bracket.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              style={S.pill(selectedCategory === c)}
              onClick={() => handleCategorySelect(c)}
              disabled={bracketLocked && selectedCategory !== c}
            >
              {CATEGORY_EMOJI[c]} {c}
            </button>
          ))}
        </div>
        {bracketLocked && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: "1rem" }}>
            <span style={{ fontSize: 13, color: "var(--color-text-success)", fontWeight: 500 }}>
              ✓ Bracket locked in
            </span>
            <button style={{ ...S.btn, fontSize: 13 }} onClick={handleChangeBracket}>
              Change bracket
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>
          Computing rankings from class votes…
        </div>
      )}

      {bracket && !loading && (
        <>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ ...S.h3, marginBottom: 0 }}>
                {isDone ? "Champion crowned!" : ROUND_LABELS[currentRound]}
              </h3>
              {!bracketLocked && !isDone && (
                <button style={S.btnPrimary} onClick={handleLock}>
                  Lock in this bracket
                </button>
              )}
            </div>

            {isDone && bracket.final[0].winner && (
              <div
                style={{
                  padding: "1.5rem",
                  background: "var(--color-background-success)",
                  borderRadius: 10,
                  textAlign: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--color-text-success)", marginBottom: 6 }}>Champion</div>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{bracket.final[0].winner.text}</div>
                <span style={S.badge(bracket.final[0].winner.category)}>
                  {bracket.final[0].winner.category}
                </span>
              </div>
            )}

            {["r1", "r2", "r3", "r4", "final"].map((round) => {
              const matches = bracket[round];
              const isActive = currentRound === round;
              return (
                <div key={round} style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: isActive ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {ROUND_LABELS[round]}
                    {isActive && " — pick your winner"}
                  </div>
                  {matches.map((match, idx) => renderMatchup(match, round, idx))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {isDone && (
        <div style={{ textAlign: "center" }}>
          <button style={S.btnPrimary} onClick={onDone}>
            Continue to reflection →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Phase 4: Reflection ──────────────────────────────────────────
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
          <div style={{ fontSize: 40, marginBottom: "1rem" }}>✓</div>
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
        {
          q: "What was the hardest 'Would You Rather' of the whole bracket?",
          hint: "Describe the matchup and why it was so difficult to choose.",
          val: hardest,
          set: setHardest,
        },
        {
          q: "What was the best scenario submitted today?",
          hint: "What made it stand out — funniness, creativity, how uncomfortable it made you?",
          val: best,
          set: setBest,
        },
        {
          q: "What was the worst scenario submitted today?",
          hint: "Too easy, too gross, not interesting enough — what made it a miss?",
          val: worst,
          set: setWorst,
        },
      ].map(({ q, hint, val, set }, i) => (
        <div key={i} style={S.card}>
          <h3 style={S.h3}>{q}</h3>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>{hint}</p>
          <textarea
            style={{ ...S.input, minHeight: 100, resize: "vertical" }}
            placeholder="Your answer…"
            value={val}
            onChange={(e) => set(e.target.value)}
          />
        </div>
      ))}

      <div style={{ textAlign: "center" }}>
        <button
          style={{ ...S.btnPrimary, opacity: (!hardest.trim() || !best.trim() || !worst.trim()) ? 0.5 : 1 }}
          onClick={handleSubmit}
          disabled={saving || !hardest.trim() || !best.trim() || !worst.trim()}
        >
          {saving ? "Submitting…" : "Submit reflection"}
        </button>
      </div>
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────
export default function WouldYouRatherBracket() {
  // Generate or retrieve session ID (one per class "session")
  // In production you'd have the teacher create/start a session
  const SESSION_ID = "wyr-session-001"; // ← change this per class session

  const [studentName, setStudentName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [phase, setPhase] = useState(1); // 1=brainstorm, 2=ranking, 3=bracket, 4=reflect
  const [scenarios, setScenarios] = useState([]);
  const [sessionPhase, setSessionPhase] = useState(1); // controlled by teacher / auto-advance

  // Live listener on scenarios
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sessions", SESSION_ID), (snap) => {
      if (snap.exists()) {
        setScenarios(snap.data().scenarios || []);
        const sp = snap.data().phase;
        if (sp) setSessionPhase(sp);
      }
    });
    return unsub;
  }, []);

  const handleNameSubmit = async () => {
    const name = nameInput.trim();
    if (name.length < 2) return;
    setStudentName(name);
    // Ensure session doc exists
    const ref = doc(db, "sessions", SESSION_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { scenarios: [], phase: 1, createdAt: Date.now() });
    }
  };

  if (!studentName) {
    return (
      <div style={S.app}>
        <div style={S.header}>
          <div>
            <h1 style={S.headerTitle}>Would You Rather — Class Bracket</h1>
            <p style={S.headerSub}>25-minute philosophy activity</p>
          </div>
        </div>
        <div style={{ ...S.container, maxWidth: 480 }}>
          <div style={{ ...S.card, marginTop: "3rem" }}>
            <h2 style={S.h2}>Enter your nickname</h2>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
              This is how your submissions will be tagged. Keep it school-appropriate.
            </p>
            <input
              style={S.input}
              placeholder="e.g. Alex or ThinkingHat"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
              autoFocus
            />
            <button style={{ ...S.btnPrimary, marginTop: 12 }} onClick={handleNameSubmit}>
              Join session →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const PHASE_LABELS = ["Brainstorm", "Ranking", "Bracket", "Reflection"];

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div>
          <h1 style={S.headerTitle}>Would You Rather — Class Bracket</h1>
          <p style={S.headerSub}>
            Phase {phase} of 4 — {PHASE_LABELS[phase - 1]} &nbsp;·&nbsp; Playing as{" "}
            <strong style={{ color: "#F1EFE8" }}>{studentName}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4].map((p) => (
            <div
              key={p}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: p === phase ? "#F1EFE8" : p < phase ? "#5F5E5A" : "#444441",
                color: p === phase ? "#2C2C2A" : p < phase ? "#D3D1C7" : "#888780",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {p}
            </div>
          ))}
        </div>
      </div>

      {phase === 1 && (
        <BrainstormPhase
          sessionId={SESSION_ID}
          studentName={studentName}
          scenarios={scenarios}
          onAllDone={() => setPhase(2)}
        />
      )}
      {phase === 2 && (
        <RankingPhase
          sessionId={SESSION_ID}
          studentName={studentName}
          scenarios={scenarios}
          onDone={() => setPhase(3)}
        />
      )}
      {phase === 3 && (
        <BracketPhase
          sessionId={SESSION_ID}
          studentName={studentName}
          scenarios={scenarios}
          onDone={() => setPhase(4)}
        />
      )}
      {phase === 4 && (
        <ReflectionPhase
          sessionId={SESSION_ID}
          studentName={studentName}
          scenarios={scenarios}
        />
      )}
    </div>
  );
}
