/**
 * Open Mat UI Prototype v4 — Full Clickable Prototype
 * 
 * Access via: ?prototype=true
 * 
 * Contains all 8 screens: Auth, Onboard, Tutorial (with sub minigame), 
 * Post-Tutorial, Home, Lobby, Deck, Profile
 * 
 * This is a STANDALONE prototype — no Supabase calls, no real data.
 * Pure React state, all simulated.
 */
import React, { useState, useEffect } from "react";

// ─── TOKENS ─────────────────────────────────────────────────────
const T = {
  c: {
    bg: "#0E0E1A", surface: "#151525", surfaceLight: "#1C1C32",
    border: "rgba(255,255,255,0.06)", text: "#E8E8E8", textSec: "#8892B0", textMut: "#4A5568",
    red: "#E63946", blue: "#457B9D", green: "#2A9D8F",
    gold: "#E9C46A", amber: "#F4A261", purple: "#7B68EE",
    beltWhite: "#F5F5F5", beltBlue: "#1E90FF",
  },
  font: { display: "'Bebas Neue','Impact',sans-serif", body: "'DM Sans','Segoe UI',sans-serif", mono: "'JetBrains Mono','Courier New',monospace" },
  r: { sm: 8, md: 14, lg: 20, xl: 28, full: 9999 },
};

const ARCHETYPES = [
  { id: "wrestler", emoji: "🤼", name: "Wrestler", desc: "Takedowns and top pressure", color: T.c.amber },
  { id: "guard_puller", emoji: "🛡️", name: "Guard Puller", desc: "Sweep, submit, repeat from bottom", color: T.c.blue },
  { id: "sub_hunter", emoji: "🎯", name: "Sub Hunter", desc: "Always hunting the finish", color: T.c.red },
  { id: "pressure_passer", emoji: "⚙️", name: "Pressure Passer", desc: "Grinding passes, heavy top game", color: T.c.purple },
  { id: "leg_locker", emoji: "🦵", name: "Leg Locker", desc: "Heel hooks and leg entanglements", color: T.c.green },
  { id: "scrambler", emoji: "🌀", name: "Scrambler", desc: "Chaos, transitions, never stop moving", color: T.c.gold },
];

const POSITIONS = {
  standing: { name: "Standing", dominance: 5, emoji: "🧍" },
  clinch: { name: "Clinch", dominance: 5, emoji: "🤝" },
  closed_guard_bottom: { name: "Closed Guard", dominance: 5, emoji: "🛡️" },
  open_guard_bottom: { name: "Open Guard", dominance: 4, emoji: "🦶" },
  half_guard_top: { name: "Half Guard (Top)", dominance: 6, emoji: "½" },
  side_control_top: { name: "Side Control", dominance: 7, emoji: "⚡" },
  mount_top: { name: "Mount", dominance: 9, emoji: "👑" },
  back_control: { name: "Back Control", dominance: 10, emoji: "🎯" },
};

function getDom(d) {
  if (d >= 8) return { text: "DOMINANT", color: T.c.gold, icon: "👑" };
  if (d >= 6) return { text: "WINNING", color: T.c.green, icon: "▲" };
  if (d >= 4) return { text: "NEUTRAL", color: T.c.textSec, icon: "●" };
  if (d >= 2) return { text: "LOSING", color: T.c.amber, icon: "▼" };
  return { text: "DANGER", color: T.c.red, icon: "💀" };
}

const TUTORIAL_TURNS = [
  {
    posKey: "standing", yourGP: 10, oppGP: 10, chain: 0, p1: 0, p2: 0, turn: 1,
    tooltip: { title: "YOUR POSITION", text: "You're both standing — neutral ground. Your position determines what moves you can do and where you can go next." },
    conns: [{ posKey: "clinch", label: "Clinch", type: "advance", color: T.c.green }, { posKey: "closed_guard_bottom", label: "Pull Guard", type: "neutral", color: T.c.textSec }],
    moves: {
      advance: [{ name: "Double Leg Takedown", gp: 2, tier: "drilled", toLabel: "→ Side Control ⚡", id: "dbl" }, { name: "Single Leg", gp: 2, tier: "trained", toLabel: "→ Clinch 🤝", id: "sgl" }, { name: "Arm Drag to Back", gp: 2, tier: "known", toLabel: "→ Back Control 🎯", id: "drag" }],
      attack: [], escape: [{ name: "Guard Pull", gp: 1, tier: "trained", toLabel: "→ Closed Guard 🛡️", id: "pull" }],
    },
    opp: { name: "Guard Pull" }, result: { text: "You shot a double leg as they pulled guard — you land in side control!", sc: "+3" },
  },
  {
    posKey: "side_control_top", yourGP: 8, oppGP: 9, chain: 1, p1: 3, p2: 0, turn: 3,
    tooltip: { title: "GRIP POINTS", text: "You spent 2 GP on that takedown. GP is your gas tank — every move costs energy. Run out and you're stuck surviving." },
    conns: [{ posKey: "mount_top", label: "→ Mount", type: "advance", color: T.c.gold }, { posKey: "back_control", label: "→ Back Take", type: "advance", color: T.c.gold }, { posKey: "half_guard_top", label: "They recover", type: "retreat", color: T.c.amber }],
    moves: {
      advance: [{ name: "Mount Transition", gp: 1, tier: "drilled", toLabel: "→ Mount 👑", id: "mnt" }, { name: "Knee on Belly", gp: 1, tier: "trained", toLabel: "→ Stay + Points", id: "kob" }],
      attack: [{ name: "Americana", gp: 3, tier: "drilled", toLabel: "⚠️ SUBMISSION", id: "amsc" }, { name: "Kimura", gp: 3, tier: "known", toLabel: "⚠️ SUBMISSION", id: "kimsc" }],
      escape: [],
    },
    opp: { name: "Shrimp to Guard" }, result: { text: "You climbed to mount! Chain continues — your next move gets +10% bonus.", sc: "+4" },
  },
  {
    posKey: "mount_top", yourGP: 7, oppGP: 6, chain: 2, p1: 7, p2: 0, turn: 5,
    tooltip: { title: "CHAINS 🔥🔥", text: "Two moves advancing position — you're chaining! Each link makes your next move stronger. Time to hunt the finish." },
    conns: [{ posKey: "back_control", label: "→ Back Take", type: "advance", color: T.c.gold }, { posKey: "side_control_top", label: "They escape", type: "retreat", color: T.c.amber }],
    moves: {
      advance: [{ name: "S-Mount Transition", gp: 1, tier: "trained", toLabel: "→ S-Mount (setup)", id: "smnt" }, { name: "Back Take", gp: 2, tier: "known", toLabel: "→ Back Control 🎯", id: "bktk" }],
      attack: [{ name: "Americana", gp: 3, tier: "drilled", toLabel: "⚠️ SUBMISSION", id: "ammt" }, { name: "Arm Triangle", gp: 3, tier: "trained", toLabel: "⚠️ SUBMISSION", id: "armt" }, { name: "Armbar", gp: 3, tier: "known", toLabel: "⚠️ SUBMISSION", id: "armb" }],
      escape: [],
    },
    opp: { name: "Bridge Escape" }, result: null, triggersSub: true,
  },
];

