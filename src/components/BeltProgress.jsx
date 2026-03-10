import React, { useState, useEffect } from 'react';
import { sb as supabase } from '../lib/supabase';

/*
 * BeltProgress — Phase 3.4
 * 
 * Reusable component that shows:
 * - Current belt with progress bars toward next belt
 * - Wins / Matches / Submissions / Unique Techniques progress
 * - "PROMOTE" button when all requirements are met
 * - Celebration animation on promotion
 * 
 * Usage:
 *   <BeltProgress profileId={user.id} onPromotion={(newBelt) => refreshProfile()} />
 * 
 * Can be embedded in PostMatchScreen and HomeScreen.
 */

const BELT_COLORS = {
  white: '#ccc',
  blue: '#4895ef',
  purple: '#9b59b6',
  brown: '#8B4513',
  black: '#333',
};

const BELT_ORDER = ['white', 'blue', 'purple', 'brown', 'black'];

const BELT_PERKS = {
  blue: { deckMax: 35, drillSlots: 4, variantSlots: 1 },
  purple: { deckMax: 45, drillSlots: 5, variantSlots: 2 },
  brown: { deckMax: 55, drillSlots: 5, variantSlots: 3 },
  black: { deckMax: 65, drillSlots: 5, variantSlots: 4 },
};

