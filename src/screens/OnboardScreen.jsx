// ═══════════════════════════════════════════════════════════
// OPEN MAT — ONBOARDING SCREEN
// 4-step: Name → Archetype → Belt notice → Deck picker
// Real Supabase calls: profile upsert + seed_starter_deck
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { T, ARCHETYPES, BeltColors } from '../lib/tokens';
import { ArchIcon } from '../lib/icons';
import { Btn } from '../components/UI';
import { sb, G } from '../lib/supabase';

// Archetype naming differs between tables:
// profiles CHECK constraint uses 'submission_hunter'
// starter_decks table uses 'sub_hunter'
const toDeckArchetype = (a) => a === 'submission_hunter' ? 'sub_hunter' : a;

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
function DeckStep({ archetype, deck, setDeck, decks, loadingDecks, onComplete, saving, onBack }) {
  const archData = ARCHETYPES.find(a => a.id === archetype);
  return (
    <div style={{ animation: "fadeUp 0.3s ease-out both" }}>
      <div style={{ fontFamily: T.display, fontSize: 28, letterSpacing: "0.06em", color: T.white, marginBottom: 4 }}>Pick Your Deck</div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, marginBottom: 20, lineHeight: 1.6 }}>Two starter decks for {archData?.name}. You can edit your deck later.</div>
      {loadingDecks ? (
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textAlign: "center", padding: 40 }}>Loading decks...</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {decks.map(d => {
          const sel = deck === d.id;
          const ids = d.technique_ids || [];
          const moveCount = ids.length;
          // Compute type stats from G.techniques
          const stats = { submission: 0, sweep: 0, transition: 0, escape: 0, takedown: 0 };
          ids.forEach(tid => {
            const tech = G.techniques[tid];
            if (tech && stats[tech.type] !== undefined) stats[tech.type]++;
          });
          return (
            <button key={d.id} onClick={() => setDeck(d.id)} style={{
              padding: "16px", textAlign: "left", background: sel ? `${archData.color}10` : T.surface,
              border: `1px solid ${sel ? archData.color : T.border}`, borderRadius: 6, cursor: "pointer", position: "relative", overflow: "hidden",
            }}>
              {sel && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: archData.color }}/>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontFamily: T.display, fontSize: 20, letterSpacing: "0.04em", color: sel ? T.white : T.muted }}>{d.deck_name}</div>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim }}>{moveCount} moves</span>
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {stats.submission > 0 && <span><span style={{ color: T.red }}>{stats.submission}</span> subs</span>}
                {stats.sweep > 0 && <span><span style={{ color: T.amber }}>{stats.sweep}</span> sweeps</span>}
                {stats.transition > 0 && <span><span style={{ color: T.blue }}>{stats.transition}</span> trans</span>}
                {stats.escape > 0 && <span><span style={{ color: T.teal }}>{stats.escape}</span> esc</span>}
                {stats.takedown > 0 && <span><span style={{ color: T.green }}>{stats.takedown}</span> TD</span>}
              </div>
            </button>
          );
        })}
      </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="ghost" onClick={onBack}>Back</Btn>
        <div style={{ flex: 1 }}><Btn full onClick={onComplete} disabled={!deck || saving || loadingDecks}>{saving ? "Setting up..." : "Start Rolling"}</Btn></div>
      </div>
    </div>
  );
}

// mode: 'full' (default) | 'name_only' (just name → save) | 'archetype_deck' (archetype + deck only)
export default function OnboardScreen({ user, onDone, mode = 'full' }) {
  const startStep = mode === 'archetype_deck' ? 1 : 0;
  const [step, setStep] = useState(startStep);
  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState(null);
  const [deck, setDeck] = useState(null);
  const [fetchedDecks, setFetchedDecks] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Fetch starter decks from DB when archetype changes
  useEffect(() => {
    if (!archetype) return;
    const dbArchetype = toDeckArchetype(archetype);
    setLoadingDecks(true);
    setDeck(null);
    sb.from('starter_decks')
      .select('id, archetype, deck_name, technique_ids')
      .eq('archetype', dbArchetype)
      .then(({ data, error: fetchErr }) => {
        if (fetchErr) {
          console.error('[ONBOARD] Failed to fetch starter decks:', fetchErr);
          setFetchedDecks([]);
        } else {
          console.log('[ONBOARD] Fetched starter decks:', data);
          setFetchedDecks(data || []);
        }
        setLoadingDecks(false);
      });
  }, [archetype]);

  // Name-only save: just upsert name, no archetype or deck
  const handleNameOnly = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: upsertErr } = await sb.from("profiles").upsert(
        {
          id: user.id,
          username: name.trim(),
          display_name: name.trim(),
          belt: "white",
          elo: parseInt(1200, 10),
        },
        { onConflict: 'id' }
      );
      if (upsertErr) {
        console.error("Profile upsert error:", upsertErr);
        setError("Failed to save profile. Please try again.");
        setSaving(false);
        return;
      }
      onDone && onDone();
    } catch (e) {
      console.error("Onboard error:", e);
      setError("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const handleComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      // profiles table uses 'submission_hunter', starter_decks uses 'sub_hunter'
      const profileArchetype = archetype; // raw value from ARCHETYPES (e.g. 'submission_hunter')
      const deckArchetype = toDeckArchetype(archetype); // mapped for starter_decks/RPC

      // Update profile with archetype — profile already exists from name step
      // Use update (not upsert) to avoid overwriting username with a fallback
      const { error: upsertErr } = await sb.from("profiles")
        .update({ archetype: profileArchetype })
        .eq('id', user.id);
      if (upsertErr) {
        console.error("Profile upsert error:", upsertErr);
        setError("Failed to save profile. Please try again.");
        setSaving(false);
        return;
      }
      // Seed starter deck — parseInt for deck ID, p_ prefix on all params
      console.log('[ONBOARD] seeding deck:', { p_profile_id: user.id, p_archetype: deckArchetype, p_deck_id: parseInt(deck, 10) });
      const { error: seedErr } = await sb.rpc("seed_starter_deck", {
        p_profile_id: user.id,
        p_archetype: deckArchetype,
        p_deck_id: parseInt(deck, 10),
      });
      if (seedErr) {
        console.error("Seed deck error:", seedErr);
        setError("Failed to build starter deck. Please try again.");
        setSaving(false);
        return;
      }
      onDone && onDone();
    } catch (e) {
      console.error("Onboard error:", e);
      setError("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const totalSteps = mode === 'name_only' ? 1 : mode === 'archetype_deck' ? 3 : 4;
  const stepsOffset = mode === 'archetype_deck' ? -1 : 0;

  return (
    <div style={{ padding: "24px 20px 40px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {error && <div style={{ background: "#3A1215", border: `1px solid ${T.red}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: T.red, fontSize: 14, fontFamily: T.body }}>{error}</div>}
      <Steps current={step + stepsOffset} total={totalSteps}/>
      {step === 0 && mode !== 'archetype_deck' && (
        <NameStep name={name} setName={setName} onNext={mode === 'name_only' ? handleNameOnly : () => setStep(1)} />
      )}
      {step === 1 && <ArchetypeStep archetype={archetype} setArchetype={setArchetype} onNext={() => setStep(2)} onBack={mode === 'archetype_deck' ? null : () => setStep(0)} />}
      {step === 2 && <BeltStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <DeckStep archetype={archetype} deck={deck} setDeck={setDeck} decks={fetchedDecks} loadingDecks={loadingDecks} onComplete={handleComplete} saving={saving} onBack={() => setStep(2)} />}
    </div>
  );
}
