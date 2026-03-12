// ═══════════════════════════════════════════════════════════
// OPEN MAT — LOBBY SCREEN
// Ranked Bot Ladder — climb from Iron Mike to The Professor
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { sb } from '../lib/supabase';

const LADDER = [
  { rank: 1, name: "Iron Mike",       arch: "wrestler",          elo: 1000, belt: "white",  flavor: "Takedown machine. Will grind you.",           uuid: "00000001-0000-0000-0000-000000000001" },
  { rank: 2, name: "Miyao",           arch: "guard_puller",      elo: 1050, belt: "white",  flavor: "Berimbolo from everywhere.",                  uuid: "00000002-0000-0000-0000-000000000002" },
  { rank: 3, name: "Rodolfo",         arch: "pressure_passer",   elo: 1150, belt: "blue",   flavor: "Heavy pressure. Smash pass.",                 uuid: "00000004-0000-0000-0000-000000000004" },
  { rank: 4, name: "Haisam",          arch: "leg_locker",        elo: 1200, belt: "blue",   flavor: "Your knees aren't safe.",                     uuid: "00000003-0000-0000-0000-000000000003" },
  { rank: 5, name: "Ruotolo",         arch: "scrambler",         elo: 1350, belt: "purple", flavor: "Chaos incarnate.",                            uuid: "00000006-0000-0000-0000-000000000006" },
  { rank: 6, name: "Marcelo",         arch: "submission_hunter", elo: 1500, belt: "brown",  flavor: "Always hunting. Always.",                     uuid: "00000005-0000-0000-0000-000000000005" },
  { rank: 7, name: "The Professor",   arch: "submission_hunter", elo: 3000, belt: "black",  flavor: "I know every technique. I've seen every position. Show me something new.", uuid: "00000007-0000-0000-0000-000000000007", isBoss: true },
];

