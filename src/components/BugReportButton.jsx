import React, { useState } from 'react';
import { T } from '../lib/tokens';
import { sb } from '../lib/supabase';

export default function BugReportButton({ currentScreen, matchId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await sb.rpc('submit_bug_report', {
        p_screen: currentScreen || 'unknown',
        p_description: text.trim(),
        p_match_id: matchId || null,
        p_device_info: navigator.userAgent,
      });
      setSent(true);
      setText('');
      setTimeout(() => { setSent(false); setOpen(false); }, 1500);
    } catch (e) {
      console.error('[BUG REPORT] Failed:', e);
    }
    setSending(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        width: 40, height: 40, borderRadius: '50%',
        background: T.surface2, border: `1px solid ${T.border}`,
        color: T.muted, fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {'\u{1F41B}'}
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      width: 280, background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: T.display, fontSize: 14, color: T.white, letterSpacing: '0.04em' }}>Report Bug</div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 16 }}>X</button>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, marginBottom: 8 }}>
        Screen: {currentScreen}{matchId ? ` | Match: ${matchId.slice(0, 8)}...` : ''}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What went wrong?"
        rows={3}
        style={{
          width: '100%', padding: '8px 10px', background: T.surface2,
          border: `1px solid ${T.border}`, borderRadius: 4, color: T.text,
          fontFamily: T.body, fontSize: 13, outline: 'none', resize: 'vertical',
          marginBottom: 8, boxSizing: 'border-box',
        }}
      />
      <button onClick={handleSubmit} disabled={sending || !text.trim()} style={{
        width: '100%', padding: '8px 0', background: sending ? T.surface2 : T.you,
        border: 'none', borderRadius: 4, color: T.white, fontFamily: T.display,
        fontSize: 13, cursor: sending ? 'default' : 'pointer', letterSpacing: '0.04em',
        opacity: (!text.trim() || sending) ? 0.5 : 1,
      }}>
        {sent ? 'Sent!' : sending ? 'Sending...' : 'Submit'}
      </button>
    </div>
  );
}