export default function BeltProgress({ profileId, compact = false, onPromotion }) {
  const [progress, setProgress] = useState(null);
  const [eligible, setEligible] = useState(false);
  const [nextBelt, setNextBelt] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkProgress();
  }, [profileId]);

  async function checkProgress() {
    try {
      const { data, error } = await supabase.rpc('check_belt_promotion', {
        p_profile_id: profileId,
      });

      if (error) throw error;
      if (data && data.length > 0) {
        const row = data[0];
        setEligible(row.eligible);
        setNextBelt(row.next_belt);
        setProgress(row.progress);
      }
    } catch (err) {
      console.error('Belt check error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePromotion() {
    setPromoting(true);
    try {
      const { data: newBelt, error } = await supabase.rpc('promote_belt', {
        p_profile_id: profileId,
      });

      if (error) throw error;

      setPromoted(true);
      setTimeout(() => {
        if (onPromotion) onPromotion(newBelt);
      }, 2500);
    } catch (err) {
      console.error('Promotion error:', err);
      alert('Promotion failed: ' + err.message);
    } finally {
      setPromoting(false);
    }
  }

  if (loading) return null;
  if (!nextBelt || !progress) {
    // Max belt (black) — show achievement badge
    return (
      <div style={styles.maxBelt}>
        <div style={styles.maxBeltIcon}>◆</div>
        <div style={styles.maxBeltText}>BLACK BELT</div>
      </div>
    );
  }

  // Promotion celebration overlay
  if (promoted) {
    const perks = BELT_PERKS[nextBelt];
    return (
      <div style={styles.celebrationWrap}>
        <div style={styles.celebrationFlash} />
        <div style={styles.celebrationContent}>
          <div style={styles.celebrationEmoji}>🥋</div>
          <div style={styles.celebrationTitle}>BELT PROMOTION</div>
          <div style={{
            ...styles.celebrationBelt,
            color: BELT_COLORS[nextBelt],
          }}>
            {nextBelt.toUpperCase()} BELT
          </div>
          {perks && (
            <div style={styles.celebrationPerks}>
              <div style={styles.perkItem}>Deck size: {perks.deckMax} moves</div>
              <div style={styles.perkItem}>Drill slots: {perks.drillSlots}</div>
              <div style={styles.perkItem}>Variant slots: {perks.variantSlots}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const categories = [
    { key: 'wins', label: 'Wins', icon: '🏆' },
    { key: 'matches', label: 'Matches', icon: '⚔️' },
    { key: 'submissions', label: 'Subs', icon: '🔒' },
    { key: 'unique_techniques', label: 'Techniques', icon: '📚' },
  ];

  // Compact mode — single progress bar (for PostMatchScreen)
  if (compact) {
    const allDone = categories.every(c => {
      const p = progress[c.key];
      return p && p.current >= p.required;
    });
    const totalPct = categories.reduce((sum, c) => {
      const p = progress[c.key];
      if (!p || p.required === 0) return sum + 100;
      return sum + Math.min(100, (p.current / p.required) * 100);
    }, 0) / categories.length;

    return (
      <div style={styles.compactWrap}>
        <div style={styles.compactHeader}>
          <div style={styles.compactLabel}>
            Next belt: <span style={{ color: BELT_COLORS[nextBelt], fontWeight: 700 }}>{nextBelt}</span>
          </div>
          <div style={styles.compactPct}>{Math.round(totalPct)}%</div>
        </div>
        <div style={styles.compactBarBg}>
          <div style={{
            ...styles.compactBarFill,
            width: `${totalPct}%`,
            background: eligible ? 'var(--red, #e63946)' : BELT_COLORS[nextBelt],
          }} />
        </div>
        {eligible && (
          <button
            onClick={handlePromotion}
            disabled={promoting}
            style={styles.promoteBtn}
          >
            {promoting ? 'Promoting...' : `PROMOTE TO ${nextBelt.toUpperCase()}`}
          </button>
        )}
      </div>
    );
  }

  // Full mode — detailed breakdown (for HomeScreen)
  return (
    <div style={styles.fullWrap}>
      <div style={styles.fullHeader}>
        <div style={styles.fullTitle}>BELT PROGRESS</div>
        <div style={{
          ...styles.fullNextBelt,
          color: BELT_COLORS[nextBelt],
        }}>
          → {nextBelt.toUpperCase()}
        </div>
      </div>

      <div style={styles.categoryGrid}>
        {categories.map(cat => {
          const p = progress[cat.key];
          if (!p) return null;
          const pct = p.required === 0 ? 100 : Math.min(100, (p.current / p.required) * 100);
          const done = p.current >= p.required;

          return (
            <div key={cat.key} style={styles.catItem}>
              <div style={styles.catHeader}>
                <span style={styles.catIcon}>{cat.icon}</span>
                <span style={styles.catLabel}>{cat.label}</span>
                <span style={{
                  ...styles.catCount,
                  color: done ? 'var(--green, #52b788)' : 'var(--text, #e8e8f0)',
                }}>
                  {p.current}/{p.required}
                </span>
              </div>
              <div style={styles.catBarBg}>
                <div style={{
                  ...styles.catBarFill,
                  width: `${pct}%`,
                  background: done ? 'var(--green, #52b788)' : BELT_COLORS[nextBelt],
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {eligible && (
        <button
          onClick={handlePromotion}
          disabled={promoting}
          style={styles.promoteBtn}
        >
          {promoting ? 'Promoting...' : `🥋 PROMOTE TO ${nextBelt.toUpperCase()} BELT`}
        </button>
      )}
    </div>
  );
}

const styles = {
  // Max belt
  maxBelt: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
  },
  maxBeltIcon: {
    fontSize: 16,
    color: '#FFD700',
  },
  maxBeltText: {
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.2em',
    color: '#FFD700',
    fontWeight: 600,
  },
  // Compact mode
  compactWrap: {
    padding: '10px 0',
  },
  compactHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  compactLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: '0.1em',
    color: 'var(--muted, #44445a)',
    textTransform: 'uppercase',
  },
  compactPct: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    color: 'var(--text, #e8e8f0)',
  },
  compactBarBg: {
    height: 4,
    background: 'var(--border, #1a1a22)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s ease',
  },
  // Full mode
  fullWrap: {
    padding: '14px 0',
  },
  fullHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: '0.18em',
    color: 'var(--muted, #44445a)',
    textTransform: 'uppercase',
  },
  fullNextBelt: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    letterSpacing: '0.06em',
  },
  categoryGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  catItem: {},
  catHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  catIcon: { fontSize: 12 },
  catLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 9,
    letterSpacing: '0.1em',
    color: 'var(--muted, #44445a)',
    textTransform: 'uppercase',
    flex: 1,
  },
  catCount: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 600,
  },
  catBarBg: {
    height: 4,
    background: 'var(--border, #1a1a22)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s ease',
  },
  // Promote button
  promoteBtn: {
    width: '100%',
    marginTop: 14,
    padding: '14px 20px',
    background: 'var(--red, #e63946)',
    border: 'none',
    borderRadius: 4,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.2em',
    color: '#fff',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  // Celebration
  celebrationWrap: {
    position: 'relative',
    padding: '40px 20px',
    textAlign: 'center',
    overflow: 'hidden',
  },
  celebrationFlash: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle, rgba(230,57,70,0.1) 0%, transparent 70%)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  celebrationContent: {
    position: 'relative',
    zIndex: 1,
  },
  celebrationEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  celebrationTitle: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    letterSpacing: '0.3em',
    color: 'var(--muted, #44445a)',
    marginBottom: 6,
  },
  celebrationBelt: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 42,
    letterSpacing: '0.08em',
    lineHeight: 1,
    marginBottom: 16,
  },
  celebrationPerks: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
  },
  perkItem: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: 'var(--muted, #44445a)',
    letterSpacing: '0.06em',
  },
};
