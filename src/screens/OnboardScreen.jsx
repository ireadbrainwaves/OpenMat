// ═══════════════════════════════════════════════════════════
// OPEN MAT — ONBOARDING SCREEN
// 4-step: Name → Archetype → Belt notice → Deck picker
// Real Supabase calls: profile upsert + seed_starter_deck
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { T, ARCHETYPES, BeltColors, ArchColors } from '../lib/tokens';
import { ArchIcon, MoveIcon } from '../lib/icons';
import { Btn, Bar } from '../components/UI';
import { sb } from '../lib/supabase';

const STARTER_DECKS = {
  wrestler: [
    { id: 25, name: "Takedown Artist", desc: "Double legs, singles, top control finishes", moves: 24, subs: 4, sweeps: 0, transitions: 12, escapes: 4, takedowns: 4 },
    { id: 26, name: "Grind & Pin", desc: "Body lock, pressure passing, mount submissions", moves: 25, subs: 5, sweeps: 1, transitions: 10, escapes: 5, takedowns: 4 },
  ],
  guard_puller: [
    { id: 27, name: "Sweep Machine", desc: "Scissor sweeps, hip bumps, constant reversals", moves: 24, subs: 4, sweeps: 8, transitions: 6, escapes: 4, takedowns: 2 },
    { id: 28, name: "Guard Assassin", desc: "Triangles, armbars, attack from your back", moves: 25, subs: 7, sweeps: 4, transitions: 6, escapes: 5, takedowns: 3 },
  ],
  leg_locker: [
    { id: 29, name: "Heel Hook Hunter", desc: "Inside sankaku, ashi entries, heel hooks", moves: 24, subs: 6, sweeps: 2, transitions: 8, escapes: 5, takedowns: 3 },
    { id: 30, name: "Ankle Lock Specialist", desc: "Straight ankle locks, toe holds, 50/50", moves: 24, subs: 5, sweeps: 3, transitions: 8, escapes: 5, takedowns: 3 },
  ],
  pressure_passer: [
    { id: 31, name: "Smash Pass", desc: "Knee slice, smash pass, heavy top", moves: 25, subs: 4, sweeps: 1, transitions: 12, escapes: 4, takedowns: 4 },
    { id: 32, name: "Knee Cutter", desc: "Knee slice, leg drag, speed passing", moves: 24, subs: 3, sweeps: 1, transitions: 13, escapes: 4, takedowns: 3 },
  ],
  submission_hunter: [
    { id: 33, name: "Submission Sniper", desc: "Armbars, triangles, chain attacks", moves: 25, subs: 8, sweeps: 3, transitions: 6, escapes: 5, takedowns: 3 },
    { id: 34, name: "Choke Artist", desc: "RNC, guillotine, darce, collar chokes", moves: 24, subs: 7, sweeps: 2, transitions: 7, escapes: 5, takedowns: 3 },
  ],
  scrambler: [
    { id: 35, name: "Chaos Agent", desc: "Arm drags, back takes, constant movement", moves: 25, subs: 3, sweeps: 4, transitions: 10, escapes: 5, takedowns: 3 },
    { id: 36, name: "Berimbolo Bandit", desc: "Inversions, berimbolo, tricky entries", moves: 24, subs: 4, sweeps: 5, transitions: 8, escapes: 4, takedowns: 3 },
  ],
};

// Step indicator
const Steps = ({ current, total }) => (
  <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}>
    {Array.from({ length: total }, (_, i) => (
      <div key={i} style={{
        width: i === current ? 24 : 8, height: 4, borderRadius: 2,
        background: i === current ? T.you : i < current ? T.you + "60" : T.surface3,
        transition: "all 0.3s",
      }}/>
    ))}
  </div>
);

