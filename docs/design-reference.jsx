import React, { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   SkillStorm — Notion × Duolingo redesign
   - Warm white document surface (Notion)
   - Leaf-green tactile CTAs, streak/XP signals (Duolingo)
   - RBAC dashboards: student / teacher / director
   - Test flow with age modes: 1.–3. třída vs 7.–9. třída
   - Parťák: original SkillStorm companion (student-only)
   ============================================================ */

const T = {
  bg: "#ffffff",
  bgAlt: "#fbfaf8",
  surface: "#f1efea",
  text: "#37352f",
  muted: "#6f6b62",
  dim: "#a09c92",
  border: "#e9e7e2",
  borderStrong: "#d6d3cc",
  accent: "#58cc02",
  accentHover: "#4cad00",
  accentDeep: "#3d8a00",
  accentSoft: "#e8f8d8",
  streak: "#ff9600",
  danger: "#ff4b4b",
  xp: "#1cb0f6",
};

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    .ss-root { font-family: 'Inter', -apple-system, sans-serif; color: ${T.text}; background: ${T.bg}; min-height: 100vh; }
    .ss-root ::selection { background: ${T.accentSoft}; }
    .tactile {
      border-radius: 16px; border: none; cursor: pointer;
      font-family: inherit; font-weight: 700; font-size: 16px;
      padding: 14px 24px; background: ${T.accent}; color: #fff;
      box-shadow: 0 4px 0 0 ${T.accentDeep};
      transition: transform .06s ease, box-shadow .06s ease, background .15s ease;
    }
    .tactile:hover { background: ${T.accentHover}; }
    .tactile:active { transform: translateY(2px); box-shadow: 0 0 0 0 ${T.accentDeep}; }
    .tactile.secondary {
      background: transparent; color: ${T.text};
      border: 2px solid ${T.borderStrong};
      box-shadow: 0 4px 0 0 ${T.borderStrong};
    }
    .tactile.secondary:hover { background: ${T.bgAlt}; }
    .tactile.secondary:active { transform: translateY(2px); box-shadow: 0 0 0 0 ${T.borderStrong}; }
    .tactile:focus-visible, .card-btn:focus-visible { outline: 3px solid ${T.xp}; outline-offset: 2px; }
    .card { background: ${T.bgAlt}; border: 1px solid ${T.border}; border-radius: 12px; transition: background .15s, border-color .15s; }
    .card.hoverable:hover { background: ${T.surface}; border-color: ${T.borderStrong}; }
    .pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 12px; font-weight: 700; font-size: 13px; color: #fff; font-variant-numeric: tabular-nums; }
    @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
    @keyframes pop { 0% { transform: scale(.6); opacity:0 } 70% { transform: scale(1.08) } 100% { transform: scale(1); opacity:1 } }
    @keyframes wiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
    .bob { animation: bob 2.6s ease-in-out infinite; }
    .pop { animation: pop .35s ease-out both; }
    .wiggle { animation: wiggle .5s ease-in-out; }
    @media (prefers-reduced-motion: reduce) { .bob, .pop, .wiggle { animation: none; } }
    .navrail { width: 240px; flex-shrink: 0; }
    .bottomtabs { display: none; }
    @media (max-width: 768px) {
      .navrail { display: none; }
      .bottomtabs { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: ${T.bg}; border-top: 1px solid ${T.border}; z-index: 50; }
      .ss-main { padding-bottom: 90px !important; }
      .tactile { box-shadow: 0 3px 0 0 ${T.accentDeep}; }
      .tactile.secondary { box-shadow: 0 3px 0 0 ${T.borderStrong}; }
    }
  `}</style>
);

/* ---------------- Parťák (original SkillStorm companion) ---------------- */
/* Two life stages shown here: soft blob (1.–3.) and heraldic emblem (7.–9.) */

const PartakBlob = ({ size = 120, mood = "idle" }) => {
  const eyeY = mood === "happy" ? 46 : 50;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={mood === "happy" ? "wiggle" : "bob"} aria-label="Parťák">
      <path d="M60 12 C92 12 106 40 104 66 C102 94 84 108 60 108 C36 108 18 94 16 66 C14 40 28 12 60 12 Z" fill={T.accent}/>
      <path d="M60 18 C86 18 98 42 96 64 C94 88 80 100 60 100 C40 100 26 88 24 64 C22 42 34 18 60 18 Z" fill="#6fdb1a" opacity=".55"/>
      <ellipse cx="44" cy={eyeY} rx="7" ry={mood === "happy" ? 4 : 9} fill="#25341a"/>
      <ellipse cx="76" cy={eyeY} rx="7" ry={mood === "happy" ? 4 : 9} fill="#25341a"/>
      {mood === "happy"
        ? <path d="M46 70 Q60 84 74 70" stroke="#25341a" strokeWidth="5" fill="none" strokeLinecap="round"/>
        : <path d="M50 72 Q60 78 70 72" stroke="#25341a" strokeWidth="5" fill="none" strokeLinecap="round"/>}
      <circle cx="34" cy="64" r="6" fill="#ffffff" opacity=".35"/>
      <circle cx="86" cy="64" r="6" fill="#ffffff" opacity=".35"/>
      <path d="M52 10 Q60 0 68 10" stroke={T.accentDeep} strokeWidth="5" fill="none" strokeLinecap="round"/>
    </svg>
  );
};

const PartakEmblem = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Parťák — emblém">
    <path d="M24 3 L42 10 V25 C42 36 33 43 24 45 C15 43 6 36 6 25 V10 Z" fill={T.accentSoft} stroke={T.accentDeep} strokeWidth="2.5"/>
    <path d="M24 10 L35 14.5 V25 C35 32 29.5 36.5 24 38 C18.5 36.5 13 32 13 25 V14.5 Z" fill={T.accent}/>
    <circle cx="20" cy="23" r="2.4" fill="#25341a"/>
    <circle cx="28" cy="23" r="2.4" fill="#25341a"/>
    <path d="M20 29 Q24 32 28 29" stroke="#25341a" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
  </svg>
);

/* ---------------- Demo data ---------------- */

const TESTS = [
  { id: 1, name: "Zlomky — sčítání a odčítání", subject: "Matematika", due: "dnes do 12:00", questions: 3, status: "open", cls: "8.A" },
  { id: 2, name: "Vyjmenovaná slova po B", subject: "Český jazyk", due: "zítra do 14:00", questions: 10, status: "open", cls: "3.B" },
  { id: 3, name: "Fotosyntéza", subject: "Přírodopis", due: "odevzdáno · 85 %", questions: 12, status: "done", cls: "8.A" },
];

const QUESTIONS = [
  { q: "Kolik je 1/2 + 1/4?", opts: ["3/4", "2/6", "1/6", "2/4"], correct: 0 },
  { q: "Kolik je 5/6 − 1/3?", opts: ["4/3", "1/2", "4/6", "1/3"], correct: 1 },
  { q: "Který zlomek je největší?", opts: ["1/3", "2/5", "3/4", "1/2"], correct: 2 },
];

const CLASSES = [
  { name: "8.A", students: 24, avg: 76, submitted: 21, risk: 2 },
  { name: "8.B", students: 22, avg: 68, submitted: 18, risk: 4 },
  { name: "9.A", students: 26, avg: 81, submitted: 26, risk: 1 },
];

/* ---------------- Shared bits ---------------- */

const Pill = ({ color, children }) => (
  <span className="pill" style={{ background: color }}>{children}</span>
);

const ProgressBar = ({ value, height = 12 }) => (
  <div style={{ background: T.surface, borderRadius: 999, height, overflow: "hidden" }}>
    <div style={{ width: `${value}%`, height: "100%", background: T.accent, borderRadius: 999, position: "relative", transition: "width .4s ease" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,.32)", borderRadius: 999 }}/>
    </div>
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.dim, marginBottom: 12 }}>{children}</div>
);

/* ---------------- Student: dashboard ---------------- */

const StudentDashboard = ({ onOpenTests, xp, streak }) => {
  const level = Math.floor(xp / 200) + 1;
  const toNext = xp % 200;
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 40, fontWeight: 800, margin: "8px 0 4px" }}>Ahoj, Kubo! 👋</h1>
      <p style={{ color: T.muted, fontSize: 16, lineHeight: 1.6, margin: "0 0 24px" }}>Tvůj parťák už se těší na dnešní procvičování.</p>

      <div className="card" style={{ padding: 32, display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <PartakBlob size={110} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Pill color={T.streak}>🔥 {streak} dní</Pill>
            <Pill color={T.xp}>⚡ {xp} XP</Pill>
            <Pill color={T.accent}>Úroveň {level}</Pill>
          </div>
          <div style={{ fontSize: 14, color: T.muted, marginBottom: 8 }}>
            Do další úrovně zbývá <strong style={{ color: T.text }}>{200 - toNext} XP</strong>
          </div>
          <ProgressBar value={(toNext / 200) * 100} />
        </div>
      </div>

      <SectionLabel>Čeká na tebe</SectionLabel>
      {TESTS.filter(t => t.status === "open").map(t => (
        <button key={t.id} className="card hoverable card-btn" onClick={onOpenTests}
          style={{ width: "100%", textAlign: "left", padding: "18px 20px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer", font: "inherit" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
            <div style={{ color: T.muted, fontSize: 14, marginTop: 2 }}>{t.subject} · {t.questions} otázek</div>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.streak, whiteSpace: "nowrap" }}>{t.due}</span>
        </button>
      ))}

      <SectionLabel>Hotovo</SectionLabel>
      {TESTS.filter(t => t.status === "done").map(t => (
        <div key={t.id} className="card" style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
            <div style={{ color: T.muted, fontSize: 14, marginTop: 2 }}>{t.subject}</div>
          </div>
          <Pill color={T.accent}>85 %</Pill>
        </div>
      ))}
    </div>
  );
};

/* ---------------- Student: test run with age modes ---------------- */

const YOUNG_TILE_ICONS = ["🍎", "🌟", "🐸", "🎈"];

const TestRun = ({ mode, setMode, onFinish, addXp }) => {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [runStreak, setRunStreak] = useState(0);
  const [time, setTime] = useState(180);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);

  const q = QUESTIONS[idx];
  const isYoung = mode === "young";

  useEffect(() => {
    if (isYoung || finished) return;
    timerRef.current = setInterval(() => setTime(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timerRef.current);
  }, [isYoung, finished]);

  const pick = useCallback((i) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.correct;
    if (ok) { setScore(s => s + 1); setRunStreak(s => s + 1); } else { setRunStreak(0); }
    setTimeout(() => {
      if (idx + 1 < QUESTIONS.length) { setIdx(idx + 1); setPicked(null); }
      else {
        setFinished(true);
        addXp(40 + (score + (ok ? 1 : 0)) * 10 + 60); // +40 dokončení, +10/správně, +60 zlepšení vs. minule (demo)
      }
    }, isYoung ? 1400 : 900);
  }, [picked, q, idx, isYoung, score, addXp]);

  useEffect(() => {
    if (isYoung || finished) return;
    const h = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= 4) pick(n - 1); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isYoung, finished, pick]);

  const mood = picked === null ? "idle" : picked === q.correct ? "happy" : "idle";

  if (finished) {
    const pct = Math.round((score / QUESTIONS.length) * 100);
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }} className="pop">
        <PartakBlob size={140} mood="happy" />
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0 6px" }}>Hotovo! 🎉</h1>
        <p style={{ color: T.muted, fontSize: 16, lineHeight: 1.6 }}>
          Zlepšil ses oproti minulému pokusu — a to se počítá nejvíc.
        </p>
        <div className="card" style={{ padding: 24, margin: "20px 0", display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 12 }}>
          <div><div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{pct} %</div><div style={{ fontSize: 13, color: T.muted }}>úspěšnost</div></div>
          <div><div style={{ fontSize: 32, fontWeight: 800, color: T.xp, fontVariantNumeric: "tabular-nums" }}>+{40 + score * 10 + 60}</div><div style={{ fontSize: 13, color: T.muted }}>XP celkem</div></div>
          <div><div style={{ fontSize: 32, fontWeight: 800, color: T.streak, fontVariantNumeric: "tabular-nums" }}>+60</div><div style={{ fontSize: 13, color: T.muted }}>za zlepšení</div></div>
        </div>
        <button className="tactile" style={{ width: "100%" }} onClick={onFinish}>Zpět na přehled</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: isYoung ? 560 : 480, margin: "0 auto" }}>
      {/* demo mode toggle */}
      <div className="card" style={{ padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>Režim UI podle ročníku</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[["young", "1.–3. třída"], ["old", "7.–9. třída"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ font: "inherit", fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                border: `2px solid ${mode === m ? T.accent : T.border}`,
                background: mode === m ? T.accentSoft : "transparent", color: mode === m ? T.accentDeep : T.muted }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* header row */}
      {isYoung ? (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <PartakBlob size={96} mood={mood} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T.accentDeep, marginTop: 4 }}>
            {picked === null ? "Zvládneš to! 💪" : picked === q.correct ? "Juchů! Správně!" : "Nevadí, zkusíme další!"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PartakEmblem size={36} />
            <Pill color={T.streak}>🔥 {runStreak}</Pill>
          </div>
          <span style={{ fontFamily: "'Inter'", fontWeight: 800, fontSize: 18, fontVariantNumeric: "tabular-nums", color: time < 30 ? T.danger : T.text }}>
            {String(Math.floor(time / 60)).padStart(1, "0")}:{String(time % 60).padStart(2, "0")}
          </span>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <ProgressBar value={(idx / QUESTIONS.length) * 100} height={isYoung ? 16 : 10} />
      </div>

      <div className="card" style={{ padding: isYoung ? 32 : 24, marginBottom: 16, textAlign: isYoung ? "center" : "left" }}>
        <div style={{ fontSize: 13, color: T.dim, fontWeight: 600, marginBottom: 6 }}>Otázka {idx + 1} z {QUESTIONS.length}</div>
        <div style={{ fontSize: isYoung ? 28 : 20, fontWeight: 800, lineHeight: 1.3 }}>{q.q}</div>
      </div>

      {isYoung ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {q.opts.map((o, i) => {
            const state = picked === null ? "idle" : i === q.correct ? "right" : i === picked ? "wrong" : "dim";
            const bg = state === "right" ? T.accent : state === "wrong" ? T.danger : T.bgAlt;
            const col = state === "right" || state === "wrong" ? "#fff" : T.text;
            return (
              <button key={i} className="tactile card-btn" onClick={() => pick(i)} disabled={picked !== null}
                style={{ background: bg, color: col, boxShadow: `0 4px 0 0 ${state === "right" ? T.accentDeep : state === "wrong" ? "#c92f2f" : T.borderStrong}`,
                  border: state === "idle" ? `2px solid ${T.borderStrong}` : "none",
                  padding: "26px 12px", fontSize: 24, fontWeight: 800, opacity: state === "dim" ? .5 : 1 }}>
                <div style={{ fontSize: 30, marginBottom: 6 }}>{YOUNG_TILE_ICONS[i]}</div>
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.opts.map((o, i) => {
            const state = picked === null ? "idle" : i === q.correct ? "right" : i === picked ? "wrong" : "dim";
            return (
              <button key={i} className="card hoverable card-btn" onClick={() => pick(i)} disabled={picked !== null}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer", font: "inherit", textAlign: "left",
                  borderColor: state === "right" ? T.accent : state === "wrong" ? T.danger : T.border,
                  background: state === "right" ? T.accentSoft : state === "wrong" ? "#ffecec" : T.bgAlt,
                  opacity: state === "dim" ? .55 : 1 }}>
                <kbd style={{ fontWeight: 700, fontSize: 12, color: T.dim, border: `1px solid ${T.borderStrong}`, borderRadius: 6, padding: "2px 7px", background: T.bg }}>{i + 1}</kbd>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{o}</span>
              </button>
            );
          })}
          <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>Tip: odpovídej klávesami 1–4</div>
        </div>
      )}
    </div>
  );
};

/* ---------------- Student: test list ---------------- */

const StudentTests = ({ onStart }) => (
  <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <h1 style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 20px" }}>Moje testy</h1>
    {TESTS.map(t => (
      <div key={t.id} className="card hoverable" style={{ padding: "20px 22px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{t.name}</div>
          <div style={{ color: T.muted, fontSize: 14, marginTop: 3 }}>{t.subject} · {t.questions} otázek · {t.due}</div>
        </div>
        {t.status === "open"
          ? <button className="tactile" style={{ padding: "10px 20px", fontSize: 15 }} onClick={onStart}>Spustit test</button>
          : <Pill color={T.accent}>85 %</Pill>}
      </div>
    ))}
  </div>
);

/* ---------------- Teacher dashboard ---------------- */

const TeacherDashboard = ({ onNewTest }) => (
  <div style={{ maxWidth: 900, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: "8px 0 4px" }}>Dobrý den, pane učiteli</h1>
        <p style={{ color: T.muted, margin: 0 }}>Matematika · 3 třídy · školní rok 2025/26</p>
      </div>
      <button className="tactile" onClick={onNewTest}>+ Nový test</button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
      {[["Aktivní zadání", "4", T.text], ["Čeká na opravu", "12", T.streak], ["Průměr školy", "75 %", T.accentDeep]].map(([l, v, c]) => (
        <div key={l} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }}>{v}</div>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>{l}</div>
        </div>
      ))}
    </div>

    <SectionLabel>Moje třídy</SectionLabel>
    {CLASSES.map(c => (
      <div key={c.name} className="card hoverable" style={{ padding: "18px 22px", marginBottom: 10, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 20, width: 56 }}>{c.name}</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 6 }}>Odevzdáno {c.submitted}/{c.students} · průměr {c.avg} %</div>
          <ProgressBar value={c.avg} height={8} />
        </div>
        {c.risk > 0 && <Pill color={c.risk > 3 ? T.danger : T.streak}>⚠ {c.risk} rizikoví</Pill>}
      </div>
    ))}

    <SectionLabel>Poslední odevzdání</SectionLabel>
    <div className="card" style={{ padding: "6px 0" }}>
      {[["Anna K.", "8.A", "Zlomky", 92], ["Tomáš V.", "8.B", "Zlomky", 54], ["Eliška P.", "9.A", "Rovnice", 88]].map(([n, cl, te, sc], i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", borderBottom: i < 2 ? `1px solid ${T.border}` : "none", fontSize: 15 }}>
          <span><strong>{n}</strong> <span style={{ color: T.muted }}>· {cl} · {te}</span></span>
          <strong style={{ color: sc >= 60 ? T.accentDeep : T.danger, fontVariantNumeric: "tabular-nums" }}>{sc} %</strong>
        </div>
      ))}
    </div>
  </div>
);

/* ---------------- Teacher: test builder (Test → Questions → Assignment) ---------------- */

const Q_TYPES = [
  { id: "MULTIPLE_CHOICE", label: "Výběr z možností", icon: "🔘" },
  { id: "TRUE_FALSE", label: "Pravda / Nepravda", icon: "⚖️" },
  { id: "FILL_IN", label: "Doplňovačka", icon: "✏️" },
];

const emptyQuestion = (type = "MULTIPLE_CHOICE") => ({
  type,
  text: "",
  opts: type === "TRUE_FALSE" ? ["Pravda", "Nepravda"] : type === "FILL_IN" ? [] : ["", "", "", ""],
  correct: 0,
  answer: "",
});

const FieldLabel = ({ children }) => (
  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.muted, marginBottom: 6 }}>{children}</label>
);

const inputStyle = {
  width: "100%", font: "inherit", fontSize: 15, padding: "10px 14px",
  border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg, color: T.text, outline: "none",
};

const Input = (props) => (
  <input {...props} style={{ ...inputStyle, ...props.style }}
    onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${T.accent}`}
    onBlur={e => e.target.style.boxShadow = "none"} />
);

