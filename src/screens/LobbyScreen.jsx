// ═══════════════════════════════════════════════════════════
// OPEN MAT — LOBBY SCREEN
// Bot grid + human player list
// Real Supabase: challenge_bot(), match_invites
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ArchColors } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { sb } from '../lib/supabase';

const BOTS = [
  { name: "IronMike", arch: "wrestler", elo: 1200, flavor: "Takedown machine. Will grind you.", uuid: "00000001-0000-0000-0000-000000000001" },
  { name: "MiyaoBot", arch: "guard_puller", elo: 1150, flavor: "Berimbolo from everywhere.", uuid: "00000002-0000-0000-0000-000000000002" },
  { name: "HaisamBot", arch: "leg_locker", elo: 1180, flavor: "Your knees aren't safe.", uuid: "00000003-0000-0000-0000-000000000003" },
  { name: "RodolfoBot", arch: "pressure_passer", elo: 1175, flavor: "Heavy pressure. Smash pass.", uuid: "00000004-0000-0000-0000-000000000004" },
  { name: "MarceloBot", arch: "submission_hunter", elo: 1250, flavor: "Always hunting. Always.", uuid: "00000005-0000-0000-0000-000000000005" },
  { name: "RuotoloBot", arch: "scrambler", elo: 1300, flavor: "Chaos incarnate.", uuid: "00000006-0000-0000-0000-000000000006" },
];

export default function LobbyScreen({ user, onMatchStart }) {
  const [loading, setLoading] = useState(null); // bot uuid being challenged

  const challengeBot = async (bot) => {
    setLoading(bot.uuid);
    try {
      const { data, error } = await sb.rpc("challenge_bot", {
        p_player_id: user.id,
        p_bot_id: bot.uuid,
      });
      if (error) throw error;
      onMatchStart && onMatchStart(data); // match UUID
    } catch (e) {
      console.error("Challenge bot error:", e);
    }
    setLoading(null);
  };

  return (
    <div style={{ padding: "20px", animation: "fadeUp 0.3s ease-out" }}>
      <div style={{ fontFamily: T.display, fontSize: 24, color: T.white, letterSpacing: "0.06em", marginBottom: 16 }}>Solo Training</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        {BOTS.map(b => {
          const c = ArchColors[b.arch] || T.muted;
          return (
            <button key={b.uuid} onClick={() => challengeBot(b)} disabled={!!loading} style={{
              padding: "14px 12px", textAlign: "left", background: T.surface,
              border: `1px solid ${T.border}`, borderRadius: 6, cursor: loading ? "default" : "pointer",
              opacity: loading && loading !== b.uuid ? 0.5 : 1, transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${c}12`, border: `1px solid ${c}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArchIcon id={b.arch} s={18}/>
                </div>
                <div>
                  <div style={{ fontFamily: T.display, fontSize: 15, color: T.white, letterSpacing: "0.04em" }}>{b.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: c }}>{b.arch.replace("_", " ")}</div>
                </div>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 10, color: T.dim, marginBottom: 6, lineHeight: 1.4 }}>{b.flavor}</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.gold }}>{b.elo} Elo</div>
              {loading === b.uuid && <div style={{ fontFamily: T.mono, fontSize: 9, color: T.you, marginTop: 4 }}>Starting match...</div>}
            </button>
          );
        })}
      </div>

      <div style={{ fontFamily: T.display, fontSize: 24, color: T.white, letterSpacing: "0.06em", marginBottom: 12 }}>Online Players</div>
      <div style={{ padding: "20px", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 6 }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>No players online right now</div>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, marginTop: 4 }}>Challenge a bot while you wait</div>
      </div>
    </div>
  );
}