export default function LobbyScreen({ user, profile, onNavigate }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [beaten, setBeaten] = useState(new Set());
  const [checking, setChecking] = useState(true);

  // Check which bots the player has beaten
  useEffect(() => {
    (async () => {
      try {
        const botIds = LADDER.map(b => b.uuid);
        const { data: wins } = await sb
          .from('matches')
          .select('player1_id, player2_id, winner_id')
          .eq('status', 'finished')
          .eq('winner_id', profile.id)
          .or(botIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','));

        const beatenSet = new Set();
        if (wins) {
          for (const m of wins) {
            const botId = m.player1_id === profile.id ? m.player2_id : m.player1_id;
            if (botIds.includes(botId)) beatenSet.add(botId);
          }
        }
        setBeaten(beatenSet);
      } catch (e) {
        console.error('Failed to check bot wins:', e);
      }
      setChecking(false);
    })();
  }, [profile.id]);

  const isUnlocked = (bot) => {
    if (bot.rank === 1) return true;
    const prev = LADDER.find(b => b.rank === bot.rank - 1);
    return prev && beaten.has(prev.uuid);
  };

  const challengeBot = async (bot) => {
    setLoading(bot.uuid);
    setError(null);
    try {
      const { data, error: rpcError } = await sb.rpc("challenge_bot", {
        p_player_id: user.id,
        p_bot_id: bot.uuid,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("No match ID returned");
      onNavigate && onNavigate('game_plan', { matchId: data, isBot: true, botId: bot.uuid });
    } catch (e) {
      console.error("Challenge bot error:", e);
      setError("Failed to start match — try again.");
    }
    setLoading(null);
  };

  // Current target = first unbeaten bot
  const nextRank = LADDER.find(b => !beaten.has(b.uuid));

  // Display top-to-bottom: boss at top, rank 1 at bottom
  const ladderDisplay = [...LADDER].reverse();

  return (
    <div style={{ padding: "20px 16px", animation: "fadeUp 0.3s ease-out", minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.display, fontSize: 28, color: T.white, letterSpacing: "0.06em" }}>Ranked Ladder</div>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>
          {checking ? "Checking progress..." : beaten.size === 0 ? "Defeat each opponent to climb" : `${beaten.size}/${LADDER.length} defeated`}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 12px", background: `${T.red}10`, border: `1px solid ${T.red}30`, borderRadius: 4, marginBottom: 12, fontFamily: T.mono, fontSize: 10, color: T.red }}>
          {error}
        </div>
      )}

      {/* Ladder */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {ladderDisplay.map(bot => {
          const unlocked = isUnlocked(bot);
          const isBeaten = beaten.has(bot.uuid);
          const isCurrent = nextRank && nextRank.uuid === bot.uuid;
          const beltColor = BeltColors[bot.belt] || T.muted;
          const archColor = ArchColors[bot.arch] || T.muted;

          if (bot.isBoss) {
            return (
              <BossCard
                key={bot.uuid} bot={bot} unlocked={unlocked} isBeaten={isBeaten}
                isCurrent={isCurrent} loading={loading} onChallenge={challengeBot}
              />
            );
          }

          return (
            <div
              key={bot.uuid}
              style={{
                display: "flex", alignItems: "stretch",
                opacity: !unlocked ? 0.4 : 1,
                transition: "all 0.2s",
                ...(isCurrent && unlocked ? {
                  animation: "bossPulse 2.5s ease-in-out infinite",
                } : {}),
              }}
            >
              {/* Belt-colored left border */}
              <div style={{
                width: 4, borderRadius: "4px 0 0 4px", flexShrink: 0,
                background: isBeaten ? T.green : unlocked ? beltColor : T.dim,
              }} />

              {/* Card body */}
              <div style={{
                flex: 1, padding: "12px 14px",
                background: isBeaten ? `${T.green}06` : isCurrent ? `${archColor}06` : T.surface,
                border: `1px solid ${isBeaten ? `${T.green}25` : isCurrent ? `${archColor}40` : T.border}`,
                borderLeft: "none",
                borderRadius: "0 6px 6px 0",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Rank badge */}
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: isBeaten ? `${T.green}18` : T.surface2,
                    border: `1px solid ${isBeaten ? `${T.green}40` : T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: T.display, fontSize: 13,
                    color: isBeaten ? T.green : T.dim,
                  }}>
                    {isBeaten ? "✓" : bot.rank}
                  </div>

                  {/* Archetype icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: unlocked ? `${archColor}10` : T.surface2,
                    border: `1px solid ${unlocked ? `${archColor}20` : T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {unlocked ? <ArchIcon id={bot.arch} s={18}/> : <LockIcon />}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: T.display, fontSize: 15, color: unlocked ? T.white : T.dim, letterSpacing: "0.04em" }}>
                        {bot.name}
                      </span>
                      <span style={{
                        fontFamily: T.mono, fontSize: 7, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: beltColor, background: `${beltColor}12`, padding: "1px 5px", borderRadius: 2,
                      }}>
                        {bot.belt}
                      </span>
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 9, color: unlocked ? archColor : T.dim, letterSpacing: "0.04em" }}>
                      {unlocked ? bot.arch.replace(/_/g, " ") : `Beat ${LADDER.find(b => b.rank === bot.rank - 1)?.name} to unlock`}
                    </div>
                  </div>

                  {/* Right side: Elo + Challenge button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: unlocked ? T.gold : T.dim }}>
                      {unlocked ? bot.elo : "???"}
                    </div>
                    {unlocked && (
                      <button
                        onClick={() => challengeBot(bot)}
                        disabled={!!loading}
                        style={{
                          padding: "5px 10px", borderRadius: 3,
                          fontFamily: T.mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                          cursor: loading ? "default" : "pointer",
                          border: `1px solid ${isCurrent ? T.you : isBeaten ? `${T.green}40` : T.border}`,
                          background: isCurrent ? `${T.you}15` : "transparent",
                          color: isCurrent ? T.you : isBeaten ? T.green : T.muted,
                          opacity: loading && loading !== bot.uuid ? 0.4 : 1,
                        }}
                      >
                        {loading === bot.uuid ? "..." : isBeaten ? "Rematch" : "Fight"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Flavor text — current target or beaten */}
                {(isCurrent || isBeaten) && unlocked && (
                  <div style={{ fontFamily: T.body, fontSize: 10, color: T.muted, marginTop: 6, marginLeft: 70, lineHeight: 1.4 }}>
                    {bot.flavor}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* PvP note */}
      <div style={{ marginTop: 16, padding: "8px 12px", textAlign: "center" }}>
        <div style={{ fontFamily: T.mono, fontSize: 8, color: T.dim, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          PvP matchmaking coming soon
        </div>
      </div>
    </div>
  );
}

// ── LOCK ICON ─────────────────────────────────────────────
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
      <rect x="7" y="10" width="10" height="9" rx="1.5" stroke={T.dim} strokeWidth="1.5" fill="none"/>
      <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke={T.dim} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

// ── BOSS CARD ─────────────────────────────────────────────
function BossCard({ bot, unlocked, isBeaten, isCurrent, loading, onChallenge }) {
  const goldDark = "#B8860B";
  const goldLight = T.gold;

  return (
    <div style={{
      opacity: !unlocked ? 0.3 : 1, transition: "all 0.2s",
      ...(isCurrent && unlocked ? { animation: "bossPulse 2s ease-in-out infinite" } : {}),
    }}>
      <div style={{
        padding: "16px 14px", textAlign: "left",
        background: isBeaten
          ? `linear-gradient(135deg, ${T.green}08, ${T.surface})`
          : unlocked
            ? `linear-gradient(135deg, ${goldDark}10, ${T.red}06, ${T.surface})`
            : T.surface,
        border: `2px solid ${isBeaten ? `${T.green}40` : unlocked ? goldLight : T.border}`,
        borderRadius: 8,
        position: "relative", overflow: "hidden",
      }}>
        {/* FINAL BOSS label */}
        <div style={{
          fontFamily: T.mono, fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase",
          color: isBeaten ? T.green : unlocked ? goldLight : T.dim,
          marginBottom: 8,
        }}>
          {isBeaten ? "★ CONQUERED ★" : "⚔ FINAL BOSS ⚔"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Boss icon */}
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: unlocked ? `${goldDark}18` : T.surface2,
            border: `2px solid ${isBeaten ? `${T.green}50` : unlocked ? goldLight : T.dim}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unlocked ? (
              isBeaten
                ? <span style={{ fontFamily: T.display, fontSize: 18, color: T.green }}>✓</span>
                : <ArchIcon id={bot.arch} s={24}/>
            ) : <LockIcon />}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontFamily: T.display, fontSize: 20,
                color: isBeaten ? T.green : unlocked ? goldLight : T.dim,
                letterSpacing: "0.06em",
              }}>
                {bot.name}
              </span>
              <span style={{
                fontFamily: T.mono, fontSize: 8, letterSpacing: "0.08em",
                color: goldLight, background: unlocked ? `${goldLight}15` : T.surface2,
                padding: "1px 6px", borderRadius: 2,
              }}>
                ★ BLACK
              </span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: unlocked ? T.red : T.dim, letterSpacing: "0.06em" }}>
              {unlocked ? "submission hunter • master" : `Beat ${LADDER.find(b => b.rank === bot.rank - 1)?.name} to unlock`}
            </div>
          </div>

          {/* Elo + Challenge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontFamily: T.display, fontSize: 16, color: unlocked ? goldLight : T.dim }}>
              {unlocked ? bot.elo : "???"}
            </div>
            {unlocked && (
              <button
                onClick={() => onChallenge(bot)}
                disabled={!!loading}
                style={{
                  padding: "6px 12px", borderRadius: 3,
                  fontFamily: T.mono, fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                  cursor: loading ? "default" : "pointer",
                  border: `1px solid ${isBeaten ? `${T.green}40` : goldLight}`,
                  background: isBeaten ? "transparent" : `${goldLight}12`,
                  color: isBeaten ? T.green : goldLight,
                }}
              >
                {loading === bot.uuid ? "..." : isBeaten ? "Rematch" : "Fight"}
              </button>
            )}
          </div>
        </div>

        {/* Flavor text */}
        {unlocked && !isBeaten && (
          <div style={{
            fontFamily: T.body, fontSize: 11, color: T.muted, marginTop: 10,
            fontStyle: "italic", lineHeight: 1.5, paddingLeft: 56,
          }}>
            "{bot.flavor}"
          </div>
        )}

        {loading === bot.uuid && (
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.you, marginTop: 6, paddingLeft: 56 }}>Starting match...</div>
        )}
      </div>
    </div>
  );
}
