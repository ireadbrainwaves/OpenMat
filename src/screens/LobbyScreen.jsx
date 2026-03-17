// ═══════════════════════════════════════════════════════════
// OPEN MAT — LOBBY SCREEN (LIGHT MODE)
// Ranked Bot Ladder with belt-gated progression
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

const LADDER = [
  { rank: 1, name: "Iron Mike",     arch: "wrestler",          elo: 1000, belt: "white",  flavor: "Takedown machine. Will grind you.",           uuid: "00000001-0000-0000-0000-000000000001" },
  { rank: 2, name: "Rodolfo",       arch: "pressure_passer",   elo: 1050, belt: "white",  flavor: "Heavy pressure. Smash pass.",                 uuid: "00000004-0000-0000-0000-000000000004" },
  { rank: 3, name: "Miyao",         arch: "guard_puller",      elo: 1150, belt: "blue",   flavor: "Berimbolo from everywhere.",                  uuid: "00000002-0000-0000-0000-000000000002" },
  { rank: 4, name: "Marcelo",       arch: "submission_hunter", elo: 1200, belt: "blue",   flavor: "Always hunting. Always.",                     uuid: "00000005-0000-0000-0000-000000000005" },
  { rank: 5, name: "Haisam",        arch: "leg_locker",        elo: 1350, belt: "purple", flavor: "Your knees aren't safe.",                     uuid: "00000003-0000-0000-0000-000000000003" },
  { rank: 6, name: "Ruotolo",       arch: "scrambler",         elo: 1500, belt: "purple", flavor: "Chaos incarnate.",                            uuid: "00000006-0000-0000-0000-000000000006" },
  { rank: 7, name: "The Professor", arch: "submission_hunter", elo: 3000, belt: "black",  flavor: "I know every technique. I've seen every position. Show me something new.", uuid: "00000007-0000-0000-0000-000000000007", isBoss: true },
];

const BELT_ORDER = { white: 0, blue: 1, purple: 2, brown: 3, black: 4 };

