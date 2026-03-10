// ═══════════════════════════════════════════════════════════
// OPEN MAT — AUTH SCREEN
// Login / Signup with Supabase Auth
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { T } from '../lib/tokens';
import { Logo } from '../lib/icons';
import { sb } from '../lib/supabase';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = mode === "login"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
      if (authError) throw authError;
      // onAuth is called by the auth state listener in App.jsx
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 4, color: T.text,
    fontFamily: T.body, fontSize: 16, outline: "none",
  };

  return (
    <div style={{ padding: "60px 24px 40px", display: "flex", flexDirection: "column", minHeight: "100vh", justifyContent: "center" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ display: "inline-flex", marginBottom: 16 }}><Logo size={64}/></div>
        <div style={{ fontFamily: T.display, fontSize: 36, letterSpacing: "0.1em", color: T.white }}>Open Mat</div>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase", marginTop: 4 }}>
          Turn-Based BJJ Strategy
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
        {["login", "signup"].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(null); }} style={{
            flex: 1, padding: "10px", fontFamily: T.mono, fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", cursor: "pointer", border: "none",
            background: mode === m ? T.surface2 : "transparent",
            color: mode === m ? T.you : T.dim,
          }}>{m === "login" ? "Log In" : "Sign Up"}</button>
        ))}
      </div>

      {/* Form */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Email</div>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle}/>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Password</div>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle}/>
      </div>

      {error && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.red, marginBottom: 12, textAlign: "center" }}>{error}</div>}

      <button onClick={handleSubmit} disabled={!email || !password || loading} style={{
        width: "100%", padding: "14px 24px",
        background: (!email || !password || loading) ? T.surface3 : T.you,
        border: `1px solid ${(!email || !password || loading) ? T.border : T.you}`,
        color: (!email || !password || loading) ? T.dim : "#fff",
        fontFamily: T.mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase",
        cursor: (!email || !password || loading) ? "default" : "pointer", borderRadius: 2,
        opacity: loading ? 0.6 : 1,
      }}>
        {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
      </button>

      {mode === "signup" && (
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          Everyone starts at white belt. Your belt is earned through play.
        </div>
      )}
    </div>
  );
}
