import React from 'react';
const { useState, useEffect } = React;
import { sb, dbg, loadGraph } from './lib/supabase';
import { AppShell, Nav, BottomNav, Center, Spinner } from './components/UI';
import PrototypeScreen from './screens/PrototypeScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardScreen from './screens/OnboardScreen';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GamePlanScreen from './screens/GamePlanScreen';
import MatchScreen from './screens/MatchScreen';
import PostMatchScreen from './screens/PostMatchScreen';
import DeckScreen from './screens/DeckScreen';
import GymScreen from './screens/GymScreen';
import ProfileScreen from './screens/ProfileScreen';

export default function App() {
  // Prototype mode — bypass everything
  const params = new URLSearchParams(window.location.search);
  if (params.get('prototype') === 'true') {
    document.documentElement.classList.add('prototype-mode');
    return <PrototypeScreen />;
  }

  const [screen, setScreen] = useState('loading');
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [endedMatch, setEndedMatch] = useState(null);
  const [navParams, setNavParams] = useState(null);

  useEffect(() => {
    (async () => {
      dbg('App init...', 'ok');
      const ok = await loadGraph();
      if (!ok) { dbg('Graph load failed!', 'err'); setScreen('error'); return; }

      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        dbg('Session found: ' + session.user.email, 'ok');
        setUser(session.user);
        const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
        if (p) {
          const emailPrefix = session.user.email?.split('@')[0] || '';
          if (p.display_name && p.display_name !== emailPrefix) {
            setProfile(p); setScreen('main');
          } else {
            setScreen('onboarding');
          }
        } else {
          setScreen('onboarding');
        }
      } else {
        setScreen('auth');
      }
    })();

    const { data: { subscription } } = sb.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') { setUser(null); setProfile(null); setScreen('auth'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(u) {
    setUser(u);
    const { data: p } = await sb.from('profiles').select('*').eq('id', u.id).single();
    const emailPrefix = u.email?.split('@')[0] || '';
    if (p && p.display_name && p.display_name !== emailPrefix) {
      setProfile(p); setScreen('main');
    } else {
      setScreen('onboarding');
    }
  }

  async function handleOnboard() {
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (p) { setProfile(p); setScreen('main'); dbg('Profile loaded: ' + p.display_name, 'ok'); }
  }

  // NEW FLOW: Lobby → GamePlan → Match → PostMatch
  async function handleNavigate(targetScreen, params = {}) {
    if (targetScreen === 'game_plan') {
      const { matchId: id } = params;
      setMatchId(id);
      setNavParams(params);
      dbg('Match accepted: ' + id + ', loading opponent for game plan...', 'ok');

      const { data: m } = await sb.from('matches').select('*').eq('id', id).single();
      if (m) {
        const oppId = m.player1_id === profile.id ? m.player2_id : m.player1_id;
        const { data: opp } = await sb.from('profiles').select('*').eq('id', oppId).single();
        if (opp) {
          setOpponent(opp);
          dbg('Opponent loaded: ' + opp.display_name, 'ok');
        }

        // If match already has drills set OR is past turn 1, skip game plan (rejoining)
        const myDrills = m.player1_id === profile.id ? m.player1_drilled_moves : m.player2_drilled_moves;
        if ((myDrills && myDrills.length > 0) || m.current_turn > 1) {
          dbg('Rejoining active match — skipping game plan', 'ok');
          setScreen('match');
          return;
        }
      }

      setScreen('gameplan');
    }
  }

  function handleGamePlanReady(drilledMoveIds) {
    dbg('Game plan ready with ' + drilledMoveIds.length + ' drills, entering match', 'ok');
    setScreen('match');
  }

  function handleMatchEnd(m) {
    setEndedMatch(m); setScreen('result');
    (async () => {
      const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
      if (p) setProfile(p);
    })();
  }

  async function handleRematch() {
    if (!endedMatch) return;
    const oppId = endedMatch.player1_id === profile.id ? endedMatch.player2_id : endedMatch.player1_id;
    dbg('Sending rematch to ' + oppId, 'ok');
    await sb.from('match_invites').insert({ from_profile_id: profile.id, to_profile_id: oppId, match_type: 'ranked' });
    setScreen('main'); setTab('match');
  }

  // Loading
  if (screen === 'loading') return <AppShell><Center><Spinner size={30} /><div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Loading Open Mat...</div></Center></AppShell>;
  if (screen === 'error') return <AppShell><Center><div style={{ color: 'var(--red)', fontSize: 16, fontWeight: 700 }}>Failed to load</div><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Check console for errors</div></Center></AppShell>;

  // Auth / Onboarding
  if (screen === 'auth') return <AppShell><AuthScreen onDone={handleAuth} /></AppShell>;
  if (screen === 'onboarding') return <AppShell><OnboardScreen user={user} onDone={handleOnboard} /></AppShell>;

  // NEW: Game Plan screen (between lobby and match)
  if (screen === 'gameplan' && matchId) return <AppShell><GamePlanScreen profile={profile} matchId={matchId} opponent={opponent} onReady={handleGamePlanReady} isBot={navParams?.isBot || false} botId={navParams?.botId || null} /></AppShell>;

  // Match
  if (screen === 'match' && matchId) return <AppShell><MatchScreen profile={profile} matchId={matchId} onEnd={handleMatchEnd} isBot={navParams?.isBot || false} botId={navParams?.botId || null} /></AppShell>;

  // NEW: Post-Match Progression (replaces old ResultScreen)
  if (screen === 'result' && endedMatch) return <AppShell><PostMatchScreen profile={profile} match={endedMatch} onHome={() => { setScreen('main'); setTab('home'); }} onRematch={handleRematch} /></AppShell>;

  // === TEST PREVIEWS (remove before shipping) ===
  function testGamePlan() {
    // Preview GamePlan with a mock opponent (Iron Mike bot)
    setMatchId('test-preview');
    setOpponent({
      id: '00000001-0000-0000-0000-000000000001',
      display_name: 'Iron Mike',
      archetype: 'wrestler',
      belt: 'blue',
      elo: 1280,
    });
    setScreen('gameplan');
  }

  function testPostMatch() {
    // Preview PostMatch with mock match data
    setEndedMatch({
      id: 'test-preview',
      player1_id: profile.id,
      player2_id: '00000001-0000-0000-0000-000000000001',
      winner_id: profile.id,
      win_method: 'Submission — Armbar from Closed Guard',
      current_turn: 18,
      max_turns: 30,
      player1_points: 6,
      player2_points: 2,
      player1_elo_delta: 24,
      player2_elo_delta: -24,
      status: 'finished',
    });
    setScreen('result');
  }

  // Main tabs
  return (
    <AppShell>
      {tab === 'home' && <HomeScreen profile={profile} onMatch={() => setTab('match')} />}
      {tab === 'match' && <LobbyScreen user={user} profile={profile} onNavigate={handleNavigate} />}
      {tab === 'deck' && <DeckScreen profile={profile} />}
      {tab === 'gym' && <GymScreen profile={profile} />}
      <Nav cur={tab} go={setTab} />
      <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 20 }}>
        <button onClick={async () => { await sb.auth.signOut(); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 10, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>Sign Out</button>
      </div>
      {/* DEV: Test preview buttons — remove before shipping */}
      <div style={{ position: 'absolute', top: 8, left: 12, zIndex: 20, display: 'flex', gap: 4 }}>
        <button onClick={testGamePlan} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--amber)', fontSize: 8, padding: '3px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>Test GamePlan</button>
        <button onClick={testPostMatch} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--green)', fontSize: 8, padding: '3px 6px', borderRadius: 3, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>Test PostMatch</button>
      </div>
    </AppShell>
  );
}
