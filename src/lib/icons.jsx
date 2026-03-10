// ═══════════════════════════════════════════════════════════
// OPEN MAT — SVG ICON LIBRARY
// Zero emojis. Every icon encodes physics, not pictures.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T, MTColors } from './tokens';

// ── MOVE TYPE ICONS ────────────────────────────────────────
export const MoveIcon = ({ type, size = 16 }) => {
  const c = MTColors[type] || T.muted;
  const icons = {
    submission: (
      <svg viewBox="0 0 32 32" fill="none" width={size} height={size}>
        <path d="M16 4L28 16L16 28L4 16Z" stroke={c} strokeWidth="1.5" fill={`${c}10`}/>
        <line x1="8" y1="8" x2="12" y2="12" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
        <line x1="24" y1="8" x2="20" y2="12" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
        <line x1="8" y1="24" x2="12" y2="20" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
        <line x1="24" y1="24" x2="20" y2="20" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
        <circle cx="16" cy="16" r="3" fill={c} opacity="0.6"/>
      </svg>
    ),
    transition: (
      <svg viewBox="0 0 32 32" fill="none" width={size} height={size}>
        <circle cx="6" cy="22" r="2.5" fill={c} opacity="0.35"/>
        <path d="M8 22C8 22 12 8 20 8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M17.5 5L21 8L17.5 11" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 8C25 8 27 14 27 14" stroke={c} strokeWidth="1" strokeLinecap="round" strokeDasharray="2 2" opacity="0.3"/>
      </svg>
    ),
    sweep: (
      <svg viewBox="0 0 32 32" fill="none" width={size} height={size}>
        <circle cx="16" cy="24" r="3.5" fill={c} opacity="0.35"/>
        <path d="M23 24A10 10 0 0 0 23 8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M23 8L20.5 11" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M23 8L25.5 11" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="23" cy="6" r="2" stroke={c} strokeWidth="1" strokeDasharray="2 1.5" opacity="0.25" fill="none"/>
      </svg>
    ),
    escape: (
      <svg viewBox="0 0 32 32" fill="none" width={size} height={size}>
        <path d="M10 25A12 12 0 0 1 7 12" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 7A12 12 0 0 1 25 20" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="16" r="3.5" fill={c} opacity="0.6"/>
        <path d="M19 13L25 7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    takedown: (
      <svg viewBox="0 0 32 32" fill="none" width={size} height={size}>
        <circle cx="16" cy="8" r="3.5" fill={c} opacity="0.35"/>
        <line x1="16" y1="12" x2="16" y2="24" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <path d="M12 20L16 25L20 20" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="10" y1="28" x2="22" y2="28" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.2"/>
      </svg>
    ),
    counter: (
      <svg viewBox="0 0 32 32" fill="none" width={size} height={size}>
        <line x1="6" y1="20" x2="16" y2="16" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="16" y1="16" x2="26" y2="8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="16" cy="16" r="2.5" fill={c} opacity="0.5"/>
        <path d="M24 10L26 8L24 6" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  };
  return icons[type] || icons.transition;
};

// ── STANCE ICONS ───────────────────────────────────────────
export const StanceIcon = ({ stance, size = 20 }) => {
  if (stance === "attack") return (
    <svg viewBox="0 0 28 28" fill="none" width={size} height={size}>
      <path d="M6 22L14 4L22 22" stroke={T.red} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={`${T.red}08`}/>
      <circle cx="14" cy="6" r="1.5" fill={T.red} opacity="0.5"/>
    </svg>
  );
  if (stance === "defend") return (
    <svg viewBox="0 0 28 28" fill="none" width={size} height={size}>
      <path d="M6 8C6 8 6 22 14 24C22 22 22 8 22 8" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round" fill={`${T.blue}08`}/>
      <path d="M10 12C10 12 14 18 18 12" stroke={T.blue} strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 28 28" fill="none" width={size} height={size}>
      <path d="M14 24C14 24 8 20 8 16C8 12 14 12 14 16C14 20 20 20 20 14C20 8 14 4 14 4" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="14" cy="4" r="1.5" fill={T.amber} opacity="0.5"/>
    </svg>
  );
};

// ── ARCHETYPE ICONS ────────────────────────────────────────
export const ArchIcon = ({ id, s = 28 }) => {
  const icons = {
    wrestler: (
      <svg viewBox="0 0 32 32" fill="none" width={s} height={s}>
        <circle cx="16" cy="8" r="4" fill={T.green} opacity="0.4"/>
        <line x1="16" y1="12" x2="16" y2="24" stroke={T.green} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M11 20L16 26L21 20" stroke={T.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="28" x2="24" y2="28" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
      </svg>
    ),
    guard_puller: (
      <svg viewBox="0 0 32 32" fill="none" width={s} height={s}>
        <circle cx="16" cy="16" r="11" stroke={T.teal} strokeWidth="2" fill={`${T.teal}08`}/>
        <circle cx="16" cy="5" r="2" fill={T.teal} opacity="0.6"/>
        <line x1="8" y1="10" x2="12" y2="13" stroke={T.teal} strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
        <line x1="24" y1="10" x2="20" y2="13" stroke={T.teal} strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
        <circle cx="16" cy="24" r="2.5" fill={T.teal} opacity="0.35"/>
      </svg>
    ),
    leg_locker: (
      <svg viewBox="0 0 32 32" fill="none" width={s} height={s}>
        <circle cx="12" cy="16" r="8" stroke={T.purple} strokeWidth="1.8" fill="none"/>
        <circle cx="20" cy="16" r="8" stroke={T.purple} strokeWidth="1.8" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill={T.purple} opacity="0.6"/>
      </svg>
    ),
    pressure_passer: (
      <svg viewBox="0 0 32 32" fill="none" width={s} height={s}>
        <rect x="4" y="20" width="24" height="5" rx="2.5" fill={T.red} opacity="0.2"/>
        <rect x="11" y="4" width="10" height="20" rx="4" fill={T.red} opacity="0.55" transform="rotate(-12,16,14)"/>
      </svg>
    ),
    submission_hunter: (
      <svg viewBox="0 0 32 32" fill="none" width={s} height={s}>
        <path d="M16 3L29 16L16 29L3 16Z" stroke={T.red} strokeWidth="1.8" fill={`${T.red}10`}/>
        <line x1="7" y1="7" x2="12" y2="12" stroke={T.red} strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
        <line x1="25" y1="7" x2="20" y2="12" stroke={T.red} strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
        <circle cx="16" cy="16" r="3.5" fill={T.red} opacity="0.5"/>
      </svg>
    ),
    scrambler: (
      <svg viewBox="0 0 32 32" fill="none" width={s} height={s}>
        <rect x="4" y="6" width="13" height="8" rx="3" fill={T.amber} opacity="0.5" transform="rotate(-25,10,10)"/>
        <rect x="15" y="18" width="13" height="8" rx="3" fill={T.amber} opacity="0.5" transform="rotate(20,21,22)"/>
        <circle cx="16" cy="16" r="2" fill={T.amber} opacity="0.4"/>
      </svg>
    ),
  };
  return icons[id] || null;
};

// ── OPEN MAT LOGO ──────────────────────────────────────────
export const Logo = ({ size = 64 }) => (
  <svg viewBox="0 0 64 64" fill="none" width={size} height={size}>
    <polygon points="32,6 4,56 60,56" stroke={T.you} strokeWidth="2" fill="none" strokeLinejoin="round"/>
    <path d="M32 24L40 32L32 40L24 32Z" stroke={T.you} strokeWidth="1.5" fill={`${T.you}15`}/>
    <circle cx="32" cy="32" r="3" fill={T.you} opacity="0.5"/>
  </svg>
);
