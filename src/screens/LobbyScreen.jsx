// ═══════════════════════════════════════════════════════════
// OPEN MAT — LOBBY SCREEN (LADDER SYSTEM)
// Two tabs: Ladders (progression) | Quick Match (old free play)
// Ladders fetched from DB, sequential unlock progression
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors, BeltColors, ARCHETYPE_ANIMALS } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

// ── TIER STYLING ─────────────────────────────────────────
const TIER_COLORS = {
  beginner:     { color: '#6B7280', bg: '#F3F4F6' },
  intermediate: { color: '#2563EB', bg: '#EFF4FF' },
  advanced:     { color: '#7C3AED', bg: '#F5F0FF' },
  expert:       { color: '#C23028', bg: '#FEF2F1' },
  boss:         { color: '#B8860B', bg: '#FDF8EC' },
};

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

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════
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

  // ── FETCH BOTS FOR SELECTED LADDER + BEATEN STATUS ─────
  useEffect(() => {
    if (!selectedLadder) { setLadderBots([]); return; }
    (async () => {
      setChecking(true);
      const { data: bots } = await sb.from('ladder_bots')
        .select('*')
        .eq('ladder_id', selectedLadder.id)
        .order('position');
      const botList = bots || [];
      setLadderBots(botList);

      // Check which bots player has beaten
      const botIds = botList.map(b => b.bot_profile_id).filter(Boolean);
      if (botIds.length > 0) {
        const { data: wins } = await sb.from('matches')
          .select('player1_id, player2_id, winner_id')
          .eq('status', 'finished')
          .eq('winner_id', profile.id)
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
      console.error("Challenge bot returned no match ID");
      setError("Failed to start match — no match ID returned.");
      setLoading(null);
      return;
    }
    setLoading(null);
    onNavigate && onNavigate('game_plan', { matchId: data, isBot: true, botId: botProfileId });
  };

  // Quick match challenge (old format)
  const challengeQuickBot = async (bot) => {
    setLoading(bot.uuid); setError(null);
    try {
      const { data, error: rpcError } = await sb.rpc("challenge_bot", { p_player_id: user.id, p_bot_id: bot.uuid });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("No match ID returned");
      onNavigate && onNavigate('game_plan', { matchId: data, isBot: true, botId: bot.uuid });
    } catch (e) { console.error("Challenge bot error:", e); setError("Failed to start match — try again."); }
    setLoading(null);
  };

  return (
    <div style={{ padding: "20px 16px", animation: "fadeUp 0.3s ease-out", minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      {/* Tab toggle */}
      <div style={{ display: 'flex', marginBottom: 16, border: `1.5px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
        {[{ key: 'ladders', label: 'Ladders' }, { key: 'quick', label: 'Quick Match' }].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedLadder(null); }} style={{
            flex: 1, padding: '10px', fontFamily: F.mono, fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
            border: 'none', fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? '#111827' : '#FFFFFF',
            color: tab === t.key ? '#FFFFFF' : T.dim,
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {error && (
        <div style={{ padding: "10px 12px", background: `${T.red}08`, border: `1px solid ${T.red}20`, borderRadius: 8, marginBottom: 12, fontFamily: F.mono, fontSize: 10, color: T.red }}>{error}</div>
      )}

      {/* ═══ LADDERS TAB ═══ */}
      {tab === 'ladders' && !selectedLadder && (
        <LadderSelect ladders={ladders} checking={checking} onSelect={setSelectedLadder} />
      )}

      {tab === 'ladders' && selectedLadder && (
        <LadderBotList
          ladder={selectedLadder}
          bots={ladderBots}
          beaten={beaten}
          checking={checking}
          loading={loading}
          onChallenge={challengeBot}
          onBack={() => setSelectedLadder(null)}
        />
      )}

      {/* ═══ QUICK MATCH TAB ═══ */}
      {tab === 'quick' && (
        <QuickMatchList
          profile={profile}
          loading={loading}
          onChallenge={challengeQuickBot}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LADDER SELECT — 6 archetype ladder cards
// ═══════════════════════════════════════════════════════════
function LadderSelect({ ladders, checking, onSelect }) {
  if (checking) {
    return <div style={{ textAlign: 'center', padding: 40, fontFamily: F.body, fontSize: 14, color: T.muted }}>Loading ladders...</div>;
  }

  const ARCHETYPE_ORDER = ['wrestler', 'guard_puller', 'leg_locker', 'pressure_passer', 'submission_hunter', 'scrambler'];

  // Map DB archetype names to display archetype IDs
  const normalizeArch = (a) => a === 'sub_hunter' ? 'submission_hunter' : a;

  // Match DB ladders to archetype slots
  const matchedLadders = {};
  for (const l of ladders) {
    const norm = normalizeArch(l.archetype);
    matchedLadders[norm] = l;
  }
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
            <div
              key={archId}
              onClick={() => available && onSelect(ladder)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px', borderRadius: 12,
                background: '#FFFFFF',
                border: `1.5px solid ${available ? archColor + '25' : T.border}`,
                boxShadow: available ? T.shadowMd : T.shadowSm,
                cursor: available ? 'pointer' : 'default',
                opacity: available ? 1 : 0.5,
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: `${archColor}08`, border: `1.5px solid ${archColor}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ArchIcon id={archId} s={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>
                    {ladder?.name || `${animal} Gauntlet`}
                  </span>
                  {!available && (
                    <span style={{ fontFamily: F.mono, fontSize: 7, color: T.dim, background: '#F3F4F6', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.08em' }}>
                      COMING SOON
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>
                  {ladder?.description || `${animal} archetype ladder — coming soon`}
                </div>
              </div>
              {available && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 6l6 6-6 6" stroke={T.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// LADDER BOT LIST — sequential unlock progression
// ═══════════════════════════════════════════════════════════
function LadderBotList({ ladder, bots, beaten, checking, loading, onChallenge, onBack }) {
  if (checking) {
    return <div style={{ textAlign: 'center', padding: 40, fontFamily: F.body, fontSize: 14, color: T.muted }}>Loading bots...</div>;
  }

  // Sequential unlock: bot N unlocked if N=1 or bot N-1 is beaten
  const botProfileIds = bots.map(b => b.bot_profile_id);
  const isUnlocked = (idx) => {
    if (idx === 0) return true;
    return beaten.has(botProfileIds[idx - 1]);
  };

  // Find frontier (first unbeaten unlocked bot)
  const frontierIdx = bots.findIndex((b, i) => isUnlocked(i) && !beaten.has(b.bot_profile_id));

  return (
    <>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: `1.5px solid ${T.border}`, borderRadius: 6,
          padding: '6px 10px', cursor: 'pointer', fontFamily: F.mono, fontSize: 9,
          color: T.muted, letterSpacing: '0.08em',
        }}>BACK</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.display, fontSize: 22, color: T.text }}>{ladder.name}</div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, letterSpacing: '0.08em' }}>
            {beaten.size}/{bots.length} defeated
          </div>
        </div>
      </div>

      {/* Bot list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bots.map((bot, idx) => {
          const unlocked = isUnlocked(idx);
          const isBeaten = beaten.has(bot.bot_profile_id);
          const isFrontier = idx === frontierIdx;
          const beltColor = BeltColors[bot.belt] || T.muted;
          const tier = TIER_COLORS[bot.difficulty_tier] || TIER_COLORS.beginner;
          const isBoss = bot.difficulty_tier === 'boss' || bot.position >= 29;

          return (
            <div key={bot.bot_profile_id || idx} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 10,
              background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
              border: isBoss ? `1.5px solid ${T.gold}30` : isFrontier ? `1.5px solid #11182730` : `1px solid ${T.border}`,
              boxShadow: isBoss ? T.shadowMd : isFrontier ? T.shadowMd : T.shadowSm,
              opacity: unlocked ? 1 : 0.5,
              transition: 'all 0.15s',
              ...(isFrontier ? { animation: 'bossPulse 2.5s ease-in-out infinite' } : {}),
            }}>
              {/* Position number */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isBeaten ? `${T.green}10` : isBoss ? `${T.gold}10` : '#F3F4F6',
                border: `1.5px solid ${isBeaten ? `${T.green}25` : isBoss ? T.gold : T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.display, fontSize: 13,
                color: isBeaten ? T.green : isBoss ? T.gold : T.dim,
              }}>
                {isBeaten ? '+' : `#${bot.position}`}
              </div>

              {/* Belt dot */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: beltColor,
                border: bot.belt === 'white' ? '1px solid #D1D5DB' : 'none',
              }} />

              {/* Name + description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: F.display, fontSize: 15, color: unlocked ? T.text : T.dim }}>
                    {bot.bot_name}
                  </span>
                  {!unlocked && <LockIcon />}
                </div>
                {unlocked && bot.description && (
                  <div style={{
                    fontFamily: F.body, fontSize: 11, color: T.muted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginTop: 1,
                  }}>
                    {bot.description}
                  </div>
                )}
              </div>

              {/* Tier badge */}
              <span style={{
                fontFamily: F.mono, fontSize: 7, letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
                color: tier.color, background: tier.bg, flexShrink: 0,
              }}>
                {bot.difficulty_tier}
              </span>

              {/* Action */}
              <div style={{ flexShrink: 0, width: 64, textAlign: 'right' }}>
                {unlocked ? (
                  <button onClick={() => onChallenge(bot.bot_profile_id)} disabled={!!loading} style={{
                    padding: '5px 10px', borderRadius: 6,
                    fontFamily: F.mono, fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: loading ? 'default' : 'pointer',
                    border: `1.5px solid ${isFrontier ? '#111827' : isBeaten ? `${T.green}30` : T.border}`,
                    background: isFrontier ? '#111827' : '#FFFFFF',
                    color: isFrontier ? '#FFFFFF' : isBeaten ? T.green : T.muted,
                    opacity: loading && loading !== bot.bot_profile_id ? 0.4 : 1,
                  }}>
                    {loading === bot.bot_profile_id ? '...' : isBeaten ? 'Again' : 'Fight'}
                  </button>
                ) : (
                  <span style={{ fontFamily: F.mono, fontSize: 8, color: T.dim }}>Locked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// QUICK MATCH — old free play list
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {QUICK_LADDER.map(bot => {
          const isBeaten = beaten.has(bot.uuid);
          const beltColor = BeltColors[bot.belt] || T.muted;
          const archColor = ArchColors[bot.arch] || T.muted;
          const animal = ARCHETYPE_ANIMALS[bot.arch] || '';

          return (
            <div key={bot.uuid} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: isBeaten ? `${T.green}04` : '#FFFFFF',
              border: `1px solid ${isBeaten ? `${T.green}20` : T.border}`,
              boxShadow: bot.isBoss ? T.shadowMd : T.shadowSm,
              ...(bot.isBoss ? { border: `1.5px solid ${T.gold}30` } : {}),
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: isBeaten ? `${T.green}10` : `${archColor}08`,
                border: `1px solid ${isBeaten ? `${T.green}25` : `${archColor}15`}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isBeaten ? (
                  <span style={{ fontFamily: F.display, fontSize: 13, color: T.green }}>+</span>
                ) : (
                  <ArchIcon id={bot.arch} s={16} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: F.display, fontSize: 15, color: T.text }}>{bot.name}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 7, color: beltColor, background: `${beltColor}10`, padding: "1px 5px", borderRadius: 3, letterSpacing: '0.06em' }}>{bot.belt}</span>
                </div>
                <div style={{ fontFamily: F.body, fontSize: 11, color: T.muted, marginTop: 1 }}>
                  {animal && `${animal} · `}{bot.flavor}
                </div>
              </div>

              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.gold, flexShrink: 0 }}>{bot.elo}</div>

              <button onClick={() => onChallenge(bot)} disabled={!!loading} style={{
                padding: "5px 10px", borderRadius: 6,
                fontFamily: F.mono, fontSize: 8, letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: loading ? "default" : "pointer",
                border: `1.5px solid ${isBeaten ? `${T.green}30` : T.border}`,
                background: '#FFFFFF',
                color: isBeaten ? T.green : T.muted,
                opacity: loading && loading !== bot.uuid ? 0.4 : 1,
              }}>
                {loading === bot.uuid ? "..." : isBeaten ? "Again" : "Fight"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "8px 12px", textAlign: "center" }}>
        <div style={{ fontFamily: F.mono, fontSize: 8, color: T.dim, letterSpacing: "0.14em", textTransform: "uppercase" }}>PvP matchmaking coming soon</div>
      </div>
    </>
  );
}

// ── SHARED COMPONENTS ────────────────────────────────────
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none">
      <rect x="7" y="10" width="10" height="9" rx="1.5" stroke="#9CA3AF" strokeWidth="1.5" fill="none"/>
      <path d="M9 10V7a3 3 0 0 1 6 0v3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