// Type bar for deck composition
const TypeBar = ({ label, count, max, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, width: 36, textAlign: "right" }}>{label}</span>
    <div style={{ flex: 1, height: 4, background: T.surface3, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: color, borderRadius: 2 }}/>
    </div>
    <span style={{ fontFamily: T.mono, fontSize: 9, color: T.muted, width: 16 }}>{count}</span>
  </div>
);

// ─── Step 0: Name ───
function NameStep({ name, setName, onNext }) {
  return (
    <div style={{ animation: "fadeUp 0.3s ease-out both" }}>
      <div style={{ fontFamily: T.display, fontSize: 32, letterSpacing: "0.06em", color: T.white, marginBottom: 8 }}>What's Your Name?</div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginBottom: 24, lineHeight: 1.6 }}>This is how opponents and training partners will see you.</div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your display name" style={{
        width: "100%", padding: "14px 16px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontFamily: T.body, fontSize: 16, outline: "none", marginBottom: 16,
      }}/>
      <Btn full onClick={onNext} disabled={!name.trim()}>Continue</Btn>
    </div>
  );
}

// ─── Step 1: Archetype ───
function ArchetypeStep({ archetype, setArchetype, onNext, onBack }) {
  return (
    <div style={{ animation: "fadeUp 0.3s ease-out both" }}>
      <div style={{ fontFamily: T.display, fontSize: 28, letterSpacing: "0.06em", color: T.white, marginBottom: 4 }}>Choose Your Game</div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginBottom: 20, lineHeight: 1.6 }}>Your archetype defines your strengths and weaknesses. Pick the style that matches how you roll.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {ARCHETYPES.map(a => {
          const sel = archetype === a.id;
          return (
            <button key={a.id} onClick={() => setArchetype(a.id)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
              background: sel ? `${a.color}10` : T.surface, border: `1px solid ${sel ? a.color : T.border}`,
              borderRadius: 6, cursor: "pointer", textAlign: "left", transition: "all 0.15s", position: "relative", overflow: "hidden",
            }}>
              {sel && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: a.color }}/>}
              <div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: `${a.color}08`, borderRadius: 6, border: `1px solid ${a.color}15`, flexShrink: 0 }}>
                <ArchIcon id={a.id} s={30}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.display, fontSize: 18, letterSpacing: "0.04em", color: sel ? T.white : T.muted }}>{a.name}</div>
                <div style={{ fontFamily: T.body, fontSize: 11, color: T.dim, marginTop: 3, lineHeight: 1.4 }}>{a.desc}</div>
                {sel && <div style={{ display: "flex", gap: 12, marginTop: 6, fontFamily: T.mono, fontSize: 9 }}><span style={{ color: T.green }}>{a.strength}</span><span style={{ color: T.red }}>{a.weakness}</span></div>}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="ghost" onClick={onBack}>Back</Btn>
        <div style={{ flex: 1 }}><Btn full onClick={onNext} disabled={!archetype}>Continue</Btn></div>
      </div>
    </div>
  );
}