export default function LobbyScreen({ user, profile, onNavigate }) {
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [beaten, setBeaten] = useState(new Set());
  const [checking, setChecking] = useState(true);
  const [botReqs, setBotReqs] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const { data: reqs } = await sb.from('bot_requirements').select('*');
        if (reqs) { const map = {}; reqs.forEach(r => { map[r.bot_id] = r; }); setBotReqs(map); }
        const botIds = LADDER.map(b => b.uuid);
        const { data: wins } = await sb.from('matches').select('player1_id, player2_id, winner_id')
          .eq('status', 'finished').eq('winner_id', profile.id)
          .or(botIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','));
        const beatenSet = new Set();
        if (wins) { for (const m of wins) { const botId = m.player1_id === profile.id ? m.player2_id : m.player1_id; if (botIds.includes(botId)) beatenSet.add(botId); } }
        setBeaten(beatenSet);
      } catch (e) { console.error('Failed to load lobby data:', e); }
      setChecking(false);
    })();
  }, [profile.id]);

  const isBotUnlocked = (botId) => {
    const req = botReqs[botId]; if (!req) return true;
    const playerBeltRank = BELT_ORDER[profile.belt] || 0;
    const reqBeltRank = BELT_ORDER[req.required_belt] || 0;
    if (playerBeltRank > reqBeltRank) return true;
    if (playerBeltRank < reqBeltRank) return false;
    if ((profile.belt_stripe || 0) < (req.required_stripe || 0)) return false;
    if ((profile.matches_won || 0) < (req.required_wins || 0)) return false;
    return true;
  };

  const getUnlockMessage = (botId) => { const req = botReqs[botId]; if (!req) return null; return req.unlock_message || `Reach ${req.required_belt} belt to challenge`; };

  const challengeBot = async (bot) => {
    setLoading(bot.uuid); setError(null);
    try {
      const { data, error: rpcError } = await sb.rpc("challenge_bot", { p_player_id: user.id, p_bot_id: bot.uuid });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("No match ID returned");
      onNavigate && onNavigate('game_plan', { matchId: data, isBot: true, botId: bot.uuid });
    } catch (e) { console.error("Challenge bot error:", e); setError("Failed to start match — try again."); }
    setLoading(null);
  };

  const nextRank = LADDER.find(b => !beaten.has(b.uuid) && isBotUnlocked(b.uuid));
  const ladderDisplay = [...LADDER].reverse();

  return (
    <div style={{ padding: "20px 16px", animation: "fadeUp 0.3s ease-out", minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: F.display, fontSize: 28, color: T.text }}>Ranked Ladder</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
          {checking ? "Checking progress..." : beaten.size === 0 ? "Defeat each opponent to climb" : `${beaten.size}/${LADDER.length} defeated`}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 12px", background: `${T.red}08`, border: `1px solid ${T.red}20`, borderRadius: 8, marginBottom: 12, fontFamily: F.mono, fontSize: 10, color: T.red }}>{error}</div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {ladderDisplay.map(bot => {
          const unlocked = isBotUnlocked(bot.uuid);
          const isBeaten = beaten.has(bot.uuid);
          const isCurrent = nextRank && nextRank.uuid === bot.uuid;
          const beltColor = BeltColors[bot.belt] || T.muted;
          const archColor = ArchColors[bot.arch] || T.muted;
          const unlockMsg = getUnlockMessage(bot.uuid);
          const animal = ARCHETYPE_ANIMALS[bot.arch] || '';

          if (bot.isBoss) {
            return <BossCard key={bot.uuid} bot={bot} unlocked={unlocked} isBeaten={isBeaten} isCurrent={isCurrent} loading={loading} onChallenge={challengeBot} unlockMsg={unlockMsg} />;
          }

          return (
            <div key={bot.uuid} style={{ display: "flex", alignItems: "stretch", opacity: !unlocked ? 0.5 : 1, transition: "all 0.2s", ...(isCurrent && unlocked ? { animation: "bossPulse 2.5s ease-in-out infinite" } : {}) }}>
              <div style={{ width: 4, borderRadius: "4px 0 0 4px", flexShrink: 0, background: isBeaten ? T.green : unlocked ? beltColor : T.dim }} />
              <div style={{
                flex: 1, padding: "12px 14px",
                background: isBeaten ? `${T.green}04` : '#FFFFFF',
                border: `1px solid ${isBeaten ? `${T.green}20` : isCurrent ? `${archColor}30` : T.border}`,
                borderLeft: "none", borderRadius: "0 8px 8px 0", boxShadow: T.shadowSm,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: isBeaten ? `${T.green}10` : '#F9FAFB',
                    border: `1px solid ${isBeaten ? `${T.green}25` : T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: F.display, fontSize: 13, color: isBeaten ? T.green : T.dim,
                  }}>
                    {isBeaten ? "+" : bot.rank}
                  </div>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: unlocked ? `${archColor}08` : '#F9FAFB',
                    border: `1px solid ${unlocked ? `${archColor}15` : T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {unlocked ? <ArchIcon id={bot.arch} s={18}/> : <LockIcon />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: F.display, fontSize: 16, color: unlocked ? T.text : T.dim }}>{bot.name}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 7, letterSpacing: "0.08em", textTransform: "uppercase", color: beltColor, background: `${beltColor}10`, padding: "1px 5px", borderRadius: 3 }}>{bot.belt}</span>
                    </div>
                    <div style={{ fontFamily: F.mono, fontSize: 9, color: unlocked ? archColor : T.dim, letterSpacing: "0.04em" }}>
                      {unlocked ? (animal ? `${animal} · ` : '') + bot.arch.replace(/_/g, " ") : (unlockMsg || 'Locked')}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: unlocked ? T.gold : T.dim }}>{unlocked ? bot.elo : "???"}</div>
                    {unlocked && (
                      <button onClick={() => challengeBot(bot)} disabled={!!loading} style={{
                        padding: "5px 10px", borderRadius: 6, fontFamily: F.mono, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                        cursor: loading ? "default" : "pointer",
                        border: `1.5px solid ${isCurrent ? '#111827' : isBeaten ? `${T.green}30` : T.border}`,
                        background: isCurrent ? '#111827' : "#FFFFFF",
                        color: isCurrent ? '#FFFFFF' : isBeaten ? T.green : T.muted,
                        opacity: loading && loading !== bot.uuid ? 0.4 : 1,
                      }}>
                        {loading === bot.uuid ? "..." : isBeaten ? "Rematch" : "Fight"}
                      </button>
                    )}
                  </div>
                </div>
                {(isCurrent || isBeaten) && unlocked && (
                  <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 6, marginLeft: 70, lineHeight: 1.4, fontStyle: "italic" }}>"{bot.flavor}"</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "8px 12px", textAlign: "center" }}>
        <div style={{ fontFamily: F.mono, fontSize: 8, color: T.dim, letterSpacing: "0.14em", textTransform: "uppercase" }}>PvP matchmaking coming soon</div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
      <rect x="7" y="10" width="10" height="9" rx="1.5" stroke="#9CA3AF" strokeWidth="1.5" fill="none"/>
      <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function BossCard({ bot, unlocked, isBeaten, isCurrent, loading, onChallenge, unlockMsg }) {
  return (
    <div style={{ opacity: !unlocked ? 0.3 : 1, transition: "all 0.2s", ...(isCurrent && unlocked ? { animation: "bossPulse 2s ease-in-out infinite" } : {}) }}>
      <div style={{
        padding: "16px 14px", textAlign: "left",
        background: isBeaten ? `${T.green}04` : unlocked ? `linear-gradient(135deg, #FDF8EC, #FFFFFF)` : '#FFFFFF',
        border: `2px solid ${isBeaten ? `${T.green}30` : unlocked ? T.gold : T.border}`,
        borderRadius: 12, position: "relative", overflow: "hidden", boxShadow: T.shadowMd,
      }}>
        <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: isBeaten ? T.green : unlocked ? T.gold : T.dim, marginBottom: 8 }}>
          {isBeaten ? "* CONQUERED *" : "FINAL BOSS"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: unlocked ? `${T.gold}10` : '#F9FAFB',
            border: `2px solid ${isBeaten ? `${T.green}30` : unlocked ? T.gold : T.dim}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unlocked ? (isBeaten ? <span style={{ fontFamily: F.display, fontSize: 18, color: T.green }}>+</span> : <ArchIcon id={bot.arch} s={24}/>) : <LockIcon />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: F.display, fontSize: 20, color: isBeaten ? T.green : unlocked ? T.text : T.dim }}>{bot.name}</span>
              <span style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.08em", color: T.gold, background: `${T.gold}10`, padding: "1px 6px", borderRadius: 3 }}>BLACK</span>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: unlocked ? T.red : T.dim, letterSpacing: "0.06em" }}>
              {unlocked ? "Spider · submission hunter · master" : (unlockMsg || "Locked")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontFamily: F.display, fontSize: 16, color: unlocked ? T.gold : T.dim }}>{unlocked ? bot.elo : "???"}</div>
            {unlocked && (
              <button onClick={() => onChallenge(bot)} disabled={!!loading} style={{
                padding: "6px 12px", borderRadius: 6, fontFamily: F.mono, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: loading ? "default" : "pointer",
                border: `1.5px solid ${isBeaten ? `${T.green}30` : T.gold}`,
                background: isBeaten ? "#FFFFFF" : `${T.gold}08`,
                color: isBeaten ? T.green : T.gold,
              }}>
                {loading === bot.uuid ? "..." : isBeaten ? "Rematch" : "Fight"}
              </button>
            )}
          </div>
        </div>
        {unlocked && !isBeaten && (
          <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 10, fontStyle: "italic", lineHeight: 1.5, paddingLeft: 56 }}>"{bot.flavor}"</div>
        )}
        {loading === bot.uuid && (
          <div style={{ fontFamily: F.mono, fontSize: 9, color: T.sub, marginTop: 6, paddingLeft: 56 }}>Starting match...</div>
        )}
      </div>
    </div>
  );
}
