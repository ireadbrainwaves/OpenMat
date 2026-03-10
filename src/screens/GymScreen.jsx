import React from 'react';
const { useState, useEffect } = React;
import { sb } from '../lib/supabase';
import { ARCHETYPES } from '../lib/constants';
import { Screen, SectionLabel } from '../components/UI';

export default function GymScreen({ profile }) {
  const [gym, setGym] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    (async () => {
      if (!profile.gym_id) return;
      const { data: g } = await sb.from('gyms').select('*').eq('id', profile.gym_id).single();
      if (g) setGym(g);
      const { data: m } = await sb.from('gym_memberships').select('profile:profiles(*)').eq('gym_id', profile.gym_id);
      if (m) setMembers(m.map(x => x.profile).filter(Boolean).sort((a, b) => b.elo - a.elo));
    })();
  }, [profile.gym_id]);

  if (!gym) return <Screen><div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>No gym yet. Create one during onboarding.</div></Screen>;

  const podiumBg = ['rgba(240,160,80,.12)', 'rgba(136,136,168,.08)', 'rgba(160,82,45,.1)'];
  const podiumColor = ['var(--amber)', 'var(--text-secondary)', '#cd7f32'];

  return (
    <Screen>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--card2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 10 }}>🥋</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{gym.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{members.length} members</div>
      </div>

      <SectionLabel>Leaderboard</SectionLabel>
      {members.map((m, i) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 6, gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? podiumBg[i] : 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: i < 3 ? podiumColor[i] : 'var(--dim)' }}>{i + 1}</div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{ARCHETYPES[m.archetype]?.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.display_name} {m.id === profile.id ? '⭐' : ''}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ARCHETYPES[m.archetype]?.label} — {m.belt}</div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700 }}>{m.elo}</div>
        </div>
      ))}
    </Screen>
  );
}
