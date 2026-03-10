// ═══════════════════════════════════════════════════════════
// OPEN MAT — SHARED UI COMPONENTS
// Btn, Bar, GPBar, ChainCounter, BottomNav, Coach
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T } from '../lib/tokens';

// ── BUTTON ─────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = "primary", disabled, full }) => {
  const v = {
    primary: { bg: T.you, c: "#fff", b: T.you },
    danger: { bg: T.red, c: "#fff", b: T.red },
    secondary: { bg: "transparent", c: T.muted, b: T.borderB },
    ghost: { bg: "transparent", c: T.dim, b: "transparent" },
  }[variant] || { bg: T.you, c: "#fff", b: T.you };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : "auto", padding: "14px 24px",
      background: disabled ? T.surface3 : v.bg, border: `1px solid ${disabled ? T.border : v.b}`,
      color: disabled ? T.dim : v.c, fontFamily: T.mono, fontSize: 12,
      letterSpacing: "0.18em", textTransform: "uppercase", cursor: disabled ? "default" : "pointer",
      borderRadius: 2, opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
    }}>{children}</button>
  );
};

// ── PROGRESS BAR ───────────────────────────────────────────
export const Bar = ({ pct, color, h = 4 }) => (
  <div style={{ height: h, background: T.surface3, borderRadius: h / 2, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: h / 2, transition: "width 0.6s" }}/>
  </div>
);

// ── GP BAR ─────────────────────────────────────────────────
export const GPBar = ({ current, max = 12, showThresholds = false }) => {
  const pct = (current / max) * 100;
  const c = current <= 2 ? T.red : current <= 5 ? T.amber : T.green;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: T.surface3, borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: c, borderRadius: 3, transition: "width 0.5s",
          boxShadow: current <= 2 ? `0 0 8px ${T.red}40` : "none",
          animation: current <= 2 ? "gpPulse 1s ease-in-out infinite" : "none",
        }}/>
        {showThresholds && [3, 6, 9].map(t => (
          <div key={t} style={{ position: "absolute", left: `${(t / max) * 100}%`, top: 0, bottom: 0, width: 1, background: T.dim, opacity: 0.3 }}/>
        ))}
      </div>
      <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: c, minWidth: 28, textAlign: "right" }}>{current}/{max}</span>
    </div>
  );
};

// ── CHAIN COUNTER ──────────────────────────────────────────
export const ChainCounter = ({ count, showBonus = false }) => {
  if (count <= 0) return null;
  const bonusPct = count >= 5 ? 30 : count >= 4 ? 25 : count >= 3 ? 20 : count >= 2 ? 10 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {Array.from({ length: Math.min(count, 5) }, (_, i) => (
        <div key={i} style={{
          width: 8, height: 12 + i * 2, borderRadius: "2px 2px 0 0",
          background: `linear-gradient(to top, ${T.red}, ${T.amber})`,
          opacity: 0.6 + i * 0.1,
        }}/>
      ))}
      {showBonus && bonusPct > 0 && (
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.amber, marginLeft: 2 }}>+{bonusPct}%</span>
      )}
    </div>
  );
};

// ── BOTTOM NAV ─────────────────────────────────────────────
export const BottomNav = ({ active, onNavigate }) => {
  const tabs = [
    { id: "home", label: "Home" },
    { id: "lobby", label: "Lobby" },
    { id: "deck", label: "Deck" },
    { id: "profile", label: "Profile" },
  ];
  return (
    <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onNavigate && onNavigate(t.id)} style={{
          flex: 1, padding: "10px 4px", fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: "pointer", border: "none",
          background: active === t.id ? `${T.you}08` : "transparent",
          color: active === t.id ? T.you : T.dim,
          borderTop: `2px solid ${active === t.id ? T.you : "transparent"}`,
        }}>{t.label}</button>
      ))}
    </div>
  );
};

// ── COACH TOOLTIP ──────────────────────────────────────────
export const Coach = ({ message, sub, action, onAction, pulse }) => (
  <div style={{ padding: "12px 16px", background: `${T.coach}0A`, border: `1px solid ${T.coach}25`, borderRadius: 6, animation: "fadeUp 0.35s ease-out both" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: `${T.coach}15`, border: `1px solid ${T.coach}35`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: T.mono, fontSize: 12, color: T.coach, fontWeight: 700,
        animation: pulse ? "coachPulse 2s ease-in-out infinite" : "none",
      }}>C</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.body, fontSize: 13, color: T.text, lineHeight: 1.55, marginBottom: sub ? 4 : 0 }}>{message}</div>
        {sub && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, lineHeight: 1.5 }}>{sub}</div>}
      </div>
    </div>
    {action && (
      <button onClick={onAction} style={{
        marginTop: 10, marginLeft: 40, padding: "9px 18px",
        background: T.coach, border: "none", color: "#fff",
        fontFamily: T.mono, fontSize: 10, letterSpacing: "0.14em",
        textTransform: "uppercase", cursor: "pointer", borderRadius: 2,
      }}>{action}</button>
    )}
  </div>
);

// ── LOADING SPINNER ────────────────────────────────────────
export const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.you, animation: "spin 0.8s linear infinite" }}/>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── SCREEN WRAPPER ─────────────────────────────────────────
export const Screen = ({ children }) => (
  <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.body, display: "flex", flexDirection: "column", border: `1px solid ${T.border}` }}>
    {children}
  </div>
);

// ── LEGACY EXPORTS (MatchScreen, App.jsx compatibility) ───
export const Center = ({ children }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", height: "100%", gap: 12 }}>
    {children}
  </div>
);

export const Card = ({ children, style }) => (
  <div style={{ padding: "12px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, ...style }}>
    {children}
  </div>
);

export const SectionLabel = ({ children }) => (
  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
    {children}
  </div>
);

export const Nav = BottomNav;
export const AppShell = Screen;