// ─── PROTOTYPE CSS (scoped) ─────────────────────────────────────
const protoCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=JetBrains+Mono:wght@400;700&display=swap');
  .proto *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  .proto{font-family:'DM Sans','Segoe UI',sans-serif;-webkit-text-size-adjust:100%}
  .proto input{-webkit-appearance:none;-moz-appearance:none;appearance:none}
  @supports(height:100dvh){.proto .dvh-fix{min-height:100dvh!important}}
  @keyframes pFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pSlideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pScaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
  @keyframes pPulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes pFlipX{0%{transform:perspective(800px) rotateY(90deg);opacity:0}100%{transform:perspective(800px) rotateY(0);opacity:1}}
  @keyframes pBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  @keyframes pWidthGrow{from{width:0%}}
  @keyframes pCountPop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
  @keyframes pShake{0%,100%{transform:translateX(0)}10%{transform:translateX(-6px)}30%{transform:translateX(6px)}50%{transform:translateX(-5px)}70%{transform:translateX(5px)}90%{transform:translateX(-3px)}}
  @keyframes pRedPulse{0%{box-shadow:inset 0 0 60px rgba(230,57,70,.1)}50%{box-shadow:inset 0 0 100px rgba(230,57,70,.25)}100%{box-shadow:inset 0 0 60px rgba(230,57,70,.1)}}
  @keyframes pTapFlash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
`;

// ─── SHARED COMPONENTS ──────────────────────────────────────────
const Screen = ({ children, style }) => (
  <div style={{ width: "100%", maxWidth: 428, minHeight: "100vh", margin: "0 auto", background: `linear-gradient(180deg,${T.c.bg},#0B0B16)`, fontFamily: T.font.body, color: T.c.text, position: "relative", overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch", ...style }}>
    <div style={{ position: "fixed", inset: 0, opacity: 0.015, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h6v6H0z' fill='none' stroke='%23fff' stroke-width='.3'/%3E%3C/svg%3E\")", pointerEvents: "none" }} />
    <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", color, disabled, style, size = "md" }) => {
  const sz = { sm: [14, 10, 13], md: [24, 14, 15], lg: [32, 18, 17] }[size];
  const bg = color || T.c.red; const p = variant === "primary";
  return <button onClick={onClick} disabled={disabled} style={{ padding: `${sz[1]}px ${sz[0]}px`, fontSize: sz[2], fontFamily: T.font.body, fontWeight: 700, border: p ? "none" : `1.5px solid ${bg}55`, borderRadius: T.r.md, cursor: disabled ? "not-allowed" : "pointer", background: p ? `linear-gradient(135deg,${bg},${bg}CC)` : "transparent", color: p ? "#fff" : bg, opacity: disabled ? .3 : 1, transition: "all .25s cubic-bezier(.4,0,.2,1)", letterSpacing: .5, width: "100%", boxShadow: p && !disabled ? `0 4px 20px ${bg}33` : "none", ...style }}>{children}</button>;
};

const GPBar = ({ value, max = 10, label }) => {
  const pct = Math.max(0, (value / max) * 100);
  const color = value > 5 ? T.c.green : value > 2 ? T.c.amber : T.c.red;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 18, fontFamily: T.font.mono, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,.06)", borderRadius: T.r.full, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${color}AA,${color})`, borderRadius: T.r.full, transition: "all .8s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
};

const Tooltip = ({ title, text, onDismiss }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, animation: "pSlideDown .4s cubic-bezier(.16,1,.3,1) both" }}>
    <div style={{ margin: "12px 16px", padding: "18px 22px", background: "rgba(12,12,28,.92)", backdropFilter: "blur(16px)", border: `1px solid ${T.c.gold}33`, borderRadius: T.r.xl, boxShadow: `0 8px 40px rgba(0,0,0,.5)` }}>
      <div style={{ fontFamily: T.font.display, fontSize: 24, color: T.c.gold, letterSpacing: 3, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.c.text, lineHeight: 1.6, marginBottom: 14, opacity: .9 }}>{text}</div>
      <button onClick={onDismiss} style={{ background: `${T.c.gold}12`, border: `1px solid ${T.c.gold}33`, color: T.c.gold, padding: "8px 20px", borderRadius: T.r.full, cursor: "pointer", fontSize: 13, fontFamily: T.font.body, fontWeight: 600 }}>Got it</button>
    </div>
  </div>
);

const BottomNav = ({ active, onNav }) => (
  <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 0 16px", background: "rgba(8,8,18,.95)", borderTop: `1px solid ${T.c.border}`, position: "sticky", bottom: 0 }}>
    {[{ id: "home", icon: "🏠", label: "Home" }, { id: "deck", icon: "🃏", label: "Deck" }, { id: "lobby", icon: "🥋", label: "Lobby" }, { id: "profile", icon: "👤", label: "Profile" }].map(it => (
      <div key={it.id} onClick={() => onNav(it.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", opacity: active === it.id ? 1 : .4, transition: "opacity .2s" }}>
        <span style={{ fontSize: 18 }}>{it.icon}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: active === it.id ? T.c.gold : T.c.textMut }}>{it.label}</span>
      </div>
    ))}
  </div>
);

const PositionMap = ({ posKey, conns }) => {
  const p = POSITIONS[posKey]; const d = getDom(p.dominance);
  return (
    <div style={{ padding: "0 16px", animation: "pFadeUp .5s cubic-bezier(.16,1,.3,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 8, background: `linear-gradient(135deg,${d.color}08,${d.color}03)`, border: `1.5px solid ${d.color}25`, borderRadius: T.r.md }}>
        <div style={{ fontSize: 28 }}>{p.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.font.display, fontSize: 22, letterSpacing: 2 }}>{p.name.toUpperCase()}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 12 }}>{d.icon}</span>
            <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: d.color, letterSpacing: 1 }}>{d.text}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
        {conns.map((c, i) => { const cp = POSITIONS[c.posKey]; return (
          <div key={i} style={{ flex: "0 0 auto", minWidth: 88, padding: "7px 10px", textAlign: "center", background: T.c.surface, border: `1px solid ${c.color}22`, borderRadius: T.r.sm, animation: `pScaleIn .3s cubic-bezier(.16,1,.3,1) ${.1+i*.08}s both` }}>
            <div style={{ fontSize: 7, fontFamily: T.font.mono, color: c.color, letterSpacing: 1, marginBottom: 2, fontWeight: 700 }}>{c.type==="advance"?"▲ ADVANCE":c.type==="retreat"?"▼ RETREAT":"● LATERAL"}</div>
            <div style={{ fontSize: 15, marginBottom: 1 }}>{cp?.emoji||"?"}</div>
            <div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2 }}>{c.label}</div>
          </div>
        );})}
      </div>
    </div>
  );
};

const MGRP = { advance: { title: "ADVANCE POSITION", icon: "▲", color: T.c.green, desc: "Move to a better position" }, attack: { title: "ATTACK", icon: "⚠️", color: T.c.red, desc: "Go for the finish" }, escape: { title: "ESCAPE / RECOVER", icon: "↩", color: T.c.blue, desc: "Get to safety" } };

