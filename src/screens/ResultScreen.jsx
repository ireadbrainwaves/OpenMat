import React from 'react';
const { useState, useEffect } = React;
import { sb } from '../lib/supabase';
import { Screen, Btn, SectionLabel } from '../components/UI';

export default function ResultScreen({ profile, match, onHome, onRematch }) {
  const [turns, setTurns] = useState([]);
  const [oppName, setOppName] = useState('Opponent');
  const won = match?.winner_id === profile.id;
  const amP1 = match?.player1_id === profile.id;
  const delta = amP1 ? match?.player1_elo_delta : match?.player2_elo_delta;

  useEffect(() => {
    (async () => {
      const oppId = amP1 ? match.player2_id : match.player1_id;
      const { data: o } = await sb.from('profiles').select('display_name').eq('id', oppId).single();
      if (o) setOppName(o.display_name);
      const { data: t } = await sb.from('match_turns').select('*').eq('match_id', match.id).order('turn_number');
      if (t) setTurns(t);
    })();
  }, [match]);

  return (
    <Screen style={{ padding: '0 var(--px) 40px' }} className="slide-up">
      <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, background: won ? 'rgba(74,186,128,.1)' : 'rgba(230,57,70,.1)', border: '2px solid ' + (won ? 'var(--green)' : 'var(--red)') }}>
          {won ? '🏆' : '😤'}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: won ? 'var(--green)' : 'var(--red)' }}>{match?.winner_id ? (won ? 'Victory' : 'Defeat') : 'Draw'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{match?.win_method}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, marginTop: 8, color: delta > 0 ? 'var(--green)' : 'var(--red)' }}>{delta > 0 ? '+' : ''}{delta} Elo</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, margin: '16px 0' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>You</div><div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--blue)' }}>{amP1 ? match.player1_points : match.player2_points}</div></div>
        <div style={{ fontSize: 14, color: 'var(--dim)', fontWeight: 600 }}>vs</div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{oppName}</div><div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--red)' }}>{amP1 ? match.player2_points : match.player1_points}</div></div>
      </div>

      <SectionLabel>Play-by-Play</SectionLabel>
      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
        {turns.map(t => (
          <div key={t.turn_number} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: t.result === 'submission_win' ? 'var(--red)' : 'var(--muted)', width: 24, flexShrink: 0 }}>T{t.turn_number}</span>
            <span style={{ fontSize: 11, lineHeight: 1.4, color: t.result === 'submission_win' ? 'var(--red)' : 'var(--text)', fontWeight: t.result === 'submission_win' ? 600 : 400 }}>{t.description}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={onRematch} style={{ flex: 1 }}>Send Rematch</Btn>
        <Btn on={false} onClick={onHome} style={{ flex: 1 }}>Home</Btn>
      </div>
    </Screen>
  );
}
