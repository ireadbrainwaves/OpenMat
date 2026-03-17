// ═══════════════════════════════════════════════════════════
// OPEN MAT — MOVE CARD COMPONENT SYSTEM
// 4 modes: compact (hand), full (detail), row (list), flip (reveal)
// Light mode. DM font family. Sports-editorial aesthetic.
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { T, TYPE_COLORS, TIER_STYLES } from '../lib/tokens';
import { G } from '../lib/supabase';

const F = {
  display: T.display,
  mono: T.mono,
  body: T.body,
};

// ── TYPE ICON SVGs (light mode optimized) ────────────────
export function TypeIcon({ type, size = 14 }) {
  const tc = TYPE_COLORS[type];
  const color = tc?.dark || "#666";
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
    counter: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 8l-4 4 4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };
  return icons[type] || icons.transition;
}

// ── TIER BADGE ───────────────────────────────────────────
export function TierBadge({ tier, large }) {
  const t = TIER_STYLES[tier];
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

// ── GP COLOR helper ──────────────────────────────────────
function gpColor(gp) {
  if (gp <= 2) return T.gpCheap;
  if (gp >= 4) return T.gpExpensive;
  return T.gpModerate;
}

// ── POSITION NAME helper ─────────────────────────────────
function posName(posId) {
  if (!posId) return "";
  const p = G.positions?.[posId];
  if (p) return p.name;
  return String(posId).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════════
//  MODE: COMPACT — match hand, game plan
// ═══════════════════════════════════════════════════════════
function CompactCard({ move, type, tier, gp, gpMod = 0, selected, variant, onClick }) {
  const tc = TYPE_COLORS[type] || TYPE_COLORS.transition;
  const ts = TIER_STYLES[tier] || TIER_STYLES.known;
  const effectiveGP = (gp || 0) + (gpMod || 0);
  const isDrilled = tier === "drilled" || tier === "mastered";
  const fromPos = posName(move?.from_position);
  const toPos = posName(move?.to_position);

  return (
    <div onClick={onClick} style={{
      width: 144, minHeight: 172,
      background: selected ? tc.bg : "#FFFFFF",
      border: `1.5px solid ${selected ? tc.color : "#E5E7EB"}`,
      borderRadius: 10, padding: "12px 11px 10px",
      cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: selected ? "translateY(-4px)" : "none",
      boxShadow: selected
        ? `0 8px 24px ${tc.border}, 0 0 0 1px ${tc.color}`
        : "0 1px 3px rgba(0,0,0,0.04)",
      position: "relative", overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Drilled corner ribbon */}
      {isDrilled && (
        <div style={{
          position: "absolute", top: -1, right: -1,
          width: 28, height: 28, overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 4, right: -8,
            width: 40, height: 12, background: ts.ring,
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
          background: tc.bg, border: `1px solid ${tc.border}`,
        }}>
          <TypeIcon type={type} size={11} />
          <span style={{
            fontFamily: F.mono, fontSize: 8, fontWeight: 500,
            letterSpacing: "0.06em", color: tc.dark,
          }}>
            {tc.label}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: F.display, fontSize: 26, lineHeight: 1,
            color: gpColor(effectiveGP),
          }}>
            {effectiveGP}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 7, color: "#9CA3AF", letterSpacing: "0.08em" }}>GP</div>
          {gpMod !== 0 && (
            <div style={{
              fontFamily: F.mono, fontSize: 7, marginTop: 1,
              color: gpMod < 0 ? T.gpCheap : T.gpExpensive,
            }}>
              {gpMod < 0 ? gpMod : `+${gpMod}`}
            </div>
          )}
        </div>
      </div>

      {/* Move name */}
      <div style={{
        fontFamily: F.display, fontSize: 19, color: selected ? tc.dark : "#1F2937",
        lineHeight: 1.15, flex: 1, letterSpacing: "0.01em",
        transition: "color 0.15s",
      }}>
        {move?.name || "Unknown"}
      </div>

      {/* Variant */}
      {variant && (
        <div style={{
          fontFamily: F.mono, fontSize: 7, color: "#B8860B",
          letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 3,
          background: "#FDF8EC", padding: "2px 5px", borderRadius: 3,
          alignSelf: "flex-start",
        }}>
          ◆ {variant}
        </div>
      )}

      {/* Bottom */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 4, borderTop: `1px solid ${selected ? tc.border : "#F3F4F6"}`,
        marginTop: "auto",
      }}>
        <TierBadge tier={tier} />
        {(fromPos || toPos) && (
          <div style={{
            fontFamily: F.mono, fontSize: 7, color: "#9CA3AF",
            letterSpacing: "0.04em", maxWidth: 70, textAlign: "right",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {fromPos && (fromPos.length > 9 ? fromPos.slice(0, 8) + "…" : fromPos)}
            {fromPos && toPos && <span style={{ color: tc.color, margin: "0 2px" }}>→</span>}
            {toPos && (toPos.length > 9 ? toPos.slice(0, 8) + "…" : toPos)}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MODE: FULL — detail view, library expand
// ═══════════════════════════════════════════════════════════
function FullCard({ move, type, tier, gp, gpMod = 0, locked, requiredBelt, variant, isInDeck, onClose, onAddToDeck, onRemoveFromDeck }) {
  const tc = TYPE_COLORS[type] || TYPE_COLORS.transition;
  const ts = TIER_STYLES[tier] || TIER_STYLES.known;
  const effectiveGP = (gp || 0) + (gpMod || 0);
  const fromPos = posName(move?.from_position);
  const toPos = posName(move?.to_position);

  return (
    <div style={{
      width: "100%", maxWidth: 340,
      background: "#FFFFFF",
      borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${tc.border}`,
      boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
      position: "relative",
    }}>
      {/* Locked overlay */}
      {locked && (
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
            REQUIRES {(requiredBelt || "BLUE").toUpperCase()} BELT
          </span>
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: requiredBelt === "blue" ? "#2563EB"
              : requiredBelt === "purple" ? "#7C3AED"
              : requiredBelt === "brown" ? "#92400E" : "#1F2937",
          }} />
        </div>
      )}

      {/* Color header band */}
      <div style={{
        height: 4, background: `linear-gradient(90deg, ${tc.color}, ${tc.border})`,
      }} />

      {/* Header */}
      <div style={{ padding: "14px 18px 12px", background: tc.bg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", borderRadius: 4,
                background: "#FFFFFF", border: `1px solid ${tc.border}`,
              }}>
                <TypeIcon type={type} size={13} />
                <span style={{
                  fontFamily: F.mono, fontSize: 9, fontWeight: 500,
                  letterSpacing: "0.06em", color: tc.dark,
                }}>
                  {tc.label}
                </span>
              </div>
              <TierBadge tier={tier} large />
            </div>
          </div>

          {/* GP pill */}
          <div style={{
            textAlign: "center", background: "#FFFFFF",
            borderRadius: 10, padding: "8px 14px",
            border: `1.5px solid ${tc.border}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              fontFamily: F.display, fontSize: 38, lineHeight: 1,
              color: gpColor(effectiveGP),
            }}>
              {effectiveGP}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF", letterSpacing: "0.12em", marginTop: 2 }}>
              GP COST
            </div>
            {gpMod !== 0 && (
              <div style={{
                fontFamily: F.mono, fontSize: 8, marginTop: 2,
                color: gpMod < 0 ? T.gpCheap : T.gpExpensive,
              }}>
                {gpMod < 0 ? `${gpMod} drilled` : `+${gpMod} known`}
              </div>
            )}
          </div>
        </div>

        {/* Move name */}
        <div style={{
          fontFamily: F.display, fontSize: 28, color: "#111827",
          lineHeight: 1.15, marginBottom: 3,
        }}>
          {move?.name || "Unknown"}
        </div>

        {variant && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: F.mono, fontSize: 9, color: "#B8860B",
            background: "#FDF8EC", padding: "3px 8px", borderRadius: 4,
            border: "1px solid #F0DBA8",
          }}>
            ◆ VARIANT: {variant}
          </div>
        )}
      </div>

      {/* Description */}
      {move?.description && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{
            fontFamily: F.body, fontSize: 13.5, color: "#4B5563",
            lineHeight: 1.6, fontStyle: "italic",
          }}>
            "{move.description}"
          </div>
        </div>
      )}

      {/* Position flow */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {(fromPos || toPos) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              flex: 1, padding: "10px 12px",
              background: "#F9FAFB", borderRadius: 8,
              border: "1px solid #F3F4F6", textAlign: "center",
            }}>
              <div style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF", letterSpacing: "0.1em", marginBottom: 4 }}>FROM</div>
              <div style={{ fontFamily: F.display, fontSize: 14, color: "#374151" }}>{fromPos || "—"}</div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: tc.bg, border: `1.5px solid ${tc.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M1 5h10M9 1l4 4-4 4" stroke={tc.color} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{
              flex: 1, padding: "10px 12px",
              background: tc.bg, borderRadius: 8,
              border: `1px solid ${tc.border}`, textAlign: "center",
            }}>
              <div style={{ fontFamily: F.mono, fontSize: 8, color: tc.color, letterSpacing: "0.1em", marginBottom: 4 }}>TO</div>
              <div style={{ fontFamily: F.display, fontSize: 14, color: tc.dark }}>{toPos || "—"}</div>
            </div>
          </div>
        )}

        {/* Success rate */}
        {move?.success_rate != null && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: "#9CA3AF", letterSpacing: "0.08em" }}>
                SUCCESS RATE
              </span>
              <span style={{ fontFamily: F.display, fontSize: 20, color: tc.dark }}>
                {move.success_rate}%
              </span>
            </div>
            <div style={{ width: "100%", height: 5, background: "#E5E7EB", borderRadius: 5 }}>
              <div style={{
                width: `${move.success_rate}%`, height: "100%",
                background: tc.color, borderRadius: 5,
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              }} />
            </div>
          </div>
        )}

        {/* Stats pills */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, padding: "8px 10px",
            background: "#F9FAFB", borderRadius: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF" }}>BASE GP</span>
            <span style={{ fontFamily: F.display, fontSize: 16, color: "#374151" }}>{gp || 0}</span>
          </div>
          <div style={{
            flex: 1, padding: "8px 10px",
            background: ts.bg, borderRadius: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            border: `1px solid ${tier === "drilled" || tier === "mastered" ? "#F0DBA8" : "#F3F4F6"}`,
          }}>
            <span style={{ fontFamily: F.mono, fontSize: 8, color: "#9CA3AF" }}>TIER</span>
            <TierBadge tier={tier} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {(onClose || onAddToDeck || onRemoveFromDeck) && (
        <div style={{
          padding: "10px 18px 14px",
          borderTop: "1px solid #F3F4F6",
          display: "flex", gap: 8,
        }}>
          {onClose && (
            <button onClick={onClose} style={{
              flex: 1, padding: "10px",
              border: "1.5px solid #E5E7EB", borderRadius: 8,
              background: "#FFFFFF", color: "#6B7280",
              fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em",
              cursor: "pointer",
            }}>
              BACK
            </button>
          )}
          {onAddToDeck && !isInDeck && (
            <button onClick={onAddToDeck} style={{
              flex: 2, padding: "10px",
              border: "none", borderRadius: 8,
              background: tc.color, color: "#FFFFFF",
              fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em",
              fontWeight: 600, cursor: "pointer",
              boxShadow: `0 2px 8px ${tc.border}`,
            }}>
              ADD TO DECK
            </button>
          )}
          {onRemoveFromDeck && isInDeck && (
            <button onClick={onRemoveFromDeck} style={{
              flex: 2, padding: "10px",
              border: `1.5px solid ${tc.border}`, borderRadius: 8,
              background: tc.bg, color: tc.dark,
              fontFamily: F.mono, fontSize: 10, letterSpacing: "0.08em",
              fontWeight: 600, cursor: "pointer",
            }}>
              REMOVE FROM DECK
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MODE: ROW — deck builder list, library browse
// ═══════════════════════════════════════════════════════════
function RowCard({ move, type, tier, gp, gpMod = 0, isInDeck, locked, onClick }) {
  const tc = TYPE_COLORS[type] || TYPE_COLORS.transition;
  const effectiveGP = (gp || 0) + (gpMod || 0);

  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 16px", cursor: "pointer",
      background: isInDeck ? tc.bg : "#FFFFFF",
      borderBottom: "1px solid #F3F4F6",
      borderLeft: isInDeck ? `3px solid ${tc.color}` : "3px solid transparent",
      transition: "background 0.12s",
      opacity: locked ? 0.45 : 1,
    }}>
      {/* Type icon in circle */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: tc.bg, border: `1px solid ${tc.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <TypeIcon type={type} size={15} />
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontFamily: F.display, fontSize: 16, color: "#111827" }}>
            {move?.name || "Unknown"}
          </span>
          {locked && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="#9CA3AF" strokeWidth="2.5" />
              <path d="M8 11V7a4 4 0 118 0v4" stroke="#9CA3AF" strokeWidth="2.5" />
            </svg>
          )}
        </div>
        {move?.description && (
          <div style={{
            fontFamily: F.body, fontSize: 11.5, color: "#9CA3AF",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {move.description}
          </div>
        )}
      </div>

      {/* Type pill */}
      <div style={{
        padding: "3px 7px", borderRadius: 4,
        background: tc.bg, border: `1px solid ${tc.border}`,
        fontFamily: F.mono, fontSize: 8, color: tc.dark,
        letterSpacing: "0.06em", fontWeight: 500, flexShrink: 0,
      }}>
        {tc.label}
      </div>

      {/* Tier */}
      <div style={{ flexShrink: 0 }}>
        <TierBadge tier={tier} />
      </div>

      {/* GP */}
      <div style={{
        fontFamily: F.display, fontSize: 22, width: 30,
        textAlign: "center", flexShrink: 0,
        color: gpColor(effectiveGP),
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

// ═══════════════════════════════════════════════════════════
//  MODE: FLIP — turn reveal
// ═══════════════════════════════════════════════════════════
function FlipCard({ move, type, isOpponent, flipped }) {
  const tc = TYPE_COLORS[type] || TYPE_COLORS.transition;
  const sideColor = isOpponent ? "#2563EB" : "#C23028";
  const sideBg = isOpponent ? "#EFF4FF" : "#FEF2F1";
  const fromPos = posName(move?.from_position);
  const toPos = posName(move?.to_position);

  return (
    <div style={{ width: 150, height: 200, perspective: 600 }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: flipped ? "rotateY(180deg)" : "none",
      }}>
        {/* Back (face-down) */}
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

        {/* Front (face-up) */}
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
            background: "#FFFFFF", border: `1px solid ${tc.border}`,
            alignSelf: "flex-start", marginBottom: 12,
          }}>
            <TypeIcon type={type} size={10} />
            <span style={{
              fontFamily: F.mono, fontSize: 8, color: tc.dark,
              letterSpacing: "0.06em", fontWeight: 500,
            }}>
              {tc.label}
            </span>
          </div>
          <div style={{
            fontFamily: F.display, fontSize: 22, color: "#111827",
            lineHeight: 1.15, flex: 1,
          }}>
            {move?.name || "Unknown"}
          </div>
          {(fromPos || toPos) && (
            <div style={{
              fontFamily: F.mono, fontSize: 8, color: "#9CA3AF",
              letterSpacing: "0.04em",
            }}>
              {fromPos} <span style={{ color: tc.color }}>→</span> {toPos}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN EXPORT — mode router
// ═══════════════════════════════════════════════════════════
export default function MoveCard(props) {
  const { mode = "compact" } = props;
  switch (mode) {
    case "compact": return <CompactCard {...props} />;
    case "full": return <FullCard {...props} />;
    case "row": return <RowCard {...props} />;
    case "flip": return <FlipCard {...props} />;
    default: return <CompactCard {...props} />;
  }
}

// Named exports for direct import
export { CompactCard, FullCard, RowCard, FlipCard };