// ─── Step 2: Belt notice ───
function BeltStep({ onNext, onBack }) {
  return (
    <div style={{ animation: "fadeUp 0.3s ease-out both", textAlign: "center", paddingTop: 20 }}>
      <div style={{ display: "inline-flex", width: 80, height: 80, borderRadius: "50%", border: `2px solid ${T.text}20`, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ width: 40, height: 8, background: T.text, borderRadius: 2, opacity: 0.8 }}/>
      </div>
      <div style={{ fontFamily: T.display, fontSize: 32, letterSpacing: "0.06em", color: T.white, marginBottom: 8 }}>Everyone Starts White</div>
      <div style={{ fontFamily: T.body, fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.7, maxWidth: 300, margin: "0 auto 24px" }}>Your belt is earned through play. Win matches, land submissions, and learn new techniques to rank up.</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 32 }}>
        {[{ c: BeltColors.white, l: "White" }, { c: BeltColors.blue, l: "Blue" }, { c: BeltColors.purple, l: "Purple" }, { c: BeltColors.brown, l: "Brown" }, { c: BeltColors.black, l: "Black", b: T.dim }].map(b => (
          <div key={b.l} style={{ textAlign: "center" }}>
            <div style={{ width: 28, height: 6, background: b.c, borderRadius: 1, border: b.b ? `1px solid ${b.b}` : "none", marginBottom: 4 }}/>
            <span style={{ fontFamily: T.mono, fontSize: 8, color: T.dim }}>{b.l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Btn variant="ghost" onClick={onBack}>Back</Btn>
        <Btn onClick={onNext}>Got It</Btn>
      </div>
    </div>
  );
}

// ─── Step 3: Deck picker ───
function DeckStep({ archetype, deck, setDeck, onComplete, saving, onBack }) {
  const decks = archetype ? STARTER_DECKS[archetype] || [] : [];
  const archData = ARCHETYPES.find(a => a.id === archetype);
  return (
    <div style={{ animation: "fadeUp 0.3s ease-out both" }}>
      <div style={{ fontFamily: T.display, fontSize: 28, letterSpacing: "0.06em", color: T.white, marginBottom: 4 }}>Pick Your Deck</div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginBottom: 20, lineHeight: 1.6 }}>Two starter decks for {archData?.name}. You can edit your deck later.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {decks.map(d => {
          const sel = deck === d.id;
          return (
            <button key={d.id} onClick={() => setDeck(d.id)} style={{
              padding: "16px", textAlign: "left", background: sel ? `${archData.color}10` : T.surface,
              border: `1px solid ${sel ? archData.color : T.border}`, borderRadius: 6, cursor: "pointer", position: "relative", overflow: "hidden",
            }}>
              {sel && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: archData.color }}/>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontFamily: T.display, fontSize: 20, letterSpacing: "0.04em", color: sel ? T.white : T.muted }}>{d.name}</div>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>{d.moves} moves</span>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 11, color: T.dim, marginBottom: 12, lineHeight: 1.4 }}>{d.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <TypeBar label="Subs" count={d.subs} max={10} color={T.red}/>
                <TypeBar label="Sweep" count={d.sweeps} max={10} color={T.amber}/>
                <TypeBar label="Trans" count={d.transitions} max={15} color={T.blue}/>
                <TypeBar label="Esc" count={d.escapes} max={8} color={T.teal}/>
                <TypeBar label="TD" count={d.takedowns} max={6} color={T.green}/>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="ghost" onClick={onBack}>Back</Btn>
        <div style={{ flex: 1 }}><Btn full onClick={onComplete} disabled={!deck || saving}>{saving ? "Setting up..." : "Start Rolling"}</Btn></div>
      </div>
    </div>
  );
}

export default function OnboardScreen({ user, onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState(null);
  const [deck, setDeck] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Upsert profile
      await sb.from("profiles").upsert({
        id: user.id,
        username: name.trim(),
        archetype,
        belt: "white",
        elo: 1200,
        display_name: name.trim(),
      });
      // Seed starter deck (DB starter_decks uses "sub_hunter" not "submission_hunter")
      const rpcArchetype = archetype === "submission_hunter" ? "sub_hunter" : archetype;
      await sb.rpc("seed_starter_deck", {
        p_profile_id: user.id,
        p_archetype: rpcArchetype,
        p_deck_id: deck,
      });
      onDone && onDone();
    } catch (e) {
      console.error("Onboard error:", e);
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: "24px 20px 40px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Steps current={step} total={4}/>
      {step === 0 && <NameStep name={name} setName={setName} onNext={() => setStep(1)} />}
      {step === 1 && <ArchetypeStep archetype={archetype} setArchetype={setArchetype} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <BeltStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <DeckStep archetype={archetype} deck={deck} setDeck={setDeck} onComplete={handleComplete} saving={saving} onBack={() => setStep(2)} />}
    </div>
  );
}
