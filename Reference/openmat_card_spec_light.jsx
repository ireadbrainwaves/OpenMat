import { useState } from "react";

// ═══════════════════════════════════════════
//  OPEN MAT — LIGHT MODE CARD SPEC
//  Fresh palette. Sports-editorial feel.
//  Think: Duolingo meets fight camp meets Monocle magazine.
// ═══════════════════════════════════════════

const TYPES = {
  submission: { color: "#C23028", label: "SUB", bg: "#FEF2F1", border: "#F5C4C2", accent: "#8B1A14" },
  sweep: { color: "#B8860B", label: "SWP", bg: "#FDF8EC", border: "#F0DBA8", accent: "#7A5A08" },
  transition: { color: "#2563EB", label: "TRNS", bg: "#EFF4FF", border: "#BFCFFF", accent: "#1A3D8F" },
  takedown: { color: "#0F7B5F", label: "TD", bg: "#EEFBF5", border: "#A7E5CF", accent: "#065A42" },
  escape: { color: "#7C3AED", label: "ESC", bg: "#F5F0FF", border: "#D4BFFF", accent: "#5521A6" },
};

const TIERS = {
  drilled: { symbol: "★", color: "#B8860B", label: "DRILLED", bg: "#FDF8EC", ring: "#E8C84A" },
  trained: { symbol: "─", color: "#6B7280", label: "TRAINED", bg: "#F3F4F6", ring: "#9CA3AF" },
  known: { symbol: "░", color: "#9CA3AF", label: "KNOWN", bg: "#F9FAFB", ring: "#D1D5DB" },
  mastered: { symbol: "◆", color: "#B8860B", label: "MASTERED", bg: "#FDF8EC", ring: "#D4A017" },
};

const SAMPLE_MOVES = [
  { id: 1, name: "Rear Naked Choke", type: "submission", tier: "drilled", gp: 3, gpMod: -1, from: "Back Control", to: "Finish", success: 72, description: "Slide the choking arm under the chin, lock figure-four behind the head, squeeze.", locked: false },
  { id: 2, name: "Scissor Sweep", type: "sweep", tier: "trained", gp: 2, gpMod: 0, from: "Closed Guard", to: "Mount", success: 58, description: "Control the sleeve and collar, load onto your hip, scissor the legs to sweep.", locked: false },
  { id: 3, name: "Berimbolo", type: "transition", tier: "known", gp: 4, gpMod: 1, from: "De La Riva", to: "Back Control", success: 34, description: "Invert under the opponent, spin to the back using the DLR hook as a lever.", locked: false },
  { id: 4, name: "Double Leg", type: "takedown", tier: "drilled", gp: 3, gpMod: -1, from: "Standing", to: "Side Control", success: 65, description: "Change levels, penetration step, drive through the hips to finish the shot.", locked: false },
  { id: 5, name: "Hip Escape", type: "escape", tier: "trained", gp: 1, gpMod: 0, from: "Side Control (Bot)", to: "Half Guard", success: 70, description: "Frame on the hip and neck, shrimp away, recover guard with the inside knee.", locked: false },
  { id: 6, name: "Armbar from Guard", type: "submission", tier: "mastered", gp: 4, gpMod: -1, from: "Closed Guard", to: "Finish", success: 48, description: "Control the wrist, pivot the hips, throw the leg over the face, extend the arm.", locked: false, variant: "High-Elbow Armbar" },
  { id: 7, name: "Ankle Lock", type: "submission", tier: "known", gp: 2, gpMod: 1, from: "Ashi Garami", to: "Finish", success: 40, description: "Figure-four grip on the Achilles, arch the back to apply breaking pressure.", locked: true, requiredBelt: "Blue" },
  { id: 8, name: "Knee Cut Pass", type: "transition", tier: "trained", gp: 2, gpMod: 0, from: "Half Guard (Top)", to: "Side Control", success: 62, description: "Slice the knee through the middle, crossface pressure, free the trapped leg.", locked: false },
];

const F = {
  display: "'DM Serif Display', 'Georgia', serif",
  mono: "'DM Mono', 'Menlo', monospace",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
};

// ─── TYPE ICON SVGs ───
function TypeIcon({ type, size = 14 }) {
  const color = TYPES[type]?.accent || "#666";
  const s = size;
  const icons = {
    submission: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" fill={color} />
      </svg>
    ),
    sweep: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 18C6 12 12 6 18 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 6h4v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    transition: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15 8l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    takedown: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 4v14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 13l5 5 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    escape: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M9 18l-4-4 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 14h10a4 4 0 000-8h-2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };
  return icons[type] || null;
}