const TestBuilder = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState({ name: "", subject: "Matematika", cls: "8.A" });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [assign, setAssign] = useState({ open: "2026-07-14T08:00", close: "2026-07-14T12:00", attempts: 1, limit: 15 });
  const [published, setPublished] = useState(false);

  const steps = ["Základní údaje", "Otázky", "Zadání třídě"];

  const updateQ = (i, patch) => setQuestions(qs => qs.map((q, j) => j === i ? { ...q, ...patch } : q));
  const changeType = (i, type) => setQuestions(qs => qs.map((q, j) => j === i ? emptyQuestion(type) : q));
  const canNext = step === 0 ? meta.name.trim().length > 0
    : step === 1 ? questions.every(q => q.text.trim() && (q.type !== "MULTIPLE_CHOICE" || q.opts.every(o => o.trim())) && (q.type !== "FILL_IN" || q.answer.trim()))
    : true;

  if (published) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }} className="pop">
        <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 8px" }}>Test je zadaný</h1>
        <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.6 }}>
          <strong style={{ color: T.text }}>{meta.name}</strong> · {meta.subject} · třída {meta.cls}<br/>
          Otevře se {assign.open.replace("T", " v ")}, {questions.length} otázek, {assign.attempts} pokus, limit {assign.limit} min.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="tactile secondary" style={{ flex: 1 }} onClick={onDone}>Zpět na přehled</button>
          <button className="tactile" style={{ flex: 1 }} onClick={() => { setPublished(false); setStep(0); setMeta({ ...meta, name: "" }); setQuestions([emptyQuestion()]); }}>Vytvořit další</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 16px" }}>Nový test</h1>

      {/* stepper */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 8, borderRadius: 999, background: i <= step ? T.accent : T.surface, transition: "background .3s" }} />
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, color: i === step ? T.accentDeep : T.dim }}>{i + 1}. {s}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <FieldLabel>Název testu</FieldLabel>
            <Input value={meta.name} placeholder="např. Zlomky — sčítání a odčítání" onChange={e => setMeta({ ...meta, name: e.target.value })} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Předmět</FieldLabel>
              <select value={meta.subject} onChange={e => setMeta({ ...meta, subject: e.target.value })} style={inputStyle}>
                {["Matematika", "Český jazyk", "Přírodopis", "Dějepis", "Angličtina"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Třída</FieldLabel>
              <select value={meta.cls} onChange={e => setMeta({ ...meta, cls: e.target.value })} style={inputStyle}>
                {CLASSES.map(c => <option key={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          {questions.map((q, i) => (
            <div key={i} className="card" style={{ padding: 24, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Otázka {i + 1}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Q_TYPES.map(t => (
                    <button key={t.id} onClick={() => changeType(i, t.id)}
                      style={{ font: "inherit", fontWeight: 700, fontSize: 12, padding: "5px 10px", borderRadius: 999, cursor: "pointer",
                        border: `2px solid ${q.type === t.id ? T.accent : T.border}`,
                        background: q.type === t.id ? T.accentSoft : "transparent",
                        color: q.type === t.id ? T.accentDeep : T.muted }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                  {questions.length > 1 && (
                    <button onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
                      style={{ font: "inherit", fontWeight: 700, fontSize: 12, padding: "5px 10px", borderRadius: 999, cursor: "pointer", border: `2px solid ${T.border}`, background: "transparent", color: T.danger }}>
                      Smazat
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Znění otázky</FieldLabel>
                <Input value={q.text} placeholder={q.type === "FILL_IN" ? "např. 1/2 + 1/4 = ___" : "např. Kolik je 1/2 + 1/4?"} onChange={e => updateQ(i, { text: e.target.value })} />
              </div>

              {q.type === "MULTIPLE_CHOICE" && (
                <div style={{ display: "grid", gap: 8 }}>
                  <FieldLabel>Možnosti — kliknutím na kolečko označte správnou</FieldLabel>
                  {q.opts.map((o, oi) => (
                    <div key={oi} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button onClick={() => updateQ(i, { correct: oi })} aria-label={`Označit možnost ${oi + 1} jako správnou`}
                        style={{ width: 26, height: 26, borderRadius: 999, cursor: "pointer", flexShrink: 0,
                          border: `2px solid ${q.correct === oi ? T.accent : T.borderStrong}`,
                          background: q.correct === oi ? T.accent : "transparent",
                          color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1 }}>
                        {q.correct === oi ? "✓" : ""}
                      </button>
                      <Input value={o} placeholder={`Možnost ${oi + 1}`} onChange={e => updateQ(i, { opts: q.opts.map((x, xi) => xi === oi ? e.target.value : x) })} />
                    </div>
                  ))}
                </div>
              )}

              {q.type === "TRUE_FALSE" && (
                <div style={{ display: "flex", gap: 10 }}>
                  {["Pravda", "Nepravda"].map((o, oi) => (
                    <button key={o} onClick={() => updateQ(i, { correct: oi })}
                      style={{ flex: 1, font: "inherit", fontWeight: 700, fontSize: 15, padding: "12px", borderRadius: 12, cursor: "pointer",
                        border: `2px solid ${q.correct === oi ? T.accent : T.border}`,
                        background: q.correct === oi ? T.accentSoft : T.bg, color: q.correct === oi ? T.accentDeep : T.muted }}>
                      {q.correct === oi ? "✓ " : ""}{o}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "FILL_IN" && (
                <div>
                  <FieldLabel>Správná odpověď</FieldLabel>
                  <Input value={q.answer} placeholder="např. 3/4" onChange={e => updateQ(i, { answer: e.target.value })} />
                </div>
              )}
            </div>
          ))}
          <button className="tactile secondary" style={{ width: "100%" }} onClick={() => setQuestions(qs => [...qs, emptyQuestion()])}>+ Přidat otázku</button>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <FieldLabel>Otevření testu</FieldLabel>
              <Input type="datetime-local" value={assign.open} onChange={e => setAssign({ ...assign, open: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Uzavření testu</FieldLabel>
              <Input type="datetime-local" value={assign.close} onChange={e => setAssign({ ...assign, close: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Počet pokusů</FieldLabel>
              <Input type="number" min="1" max="5" value={assign.attempts} onChange={e => setAssign({ ...assign, attempts: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Časový limit (min)</FieldLabel>
              <Input type="number" min="0" value={assign.limit} onChange={e => setAssign({ ...assign, limit: e.target.value })} />
            </div>
          </div>
          <div className="card" style={{ padding: "14px 18px", background: T.bg, fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
            <strong style={{ color: T.text }}>Souhrn:</strong> {meta.name || "Bez názvu"} · {meta.subject} · třída {meta.cls} · {questions.length} otázek.
            Žáci ve věku 1.–3. třídy uvidí test bez časovače — limit se u nich nepoužije.
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, gap: 10 }}>
        <button className="tactile secondary" onClick={() => step === 0 ? onDone() : setStep(step - 1)}>
          {step === 0 ? "Zrušit" : "← Zpět"}
        </button>
        <button className="tactile" disabled={!canNext} style={{ opacity: canNext ? 1 : .5, cursor: canNext ? "pointer" : "not-allowed" }}
          onClick={() => step < 2 ? setStep(step + 1) : setPublished(true)}>
          {step < 2 ? "Pokračovat →" : "Zadat test třídě"}
        </button>
      </div>
    </div>
  );
};

/* ---------------- Director dashboard ---------------- */

const DirectorDashboard = () => (
  <div style={{ maxWidth: 900, margin: "0 auto" }}>
    <h1 style={{ fontSize: 36, fontWeight: 800, margin: "8px 0 4px" }}>Přehled školy</h1>
    <p style={{ color: T.muted, margin: "0 0 24px" }}>ZŠ Komenského · školní rok 2025/26</p>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
      {[["Žáků", "412"], ["Učitelů", "28"], ["Testů tento měsíc", "56"], ["Průměrná úspěšnost", "74 %"]].map(([l, v]) => (
        <div key={l} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{v}</div>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>{l}</div>
        </div>
      ))}
    </div>

    <SectionLabel>Úspěšnost po ročnících</SectionLabel>
    <div className="card" style={{ padding: 24, marginBottom: 24 }}>
      {[["1.–3. ročník", 82], ["4.–6. ročník", 75], ["7.–9. ročník", 69]].map(([l, v]) => (
        <div key={l} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{l}</span>
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{v} %</strong>
          </div>
          <ProgressBar value={v} height={10} />
        </div>
      ))}
    </div>

    <div className="card" style={{ padding: "18px 22px", borderLeft: `4px solid ${T.xp}`, background: T.bgAlt }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Proč tu nevidíte parťáky žáků?</div>
      <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
        Motivační společník je viditelný pouze žákovi. Kdyby se stal metrikou pro vedení, ztratil by
        svou hodnotu bezpečného prostoru — žáci by ho začali vnímat jako další známku.
      </div>
    </div>
  </div>
);

/* ---------------- Shell ---------------- */

const ROLES = [
  { id: "student", label: "Žák", icon: "🎒" },
  { id: "teacher", label: "Učitel", icon: "📗" },
  { id: "director", label: "Ředitel", icon: "🏫" },
];

const NAV = {
  student: [["dashboard", "Přehled", "🏠"], ["tests", "Testy", "📝"], ["materials", "Materiály", "📚"]],
  teacher: [["dashboard", "Přehled", "🏠"], ["tests", "Testy", "📝"], ["classes", "Třídy", "👥"], ["materials", "Materiály", "📚"]],
  director: [["dashboard", "Přehled", "🏠"], ["analytics", "Analytika", "📊"], ["people", "Lidé", "👥"]],
};

export default function SkillStormApp() {
  const [role, setRole] = useState("student");
  const [page, setPage] = useState("dashboard");
  const [ageMode, setAgeMode] = useState("old");
  const [xp, setXp] = useState(340);
  const [streak] = useState(6);

  const go = (p) => setPage(p);
  const switchRole = (r) => { setRole(r); setPage("dashboard"); };

  let content;
  if (role === "student") {
    if (page === "dashboard") content = <StudentDashboard onOpenTests={() => go("tests")} xp={xp} streak={streak} />;
    else if (page === "tests") content = <StudentTests onStart={() => go("run")} />;
    else if (page === "run") content = <TestRun mode={ageMode} setMode={setAgeMode} onFinish={() => go("dashboard")} addXp={(n) => setXp(x => x + n)} />;
    else content = <Placeholder title="Materiály" />;
  } else if (role === "teacher") {
    if (page === "dashboard") content = <TeacherDashboard onNewTest={() => go("tests")} />;
    else if (page === "tests") content = <TestBuilder onDone={() => go("dashboard")} />;
    else content = <Placeholder title={NAV.teacher.find(n => n[0] === page)?.[1] || ""} />;
  } else {
    content = page === "dashboard" ? <DirectorDashboard /> : <Placeholder title={NAV.director.find(n => n[0] === page)?.[1] || ""} />;
  }

  const navItems = NAV[role];

  return (
    <div className="ss-root">
      <GlobalStyle />
      {/* Top bar */}
      <header style={{ borderBottom: `1px solid ${T.border}`, background: T.bg, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PartakEmblem size={30} />
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.01em" }}>SkillStorm</span>
          </div>
          <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 999, padding: 4 }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => switchRole(r.id)}
                style={{ font: "inherit", fontWeight: 700, fontSize: 13, padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                  background: role === r.id ? T.bg : "transparent", color: role === r.id ? T.text : T.muted,
                  boxShadow: role === r.id ? `0 1px 3px rgba(55,53,47,.12)` : "none" }}>
                {r.icon} {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex" }}>
        {/* Nav rail (desktop) */}
        <nav className="navrail" style={{ borderRight: `1px solid ${T.border}`, padding: "24px 12px", minHeight: "calc(100vh - 57px)" }}>
          {navItems.map(([id, label, icon]) => (
            <button key={id} onClick={() => go(id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", font: "inherit", fontWeight: 600, fontSize: 15,
                padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", marginBottom: 2, textAlign: "left",
                background: page === id ? T.accentSoft : "transparent", color: page === id ? T.accentDeep : T.muted }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <main className="ss-main" style={{ flex: 1, padding: "32px 20px 64px" }}>
          {content}
        </main>
      </div>

      {/* Bottom tabs (mobile) */}
      <div className="bottomtabs">
        {navItems.map(([id, label, icon]) => (
          <button key={id} onClick={() => go(id)}
            style={{ flex: 1, font: "inherit", fontWeight: 700, fontSize: 11, padding: "10px 4px 12px", border: "none", cursor: "pointer",
              background: "transparent", color: page === id ? T.accentDeep : T.dim, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 20 }}>{icon}</span> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const Placeholder = ({ title }) => (
  <div style={{ maxWidth: 720, margin: "0 auto" }}>
    <h1 style={{ fontSize: 32, fontWeight: 800 }}>{title}</h1>
    <div className="card" style={{ padding: 40, textAlign: "center", color: T.muted }}>
      Tato sekce je připravená ve struktuře navigace — obsah doplníme v další iteraci.
    </div>
  </div>
);
