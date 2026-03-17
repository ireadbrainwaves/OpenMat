// ═══════════════════════════════════════════════════════════
// OPEN MAT — SHARED UI COMPONENTS (LIGHT MODE)
// Btn, Bar, GPBar, ChainCounter, BottomNav, Coach, Screen
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T } from '../lib/tokens';

// ── BUTTON ─────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = "primary", disabled, full }) => {
  const v = {
    primary: { bg: T.text, c: "#fff", b: T.text },
    danger: { bg: T.red, c: "#fff", b: T.red },
    secondary: { bg: "transparent", c: T.muted, b: T.border },
    ghost: { bg: "transparent", c: T.dim, b: "transparent" },
    type: { bg: T.sub, c: "#fff", b: T.sub },
  }[variant] || { bg: T.text, c: "#fff", b: T.text };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? "100%" : "auto", padding: "14px 24px",
      background: disabled ? T.surface3 : v.bg, border: `1.5px solid ${disabled ? T.border : v.b}`,
      color: disabled ? T.dim : v.c, fontFamily: T.mono, fontSize: 12,
      letterSpacing: "0.12em", textTransform: "uppercase", cursor: disabled ? "default" : "pointer",
      borderRadius: 8, opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
      fontWeight: 500,
    }}>{children}</button>
  );
};

// ── PROGRESS BAR ───────────────────────────────────────────
export const Bar = ({ pct, color, h = 4 }) => (
  <div style={{ height: h, background: T.border, borderRadius: h, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: h, transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}/>
  </div>
);

// ── GP BAR ─────────────────────────────────────────────────
export const GPBar = ({ current, max = 12, showThresholds = false }) => {
  const pct = (current / max) * 100;
  const c = current <= 2 ? T.gpExpensive : current <= 5 ? T.gpModerate : T.gpCheap;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: T.border, borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: c, borderRadius: 3, transition: "width 0.5s",
          boxShadow: current <= 2 ? `0 0 8px ${T.red}40` : "none",
          animation: current <= 2 ? "gpPulse 1s ease-in-out infinite" : "none",
        }}/>
        {showThresholds && [3, 6, 9].map(t => (
          <div key={t} style={{ position: "absolute", left: `${(t / max) * 100}%`, top: 0, bottom: 0, width: 1, background: T.dim, opacity: 0.2 }}/>
        ))}
      </div>
      <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 500, color: c, minWidth: 28, textAlign: "right" }}>{current}/{max}</span>
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
          background: `linear-gradient(to top, ${T.red}, ${T.gold})`,
          opacity: 0.6 + i * 0.1,
        }}/>
      ))}
      {showBonus && bonusPct > 0 && (
        <span style={{ fontFamily: T.mono, fontSize: 9, color: T.gold, marginLeft: 2 }}>+{bonusPct}%</span>
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
    <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, background: T.bgCard, flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onNavigate && onNavigate(t.id)} style={{
          flex: 1, padding: "10px 4px", fontFamily: T.mono, fontSize: 9, letterSpacing: "0.08em",
          textTransform: "uppercase", cursor: "pointer", border: "none",
          background: active === t.id ? `${T.sub}06` : "transparent",
          color: active === t.id ? T.sub : T.dim,
          borderTop: `2px solid ${active === t.id ? T.sub : "transparent"}`,
          fontWeight: active === t.id ? 500 : 400,
        }}>{t.label}</button>
      ))}
    </div>
  );
};

// ── COACH TOOLTIP ──────────────────────────────────────────
export const Coach = ({ message, sub, action, onAction, pulse }) => (
  <div style={{ padding: "12px 16px", background: `${T.coach}08`, border: `1px solid ${T.coach}20`, borderRadius: 8, animation: "fadeUp 0.35s ease-out both" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: `${T.coach}10`, border: `1px solid ${T.coach}25`,
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
        fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em",
        textTransform: "uppercase", cursor: "pointer", borderRadius: 6,
      }}>{action}</button>
    )}
  </div>
);

// ── LOADING SPINNER ────────────────────────────────────────
export const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${T.border}`, borderTopColor: T.sub, animation: "spin 0.8s linear infinite" }}/>
  </div>
);

// ── SCREEN WRAPPER ─────────────────────────────────────────
export const Screen = ({ children }) => (
  <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.body, display: "flex", flexDirection: "column" }}>
    {children}
  </div>
);

// ── LEGACY EXPORTS ─────────────────────────────────────────
export const Center = ({ children }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", height: "100%", gap: 12 }}>
    {children}
  </div>
);

export const Card = ({ children, style }) => (
  <div style={{ padding: "12px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radiusMd, boxShadow: T.shadowSm, ...style }}>
    {children}
  </div>
);

export const SectionLabel = ({ children }) => (
  <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
    {children}
  </div>
);

export const Nav = BottomNav;
export const AppShell = Screen;