function TierBadge({ tier, large }) {
  const t = TIERS[tier];
  if (!t) return null;
  return (
    <span style={{
      fontFamily: F.mono, fontSize: large ? 10 : 8, letterSpacing: "0.08em",
      color: t.color, display: "flex", alignItems: "center", gap: 3,
      background: t.bg, padding: large ? "3px 8px" : "2px 5px",
      borderRadius: 3,
    }}>
      <span style={{ fontSize: large ? 12 : 10, lineHeight: 1 }}>{t.symbol}</span>
      {t.label}
    </span>
  );
}

function StatBar({ value, max = 100, color, height = 4 }) {
  return (
    <div style={{ width: "100%", height, background: "#E5E7EB", borderRadius: height }}>
      <div style={{
        width: `${(value / max) * 100}%`, height: "100%",
        background: color, borderRadius: height,
        transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════
//  COMPACT CARD — match hand
// ═══════════════════════════════════════════
function CompactCard({ move, selected, onClick }) {
  const type = TYPES[move.type];
  const tier = TIERS[move.tier];
  const effectiveGP = move.gp + move.gpMod;
  const isDrilled = move.tier === "drilled" || move.tier === "mastered";

  return (
    <div onClick={onClick} style={{
      width: 144, minHeight: 172,
      background: selected ? type.bg : "#FFFFFF",
      border: `1.5px solid ${selected ? type.color : "#E5E7EB"}`,
      borderRadius: 10, padding: "12px 11px 10px",
      cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: selected ? "translateY(-4px)" : "none",
      boxShadow: selected
        ? `0 8px 24px ${type.border}, 0 0 0 1px ${type.color}`
        : "0 1px 3px rgba(0,0,0,0.04)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Drilled corner ribbon */}
      {isDrilled && (
        <div style={{
          position: "absolute", top: -1, right: -1,
          width: 28, height: 28, overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 4, right: -8,
            width: 40, height: 12, background: tier.ring,
            transform: "rotate(45deg)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 7, color: "#FFF", fontWeight: 700 }}>★</span>
          </div>
        </div>
      )}

      {/* Type badge + GP */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 7px", borderRadius: 4,
          background: type.bg, border: `1px solid ${type.border}`,
        }}>
          <TypeIcon type={move.type} size={11} />
          <span style={{
            fontFamily: F.mono, fontSize: 8, fontWeight: 500,
            letterSpacing: "0.06em", color: type.accent,
          }}>
            {type.label}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: F.display, fontSize: 26, lineHeight: 1,
            color: effectiveGP <= 2 ? "#0F7B5F" : effectiveGP >= 4 ? "#C23028" : "#B8860B",
          }}>
            {effectiveGP}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 7, color: "#9CA3AF", letterSpacing: "0.08em" }}>GP</div>
          {move.gpMod !== 0 && (
            <div style={{
              fontFamily: F.mono, fontSize: 7, marginTop: 1,
              color: move.gpMod < 0 ? "#0F7B5F" : "#C23028",
            }}>
              {move.gpMod < 0 ? move.gpMod : `+${move.gpMod}`}
            </div>
          )}
        </div>
      </div>

      {/* Move name */}
      <div style={{
        fontFamily: F.display, fontSize: 19, color: selected ? type.accent : "#1F2937",
        lineHeight: 1.15, flex: 1, letterSpacing: "0.01em",
        transition: "color 0.15s",
      }}>
        {move.name}
      </div>

      {/* Variant */}
      {move.variant && (
        <div style={{
          fontFamily: F.mono, fontSize: 7, color: "#B8860B",
          letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 3,
          background: "#FDF8EC", padding: "2px 5px", borderRadius: 3,
          alignSelf: "flex-start",
        }}>
          ◆ {move.variant}
        </div>
      )}

      {/* Bottom */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 4, borderTop: `1px solid ${selected ? type.border : "#F3F4F6"}`,
        marginTop: "auto",
      }}>
        <TierBadge tier={move.tier} />
        <div style={{
          fontFamily: F.mono, fontSize: 7, color: "#9CA3AF",
          letterSpacing: "0.04em",
        }}>
          {move.from.length > 10 ? move.from.slice(0, 9) + "…" : move.from}
          <span style={{ color: type.color, margin: "0 2px" }}>→</span>
          {move.to.length > 10 ? move.to.slice(0, 9) + "…" : move.to}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  FULL CARD — detail / library view
// ═══════════════════════════════════════════
function FullCard({ move, onClose }) {
  const type = TYPES[move.type];
  const tier = TIERS[move.tier];
  const effectiveGP = move.gp + move.gpMod;

  return (
    <div style={{
      width: "100%", maxWidth: 340,
      background: "#FFFFFF",
      borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${type.border}`,
      boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
      position: "relative",
    }}>
      {/* Locked overlay */}
      {move.locked && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(4px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "#F3F4F6", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="#9CA3AF" strokeWidth="1.8" />
              <path d="M8 11V7a4 4 0 118 0v4" stroke="#9CA3AF" strokeWidth="1.8" />
            </svg>
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: "#6B7280", letterSpacing: "0.08em" }}>
            REQUIRES {move.requiredBelt?.toUpperCase()} BELT
          </span>
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: move.requiredBelt === "Blue" ? "#2563EB"
              : move.requiredBelt === "Purple" ? "#7C3AED"
              : move.requiredBelt === "Brown" ? "#92400E" : "#1F2937",
          }} />
        </div>
      )}

      {/* Color header band */}
      <div style={{
        height: 4, background: `linear-gradient(90deg, ${type.color}, ${type.border})`,
      }} />

      {/* Header */}
      <div style={{ padding: "14px 18px 12px", background: type.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 4,
                background: "#FFFFFF", border: `1px solid ${type.border}`,
              }}>
                <TypeIcon type={move.type} size={13} />
                <span style={{
                  fontFamily: F.mono, fontSize: 9, fontWeight: 500,
                  letterSpacing: "0.06em", color: type.accent,
                }}>
                  {type.label}
                </span>
              </div>
              <TierBadge tier={move.tier} large />
            </div>
          </div>

          {/* GP — hero number */}
          <div style={{
            textAlign: "center", background: "#FFFFFF",
            borderRadius: 10, padding: "8px 14px",
            border: `1.5px solid ${type.border}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontFamily: F.display, fontSize: 38, lineHeight: 1,
              color: effectiveGP <= 2 ? "#0F7B5F" : effectiveGP >= 4 ? "#C23028" : "#B8860B",
            }}>
              {effectiveGP}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF", letterSpacing: "0.12em", marginTop: 2 }}>
              GP COST
            </div>
            {move.gpMod !== 0 && (
              <div style={{
                fontFamily: F.mono, fontSize: 8, marginTop: 2,
                color: move.gpMod < 0 ? "#0F7B5F" : "#C23028",
              }}>
                {move.gpMod < 0 ? `${move.gpMod} drilled` : `+${move.gpMod} known`}
              </div>
            )}
          </div>
        </div>

        {/* Move name */}
        <div style={{
          fontFamily: F.display, fontSize: 28, color: "#111827",
          lineHeight: 1.15, marginBottom: 3,
        }}>
          {move.name}
        </div>

        {move.variant && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: F.mono, fontSize: 9, color: "#B8860B",
            background: "#FDF8EC", padding: "3px 8px", borderRadius: 4,
            border: "1px solid #F0DBA8",
          }}>
            ◆ VARIANT: {move.variant}
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{
          fontFamily: F.body, fontSize: 13.5, color: "#4B5563",
          lineHeight: 1.6, fontStyle: "italic",
        }}>
          "{move.description}"
        </div>
      </div>

      {/* Position flow */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            flex: 1, padding: "10px 12px",
            background: "#F9FAFB", borderRadius: 8,
            border: "1px solid #F3F4F6", textAlign: "center",
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF", letterSpacing: "0.1em", marginBottom: 4 }}>FROM</div>
            <div style={{ fontFamily: F.display, fontSize: 14, color: "#374151" }}>{move.from}</div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: type.bg, border: `1.5px solid ${type.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M1 5h10M9 1l4 4-4 4" stroke={type.color} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{
            flex: 1, padding: "10px 12px",
            background: type.bg, borderRadius: 8,
            border: `1px solid ${type.border}`, textAlign: "center",
          }}>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: type.color, letterSpacing: "0.1em", marginBottom: 4 }}>TO</div>
            <div style={{ fontFamily: F.display, fontSize: 14, color: type.accent }}>{move.to}</div>
          </div>
        </div>

        {/* Success rate */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontFamily: F.mono, fontSize: 9, color: "#9CA3AF", letterSpacing: "0.08em" }}>
              SUCCESS RATE
            </span>
            <span style={{ fontFamily: F.display, fontSize: 20, color: type.accent }}>
              {move.success}%
            </span>
          </div>
          <StatBar value={move.success} color={type.color} height={5} />
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, padding: "8px 10px",
            background: "#F9FAFB", borderRadius: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF" }}>BASE GP</span>
            <span style={{ fontFamily: F.display, fontSize: 16, color: "#374151" }}>{move.gp}</span>
          </div>
          <div style={{
            flex: 1, padding: "8px 10px",
            background: tier.bg, borderRadius: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            border: `1px solid ${move.tier === "drilled" || move.tier === "mastered" ? "#F0DBA8" : "#F3F4F6"}`,
          }}>
            <span style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF" }}>TIER</span>
            <TierBadge tier={move.tier} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {onClose && (
        <div style={{
          padding: "10px 18px 14px",
          borderTop: "1px solid #F3F4F6",
          display: "flex", gap: 8,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px",
            border: "1.5px solid #E5E7EB", borderRadius: 8,
            background: "#FFFFFF", color: "#6B7280",
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em",
            cursor: "pointer",
          }}>
            BACK
          </button>
          <button style={{
            flex: 2, padding: "10px",
            border: "none", borderRadius: 8,
            background: type.color, color: "#FFFFFF",
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em",
            fontWeight: 600, cursor: "pointer",
            boxShadow: `0 2px 8px ${type.border}`,
          }}>
            ADD TO DECK
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  LIBRARY ROW
// ═══════════════════════════════════════════
function LibraryRow({ move, onSelect, isInDeck }) {
  const type = TYPES[move.type];
  const effectiveGP = move.gp + move.gpMod;

  return (
    <div onClick={() => onSelect(move)} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 16px", cursor: "pointer",
      background: isInDeck ? type.bg : "#FFFFFF",
      borderBottom: "1px solid #F3F4F6",
      borderLeft: isInDeck ? `3px solid ${type.color}` : "3px solid transparent",
      transition: "background 0.12s",
      opacity: move.locked ? 0.45 : 1,
    }}>
      {/* Type icon in circle */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: type.bg, border: `1px solid ${type.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <TypeIcon type={move.type} size={15} />
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontFamily: F.display, fontSize: 16, color: "#111827" }}>
            {move.name}
          </span>
          {move.locked && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="#9CA3AF" strokeWidth="2.5" />
              <path d="M8 11V7a4 4 0 118 0v4" stroke="#9CA3AF" strokeWidth="2.5" />
            </svg>
          )}
        </div>
        <div style={{
          fontFamily: F.body, fontSize: 11.5, color: "#9CA3AF",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {move.description}
        </div>
      </div>

      {/* Type pill */}
      <div style={{
        padding: "3px 7px", borderRadius: 4,
        background: type.bg, border: `1px solid ${type.border}`,
        fontFamily: F.mono, fontSize: 8, color: type.accent,
        letterSpacing: "0.06em", fontWeight: 500, flexShrink: 0,
      }}>
        {type.label}
      </div>

      {/* Tier */}
      <div style={{ width: 64, flexShrink: 0, textAlign: "center" }}>
        <TierBadge tier={move.tier} />
      </div>

      {/* GP */}
      <div style={{
        fontFamily: F.display, fontSize: 22, width: 30,
        textAlign: "center", flexShrink: 0,
        color: effectiveGP <= 2 ? "#0F7B5F" : effectiveGP >= 4 ? "#C23028" : "#B8860B",
      }}>
        {effectiveGP}
      </div>

      {/* In-deck check */}
      <div style={{ width: 22, flexShrink: 0, textAlign: "center" }}>
        {isInDeck ? (
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "#0F7B5F", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: "1.5px solid #E5E7EB",
          }} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  FLIP CARD — reveal
// ═══════════════════════════════════════════
function FlipCard({ move, isOpponent, flipped }) {
  const type = TYPES[move.type];
  const sideColor = isOpponent ? "#2563EB" : "#C23028";
  const sideBg = isOpponent ? "#EFF4FF" : "#FEF2F1";

  return (
    <div style={{ width: 150, height: 200, perspective: 600 }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: flipped ? "rotateY(180deg)" : "none",
      }}>
        {/* Back */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: "#FAFAFA", border: "1.5px solid #E5E7EB",
          borderRadius: 10, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "1.5px solid #E5E7EB", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: "1.5px solid #F3F4F6",
            }} />
          </div>
          <span style={{
            fontFamily: F.display, fontSize: 14, letterSpacing: "0.06em",
            color: "#D1D5DB",
          }}>
            OPEN MAT
          </span>
        </div>

        {/* Front */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: sideBg, border: `1.5px solid ${sideColor}`,
          borderRadius: 10, padding: "14px 12px",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            fontFamily: F.mono, fontSize: 8, letterSpacing: "0.14em",
            color: sideColor, marginBottom: 8,
            background: "#FFFFFF", padding: "2px 6px", borderRadius: 3,
            alignSelf: "flex-start",
          }}>
            {isOpponent ? "OPPONENT" : "YOUR MOVE"}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 7px", borderRadius: 4,
            background: "#FFFFFF", border: `1px solid ${type.border}`,
            alignSelf: "flex-start", marginBottom: 12,
          }}>
            <TypeIcon type={move.type} size={10} />
            <span style={{
              fontFamily: F.mono, fontSize: 8, color: type.accent,
              letterSpacing: "0.06em", fontWeight: 500,
            }}>
              {type.label}
            </span>
          </div>
          <div style={{
            fontFamily: F.display, fontSize: 22, color: "#111827",
            lineHeight: 1.15, flex: 1,
          }}>
            {move.name}
          </div>
          <div style={{
            fontFamily: F.mono, fontSize: 8, color: "#9CA3AF",
            letterSpacing: "0.04em",
          }}>
            {move.from} <span style={{ color: type.color }}>→</span> {move.to}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  MAIN SHOWCASE
// ═══════════════════════════════════════════
export default function OpenMatLightSpec() {
  const [selectedCompact, setSelectedCompact] = useState(0);
  const [expandedMove, setExpandedMove] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState("all");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #F8F8FB 0%, #FFFFFF 40%)",
      color: "#111827", fontFamily: F.body,
      padding: "28px 16px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            marginBottom: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#111827", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: F.display, fontSize: 16, color: "#FFFFFF", letterSpacing: "0.04em" }}>O</span>
            </div>
            <h1 style={{
              fontFamily: F.display, fontSize: 28, margin: 0, color: "#111827",
            }}>
              Open Mat
            </h1>
          </div>
          <p style={{
            fontFamily: F.mono, fontSize: 10, color: "#9CA3AF",
            letterSpacing: "0.06em", margin: 0,
          }}>
            LIGHT MODE CARD SPEC — SPORTS EDITORIAL AESTHETIC
          </p>
          <div style={{
            width: 40, height: 3, background: "#C23028",
            borderRadius: 2, marginTop: 10,
          }} />
        </div>

        {/* ── COMPACT CARDS ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em",
            color: "#C23028", marginBottom: 6,
          }}>
            01
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "0 0 6px", color: "#111827" }}>
            Match Hand
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>
            Cards in your hand during a match. GP cost dominates. Type color is instant. Drilled moves get a gold corner ribbon. Tap to select, tap again for detail.
          </p>
          <div style={{
            display: "flex", gap: 10, overflowX: "auto",
            paddingBottom: 12, scrollSnapType: "x mandatory",
          }}>
            {SAMPLE_MOVES.filter(m => !m.locked).map((move, i) => (
              <CompactCard
                key={move.id} move={move}
                selected={selectedCompact === i}
                onClick={() => setSelectedCompact(i)}
              />
            ))}
          </div>
        </div>

        {/* ── FULL CARDS ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em",
            color: "#B8860B", marginBottom: 6,
          }}>
            02
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "0 0 6px", color: "#111827" }}>
            Detail View
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>
            Expanded card view for library browsing and deck building. Description teaches BJJ. Locked moves show what belt you need — browse what you can't have yet.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FullCard move={SAMPLE_MOVES[0]} />
            <FullCard move={SAMPLE_MOVES[6]} />
          </div>
        </div>

        {/* ── LIBRARY LIST ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em",
            color: "#2563EB", marginBottom: 6,
          }}>
            03
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "0 0 6px", color: "#111827" }}>
            Move Library
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 }}>
            UFC moveset browser. Type icons in circles, description preview, in-deck checkmarks. Tap any row for the full card.
          </p>

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {["all", ...Object.keys(TYPES)].map(t => (
              <button key={t} onClick={() => setView(t)} style={{
                padding: "5px 12px", borderRadius: 6,
                background: view === t ? (t === "all" ? "#111827" : TYPES[t].bg) : "#F9FAFB",
                border: `1.5px solid ${view === t ? (t === "all" ? "#111827" : TYPES[t].border) : "#E5E7EB"}`,
                color: view === t ? (t === "all" ? "#FFFFFF" : TYPES[t].accent) : "#9CA3AF",
                fontFamily: F.mono, fontSize: 9, letterSpacing: "0.06em",
                fontWeight: 500, cursor: "pointer",
                transition: "all 0.15s",
              }}>
                {t === "all" ? "ALL" : TYPES[t].label}
              </button>
            ))}
          </div>

          <div style={{
            border: "1.5px solid #E5E7EB", borderRadius: 10,
            overflow: "hidden", background: "#FFFFFF",
          }}>
            {SAMPLE_MOVES
              .filter(m => view === "all" || m.type === view)
              .map(move => (
                <LibraryRow
                  key={move.id} move={move}
                  isInDeck={[1, 2, 4, 5, 8].includes(move.id)}
                  onSelect={m => setExpandedMove(m)}
                />
              ))}
          </div>
        </div>

        {/* ── FLIP CARDS ── */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em",
            color: "#0F7B5F", marginBottom: 6,
          }}>
            04
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 22, margin: "0 0 6px", color: "#111827" }}>
            Turn Reveal
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 1.5 }}>
            The heartbeat. Both cards face-down, then flip. Yours at 400ms, opponent at 750ms.
          </p>
          <button onClick={() => setFlipped(!flipped)} style={{
            padding: "8px 20px", border: "1.5px solid #E5E7EB",
            background: flipped ? "#111827" : "#FFFFFF",
            color: flipped ? "#FFFFFF" : "#111827",
            borderColor: flipped ? "#111827" : "#E5E7EB",
            borderRadius: 8, fontFamily: F.mono, fontSize: 10,
            letterSpacing: "0.08em", fontWeight: 500,
            cursor: "pointer", marginBottom: 16,
            transition: "all 0.2s",
          }}>
            {flipped ? "RESET" : "FLIP REVEAL"}
          </button>
          <div style={{
            display: "flex", gap: 20, justifyContent: "center",
            padding: "20px 0",
            background: "#F9FAFB", borderRadius: 12,
            border: "1px solid #F3F4F6",
          }}>
            <FlipCard move={SAMPLE_MOVES[0]} isOpponent={false} flipped={flipped} />
            <FlipCard move={SAMPLE_MOVES[2]} isOpponent={true} flipped={flipped} />
          </div>
        </div>

        {/* ── SPEC NOTES ── */}
        <div style={{
          padding: 20, background: "#F9FAFB",
          border: "1.5px solid #E5E7EB", borderRadius: 10,
        }}>
          <h3 style={{
            fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em",
            color: "#111827", margin: "0 0 14px",
          }}>
            IMPLEMENTATION NOTES
          </h3>
          {[
            "LIGHT MODE — white/cream base, colored accents per type. No dark backgrounds anywhere.",
            "Fonts: DM Serif Display (card names, numbers), DM Mono (labels, stats), DM Sans (descriptions, body). The DM family gives a sports-editorial feel.",
            "Type colors reworked for light backgrounds: deeper, more saturated. Red=#C23028, Gold=#B8860B, Blue=#2563EB, Green=#0F7B5F, Purple=#7C3AED.",
            "Escape type changed from teal to purple — more distinct on light backgrounds, reads as 'defense/retreat' energy.",
            "Cards use soft shadows + rounded corners (8-10px) instead of hard borders — feels like a polished sports app, not a dev tool.",
            "Locked moves: frosted glass overlay (white 85% + blur) instead of dark dim. Belt color bar as the aspiration hint.",
            "Drilled/mastered cards get a gold corner ribbon instead of a glow — works on light backgrounds where glow disappears.",
            "GP hero number: color-coded by cost (green=cheap, gold=moderate, red=expensive). Biggest element on every card.",
            "Type icons in circles for library rows — gives each move a visual anchor point, inspired by UFC fighter profile circles.",
            "In-deck indicator: green filled circle with white checkmark (not just a checkmark). Empty circle when not in deck — UFC equip/unequip pattern.",
          ].map((note, i) => (
            <div key={i} style={{
              fontFamily: F.body, fontSize: 12, color: "#6B7280",
              lineHeight: 1.5, padding: "5px 0",
              borderBottom: i < 9 ? "1px solid #F3F4F6" : "none",
              display: "flex", gap: 10,
            }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: "#C23028", flexShrink: 0, fontWeight: 500 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {note}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
