import React from 'react';
import { T } from '../lib/tokens';
import { Btn } from '../components/UI';
import { StanceIcon } from '../lib/icons';

export default function TutorialGate({ onStart, onSkip }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px', gap: 20, background: T.bg }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <StanceIcon stance="attack" size={32} />
        <StanceIcon stance="defend" size={32} />
        <StanceIcon stance="setup" size={32} />
      </div>
      <div style={{ fontFamily: T.display, fontSize: 28, color: T.text, textAlign: 'center' }}>Welcome to Open Mat</div>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, textAlign: 'center', lineHeight: 1.6, maxWidth: 280 }}>
        Learn stances, moves, and the submission minigame in a guided tutorial match.
      </div>
      <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <Btn onClick={onStart}>Start Tutorial</Btn>
        <div onClick={onSkip} style={{
          fontFamily: T.mono, fontSize: 11, color: T.muted, textAlign: 'center',
          padding: '10px 0', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: T.dim,
        }}>Skip Tutorial</div>
      </div>
    </div>
  );
}