const MoveCard = ({ m, sel, onClick, delay = 0 }) => {
  const tc = m.tier==="drilled"?T.c.gold:m.tier==="trained"?T.c.text:T.c.textMut;
  const tl = m.tier==="drilled"?"★ DRILLED":m.tier==="trained"?"─ TRAINED":"░ KNOWN";
  const gp = m.tier==="drilled"?m.gp-1:m.gp; const isSub = m.toLabel?.includes("SUBMISSION");
  return (
    <div onClick={onClick} style={{ padding: "10px 12px", cursor: "pointer", background: sel?`${T.c.gold}0C`:T.c.surface, border: `1.5px solid ${sel?T.c.gold:T.c.border}`, borderRadius: T.r.md, transition: "all .25s cubic-bezier(.4,0,.2,1)", boxShadow: sel?`0 0 20px ${T.c.gold}15`:"none", animation: `pFadeUp .35s cubic-bezier(.16,1,.3,1) ${delay}s both` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{m.name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {m.tier==="drilled"&&<span style={{ fontSize: 11, color: T.c.textMut, textDecoration: "line-through", fontFamily: T.font.mono }}>{m.gp}</span>}
          <span style={{ fontFamily: T.font.mono, fontWeight: 700, fontSize: 15, color: tc }}>{gp}</span>
          <span style={{ fontFamily: T.font.mono, fontSize: 10, color: T.c.textMut }}>GP</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isSub?T.c.red:T.c.green }}>{m.toLabel}</span>
        <span style={{ fontFamily: T.font.mono, fontSize: 10, color: tc, letterSpacing: .5 }}>{tl}</span>
      </div>
    </div>
  );
};

const MoveGroup = ({ gk, moves, selId, onSelect, bd = 0 }) => {
  if (!moves?.length) return null; const cfg = MGRP[gk];
  return (
    <div style={{ marginBottom: 14, animation: `pFadeUp .4s cubic-bezier(.16,1,.3,1) ${bd}s both` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingLeft: 2 }}>
        <span style={{ fontSize: 13 }}>{cfg.icon}</span>
        <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: 1.5 }}>{cfg.title}</span>
        <span style={{ fontSize: 10, color: T.c.textMut }}>— {cfg.desc}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {moves.map((m, i) => <MoveCard key={m.id} m={m} sel={selId===m.id} onClick={() => onSelect(m)} delay={bd+.05+i*.06} />)}
      </div>
    </div>
  );
};

