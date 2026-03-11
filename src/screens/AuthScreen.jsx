// ═══════════════════════════════════════════════════════════
// OPEN MAT — AUTH SCREEN
// Login / Signup with Supabase Auth
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { T } from '../lib/tokens';
import { Logo } from '../lib/icons';
import { sb } from '../lib/supabase';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AuthScreen({ onDone }) {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const validate = () => {
    const errs = {};
    if (!validateEmail(email)) errs.email = "Enter a valid email address";
    if (mode === "signup" && password.length < 6) errs.password = "Password must be at least 6 characters";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = mode === "login"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
      if (authError) throw authError;
      if (authData?.user) onDone && onDone(authData.user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!validateEmail(email)) {
      setFieldErrors({ email: "Enter a valid email address" });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://ireadbrainwaves.github.io/OpenMat/',
      });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setFieldErrors({});
    setResetSent(false);
  };

  const canSubmit = email && password && !loading;

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: T.surface2,
    border: `1px solid ${T.border}`, borderRadius: 4, color: T.text,
    fontFamily: T.body, fontSize: 16, outline: "none",
  };

  const fieldErrorStyle = {
    fontFamily: T.mono, fontSize: 9, color: T.red, marginTop: 4,
  };

  // ─── Forgot Password View ───
  if (mode === "reset") {
    return (
      <div style={{ padding: "60px 24px 40px", display: "flex", flexDirection: "column", minHeight: "100vh", justifyContent: "center" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", marginBottom: 16 }}><Logo size={64}/></div>
          <div style={{ fontFamily: T.display, fontSize: 36, letterSpacing: "0.1em", color: T.white }}>Open Mat</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.16em", color: T.dim, textTransform: "uppercase", marginTop: 4 }}>
            Reset Password
          </div>
        </div>

        {resetSent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.green, marginBottom: 16 }}>Check your email for a reset link</div>
            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, marginBottom: 24, lineHeight: 1.6 }}>
              We sent a password reset link to {email}. It may take a minute to arrive.
            </div>
            <button onClick={() => switchMode("login")} style={{
              padding: "10px 24px", background: "transparent", border: `1px solid ${T.border}`,
              borderRadius: 2, fontFamily: T.mono, fontSize: 10, letterSpacing: "0.14em",
              color: T.muted, cursor: "pointer", textTransform: "uppercase",
            }}>Back to Login</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Email</div>
              <input value={email} onChange={e => { setEmail(e.target.value); setFieldErrors({}); }} placeholder="your@email.com" style={inputStyle}/>
              {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
            </div>

            {error && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.red, marginBottom: 12, textAlign: "center" }}>{error}</div>}

            <button onClick={handleReset} disabled={!email || loading} style={{
              width: "100%", padding: "14px 24px",
              background: (!email || loading) ? T.surface3 : T.you,
              border: `1px solid ${(!email || loading) ? T.border : T.you}`,
              color: (!email || loading) ? T.dim : "#fff",
              fontFamily: T.mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase",
              cursor: (!email || loading) ? "default" : "pointer", borderRadius: 2,
              opacity: loading ? 0.6 : 1,
            }}>
              {loading ? "..." : "Send Reset Link"}
            </button>

            <button onClick={() => switchMode("login")} style={{
              width: "100%", marginTop: 12, padding: "10px", background: "transparent",
              border: "none", fontFamily: T.mono, fontSize: 10, color: T.dim,
              cursor: "pointer", letterSpacing: "0.1em",
            }}>← Back to Login</button>
          </>
        )}
      </div>
    );
  }

  // ─── Login / Signup View ───
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
          <button key={m} onClick={() => switchMode(m)} style={{
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
        <input value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(f => ({ ...f, email: undefined })); }} placeholder="your@email.com" style={{
          ...inputStyle,
          borderColor: fieldErrors.email ? T.red : T.border,
        }}/>
        {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.12em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Password</div>
        <input type="password" value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: undefined })); }} placeholder="••••••••" style={{
          ...inputStyle,
          borderColor: fieldErrors.password ? T.red : T.border,
        }}/>
        {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
        {mode === "signup" && !fieldErrors.password && password.length > 0 && password.length < 6 && (
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, marginTop: 4 }}>{6 - password.length} more character{6 - password.length !== 1 ? "s" : ""} needed</div>
        )}
      </div>

      {error && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.red, marginBottom: 12, textAlign: "center" }}>{error}</div>}

      <button onClick={handleSubmit} disabled={!canSubmit} style={{
        width: "100%", padding: "14px 24px",
        background: !canSubmit ? T.surface3 : T.you,
        border: `1px solid ${!canSubmit ? T.border : T.you}`,
        color: !canSubmit ? T.dim : "#fff",
        fontFamily: T.mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase",
        cursor: !canSubmit ? "default" : "pointer", borderRadius: 2,
        opacity: loading ? 0.6 : 1,
      }}>
        {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
      </button>

      {mode === "login" && (
        <button onClick={() => switchMode("reset")} style={{
          width: "100%", marginTop: 12, padding: "8px", background: "transparent",
          border: "none", fontFamily: T.mono, fontSize: 9, color: T.dim,
          cursor: "pointer", letterSpacing: "0.1em",
        }}>Forgot password?</button>
      )}

      {mode === "signup" && (
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.dim, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          Everyone starts at white belt. Your belt is earned through play.
        </div>
      )}
    </div>
  );
}
