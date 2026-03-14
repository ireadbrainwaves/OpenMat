import React from 'react';
const { useState, useEffect, useRef } = React;
import { T } from '../lib/tokens';
import { Btn, GPBar, Coach } from '../components/UI';

// ═══════════════════════════════════════════════════════════
// TUTORIAL SCREEN — Fully scripted state machine
// Zero server calls. Teaches stance triangle, positions, GP/subs.
// ═══════════════════════════════════════════════════════════

// ── Position display names ──────────────────────────────────
const POS = {
  standing_neutral:       { name: 'Standing',         top: false, bottom: false },
  guard_closed:           { name: 'Closed Guard',     top: false, bottom: true  },
  guard_closed_top:       { name: 'Closed Guard',     top: true,  bottom: false },
  clinch_front_headlock:  { name: 'Front Headlock',   top: true,  bottom: false },
  clinch_front_headlock_bottom: { name: 'Front Headlock', top: false, bottom: true },
  side_control_bottom:    { name: 'Side Control',     top: false, bottom: true  },
  side_control_top:       { name: 'Side Control',     top: true,  bottom: false },
};

function posLabel(posId) {
  const p = POS[posId] || { name: posId, top: false, bottom: false };
  const suffix = p.top ? ' (Top)' : p.bottom ? ' (Bottom)' : '';
  return p.name + suffix;
}

// ── Stance colors ───────────────────────────────────────────
const STANCE_C = { attack: T.red, defend: T.blue, setup: T.amber };
const STANCE_ICON = { attack: '⚔️', defend: '🛡️', setup: '⚙️' };

// ── Tighten meter component ────────────────────────────────
function TightenMeter({ level, max = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginRight: 4 }}>TIGHTEN</span>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{
          width: 28, height: 14, borderRadius: 2,
          background: i < level ? (level >= 3 ? T.red : T.amber) : T.surface3,
          border: `1px solid ${i < level ? (level >= 3 ? T.red : T.amber) : T.border}`,
          transition: 'all 0.4s',
          animation: i < level && level >= 3 ? 'tightenPulse 1s ease-in-out infinite' : 'none',
        }} />
      ))}
      <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: level >= 3 ? T.red : T.amber, marginLeft: 4 }}>{level}/{max}</span>
    </div>
  );
}

// ── Stance card ─────────────────────────────────────────────
function StanceCard({ stance, moveName, desc, selected, onClick, disabled }) {
  const color = STANCE_C[stance];
  const icon = STANCE_ICON[stance];
  const sel = selected === stance;
  return (
    <button onClick={() => !disabled && onClick(stance)} disabled={disabled} style={{
      width: '100%', padding: '14px 16px', textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
      background: sel ? `${color}15` : T.surface, border: `2px solid ${sel ? color : T.border}`,
      borderRadius: 6, transition: 'all 0.15s', opacity: disabled && !sel ? 0.5 : 1,
      position: 'relative', overflow: 'hidden',
    }}>
      {sel && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.display, fontSize: 18, letterSpacing: '0.04em', color: sel ? T.white : T.muted, textTransform: 'capitalize' }}>{stance}</div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: color, marginTop: 2 }}>{moveName}</div>
          <div style={{ fontFamily: T.body, fontSize: 11, color: T.dim, marginTop: 2 }}>{desc}</div>
        </div>
      </div>
    </button>
  );
}