// ─── SUB MINIGAME ───────────────────────────────────────────────
function SubMinigame({ subName, playerName, onFinish }) {
  const [phase, setPhase] = useState("intro");
  const [round, setRound] = useState(0);
  const [esc, setEsc] = useState(65);
  const [fin, setFin] = useState(35);
  const [pick, setPick] = useState(null);

  useEffect(() => { if (phase==="intro") { const t=setTimeout(()=>setPhase("tooltip"),1800); return ()=>clearTimeout(t); } }, [phase]);

  const choices = [
    { id: "squeeze", label: "SQUEEZE", icon: "💪", desc: "All-in! Higher finish chance, but lose position if they escape.", color: T.c.red, boost: 20, risk: "HIGH RISK" },
    { id: "chain", label: "CHAIN", icon: "🔗", desc: "Adjust grip. Lower finish chance, keep position on escape.", color: T.c.amber, boost: 8, risk: "SAFE PLAY" },
  ];

  const doPick = (ch) => { setPick(ch.id); setTimeout(() => { setFin(f=>f+ch.boost); setEsc(e=>Math.max(10,e-ch.boost)); setPhase(`r${round+1}res`); }, 600); };
  const next = () => { if (round>=2){setPhase("finish");setTimeout(onFinish,2500)} else{setRound(r=>r+1);setPick(null);setPhase(`r${round+2}`)} };

  const Board = () => (
    <div>
      <div style={{ textAlign: "center", paddingTop: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: T.font.display, fontSize: 15, letterSpacing: 3, color: T.c.red }}>SUBMISSION LOCKED IN</div>
        <div style={{ fontFamily: T.font.display, fontSize: 24, letterSpacing: 2, marginTop: 2 }}>{subName.toUpperCase()}</div>
      </div>
      {[{ label: "💪 FINISH", val: fin, color: T.c.red }, { label: "🛡️ ESCAPE", val: esc, color: T.c.blue }].map((b, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "0 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontFamily: T.font.mono, fontSize: 10, color: b.color, fontWeight: 700 }}>{b.label}</span>
            <span style={{ fontFamily: T.font.mono, fontSize: 14, color: b.color, fontWeight: 700 }}>{b.val}%</span>
          </div>
          <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,.06)", borderRadius: T.r.full, overflow: "hidden" }}>
            <div style={{ width: `${b.val}%`, height: "100%", background: `linear-gradient(90deg,${b.color}88,${b.color})`, borderRadius: T.r.full, transition: "width .8s cubic-bezier(.4,0,.2,1)", boxShadow: i===0?`0 0 12px ${b.color}40`:"none" }} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {[1,2,3].map(r=><div key={r} style={{ width: 28, height: 28, borderRadius: T.r.full, display: "flex", alignItems: "center", justifyContent: "center", background: r<=round?`${T.c.red}20`:T.c.surface, border: `1.5px solid ${r<=round?T.c.red+"55":T.c.border}`, fontFamily: T.font.mono, fontSize: 12, fontWeight: 700, color: r<=round?T.c.red:T.c.textMut }}>{r}</div>)}
      </div>
    </div>
  );

  return (
    <Screen>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,transparent 30%,rgba(230,57,70,.12) 100%)", animation: "pRedPulse 3s ease infinite", pointerEvents: "none" }} />
      {phase==="intro"&&<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32 }}>
        <div style={{ animation: "pShake .5s ease both" }}><div style={{ fontFamily: T.font.display, fontSize: 20, letterSpacing: 4, color: T.c.red, textAlign: "center" }}>SUBMISSION ATTEMPT</div></div>
        <div style={{ fontFamily: T.font.display, fontSize: 48, letterSpacing: 3, textAlign: "center", marginTop: 12, animation: "pCountPop .6s cubic-bezier(.16,1,.3,1) .3s both" }}>{subName.toUpperCase()}</div>
        <div style={{ fontFamily: T.font.mono, fontSize: 13, color: T.c.textSec, marginTop: 16, animation: "pFadeIn 1s ease .8s both" }}>{playerName} → Coach Bot</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, animation: "pFadeIn 1s ease 1s both" }}>
          <span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.c.gold }}>FROM MOUNT 👑</span><span style={{ color: T.c.textMut }}>•</span><span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.c.amber }}>CHAIN 🔥🔥🔥</span>
        </div>
      </div>}
      {phase==="tooltip"&&<div style={{ position: "relative", minHeight: "100vh" }}>
        <Tooltip title="SUBMISSION MINIGAME" text="You've locked in a submission! Choose SQUEEZE (high risk, high reward) or CHAIN (safe, keep position). Three rounds — if they don't escape, they tap!" onDismiss={()=>{setRound(1);setPhase("r1")}} />
        <div style={{ padding: "80px 20px", opacity: .3 }}><Board /></div>
      </div>}
      {phase.match(/^r\d$/)&&<div style={{ minHeight: "100dvh", padding: "16px 16px", animation: "pFadeUp .4s cubic-bezier(.16,1,.3,1) both" }}>
        <Board />
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.c.textMut, letterSpacing: 2, marginBottom: 10 }}>YOUR MOVE — ROUND {round}/3</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {choices.map((ch,i)=><div key={ch.id} onClick={()=>!pick&&doPick(ch)} style={{ padding: "12px 14px", cursor: pick?"default":"pointer", background: pick===ch.id?`${ch.color}12`:T.c.surface, border: `1.5px solid ${pick===ch.id?ch.color+"55":T.c.border}`, borderRadius: T.r.md, transition: "all .25s", opacity: pick&&pick!==ch.id?.3:1, animation: `pScaleIn .3s cubic-bezier(.16,1,.3,1) ${i*.1}s both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{ch.icon}</span>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15, color: ch.color }}>{ch.label}</div><span style={{ fontFamily: T.font.mono, fontSize: 9, color: T.c.textMut }}>{ch.risk}</span></div>
                <div style={{ textAlign: "right" }}><div style={{ fontFamily: T.font.mono, fontSize: 13, color: ch.color }}>+{ch.boost}%</div><div style={{ fontSize: 9, color: T.c.textMut }}>finish</div></div>
              </div>
              <div style={{ fontSize: 11, color: T.c.textSec, lineHeight: 1.3, marginTop: 4 }}>{ch.desc}</div>
            </div>)}
          </div>
        </div>
      </div>}
      {phase.includes("res")&&<div style={{ minHeight: "100dvh", padding: "16px 16px", animation: "pFadeUp .3s ease both" }}>
        <Board />
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", background: `${T.c.red}10`, border: `1px solid ${T.c.red}33`, borderRadius: T.r.md, animation: "pFlipX .4s ease both" }}><div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.c.red, letterSpacing: 1.5, marginBottom: 4 }}>YOU</div><div style={{ fontSize: 20 }}>{pick==="squeeze"?"💪":"🔗"}</div><div style={{ fontSize: 11, fontWeight: 700, color: T.c.red }}>{pick==="squeeze"?"SQUEEZE":"CHAIN"}</div></div>
            <div style={{ display: "flex", alignItems: "center", fontFamily: T.font.display, fontSize: 20, color: T.c.textMut }}>VS</div>
            <div style={{ padding: "12px 16px", background: `${T.c.blue}10`, border: `1px solid ${T.c.blue}33`, borderRadius: T.r.md, animation: "pFlipX .4s ease .3s both" }}><div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.c.blue, letterSpacing: 1.5, marginBottom: 4 }}>OPP</div><div style={{ fontSize: 20 }}>😤</div><div style={{ fontSize: 11, fontWeight: 700, color: T.c.blue }}>SURVIVE</div></div>
          </div>
          <div style={{ padding: "14px 20px", background: `${T.c.amber}08`, border: `1px solid ${T.c.amber}22`, borderRadius: T.r.md, marginBottom: 16, animation: "pFadeUp .4s ease .6s both" }}>
            <div style={{ fontSize: 14 }}>{pick==="squeeze"?"You cranked it! Finish chance surging...":"Steady grip adjustment. Pressure building..."}</div>
            <div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.c.amber, marginTop: 6 }}>Finish: {fin}% • Escape: {esc}% • {3-round} round{3-round!==1?"s":""} left</div>
          </div>
          <Btn onClick={next} color={round>=2?T.c.red:T.c.gold}>{round>=2?"💀 Final Check...":"Continue → Round "+(round+1)}</Btn>
        </div>
      </div>}
      {phase==="finish"&&<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32 }}>
        <div style={{ position: "absolute", inset: 0, background: T.c.red, animation: "pTapFlash 1.5s ease both", pointerEvents: "none" }} />
        <div style={{ fontSize: 100, animation: "pCountPop .5s cubic-bezier(.16,1,.3,1) .3s both" }}>🏆</div>
        <div style={{ fontFamily: T.font.display, fontSize: 72, letterSpacing: 6, color: T.c.red, animation: "pCountPop .6s cubic-bezier(.16,1,.3,1) .5s both" }}>TAP!</div>
        <div style={{ fontFamily: T.font.display, fontSize: 22, letterSpacing: 3, color: T.c.gold, marginTop: 8, animation: "pFadeUp .5s ease .8s both" }}>{subName.toUpperCase()}</div>
        <div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.c.textSec, marginTop: 8, animation: "pFadeUp .5s ease 1s both" }}>from Mount • Chain bonus: 🔥🔥🔥</div>
      </div>}
    </Screen>
  );
}

// ─── AUTH ────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  return (
    <Screen><div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 32 }}>
      <div style={{ animation: "pFadeUp .7s cubic-bezier(.16,1,.3,1) both" }}><div style={{ fontFamily: T.font.display, fontSize: 80, letterSpacing: 8, textAlign: "center", lineHeight: .85 }}>OPEN</div><div style={{ fontFamily: T.font.display, fontSize: 80, letterSpacing: 8, color: T.c.red, textAlign: "center", lineHeight: .85 }}>MAT</div></div>
      <div style={{ color: T.c.textMut, fontSize: 13, marginTop: 16, marginBottom: 56, animation: "pFadeIn 1s ease .4s both", letterSpacing: 4, textTransform: "uppercase" }}>A BJJ Strategy Game</div>
      <div style={{ width: "100%", maxWidth: 280, display: "flex", flexDirection: "column", gap: 10, animation: "pFadeUp .6s ease .5s both" }}>
        <input placeholder="Email" style={{ width: "100%", padding: "14px 16px", background: T.c.surface, border: `1.5px solid ${T.c.border}`, borderRadius: T.r.md, color: T.c.text, fontSize: 15, fontFamily: T.font.body, outline: "none" }} />
        <input placeholder="Password" type="password" style={{ width: "100%", padding: "14px 16px", background: T.c.surface, border: `1.5px solid ${T.c.border}`, borderRadius: T.r.md, color: T.c.text, fontSize: 15, fontFamily: T.font.body, outline: "none" }} />
        <div style={{ marginTop: 8 }}><Btn onClick={onAuth}>Sign Up</Btn></div>
        <button onClick={onAuth} style={{ background: "none", border: "none", color: T.c.textMut, fontSize: 13, cursor: "pointer", fontFamily: T.font.body, padding: 8 }}>Have an account? <span style={{ color: T.c.gold }}>Log in</span></button>
      </div>
    </div></Screen>
  );
}

// ─── ONBOARD ────────────────────────────────────────────────────
function OnboardScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [arch, setArch] = useState(null);
  if (step === 0) return (
    <Screen><div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "80px 24px 40px" }}>
      <div style={{ animation: "pFadeUp .5s cubic-bezier(.16,1,.3,1) both" }}><div style={{ fontFamily: T.font.display, fontSize: 38, letterSpacing: 3, lineHeight: 1.1 }}>WHAT DO THEY</div><div style={{ fontFamily: T.font.display, fontSize: 38, letterSpacing: 3, color: T.c.gold, lineHeight: 1.1 }}>CALL YOU?</div><div style={{ fontSize: 13, color: T.c.textMut, marginTop: 8 }}>Your display name on the mat</div></div>
      <div style={{ marginTop: 36, animation: "pFadeUp .5s ease .2s both" }}><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Austin, Professor Death" style={{ width: "100%", padding: "16px 18px", background: T.c.surface, border: `1.5px solid ${name?T.c.gold+"66":T.c.border}`, borderRadius: T.r.md, color: T.c.text, fontSize: 18, fontFamily: T.font.body, outline: "none", transition: "border .3s" }} /></div>
      <div style={{ flex: 1 }} /><Btn onClick={()=>setStep(1)} disabled={!name.trim()} color={T.c.gold}>Continue</Btn>
    </div></Screen>
  );
  return (
    <Screen><div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "52px 20px 36px" }}>
      <div style={{ animation: "pFadeUp .4s cubic-bezier(.16,1,.3,1) both", marginBottom: 20 }}><div style={{ fontFamily: T.font.display, fontSize: 38, letterSpacing: 3, lineHeight: 1.1 }}>HOW DO YOU</div><div style={{ fontFamily: T.font.display, fontSize: 38, letterSpacing: 3, color: T.c.gold, lineHeight: 1.1 }}>ROLL?</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {ARCHETYPES.map((a,i)=><div key={a.id} onClick={()=>setArch(a.id)} style={{ background: arch===a.id?`${a.color}0A`:T.c.surface, border: `1.5px solid ${arch===a.id?a.color+"55":T.c.border}`, borderRadius: T.r.lg, padding: "16px 14px", cursor: "pointer", transition: "all .25s", boxShadow: arch===a.id?`0 0 24px ${a.color}15`:"none", animation: `pScaleIn .35s cubic-bezier(.16,1,.3,1) ${.08+i*.05}s both` }}><div style={{ fontSize: 30, marginBottom: 6 }}>{a.emoji}</div><div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{a.name}</div><div style={{ fontSize: 11, color: T.c.textSec, lineHeight: 1.3 }}>{a.desc}</div></div>)}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ textAlign: "center", color: T.c.textMut, fontSize: 12, marginBottom: 12 }}>Everyone starts at <span style={{ color: T.c.beltWhite, fontWeight: 700 }}>white belt</span>. Earn your stripes.</div>
      <Btn onClick={()=>onComplete(name,arch)} disabled={!arch} color={T.c.gold}>Start Rolling</Btn>
    </div></Screen>
  );
}

// ─── TUTORIAL ───────────────────────────────────────────────────
function TutorialMatch({ playerName, archetype, onComplete }) {
  const [ti, setTi] = useState(0); const [phase, setPhase] = useState("tooltip"); const [stance, setStance] = useState(null); const [sel, setSel] = useState(null);
  const t = TUTORIAL_TURNS[ti]; const isLast = ti===TUTORIAL_TURNS.length-1;
  const stances = [{id:"attack",icon:"⚔️",label:"ATTACK",color:T.c.red,desc:"−1 GP • Enables offense"},{id:"defend",icon:"🛡️",label:"DEFEND",color:T.c.textSec,desc:"Free • Counter ops"},{id:"setup",icon:"⚙️",label:"SETUP",color:T.c.blue,desc:"+2 GP • Recovery"}];
  if (phase==="sub") return <SubMinigame subName={sel?.name||"Americana"} playerName={playerName} onFinish={onComplete} />;
  const lockIn = () => { setPhase("reveal"); setTimeout(()=>{ if(isLast&&t.triggersSub&&sel?.toLabel?.includes("SUBMISSION"))setPhase("sub"); else if(!isLast){setStance(null);setSel(null);setTi(ti+1);setPhase("tooltip")} else onComplete(); },3000); };
  return (
    <Screen>
      {phase==="tooltip"&&<Tooltip title={t.tooltip.title} text={t.tooltip.text} onDismiss={()=>setPhase("stance")} />}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px 0" }}><span style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, letterSpacing: 1.5 }}>TURN {t.turn}</span><span style={{ fontFamily: T.font.mono, fontSize: 11 }}><span style={{ color: T.c.gold }}>{playerName}</span><span style={{ color: T.c.textMut }}> {t.p1}–{t.p2} </span><span style={{ color: T.c.blue }}>Coach Bot</span></span></div>
      <div style={{ marginTop: 8 }}><PositionMap posKey={t.posKey} conns={t.conns} /></div>
      <div style={{ display: "flex", gap: 12, padding: "8px 16px" }}>
        <GPBar value={t.yourGP} label="YOUR GP" />
        {t.chain>0&&<div style={{ textAlign: "center", minWidth: 40, paddingTop: 2 }}><div style={{ fontSize: 8, fontFamily: T.font.mono, color: T.c.textMut, letterSpacing: 1, marginBottom: 1 }}>CHAIN</div><div style={{ fontSize: 16, animation: "pBreathe 2s ease infinite" }}>{"🔥".repeat(t.chain)}</div></div>}
        <GPBar value={t.oppGP} label="OPP GP" />
      </div>
      <div style={{ padding: "2px 16px 24px" }}>
        {phase==="stance"&&<div style={{ animation: "pFadeUp .4s cubic-bezier(.16,1,.3,1) both" }}><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 8, letterSpacing: 2 }}>CHOOSE YOUR APPROACH</div><div style={{ display: "flex", gap: 6 }}>{stances.map((s,i)=><div key={s.id} onClick={()=>{setStance(s.id);setTimeout(()=>setPhase("moves"),350)}} style={{ flex: 1, padding: "14px 6px", textAlign: "center", cursor: "pointer", background: stance===s.id?`${s.color}10`:T.c.surface, border: `1.5px solid ${stance===s.id?s.color+"44":T.c.border}`, borderRadius: T.r.md, transition: "all .25s", animation: `pScaleIn .3s cubic-bezier(.16,1,.3,1) ${i*.08}s both` }}><div style={{ fontSize: 24, marginBottom: 3 }}>{s.icon}</div><div style={{ fontWeight: 700, fontSize: 11, color: s.color, letterSpacing: 1 }}>{s.label}</div><div style={{ fontSize: 9, color: T.c.textMut, marginTop: 3 }}>{s.desc}</div></div>)}</div></div>}
        {phase==="moves"&&<div><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 12, letterSpacing: 2 }}>PICK YOUR MOVE</div><MoveGroup gk="advance" moves={t.moves.advance} selId={sel?.id} onSelect={setSel} bd={0} /><MoveGroup gk="attack" moves={t.moves.attack} selId={sel?.id} onSelect={setSel} bd={.15} /><MoveGroup gk="escape" moves={t.moves.escape} selId={sel?.id} onSelect={setSel} bd={.25} /><div style={{ marginTop: 14, animation: "pFadeUp .4s ease .4s both" }}><Btn onClick={lockIn} disabled={!sel} color={T.c.gold}>Lock In Move</Btn></div></div>}
        {phase==="reveal"&&t.result&&<div style={{ textAlign: "center", paddingTop: 16 }}><div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}><div style={{ flex: "0 0 155px", padding: "16px 14px", textAlign: "center", background: `${T.c.red}08`, border: `1.5px solid ${T.c.red}33`, borderRadius: T.r.lg, animation: "pFlipX .5s cubic-bezier(.16,1,.3,1) both" }}><div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.c.red, letterSpacing: 2, marginBottom: 6 }}>YOUR MOVE</div><div style={{ fontWeight: 700, fontSize: 14 }}>{sel?.name}</div><div style={{ fontSize: 11, color: T.c.green, marginTop: 4 }}>{sel?.toLabel}</div></div><div style={{ flex: "0 0 155px", padding: "16px 14px", textAlign: "center", background: `${T.c.blue}08`, border: `1.5px solid ${T.c.blue}33`, borderRadius: T.r.lg, animation: "pFlipX .5s cubic-bezier(.16,1,.3,1) .4s both" }}><div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.c.blue, letterSpacing: 2, marginBottom: 6 }}>OPP MOVE</div><div style={{ fontWeight: 700, fontSize: 14 }}>{t.opp.name}</div></div></div><div style={{ padding: "16px 20px", background: `${T.c.green}08`, border: `1px solid ${T.c.green}22`, borderRadius: T.r.lg, animation: "pFadeUp .5s ease 1s both" }}><div style={{ fontSize: 14, lineHeight: 1.5 }}>{t.result.text}</div><div style={{ fontFamily: T.font.display, fontSize: 28, letterSpacing: 2, marginTop: 8, color: T.c.gold, animation: "pCountPop .4s ease 1.3s both" }}>{t.result.sc}</div></div></div>}
        {phase==="reveal"&&!t.result&&<div style={{ textAlign: "center", paddingTop: 40, animation: "pFadeIn .5s ease both" }}><div style={{ fontSize: 40, marginBottom: 8, animation: "pBreathe 1.5s ease infinite" }}>⚔️</div><div style={{ fontFamily: T.font.display, fontSize: 24, letterSpacing: 3, color: T.c.red }}>SUBMISSION ATTEMPT!</div><div style={{ fontFamily: T.font.mono, fontSize: 13, color: T.c.textSec, marginTop: 8 }}>{sel?.name} from Mount...</div><div style={{ fontSize: 12, color: T.c.textMut, marginTop: 12, animation: "pPulse 1s ease infinite" }}>Entering sub minigame...</div></div>}
      </div>
    </Screen>
  );
}

// ─── POST-TUTORIAL ──────────────────────────────────────────────
function PostTutorial({ playerName, onContinue }) {
  return (
    <Screen><div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "52px 24px 36px" }}>
      <div style={{ textAlign: "center", animation: "pFadeUp .6s cubic-bezier(.16,1,.3,1) both" }}><div style={{ fontFamily: T.font.display, fontSize: 44, letterSpacing: 4, color: T.c.gold }}>WELCOME TO</div><div style={{ fontFamily: T.font.display, fontSize: 44, letterSpacing: 4 }}>OPEN MAT</div></div>
      <div style={{ textAlign: "center", margin: "20px 0", animation: "pFadeUp .5s ease .2s both" }}><div style={{ fontSize: 14, color: T.c.textSec }}>Great first roll, {playerName}!</div><div style={{ fontFamily: T.font.display, fontSize: 36, color: T.c.red, marginTop: 8 }}>SUBMISSION WIN</div><div style={{ fontFamily: T.font.mono, fontSize: 13, color: T.c.textMut, marginTop: 4 }}>Americana from Mount • Elo: 1200 → <span style={{ color: T.c.green }}>1205</span></div></div>
      <div style={{ background: T.c.surface, borderRadius: T.r.lg, padding: 18, margin: "12px 0", border: `1px solid ${T.c.border}`, animation: "pFadeUp .5s ease .3s both" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Belt Progress</span><span style={{ fontSize: 12, fontWeight: 700 }}>⬜ White → 🟦 Blue</span></div><div style={{ width: "100%", height: 5, background: "rgba(255,255,255,.06)", borderRadius: T.r.full }}><div style={{ width: "10%", height: "100%", background: T.c.beltBlue, borderRadius: T.r.full, animation: "pWidthGrow 1.2s cubic-bezier(.16,1,.3,1) .8s both" }} /></div><div style={{ fontSize: 11, color: T.c.textMut, marginTop: 6 }}>1/5 wins • 1/10 matches • 1/2 subs toward Blue Belt</div></div>
      {[{icon:"🏠",t:"Your Home",d:"Track stats, Elo, and belt progress"},{icon:"🃏",t:"Your Deck",d:"Customize your move set"},{icon:"🥋",t:"The Lobby",d:"Challenge bots or other players"}].map((item,i)=><div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: T.c.surface, border: `1px solid ${T.c.border}`, borderRadius: T.r.md, marginBottom: 8, animation: `pFadeUp .35s cubic-bezier(.16,1,.3,1) ${.5+i*.1}s both` }}><span style={{ fontSize: 26 }}>{item.icon}</span><div><div style={{ fontWeight: 700, fontSize: 14 }}>{item.t}</div><div style={{ fontSize: 12, color: T.c.textSec }}>{item.d}</div></div></div>)}
      <div style={{ flex: 1 }} /><Btn onClick={onContinue} color={T.c.gold}>Let's Go</Btn>
    </div></Screen>
  );
}

// ─── HOME ───────────────────────────────────────────────────────
function HomeScreen({ playerName, archetype, onNav }) {
  const a = ARCHETYPES.find(x=>x.id===archetype)||ARCHETYPES[0];
  return (
    <Screen><div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px" }}><span style={{ fontWeight: 700, fontSize: 16 }}>{playerName}</span><span style={{ fontSize: 18, opacity: .4 }}>⚙️</span></div>
      <div style={{ margin: "4px 20px 16px", padding: "24px 20px", textAlign: "center", background: `linear-gradient(145deg,${a.color}06,transparent)`, border: `1px solid ${a.color}20`, borderRadius: T.r.xl, animation: "pFadeUp .5s cubic-bezier(.16,1,.3,1) both" }}><div style={{ fontSize: 44, marginBottom: 4 }}>{a.emoji}</div><div style={{ fontFamily: T.font.display, fontSize: 15, letterSpacing: 4, color: a.color }}>{a.name.toUpperCase()}</div><div style={{ fontFamily: T.font.display, fontSize: 64, letterSpacing: 2, lineHeight: 1, marginTop: 4 }}>1205</div><div style={{ fontSize: 11, color: T.c.textMut, marginTop: 4 }}>Elo • ⬜ White Belt • 1W-0L</div></div>
      <div style={{ padding: "0 20px" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 11, color: T.c.textSec }}>→ Blue Belt</span><span style={{ fontSize: 11, fontFamily: T.font.mono, color: T.c.textMut }}>10%</span></div><div style={{ width: "100%", height: 4, background: "rgba(255,255,255,.06)", borderRadius: T.r.full }}><div style={{ width: "10%", height: "100%", background: T.c.beltBlue, borderRadius: T.r.full }} /></div></div>
      <div style={{ padding: "20px 20px" }}><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 8, letterSpacing: 2 }}>RECENT</div><div style={{ display: "flex", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: T.r.full, background: T.c.green }} />{[1,2,3,4].map(i=><div key={i} style={{ width: 10, height: 10, borderRadius: T.r.full, background: "rgba(255,255,255,.06)" }} />)}</div></div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "0 20px 16px", display: "flex", gap: 10 }}><div style={{ flex: 1 }}><Btn onClick={()=>onNav("lobby")} color={T.c.gold}>Solo Training</Btn></div><div style={{ flex: 1 }}><Btn onClick={()=>onNav("lobby")} variant="outline" color={T.c.blue}>Find Match</Btn></div></div>
      <BottomNav active="home" onNav={onNav} />
    </div></Screen>
  );
}

// ─── LOBBY ──────────────────────────────────────────────────────
function LobbyScreen({ onNav }) {
  const bots = [{name:"Marcelo",arch:"Sub Hunter",emoji:"🎯",elo:1200,flavor:"Always hunting the tap",color:T.c.red},{name:"Buchecha",arch:"Pressure Passer",emoji:"⚙️",elo:1150,flavor:"Heavy top game grinder",color:T.c.purple},{name:"Ruotolo",arch:"Scrambler",emoji:"🌀",elo:1300,flavor:"Pure chaos, never stops",color:T.c.gold},{name:"Gordon",arch:"Leg Locker",emoji:"🦵",elo:1350,flavor:"Leg lock wizard",color:T.c.green},{name:"Miyao",arch:"Guard Puller",emoji:"🛡️",elo:1100,flavor:"Berimbolo everything",color:T.c.blue},{name:"Iron Mike",arch:"Wrestler",emoji:"🤼",elo:1250,flavor:"Takedown machine",color:T.c.amber}];
  return (
    <Screen><div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px" }}><div style={{ fontFamily: T.font.display, fontSize: 28, letterSpacing: 3 }}>THE LOBBY</div></div>
      <div style={{ padding: "0 20px" }}><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 12, letterSpacing: 2 }}>SOLO TRAINING — CHALLENGE A BOT</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{bots.map((b,i)=><div key={i} style={{ background: T.c.surface, border: `1px solid ${T.c.border}`, borderRadius: T.r.lg, padding: "16px 14px", cursor: "pointer", animation: `pScaleIn .3s cubic-bezier(.16,1,.3,1) ${i*.05}s both` }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 28 }}>{b.emoji}</span><span style={{ fontFamily: T.font.mono, fontSize: 11, color: T.c.textMut }}>{b.elo}</span></div><div style={{ fontWeight: 700, fontSize: 15, marginTop: 6, marginBottom: 2 }}>{b.name}</div><div style={{ fontFamily: T.font.mono, fontSize: 10, color: b.color, letterSpacing: .5 }}>{b.arch}</div><div style={{ fontSize: 11, color: T.c.textMut, fontStyle: "italic", marginTop: 6, lineHeight: 1.3 }}>{b.flavor}</div><div style={{ marginTop: 10 }}><Btn size="sm" color={b.color}>Challenge</Btn></div></div>)}</div>
      </div>
      <div style={{ padding: "24px 20px" }}><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 12, letterSpacing: 2 }}>ONLINE OPPONENTS</div><div style={{ textAlign: "center", padding: 32, color: T.c.textMut, fontSize: 13, background: T.c.surface, borderRadius: T.r.lg, border: `1px dashed ${T.c.border}` }}>Multiplayer matchmaking coming soon</div></div>
      <div style={{ flex: 1 }} /><BottomNav active="lobby" onNav={onNav} />
    </div></Screen>
  );
}

// ─── DECK ───────────────────────────────────────────────────────
function DeckScreen({ onNav }) {
  const [tab, setTab] = useState("deck");
  const deck = [{name:"Double Leg Takedown",type:"TD",gp:2,tier:"drilled",pos:"Standing"},{name:"Single Leg",type:"TD",gp:2,tier:"trained",pos:"Standing"},{name:"Arm Drag to Back",type:"Trans",gp:2,tier:"known",pos:"Standing"},{name:"Guard Pull",type:"Trans",gp:1,tier:"trained",pos:"Standing"},{name:"Mount Transition",type:"Trans",gp:1,tier:"drilled",pos:"Side Control"},{name:"Knee on Belly",type:"Trans",gp:1,tier:"trained",pos:"Side Control"},{name:"Americana",type:"Sub",gp:3,tier:"drilled",pos:"Mount / SC"},{name:"Kimura",type:"Sub",gp:3,tier:"known",pos:"Side Control"},{name:"Arm Triangle",type:"Sub",gp:3,tier:"trained",pos:"Mount"},{name:"Armbar",type:"Sub",gp:3,tier:"known",pos:"Mount / Guard"},{name:"S-Mount Transition",type:"Trans",gp:1,tier:"trained",pos:"Mount"},{name:"Back Take",type:"Trans",gp:2,tier:"known",pos:"Mount"},{name:"Elbow Escape",type:"Escape",gp:1,tier:"trained",pos:"Mount Bot"},{name:"Shrimp to Guard",type:"Escape",gp:1,tier:"trained",pos:"SC Bot"},{name:"Bridge Escape",type:"Escape",gp:1,tier:"known",pos:"Mount Bot"}];
  const tc = {Sub:T.c.red,Trans:T.c.blue,TD:T.c.green,Escape:T.c.blue}; const ti = {drilled:"★",trained:"─",known:"░"}; const tcolor = {drilled:T.c.gold,trained:T.c.text,known:T.c.textMut};
  const stats = {subs:deck.filter(d=>d.type==="Sub").length,esc:deck.filter(d=>d.type==="Escape").length,pos:deck.filter(d=>["Trans","TD"].includes(d.type)).length};
  return (
    <Screen><div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px" }}><div style={{ fontFamily: T.font.display, fontSize: 28, letterSpacing: 3 }}>YOUR DECK</div></div>
      <div style={{ display: "flex", padding: "0 20px" }}>{["deck","library"].map(t=><div key={t} onClick={()=>setTab(t)} style={{ flex: 1, padding: "10px 0", textAlign: "center", cursor: "pointer", borderBottom: `2px solid ${tab===t?T.c.gold:"transparent"}`, color: tab===t?T.c.gold:T.c.textMut, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{t==="deck"?"My Deck":"Library"}</div>)}</div>
      <div style={{ display: "flex", gap: 12, padding: "14px 20px" }}>{[{l:"Total",v:`${deck.length}/25`},{l:"Subs",v:`${stats.subs}/2 ✓`,ok:1},{l:"Escapes",v:`${stats.esc}/2 ✓`,ok:1},{l:"Positional",v:`${stats.pos}/3 ✓`,ok:1}].map((s,i)=><div key={i} style={{ textAlign: "center", flex: 1 }}><div style={{ fontSize: 10, color: T.c.textMut, marginBottom: 2 }}>{s.l}</div><div style={{ fontFamily: T.font.mono, fontSize: 13, fontWeight: 700, color: s.ok?T.c.green:T.c.text }}>{s.v}</div></div>)}</div>
      {tab==="deck"?<div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 4 }}>{deck.map((d,i)=><div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: T.c.surface, borderRadius: T.r.sm, animation: `pFadeUp .2s ease ${i*.02}s both` }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: T.font.mono, color: tcolor[d.tier], fontSize: 14, width: 14, textAlign: "center" }}>{ti[d.tier]}</span><div><div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div><div style={{ fontSize: 10, color: T.c.textMut }}>{d.pos}</div></div></div><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10, fontFamily: T.font.mono, color: tc[d.type]||T.c.textMut, fontWeight: 700, padding: "2px 6px", background: `${tc[d.type]||T.c.textMut}12`, borderRadius: T.r.full }}>{d.type}</span><span style={{ fontFamily: T.font.mono, fontSize: 12, color: T.c.textMut }}>{d.gp}GP</span></div></div>)}</div>
      :<div style={{ padding: "0 20px" }}>{["Standing","Guard","Side Control","Mount","Back","Turtle"].map((fam,fi)=><div key={fam} style={{ marginBottom: 16, animation: `pFadeUp .3s ease ${fi*.05}s both` }}><div style={{ fontFamily: T.font.mono, fontSize: 11, color: T.c.gold, letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>{fam.toUpperCase()}</div>{[1,2,3].map(j=><div key={j} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.c.surface, borderRadius: T.r.sm, marginBottom: 3 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, opacity: .5 }}>🔒</span><span style={{ fontSize: 13, color: T.c.textMut }}>Locked Technique</span></div><span style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.beltBlue }}>Blue Belt</span></div>)}</div>)}</div>}
      <div style={{ flex: 1 }} /><BottomNav active="deck" onNav={onNav} />
    </div></Screen>
  );
}

// ─── PROFILE ────────────────────────────────────────────────────
function ProfileScreen({ playerName, archetype, onNav }) {
  const a = ARCHETYPES.find(x=>x.id===archetype)||ARCHETYPES[0];
  return (
    <Screen><div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "32px 20px", textAlign: "center", animation: "pFadeUp .4s ease both" }}><div style={{ fontSize: 64, marginBottom: 8 }}>{a.emoji}</div><div style={{ fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{playerName}</div><div style={{ fontSize: 13, color: a.color }}>{a.name} • ⬜ White Belt</div><div style={{ fontFamily: T.font.display, fontSize: 48, marginTop: 8, letterSpacing: 2 }}>1205</div><div style={{ color: T.c.textMut, fontSize: 12 }}>1W - 0L - 0D</div></div>
      <div style={{ padding: "0 20px", animation: "pFadeUp .4s ease .2s both" }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Belt Progress → <span style={{ color: T.c.beltBlue }}>Blue</span></div>{[{l:"Wins",c:1,n:5},{l:"Matches",c:1,n:10},{l:"Submissions",c:1,n:2},{l:"Techniques",c:4,n:10}].map((r,i)=><div key={i} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 12, color: T.c.textSec }}>{r.l}</span><span style={{ fontSize: 12, fontFamily: T.font.mono, color: T.c.textMut }}>{r.c}/{r.n}</span></div><div style={{ width: "100%", height: 4, background: "rgba(255,255,255,.06)", borderRadius: T.r.full }}><div style={{ width: `${(r.c/r.n)*100}%`, height: "100%", background: T.c.beltBlue, borderRadius: T.r.full }} /></div></div>)}</div>
      <div style={{ padding: "20px 20px", animation: "pFadeUp .4s ease .3s both" }}><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 12, letterSpacing: 2 }}>STATS</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{[{l:"Favorite Position",v:"Mount"},{l:"Favorite Move",v:"Americana"},{l:"Sub Rate",v:"100%"},{l:"Best Chain",v:"3 🔥"},{l:"Avg Match Length",v:"5 turns"},{l:"Positions Visited",v:"3"}].map((s,i)=><div key={i} style={{ padding: 12, background: T.c.surface, borderRadius: T.r.sm }}><div style={{ fontSize: 10, color: T.c.textMut, marginBottom: 4 }}>{s.l}</div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.v}</div></div>)}</div></div>
      <div style={{ padding: "0 20px", animation: "pFadeUp .4s ease .4s both" }}><div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.c.textMut, marginBottom: 12, letterSpacing: 2 }}>MATCH HISTORY</div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: T.c.surface, borderRadius: T.r.md, border: `1px solid ${T.c.green}22` }}><div><div style={{ fontSize: 13, fontWeight: 700 }}>vs Coach Bot</div><div style={{ fontSize: 11, color: T.c.textSec }}>Tutorial Match</div></div><div style={{ textAlign: "right" }}><div style={{ fontFamily: T.font.mono, fontSize: 13, color: T.c.green, fontWeight: 700 }}>WIN</div><div style={{ fontSize: 11, color: T.c.red }}>Sub — Americana</div></div><div style={{ fontFamily: T.font.mono, fontSize: 12, color: T.c.green }}>+5</div></div></div>
      <div style={{ flex: 1 }} /><BottomNav active="profile" onNav={onNav} />
    </div></Screen>
  );
}

// ─── MAIN EXPORT ────────────────────────────────────────────────
export default function PrototypeScreen() {
  const [screen, setScreen] = useState("auth");
  const [name, setName] = useState("");
  const [arch, setArch] = useState("");
  const nav = (s) => setScreen(s);
  const screens = ["auth","onboard","tutorial","post-tutorial","home","lobby","deck","profile"];
  const ensureUser = (s) => { if(!name&&!["auth","onboard"].includes(s)){setName("Demo");setArch("wrestler")} setScreen(s); };

  return (
    <div className="proto" style={{ background: "#060610", minHeight: "100vh" }}>
      <style>{protoCSS}</style>
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 999, display: "flex", gap: 3, padding: "5px 8px", background: "rgba(0,0,0,.85)", borderRadius: "0 0 10px 10px", border: `1px solid ${T.c.border}`, borderTop: "none", flexWrap: "wrap", maxWidth: 420, justifyContent: "center" }}>
        {screens.map(s=><button key={s} onClick={()=>ensureUser(s)} style={{ padding: "3px 6px", fontSize: 8, fontFamily: T.font.body, background: screen===s?T.c.gold:"transparent", color: screen===s?"#000":T.c.textMut, border: `1px solid ${screen===s?T.c.gold:T.c.border}`, borderRadius: 5, cursor: "pointer", fontWeight: 700, textTransform: "uppercase", letterSpacing: .3 }}>{s.replace("-"," ")}</button>)}
      </div>
      {screen==="auth"&&<AuthScreen onAuth={()=>setScreen("onboard")} />}
      {screen==="onboard"&&<OnboardScreen onComplete={(n,a)=>{setName(n);setArch(a);setScreen("tutorial")}} />}
      {screen==="tutorial"&&<TutorialMatch playerName={name||"Demo"} archetype={arch||"wrestler"} onComplete={()=>setScreen("post-tutorial")} />}
      {screen==="post-tutorial"&&<PostTutorial playerName={name||"Demo"} onContinue={()=>setScreen("home")} />}
      {screen==="home"&&<HomeScreen playerName={name||"Demo"} archetype={arch||"wrestler"} onNav={nav} />}
      {screen==="lobby"&&<LobbyScreen onNav={nav} />}
      {screen==="deck"&&<DeckScreen onNav={nav} />}
      {screen==="profile"&&<ProfileScreen playerName={name||"Demo"} archetype={arch||"wrestler"} onNav={nav} />}
    </div>
  );
}
