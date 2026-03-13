import React from 'react';
const { useState, useEffect } = React;
import { sb, dbg, loadGraph } from './lib/supabase';
import { AppShell, BottomNav, Center, Spinner } from './components/UI';
import BugReportButton from './components/BugReportButton';
import PrototypeScreen from './screens/PrototypeScreen';
import AuthScreen from './screens/AuthScreen';
import OnboardScreen from './screens/OnboardScreen';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GamePlanScreen from './screens/GamePlanScreen';
import MatchScreen from './screens/MatchScreen';
import PostMatchScreen from './screens/PostMatchScreen';
import DeckScreen from './screens/DeckScreen';
import ProfileScreen from './screens/ProfileScreen';
import TutorialGate from './screens/TutorialGate';
import TutorialScreen from './screens/TutorialScreen';

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
            setProfile(p);
            const tutDone = localStorage.getItem('openmat_tutorial_done') === 'true';
            if (!p.archetype) {
              // Has name but no archetype — route through tutorial or archetype select
              setScreen(!tutDone ? 'tutorial' : 'archetype_select');
            } else {
              setScreen(!tutDone && (p.matches_played ?? 0) === 0 ? 'tutorial' : 'main');
            }
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
      setProfile(p);
      const tutDone = localStorage.getItem('openmat_tutorial_done') === 'true';
      if (!p.archetype) {
        setScreen(!tutDone ? 'tutorial' : 'archetype_select');
      } else {
        setScreen(!tutDone && (p.matches_played ?? 0) === 0 ? 'tutorial' : 'main');
      }
    } else {
      setScreen('onboarding');
    }
  }

  async function handleOnboard() {
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (p) {
      setProfile(p);
      dbg('Profile loaded: ' + p.display_name, 'ok');
      // New flow: Name → Tutorial → Archetype → Deck
      // If no archetype yet, route to tutorial first (then archetype after)
      if (!p.archetype) {
        const tutDone = localStorage.getItem('openmat_tutorial_done') === 'true';
        if (!tutDone) {
          dbg('New user -- routing to tutorial gate', 'ok');
          setScreen('tutorial');
        } else {
          dbg('Tutorial done but no archetype -- routing to archetype select', 'ok');
          setScreen('archetype_select');
        }
      } else {
        setScreen('main');
      }
    }
  }

  async function handleArchetypeDone() {
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (p) {
      setProfile(p);
      dbg('Archetype + deck done, entering main', 'ok');
      setScreen('main');
      setTab('lobby');
    }
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
    setScreen('main'); setTab('lobby');
  }

  // Loading
  if (screen === 'loading') return <AppShell><Center><Spinner size={30} /><div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Loading Open Mat...</div></Center></AppShell>;
  if (screen === 'error') return <AppShell><Center><div style={{ color: 'var(--red)', fontSize: 16, fontWeight: 700 }}>Failed to load</div><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Check console for errors</div></Center></AppShell>;

  // Auth / Onboarding (name only → tutorial → archetype/deck)
  if (screen === 'auth') return <AppShell><AuthScreen onDone={handleAuth} /><BugReportButton currentScreen={screen} matchId={null} /></AppShell>;
  if (screen === 'onboarding') return <AppShell><OnboardScreen user={user} mode="name_only" onDone={handleOnboard} /><BugReportButton currentScreen={screen} matchId={null} /></AppShell>;

  // Tutorial gate for brand-new users
  if (screen === 'tutorial') return <AppShell><TutorialGate onStart={() => setScreen('tutorial_match')} onSkip={() => { localStorage.setItem('openmat_tutorial_done', 'true'); setScreen('archetype_select'); }} /><BugReportButton currentScreen={screen} matchId={null} /></AppShell>;

  // Tutorial match — guided match vs Coach
  if (screen === 'tutorial_match') return <AppShell><TutorialScreen profile={profile} user={user} onComplete={() => { localStorage.setItem('openmat_tutorial_done', 'true'); setScreen('archetype_select'); }} /><BugReportButton currentScreen={screen} matchId={null} /></AppShell>;

  // Archetype + Deck selection (after tutorial)
  if (screen === 'archetype_select') return <AppShell><OnboardScreen user={user} mode="archetype_deck" onDone={handleArchetypeDone} /><BugReportButton currentScreen={screen} matchId={null} /></AppShell>;

  // NEW: Game Plan screen (between lobby and match)
  if (screen === 'gameplan' && matchId) return <AppShell><GamePlanScreen profile={profile} matchId={matchId} opponent={opponent} onReady={handleGamePlanReady} isBot={navParams?.isBot || false} botId={navParams?.botId || null} /><BugReportButton currentScreen={screen} matchId={matchId} /></AppShell>;

  // Match
  if (screen === 'match' && matchId) return <AppShell><MatchScreen profile={profile} matchId={matchId} onEnd={handleMatchEnd} isBot={navParams?.isBot || false} botId={navParams?.botId || null} /><BugReportButton currentScreen={screen} matchId={matchId} /></AppShell>;

  // NEW: Post-Match Progression (replaces old ResultScreen)
  if (screen === 'result' && endedMatch) return <AppShell><PostMatchScreen profile={profile} match={endedMatch} onHome={() => { setScreen('main'); setTab('home'); }} onRematch={handleRematch} /><BugReportButton currentScreen={screen} matchId={endedMatch?.id || null} /></AppShell>;

  // Main tabs
  return (
    <AppShell>
      {tab === 'home' && <HomeScreen user={user} profile={profile} onNavigate={(t) => setTab(t)} />}
      {tab === 'lobby' && <LobbyScreen user={user} profile={profile} onNavigate={handleNavigate} />}
      {tab === 'deck' && <DeckScreen profile={profile} />}
      {tab === 'profile' && <ProfileScreen user={user} profile={profile} />}
      <BottomNav active={tab} onNavigate={setTab} />
      <BugReportButton currentScreen={screen + ':' + tab} matchId={null} />
    </AppShell>
  );
}
