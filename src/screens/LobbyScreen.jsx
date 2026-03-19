// ═══════════════════════════════════════════════════════════
// OPEN MAT — LOBBY SCREEN (THE COMPETITION BOARD)
// Vertical ladder list. Quiet beaten bots. Loud frontier.
// Boss pinned at bottom. Like a bracket on the gym wall.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

// ── OLD QUICK MATCH LADDER (kept for free play) ──────────
const QUICK_LADDER = [
  { rank: 1, name: "Iron Mike",     arch: "wrestler",          elo: 1000, belt: "white",  flavor: "Takedown machine. Will grind you.",           uuid: "00000001-0000-0000-0000-000000000001" },
  { rank: 2, name: "Rodolfo",       arch: "pressure_passer",   elo: 1050, belt: "white",  flavor: "Heavy pressure. Smash pass.",                 uuid: "00000004-0000-0000-0000-000000000004" },
  { rank: 3, name: "Miyao",         arch: "guard_puller",      elo: 1150, belt: "blue",   flavor: "Berimbolo from everywhere.",                  uuid: "00000002-0000-0000-0000-000000000002" },
  { rank: 4, name: "Marcelo",       arch: "submission_hunter", elo: 1200, belt: "blue",   flavor: "Always hunting. Always.",                     uuid: "00000005-0000-0000-0000-000000000005" },
  { rank: 5, name: "Haisam",        arch: "leg_locker",        elo: 1350, belt: "purple", flavor: "Your knees aren't safe.",                     uuid: "00000003-0000-0000-0000-000000000003" },
  { rank: 6, name: "Ruotolo",       arch: "scrambler",         elo: 1500, belt: "purple", flavor: "Chaos incarnate.",                            uuid: "00000006-0000-0000-0000-000000000006" },
  { rank: 7, name: "The Professor", arch: "submission_hunter", elo: 3000, belt: "black",  flavor: "I know every technique. Show me something new.", uuid: "00000007-0000-0000-0000-000000000007", isBoss: true },
];