// ── Position display ────────────────────────────────────────
function PositionDisplay({ playerPos, coachPos }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', gap: 12 }}>
      <div style={{ flex: 1, padding: '10px 12px', background: `${T.you}0A`, border: `1px solid ${T.you}25`, borderRadius: 6, textAlign: 'center' }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>YOU</div>
        <div style={{ fontFamily: T.display, fontSize: 16, color: T.you, letterSpacing: '0.04em' }}>{posLabel(playerPos)}</div>
      </div>
      <div style={{ flex: 1, padding: '10px 12px', background: `${T.opp}0A`, border: `1px solid ${T.opp}25`, borderRadius: 6, textAlign: 'center' }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>COACH MIKE</div>
        <div style={{ fontFamily: T.display, fontSize: 16, color: T.opp, letterSpacing: '0.04em' }}>{posLabel(coachPos)}</div>
      </div>
    </div>
  );
}

// ── GP display ──────────────────────────────────────────────
function GPDisplay({ playerGP, coachGP }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>YOUR GP</div>
        <GPBar current={playerGP} max={10} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>COACH GP</div>
        <GPBar current={coachGP} max={10} />
      </div>
    </div>
  );
}

// ── Lesson card (for What You Learned) ──────────────────────
function LessonCard({ icon, title, text, delay }) {
  return (
    <div style={{
      padding: '16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
      animation: `fadeUp 0.4s ease-out ${delay}s both`,
    }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: T.display, fontSize: 20, color: T.white, letterSpacing: '0.04em', marginBottom: 6 }}>{title}</div>
      <div style={{ fontFamily: T.body, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════

export default function TutorialScreen({ onComplete }) {
  const [phase, setPhase] = useState('INTRO');
  const [playerPosition, setPlayerPosition] = useState('standing_neutral');
  const [coachPosition, setCoachPosition] = useState('standing_neutral');
  const [playerGP, setPlayerGP] = useState(10);
  const [coachGP, setCoachGP] = useState(10);
  const [selectedStance, setSelectedStance] = useState(null);
  const [turn1Result, setTurn1Result] = useState(null);
  const [tightenMeter, setTightenMeter] = useState(1);
  const [subHistory, setSubHistory] = useState([]);
  const [showTap, setShowTap] = useState(false);
  const [tapMessageVisible, setTapMessageVisible] = useState(false);

  // Auto-advance after resolve phases (brief pause to read)
  const timerRef = useRef(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Auto-advance from transition phase
  useEffect(() => {
    if (phase === 'TURN_2_TRANSITION') {
      timerRef.current = setTimeout(() => setPhase('TURN_3_SUB_INTRO'), 1500);
    }
  }, [phase]);

  // ── TURN 1 STANCE DATA ──────────────────────────────────
  const turn1Stances = [
    { stance: 'attack', moveName: 'Guard Pull', moveType: 'transition', desc: 'Pull guard — get to your game' },
    { stance: 'defend', moveName: 'Sprawl', moveType: 'escape', desc: 'Stuff the takedown attempt' },
    { stance: 'setup',  moveName: 'Establish Collar Tie', moveType: 'transition', desc: 'Set up grips for your next move' },
  ];

  // ── TURN 1 RESOLVE ──────────────────────────────────────
  function resolveTurn1(stance) {
    setSelectedStance(stance);
    setTurn1Result(stance);
    setPhase('TURN_1_RESOLVE');
  }

  function getTurn1Outcome() {
    switch (turn1Result) {
      case 'attack': return {
        text: "You both attacked! Your guard pull got there first — but you're on bottom now.",
        lesson: 'Attack vs Attack — both moves fire. Speed decides.',
        lessonType: 'neutral',
        pPos: 'guard_closed', cPos: 'guard_closed_top',
        pGP: -1, cGP: -2,
      };
      case 'defend': return {
        text: "You sprawled on Coach's double leg! Defend beats Attack!",
        lesson: '✓ DEFEND beats ATTACK',
        lessonType: 'win',
        pPos: 'clinch_front_headlock', cPos: 'clinch_front_headlock_bottom',
        pGP: 0, cGP: -2,
      };
      case 'setup': return {
        text: "You were setting up grips while Coach shot! Attack beats Setup — he got the takedown.",
        lesson: '✗ ATTACK beats SETUP',
        lessonType: 'lose',
        pPos: 'side_control_bottom', cPos: 'side_control_top',
        pGP: -1, cGP: -2,
      };
      default: return null;
    }
  }

  // ── TURN 2 STANCE DATA ──────────────────────────────────
  function getTurn2Config() {
    if (turn1Result === 'attack') {
      return {
        coachStance: 'setup', coachMove: 'Stand Up in Closed Guard',
        stances: [
          { stance: 'attack', moveName: 'Scissor Sweep', moveType: 'sweep', desc: 'Sweep Coach — try to get on top!' },
          { stance: 'defend', moveName: 'Hold Closed Guard', moveType: 'transition', desc: 'Keep guard locked — stay safe' },
          { stance: 'setup',  moveName: 'Break Posture', moveType: 'transition', desc: "Control Coach's posture for your next attack" },
        ],
        outcomes: {
          attack: {
            text: "Attack beats Setup! Your sweep almost landed — that's the right read. Coach is just too experienced and recovers to pass.",
            lesson: '✓ ATTACK beats SETUP', lessonType: 'win', pGP: -2,
          },
          defend: {
            text: "Both playing it safe — stalemate. Coach eventually stands and passes your guard.",
            lesson: 'Defend vs Setup — standoff. Coach finds an opening.', lessonType: 'neutral', pGP: 0,
          },
          setup: {
            text: "Setup vs Setup — no advantage. Coach breaks free and passes.",
            lesson: 'Setup vs Setup — neither gains an edge.', lessonType: 'neutral', pGP: -1,
          },
        },
      };
    }
    if (turn1Result === 'defend') {
      return {
        coachStance: 'defend', coachMove: 'Turtle Up',
        stances: [
          { stance: 'attack', moveName: "D'Arce Choke", moveType: 'submission', desc: 'Go for the choke! High risk, high reward' },
          { stance: 'defend', moveName: 'Hold Front Headlock', moveType: 'transition', desc: "Maintain your control — don't give anything up" },
          { stance: 'setup',  moveName: 'Go Behind to Back', moveType: 'transition', desc: 'Circle behind Coach for back control' },
        ],
        outcomes: {
          attack: {
            text: "You went for the kill! But Coach is experienced — he scrambles free and reverses you.",
            lesson: 'Attack vs Defend — your aggression got countered.', lessonType: 'neutral', pGP: -3,
          },
          defend: {
            text: "Defend vs Defend — nobody moves. Coach eventually works free and reverses.",
            lesson: 'Defend vs Defend — stalemate. Position lost.', lessonType: 'neutral', pGP: 0,
          },
          setup: {
            text: "Setup beats Defend! You almost took Coach's back — but he's a veteran. He scrambles and reverses to side control.",
            lesson: '✓ SETUP beats DEFEND', lessonType: 'win', pGP: -1,
          },
        },
      };
    }
    // turn1Result === 'setup'
    return {
      coachStance: 'attack', coachMove: 'Americana',
      stances: [
        { stance: 'attack', moveName: 'Shrimp Escape', moveType: 'escape', desc: 'Hip escape — try to get out!' },
        { stance: 'defend', moveName: 'Frame and Block', moveType: 'escape', desc: 'Block the attack — protect yourself' },
        { stance: 'setup',  moveName: 'Roll to Turtle', moveType: 'escape', desc: 'Try to get to your knees' },
      ],
      outcomes: {
        attack: {
          text: "Attack vs Attack — Coach's Americana is stronger from top. You fight it off but stay pinned.",
          lesson: 'Attack vs Attack — top position wins the exchange.', lessonType: 'neutral', pGP: -1,
        },
        defend: {
          text: "Defend beats Attack! You blocked Coach's Americana — good survival instinct. But he's still on top.",
          lesson: '✓ DEFEND beats ATTACK', lessonType: 'win', pGP: 0,
        },
        setup: {
          text: "Too slow — Coach is already attacking. You can't set up while he's going for the Americana.",
          lesson: '✗ ATTACK beats SETUP', lessonType: 'lose', pGP: -1,
        },
      },
    };
  }

  // ── TURN 2 RESOLVE ──────────────────────────────────────
  function resolveTurn2(stance) {
    setSelectedStance(stance);
    const cfg = getTurn2Config();
    const o = cfg.outcomes[stance];
    setPlayerGP(prev => Math.max(0, prev + o.pGP));
    setPlayerPosition('side_control_bottom');
    setCoachPosition('side_control_top');
    setPhase('TURN_2_RESOLVE');
  }

  // ── SUB MINIGAME ────────────────────────────────────────
  function handleSubChoice(choice) {
    const newHistory = [...subHistory, choice];
    setSubHistory(newHistory);

    if (choice === 'explode' && playerGP >= 3) {
      setPlayerGP(prev => prev - 3);
    }

    const round = newHistory.length;
    if (round >= 3) {
      // Final round — always caught
      setTightenMeter(5);
      // Show tap after brief delay
      timerRef.current = setTimeout(() => {
        setShowTap(true);
        // Show message after tap animation
        setTimeout(() => setTapMessageVisible(true), 2500);
      }, 800);
      setPhase('TAP');
      return;
    }

    // Advance tighten
    const newTighten = round + 1;
    setTightenMeter(newTighten);

    if (round === 1) setPhase('SUB_ROUND_2');
    if (round === 2) setPhase('SUB_ROUND_3');
  }

  function getSubCoachMsg(round) {
    if (round === 1 && subHistory.length === 1) {
      return subHistory[0] === 'survive'
        ? "Good. You're not panicking. That's step one."
        : "Wild movement. I adjusted. Save your energy.";
    }
    if (round === 2 && subHistory.length === 2) {
      return subHistory[1] === 'survive'
        ? "The grip is getting tighter... you need to do something."
        : "You made space! But you're gassing out.";
    }
    return null;
  }

  function getTapMessage() {
    const explodeCount = subHistory.filter(s => s === 'explode').length;
    const surviveCount = subHistory.filter(s => s === 'survive').length;

    let msg;
    if (explodeCount >= 2 || (explodeCount >= 1 && playerGP <= 2)) {
      msg = "You burned all your energy fighting it. That's what happens when you spaz. Stay calm, save your gas.";
    } else if (surviveCount === 3) {
      msg = "You stayed calm. That's actually good. But calm isn't enough — you need technique to escape. That comes with training.";
    } else {
      msg = "You tried to fight it. Sometimes that works, sometimes it doesn't. The key is knowing WHEN to explode.";
    }
    return msg + "\n\nEveryone gets tapped their first day. That's your first lesson.";
  }

  // ── RENDER ──────────────────────────────────────────────

  // Shared wrapper
  const Wrap = ({ children }) => (
    <div style={{ padding: '20px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
      {children}
    </div>
  );

  // ── INTRO ───────────────────────────────────────────────
  if (phase === 'INTRO') {
    return (
      <Wrap>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 20 }}>
          {/* Coach avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: `${T.coach}15`,
            border: `2px solid ${T.coach}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'coachPulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontFamily: T.display, fontSize: 32, color: T.coach }}>M</span>
          </div>
          <div>
            <div style={{ fontFamily: T.display, fontSize: 28, color: T.white, letterSpacing: '0.06em', marginBottom: 8 }}>Welcome to the mat.</div>
            <div style={{ fontFamily: T.display, fontSize: 28, color: T.coach, letterSpacing: '0.06em' }}>I'm Coach Mike.</div>
          </div>
          <div style={{ fontFamily: T.body, fontSize: 14, color: T.muted, lineHeight: 1.6, maxWidth: 280 }}>
            I'm going to show you how this works. 3 turns. Let's go.
          </div>
          <Btn onClick={() => setPhase('TURN_1_STANCE')}>Step on the mat</Btn>
        </div>
      </Wrap>
    );
  }

  // ── TURN 1 STANCE ───────────────────────────────────────
  if (phase === 'TURN_1_STANCE') {
    return (
      <Wrap>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TURN 1</div>
        <PositionDisplay playerPos={playerPosition} coachPos={coachPosition} />
        <GPDisplay playerGP={playerGP} coachGP={coachGP} />

        <Coach message="Every turn, you pick a stance. Your stance determines what move you use — and how it clashes with mine." />

        {/* Coach's hidden stance */}
        <div style={{ padding: '10px 14px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, textAlign: 'center' }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>Coach Mike chose: </span>
          <span style={{ fontFamily: T.display, fontSize: 18, color: T.muted, letterSpacing: '0.06em' }}>???</span>
        </div>

        {/* Stance cards */}
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>CHOOSE YOUR STANCE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {turn1Stances.map(s => (
            <StanceCard key={s.stance} {...s} selected={selectedStance} onClick={resolveTurn1} />
          ))}
        </div>
      </Wrap>
    );
  }

  // ── TURN 1 RESOLVE ──────────────────────────────────────
  if (phase === 'TURN_1_RESOLVE') {
    const o = getTurn1Outcome();
    const newPGP = Math.max(0, playerGP + o.pGP);
    const newCGP = Math.max(0, coachGP + o.cGP);
    return (
      <Wrap>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TURN 1 — RESULT</div>

        {/* Coach reveal */}
        <div style={{
          padding: '12px 16px', background: `${T.red}0A`, border: `1px solid ${T.red}30`, borderRadius: 6,
          animation: 'flipIn 0.5s ease-out both', textAlign: 'center',
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>COACH MIKE'S MOVE</div>
          <div style={{ fontFamily: T.display, fontSize: 20, color: T.red, letterSpacing: '0.04em' }}>⚔️ Attack — Double Leg Takedown</div>
        </div>

        {/* Your stance */}
        <div style={{
          padding: '12px 16px', background: `${STANCE_C[turn1Result]}0A`, border: `1px solid ${STANCE_C[turn1Result]}30`, borderRadius: 6, textAlign: 'center',
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>YOUR MOVE</div>
          <div style={{ fontFamily: T.display, fontSize: 20, color: STANCE_C[turn1Result], letterSpacing: '0.04em' }}>
            {STANCE_ICON[turn1Result]} {turn1Result.charAt(0).toUpperCase() + turn1Result.slice(1)} — {turn1Stances.find(s => s.stance === turn1Result).moveName}
          </div>
        </div>

        {/* Outcome */}
        <div style={{ fontFamily: T.body, fontSize: 14, color: T.text, lineHeight: 1.6, padding: '8px 0' }}>{o.text}</div>

        {/* Stance lesson */}
        <div style={{
          padding: '10px 14px', borderRadius: 6, fontFamily: T.mono, fontSize: 13, fontWeight: 600, textAlign: 'center',
          background: o.lessonType === 'win' ? `${T.gold}15` : o.lessonType === 'lose' ? `${T.red}15` : `${T.muted}10`,
          color: o.lessonType === 'win' ? T.gold : o.lessonType === 'lose' ? T.red : T.muted,
          border: `1px solid ${o.lessonType === 'win' ? T.gold : o.lessonType === 'lose' ? T.red : T.dim}30`,
        }}>{o.lesson}</div>

        {/* New positions */}
        <PositionDisplay playerPos={o.pPos} coachPos={o.cPos} />

        {/* GP changes */}
        <GPDisplay playerGP={newPGP} coachGP={newCGP} />

        <Btn full onClick={() => {
          const oc = getTurn1Outcome();
          setPlayerPosition(oc.pPos);
          setCoachPosition(oc.cPos);
          setPlayerGP(prev => Math.max(0, prev + oc.pGP));
          setCoachGP(prev => Math.max(0, prev + oc.cGP));
          setSelectedStance(null);
          setPhase('TURN_2_STANCE');
        }}>Next Turn →</Btn>
      </Wrap>
    );
  }

  // ── TURN 2 STANCE ───────────────────────────────────────
  if (phase === 'TURN_2_STANCE') {
    const cfg = getTurn2Config();
    return (
      <Wrap>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TURN 2</div>
        <PositionDisplay playerPos={playerPosition} coachPos={coachPosition} />
        <GPDisplay playerGP={playerGP} coachGP={coachGP} />

        <Coach message="Same idea — pick your stance. But notice: your position changed. Different position, different moves." />

        <div style={{ padding: '10px 14px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, textAlign: 'center' }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>Coach Mike chose: </span>
          <span style={{ fontFamily: T.display, fontSize: 18, color: T.muted, letterSpacing: '0.06em' }}>???</span>
        </div>

        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>CHOOSE YOUR STANCE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cfg.stances.map(s => (
            <StanceCard key={s.stance} {...s} selected={selectedStance} onClick={resolveTurn2} />
          ))}
        </div>
      </Wrap>
    );
  }

  // ── TURN 2 RESOLVE ──────────────────────────────────────
  if (phase === 'TURN_2_RESOLVE') {
    const cfg = getTurn2Config();
    const o = cfg.outcomes[selectedStance];
    return (
      <Wrap>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TURN 2 — RESULT</div>

        {/* Coach reveal */}
        <div style={{
          padding: '12px 16px', background: `${STANCE_C[cfg.coachStance]}0A`, border: `1px solid ${STANCE_C[cfg.coachStance]}30`, borderRadius: 6,
          animation: 'flipIn 0.5s ease-out both', textAlign: 'center',
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>COACH MIKE'S MOVE</div>
          <div style={{ fontFamily: T.display, fontSize: 20, color: STANCE_C[cfg.coachStance], letterSpacing: '0.04em' }}>
            {STANCE_ICON[cfg.coachStance]} {cfg.coachStance.charAt(0).toUpperCase() + cfg.coachStance.slice(1)} — {cfg.coachMove}
          </div>
        </div>

        {/* Your stance */}
        <div style={{
          padding: '12px 16px', background: `${STANCE_C[selectedStance]}0A`, border: `1px solid ${STANCE_C[selectedStance]}30`, borderRadius: 6, textAlign: 'center',
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, letterSpacing: '0.1em', marginBottom: 4 }}>YOUR MOVE</div>
          <div style={{ fontFamily: T.display, fontSize: 20, color: STANCE_C[selectedStance], letterSpacing: '0.04em' }}>
            {STANCE_ICON[selectedStance]} {selectedStance.charAt(0).toUpperCase() + selectedStance.slice(1)} — {cfg.stances.find(s => s.stance === selectedStance).moveName}
          </div>
        </div>

        <div style={{ fontFamily: T.body, fontSize: 14, color: T.text, lineHeight: 1.6, padding: '8px 0' }}>{o.text}</div>

        <div style={{
          padding: '10px 14px', borderRadius: 6, fontFamily: T.mono, fontSize: 13, fontWeight: 600, textAlign: 'center',
          background: o.lessonType === 'win' ? `${T.gold}15` : o.lessonType === 'lose' ? `${T.red}15` : `${T.muted}10`,
          color: o.lessonType === 'win' ? T.gold : o.lessonType === 'lose' ? T.red : T.muted,
          border: `1px solid ${o.lessonType === 'win' ? T.gold : o.lessonType === 'lose' ? T.red : T.dim}30`,
        }}>{o.lesson}</div>

        <PositionDisplay playerPos="side_control_bottom" coachPos="side_control_top" />
        <GPDisplay playerGP={playerGP} coachGP={coachGP} />

        <Btn full onClick={() => {
          setPhase('TURN_2_TRANSITION');
        }}>Continue</Btn>
      </Wrap>
    );
  }

  // ── TURN 2 TRANSITION ───────────────────────────────────
  if (phase === 'TURN_2_TRANSITION') {
    return (
      <Wrap>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}>
          <PositionDisplay playerPos="side_control_bottom" coachPos="side_control_top" />
          <div style={{ fontFamily: T.display, fontSize: 22, color: T.white, letterSpacing: '0.04em' }}>Coach has side control.</div>
          <div style={{ fontFamily: T.body, fontSize: 14, color: T.muted }}>He's setting up something...</div>
        </div>
      </Wrap>
    );
  }

  // ── TURN 3 SUB INTRO ───────────────────────────────────
  if (phase === 'TURN_3_SUB_INTRO') {
    return (
      <Wrap>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TURN 3 — SUBMISSION</div>
        <PositionDisplay playerPos="side_control_bottom" coachPos="side_control_top" />
        <GPDisplay playerGP={playerGP} coachGP={coachGP} />

        <Coach message="Coach locks up a Kimura on your arm." sub="This is a submission. If it gets tight enough — you tap." />

        <TightenMeter level={1} />

        <div style={{ fontFamily: T.body, fontSize: 13, color: T.text, marginTop: 4 }}>You have two options:</div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, padding: '14px', background: `${T.blue}0A`, border: `1px solid ${T.blue}25`, borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🛡️</div>
            <div style={{ fontFamily: T.display, fontSize: 16, color: T.blue, letterSpacing: '0.04em' }}>Survive</div>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.dim, marginTop: 4, lineHeight: 1.4 }}>Hold on. Costs nothing. Buys time. But the grip gets tighter.</div>
          </div>
          <div style={{ flex: 1, padding: '14px', background: `${T.red}0A`, border: `1px solid ${T.red}25`, borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>💥</div>
            <div style={{ fontFamily: T.display, fontSize: 16, color: T.red, letterSpacing: '0.04em' }}>Explode</div>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.dim, marginTop: 4, lineHeight: 1.4 }}>Burn 3 GP to fight out. Might work — might not.</div>
          </div>
        </div>

        <Btn full onClick={() => setPhase('SUB_ROUND_1')}>Defend the Kimura</Btn>
      </Wrap>
    );
  }

  // ── SUB ROUNDS ──────────────────────────────────────────
  if (phase === 'SUB_ROUND_1' || phase === 'SUB_ROUND_2' || phase === 'SUB_ROUND_3') {
    const roundNum = phase === 'SUB_ROUND_1' ? 1 : phase === 'SUB_ROUND_2' ? 2 : 3;
    const coachAction = roundNum === 3 ? 'SQUEEZE — this is it' : roundNum === 2 ? 'SQUEEZE — grip getting tighter' : 'SQUEEZE — tightening the Kimura';
    const prevMsg = getSubCoachMsg(roundNum - 1);
    const canExplode = playerGP >= 3;

    return (
      <Wrap>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>KIMURA — ROUND {roundNum}/3</div>
        <PositionDisplay playerPos="side_control_bottom" coachPos="side_control_top" />
        <GPDisplay playerGP={playerGP} coachGP={coachGP} />

        <TightenMeter level={tightenMeter} />

        {prevMsg && <Coach message={prevMsg} />}

        <div style={{
          padding: '10px 14px', background: `${T.red}0A`, border: `1px solid ${T.red}25`, borderRadius: 6,
          fontFamily: T.mono, fontSize: 12, color: T.red, textAlign: 'center',
        }}>
          Coach: <strong>{coachAction}</strong>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => handleSubChoice('survive')} style={{
            flex: 1, padding: '16px', background: `${T.blue}0A`, border: `2px solid ${T.blue}40`, borderRadius: 6,
            cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>🛡️</div>
            <div style={{ fontFamily: T.display, fontSize: 18, color: T.blue }}>Survive</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginTop: 4 }}>0 GP</div>
          </button>

          <button onClick={() => canExplode && handleSubChoice('explode')} disabled={!canExplode} style={{
            flex: 1, padding: '16px', background: canExplode ? `${T.red}0A` : T.surface2, border: `2px solid ${canExplode ? T.red + '40' : T.border}`,
            borderRadius: 6, cursor: canExplode ? 'pointer' : 'default', textAlign: 'center', opacity: canExplode ? 1 : 0.4,
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>💥</div>
            <div style={{ fontFamily: T.display, fontSize: 18, color: canExplode ? T.red : T.dim }}>Explode</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginTop: 4 }}>
              {canExplode ? '3 GP' : 'Not enough GP'}
            </div>
          </button>
        </div>
      </Wrap>
    );
  }

  // ── TAP ─────────────────────────────────────────────────
  if (phase === 'TAP') {
    if (showTap && !tapMessageVisible) {
      // Full-screen TAP overlay
      return (
        <div style={{
          position: 'fixed', inset: 0, background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'shakeX 0.5s ease-in-out',
        }}>
          <div style={{
            fontFamily: T.display, fontSize: 80, color: '#fff', letterSpacing: '0.12em',
            animation: 'subPulse 0.6s ease-in-out infinite',
          }}>TAP!</div>
        </div>
      );
    }

    if (tapMessageVisible) {
      const msg = getTapMessage();
      return (
        <Wrap>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
            <div style={{
              textAlign: 'center', fontFamily: T.display, fontSize: 32, color: T.red, letterSpacing: '0.06em',
              marginBottom: 8,
            }}>TAP</div>

            <div style={{
              padding: '16px', background: `${T.coach}0A`, border: `1px solid ${T.coach}25`, borderRadius: 6,
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: `${T.coach}15`, border: `1px solid ${T.coach}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.mono, fontSize: 12, color: T.coach, fontWeight: 700,
                }}>C</div>
                <div style={{ fontFamily: T.body, fontSize: 13, color: T.text, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{msg}</div>
              </div>
            </div>

            <Btn full onClick={() => setPhase('WHAT_YOU_LEARNED')}>What did I learn?</Btn>
          </div>
        </Wrap>
      );
    }

    // Meter filling animation before TAP
    return (
      <Wrap>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <TightenMeter level={5} />
          <div style={{ fontFamily: T.display, fontSize: 24, color: T.red, animation: 'tightenPulse 0.5s ease-in-out infinite' }}>CAUGHT!</div>
        </div>
      </Wrap>
    );
  }

  // ── WHAT YOU LEARNED ────────────────────────────────────
  if (phase === 'WHAT_YOU_LEARNED') {
    return (
      <Wrap>
        <div style={{ fontFamily: T.display, fontSize: 28, color: T.white, letterSpacing: '0.06em', textAlign: 'center', marginBottom: 4 }}>What You Learned</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <LessonCard
            icon="⚔️🛡️⚙️"
            title="The Stance Triangle"
            text="Attack beats Setup. Defend beats Attack. Setup beats Defend. Read your opponent."
            delay={0}
          />
          <LessonCard
            icon="📍"
            title="Position Is Everything"
            text="Top vs bottom changes your whole game. Side control top can submit you. Side control bottom? You're surviving."
            delay={0.3}
          />
          <LessonCard
            icon="⛽"
            title="Manage Your Gas Tank"
            text="Every move costs GP. Run out and you can't explode, can't escape, can't do anything. Pace yourself."
            delay={0.6}
          />
          <LessonCard
            icon="🔒"
            title="Submissions End Fights"
            text="When someone locks in a sub, the tighten meter starts climbing. Survive or explode — but if it hits max, you tap."
            delay={0.9}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          <Btn full onClick={() => { setPhase('DONE'); onComplete && onComplete(); }}>Choose Your Style →</Btn>
        </div>
      </Wrap>
    );
  }

  // ── DONE (fallback) ─────────────────────────────────────
  return null;
}