export default function LobbyScreen({ user, profile, onNavigate }) {
  const [tab, setTab] = useState('ladders');
  const [ladders, setLadders] = useState([]);
  const [selectedLadder, setSelectedLadder] = useState(null);
  const [ladderBots, setLadderBots] = useState([]);
  const [beaten, setBeaten] = useState(new Set());
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(true);

  // ── FETCH LADDERS ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await sb.from('ladders').select('*').order('sort_order');
      if (data) setLadders(data);
      setChecking(false);
    })();
  }, []);

  // ── FETCH BOTS + BEATEN STATUS ─────────────────────────
  useEffect(() => {
    if (!selectedLadder) { setLadderBots([]); return; }
    (async () => {
      setChecking(true);
      const { data: bots } = await sb.from('ladder_bots')
        .select('*').eq('ladder_id', selectedLadder.id).order('position');
      const botList = bots || [];
      setLadderBots(botList);

      const botIds = botList.map(b => b.bot_profile_id).filter(Boolean);
      if (botIds.length > 0) {
        const { data: wins } = await sb.from('matches')
          .select('player1_id, player2_id, winner_id')
          .eq('status', 'finished').eq('winner_id', profile.id)
          .or(botIds.map(id => `player2_id.eq.${id}`).join(','));
        const beatenSet = new Set();
        if (wins) {
          for (const m of wins) {
            const botId = m.player1_id === profile.id ? m.player2_id : m.player1_id;
            if (botIds.includes(botId)) beatenSet.add(botId);
          }
        }
        setBeaten(beatenSet);
      } else {
        setBeaten(new Set());
      }
      setChecking(false);
    })();
  }, [selectedLadder, profile.id]);

  // ── CHALLENGE BOT ──────────────────────────────────────
  const challengeBot = async (botProfileId) => {
    setLoading(botProfileId); setError(null);
    console.log('[LADDER] challenge_bot called:', { p_player_id: user.id, p_bot_id: botProfileId });
    const { data, error: rpcError } = await sb.rpc("challenge_bot", {
      p_player_id: user.id,
      p_bot_id: botProfileId,
    });
    console.log('[LADDER] challenge_bot response:', { data, error: rpcError });
    if (rpcError) {
      console.error("Challenge bot RPC error:", rpcError);
      setError(`Failed to start match: ${rpcError.message || 'Unknown error'}`);
      setLoading(null);
      return;
    }
    if (!data) {
      setError("Failed to start match — no match ID returned.");
      setLoading(null);
      return;
    }
    setLoading(null);
    onNavigate && onNavigate('game_plan', { matchId: data, isBot: true, botId: botProfileId });
  };

  const challengeQuickBot = async (bot) => {
    setLoading(bot.uuid); setError(null);
    const { data, error: rpcError } = await sb.rpc("challenge_bot", { p_player_id: user.id, p_bot_id: bot.uuid });
    if (rpcError) { setError(`Failed: ${rpcError.message}`); setLoading(null); return; }
    if (!data) { setError("No match ID returned."); setLoading(null); return; }
    setLoading(null);
    onNavigate && onNavigate('game_plan', { matchId: data, isBot: true, botId: bot.uuid });
  };

  return (
    <div style={{ padding: "20px 16px", minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      {/* Tab toggle */}
      <div style={{ display: 'flex', marginBottom: 16, border: `1.5px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {[{ key: 'ladders', label: 'Ladders' }, { key: 'quick', label: 'Quick Match' }].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedLadder(null); }} style={{
            flex: 1, padding: '10px', fontFamily: F.mono, fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            border: 'none', fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? '#111827' : '#FFFFFF',
            color: tab === t.key ? '#FFFFFF' : T.dim,
          }}>{t.label}</button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "10px 12px", background: `${T.red}08`, border: `1px solid ${T.red}20`, borderRadius: 8, marginBottom: 12, fontFamily: F.mono, fontSize: 10, color: T.red }}>{error}</div>
      )}

      {/* ═══ LADDERS TAB — Ladder Select ═══ */}
      {tab === 'ladders' && !selectedLadder && (
        <LadderSelect ladders={ladders} checking={checking} onSelect={setSelectedLadder} />
      )}

      {/* ═══ LADDERS TAB — The Competition Board ═══ */}
      {tab === 'ladders' && selectedLadder && (
        <LadderBoard
          ladder={selectedLadder}
          bots={ladderBots}
          beaten={beaten}
          checking={checking}
          loading={loading}
          onChallenge={challengeBot}
          onBack={() => setSelectedLadder(null)}
        />
      )}

      {/* ═══ QUICK MATCH ═══ */}
      {tab === 'quick' && (
        <QuickMatchList profile={profile} loading={loading} onChallenge={challengeQuickBot} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LADDER SELECT — archetype ladders
// ═══════════════════════════════════════════════════════════
function LadderSelect({ ladders, checking, onSelect }) {
  if (checking) return <div style={{ textAlign: 'center', padding: 40, fontFamily: F.body, fontSize: 14, color: T.muted }}>Loading...</div>;

  const ARCHETYPE_ORDER = ['wrestler', 'guard_puller', 'leg_locker', 'pressure_passer', 'submission_hunter', 'scrambler'];
  const normalizeArch = (a) => a === 'sub_hunter' ? 'submission_hunter' : a;
  const matchedLadders = {};
  for (const l of ladders) matchedLadders[normalizeArch(l.archetype)] = l;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: F.display, fontSize: 28, color: T.text }}>Choose a Ladder</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
          Each ladder tests a different style
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ARCHETYPE_ORDER.map(archId => {
          const ladder = matchedLadders[archId];
          const archColor = ArchColors[archId] || T.muted;
          const animal = ARCHETYPE_ANIMALS[archId] || '';
          const available = !!ladder;
          return (
            <div key={archId} onClick={() => available && onSelect(ladder)} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px', borderRadius: 12, background: '#FFFFFF',
              border: `1.5px solid ${available ? archColor + '25' : T.border}`,
              boxShadow: available ? T.shadowMd : T.shadowSm,
              cursor: available ? 'pointer' : 'default',
              opacity: available ? 1 : 0.5,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: `${archColor}08`, border: `1.5px solid ${archColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArchIcon id={archId} s={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>{ladder?.name || `${animal} Gauntlet`}</span>
                  {!available && <span style={{ fontFamily: F.mono, fontSize: 7, color: T.dim, background: '#F3F4F6', padding: '2px 6px', borderRadius: 3 }}>COMING SOON</span>}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>
                  {ladder?.description || `${animal} archetype ladder — coming soon`}
                </div>
              </div>
              {available && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke={T.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// THE COMPETITION BOARD — vertical bracket
// Beaten = quiet. Frontier = loud. Boss = pinned.
// ═══════════════════════════════════════════════════════════
function LadderBoard({ ladder, bots, beaten, checking, loading, onChallenge, onBack }) {
  if (checking) return <div style={{ textAlign: 'center', padding: 40, fontFamily: F.body, fontSize: 14, color: T.muted }}>Loading...</div>;

  const botProfileIds = bots.map(b => b.bot_profile_id);
  const isUnlocked = (idx) => idx === 0 || beaten.has(botProfileIds[idx - 1]);
  const frontierIdx = bots.findIndex((b, i) => isUnlocked(i) && !beaten.has(b.bot_profile_id));

  // Separate boss (last bot or difficulty_tier === 'boss')
  const bossBot = bots.find(b => b.difficulty_tier === 'boss' || b.position >= 29);
  const regularBots = bots.filter(b => b !== bossBot);

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: `1.5px solid ${T.border}`, borderRadius: 6,
          padding: '6px 10px', cursor: 'pointer', fontFamily: F.mono, fontSize: 9, color: T.muted,
        }}>BACK</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.display, fontSize: 22, color: T.text }}>{ladder.name}</div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>
            Bot {frontierIdx >= 0 ? frontierIdx + 1 : beaten.size + 1} of {bots.length}
          </div>
        </div>
      </div>

      {/* The bracket */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {regularBots.map((bot, idx) => {
          const unlocked = isUnlocked(idx);
          const isBeaten = beaten.has(bot.bot_profile_id);
          const isFrontier = idx === frontierIdx;
          const isBoss = bot === bossBot;

          // ── FRONTIER BOT: The loud one ──
          if (isFrontier) {
            const archColor = ArchColors[bot.archetype] || T.muted;
            return (
              <div key={bot.bot_profile_id || idx} style={{
                padding: '24px 20px', borderRadius: 12, marginTop: 8, marginBottom: 8,
                background: '#FFFFFF', border: `1.5px solid ${T.border}`,
                boxShadow: T.shadowMd,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: `${archColor}08`, border: `2px solid ${archColor}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArchIcon id={bot.archetype || 'wrestler'} s={32} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.display, fontSize: 24, color: T.text }}>{bot.bot_name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>
                      {ARCHETYPE_ANIMALS[bot.archetype] || ''} · Bot {bot.position} of {bots.length}
                    </div>
                  </div>
                </div>
                {bot.description && (
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
                    {bot.description}
                  </div>
                )}
                <button onClick={() => onChallenge(bot.bot_profile_id)} disabled={!!loading} style={{
                  width: '100%', padding: '14px', borderRadius: 8, border: 'none',
                  background: '#111827', color: '#FFFFFF',
                  fontFamily: F.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                  cursor: loading ? 'default' : 'pointer',
                  opacity: loading && loading !== bot.bot_profile_id ? 0.4 : 1,
                }}>
                  {loading === bot.bot_profile_id ? '...' : 'Challenge'}
                </button>
              </div>
            );
          }

          // ── BEATEN BOT: Quiet, crossed off ──
          if (isBeaten) {
            return (
              <div key={bot.bot_profile_id || idx} onClick={() => onChallenge(bot.bot_profile_id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: `1px solid ${T.border}`,
              }}>
                <span style={{ fontFamily: F.mono, fontSize: 11, color: T.green, width: 16 }}>+</span>
                <span style={{ fontFamily: F.mono, fontSize: 13, color: T.dim, flex: 1 }}>{bot.bot_name}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.green }}>W</span>
              </div>
            );
          }

          // ── LOCKED BOT: Nearly invisible ──
          if (!unlocked) {
            return (
              <div key={bot.bot_profile_id || idx} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', opacity: 0.35,
                borderBottom: `1px solid ${T.border}`,
              }}>
                <LockIcon />
                <span style={{ fontFamily: F.mono, fontSize: 11, color: T.dim, flex: 1 }}>Bot {bot.position}</span>
                <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>Locked</span>
              </div>
            );
          }

          // Unlocked but not frontier (shouldn't happen normally, but handle it)
          return (
            <div key={bot.bot_profile_id || idx} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: T.dim, width: 16 }}>#{bot.position}</span>
              <span style={{ fontFamily: F.mono, fontSize: 13, color: T.text, flex: 1 }}>{bot.bot_name}</span>
            </div>
          );
        })}

        {/* ── BOSS: Always visible at bottom ── */}
        {bossBot && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px', marginTop: 12,
            borderRadius: 10, border: `1.5px solid ${T.gold}30`,
            background: `${T.gold}04`,
          }}>
            <span style={{ fontFamily: F.display, fontSize: 14, color: T.gold, width: 16 }}>*</span>
            <span style={{ fontFamily: F.display, fontSize: 16, color: T.gold, flex: 1 }}>{bossBot.bot_name}</span>
            {beaten.has(bossBot.bot_profile_id) ? (
              <button onClick={() => onChallenge(bossBot.bot_profile_id)} disabled={!!loading} style={{
                padding: '5px 12px', borderRadius: 6, border: `1.5px solid ${T.gold}30`,
                background: '#FFFFFF', fontFamily: F.mono, fontSize: 8, color: T.gold,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}>Again</button>
            ) : isUnlocked(bots.indexOf(bossBot)) ? (
              <button onClick={() => onChallenge(bossBot.bot_profile_id)} disabled={!!loading} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: T.gold, fontFamily: F.mono, fontSize: 8, color: '#FFFFFF',
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}>Challenge</button>
            ) : (
              <span style={{ fontFamily: F.mono, fontSize: 8, color: T.dim }}>
                Defeat all {regularBots.length} to face
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// QUICK MATCH — free play
// ═══════════════════════════════════════════════════════════
function QuickMatchList({ profile, loading, onChallenge }) {
  const [beaten, setBeaten] = useState(new Set());

  useEffect(() => {
    (async () => {
      const botIds = QUICK_LADDER.map(b => b.uuid);
      const { data: wins } = await sb.from('matches')
        .select('player1_id, player2_id, winner_id')
        .eq('status', 'finished').eq('winner_id', profile.id)
        .or(botIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','));
      const beatenSet = new Set();
      if (wins) {
        for (const m of wins) {
          const botId = m.player1_id === profile.id ? m.player2_id : m.player1_id;
          if (botIds.includes(botId)) beatenSet.add(botId);
        }
      }
      setBeaten(beatenSet);
    })();
  }, [profile.id]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: F.display, fontSize: 28, color: T.text }}>Quick Match</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
          Free play — no progression tracking
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
        {QUICK_LADDER.map(bot => {
          const isBeaten = beaten.has(bot.uuid);
          return (
            <div key={bot.uuid} onClick={() => onChallenge(bot)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", cursor: "pointer",
              borderBottom: `1px solid ${T.border}`,
              ...(bot.isBoss ? { border: `1.5px solid ${T.gold}30`, borderRadius: 10, marginTop: 8, background: `${T.gold}04` } : {}),
            }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: isBeaten ? T.green : T.dim, width: 16 }}>
                {isBeaten ? '+' : `#${bot.rank}`}
              </span>
              <span style={{ fontFamily: bot.isBoss ? F.display : F.mono, fontSize: bot.isBoss ? 16 : 13, color: bot.isBoss ? T.gold : T.text, flex: 1 }}>
                {bot.name}
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: T.dim }}>{bot.belt}</span>
              <span style={{ fontFamily: F.mono, fontSize: 8, color: isBeaten ? T.green : T.muted, letterSpacing: '0.06em' }}>
                {loading === bot.uuid ? '...' : isBeaten ? 'AGAIN' : 'FIGHT'}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none">
      <rect x="7" y="10" width="10" height="9" rx="1.5" stroke="#9CA3AF" strokeWidth="1.5" fill="none"/>
      <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
