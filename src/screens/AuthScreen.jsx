// ═══════════════════════════════════════════════════════════
// OPEN MAT — AUTH SCREEN (LIGHT MODE)
// Login / Signup with Supabase Auth
// Beta access key required for signup
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { T } from '../lib/tokens';
import { Logo } from '../lib/icons';
import { sb } from '../lib/supabase';

const F = { display: T.display, mono: T.mono, body: T.body };

function isValidEmail(email) {
  const atIdx = email.indexOf("@");
  if (atIdx < 1) return false;
  const afterAt = email.slice(atIdx + 1);
  return afterAt.includes(".") && !afterAt.endsWith(".");
}

function getPasswordErrors(pw) {
  const errs = [];
  if (pw.length < 8) errs.push("Password must be at least 8 characters");
  if (!/[0-9]/.test(pw)) errs.push("Password must contain a number");
  if (!/[A-Z]/.test(pw)) errs.push("Password must contain an uppercase letter");
  return errs;
}

export default function AuthScreen({ onDone }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState(null);
  const [signupComplete, setSignupComplete] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [keyValidated, setKeyValidated] = useState(false);
  const [keyError, setKeyError] = useState(null);
  const [keyValidating, setKeyValidating] = useState(false);

  const pwErrors = mode === "signup" && password.length > 0 ? getPasswordErrors(password) : [];
  const pwValid = mode !== "signup" || (password.length > 0 && pwErrors.length === 0);

  const validate = () => {
    const errs = {};
    if (!isValidEmail(email)) errs.email = "Please enter a valid email";
    if (mode === "signup") {
      if (!keyValidated) errs.accessKey = "Please validate your access key first";
      const pe = getPasswordErrors(password);
      if (pe.length > 0) errs.password = pe[0];
      if (password !== confirmPassword) errs.confirmPassword = "Passwords don't match";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateKey = async () => {
    const code = accessKey.toUpperCase().trim();
    if (!code) { setKeyError("Please enter an access key"); return; }
    setKeyValidating(true);
    setKeyError(null);
    try {
      const { data, error: fetchErr } = await sb
        .from('access_keys').select('code, active, redeemed').eq('code', code).single();
      if (fetchErr || !data) { setKeyError("Invalid access key"); setKeyValidated(false); }
      else if (!data.active) { setKeyError("This key has been deactivated"); setKeyValidated(false); }
      else if (data.redeemed) { setKeyError("This key has already been used"); setKeyValidated(false); }
      else { setKeyValidated(true); setKeyError(null); }
    } catch (e) { setKeyError("Failed to validate key"); setKeyValidated(false); }
    setKeyValidating(false);
  };

  function formatAuthError(e) {
    console.error('SIGNUP/LOGIN ERROR:', JSON.stringify(e, null, 2));
    const msg = e?.message || String(e);
    if (e?.status === 429 || /rate.?limit|too many/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
    if (e?.status === 500 || e?.status === 422) return "Server error during signup. The account may have been created — try logging in.";
    return msg;
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true); setError(null); setConfirmNotice(null);
    try {
      if (mode === "login") {
        const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const user = authData?.user;
        if (user && !user.confirmed_at && !user.email_confirmed_at) {
          await sb.auth.signOut();
          setConfirmNotice("Please confirm your email first. Check your inbox for the confirmation link.");
          setLoading(false); return;
        }
        if (user) onDone && onDone(user);
      } else {
        const { data: authData, error: authError } = await sb.auth.signUp({ email, password });
        if (authError) throw authError;
        const user = authData?.user;
        if (user && Array.isArray(user.identities) && user.identities.length === 0) {
          setError("An account with this email already exists. Try logging in instead.");
          setLoading(false); return;
        }
        const code = accessKey.toUpperCase().trim();
        try {
          const { data: redeemResult } = await sb.rpc('redeem_access_key', { p_code: code });
          if (!redeemResult?.success) console.error('[AUTH] Key redeem failed:', redeemResult?.error);
        } catch (redeemErr) { console.error('[AUTH] Key redeem error:', redeemErr); }
        if (user && (!user.confirmed_at && !user.email_confirmed_at)) {
          setSignupComplete(true); setLoading(false); return;
        }
        if (user) onDone && onDone(user);
      }
    } catch (e) { setError(formatAuthError(e)); }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!isValidEmail(email)) { setFieldErrors({ email: "Please enter a valid email" }); return; }
    setFieldErrors({}); setLoading(true); setError(null);
    try {
      const { error: resetError } = await sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://ireadbrainwaves.github.io/OpenMat/' });
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (e) { setError(formatAuthError(e)); }
    setLoading(false);
  };

  const switchMode = (m) => {
    setMode(m); setError(null); setFieldErrors({}); setResetSent(false);
    setConfirmNotice(null); setConfirmPassword(""); setSignupComplete(false);
  };

  const canSubmit = mode === "login"
    ? (email && password && !loading)
    : (email && pwValid && password === confirmPassword && confirmPassword.length > 0 && keyValidated && !loading);

  const inputStyle = {
    width: "100%", padding: "14px 16px", background: "#FFFFFF",
    border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.text,
    fontFamily: F.body, fontSize: 16, outline: "none",
    boxShadow: T.shadowSm,
  };

  const disabledInputStyle = { ...inputStyle, opacity: 0.4, cursor: "default" };
  const fieldErrorStyle = { fontFamily: F.mono, fontSize: 9, color: T.red, marginTop: 4 };

  // ─── Forgot Password View ───
  if (mode === "reset") {
    return (
      <div style={{ padding: "60px 24px 40px", display: "flex", flexDirection: "column", minHeight: "100vh", justifyContent: "center", background: T.bg }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-flex", marginBottom: 16 }}><Logo size={64}/></div>
          <div style={{ fontFamily: F.display, fontSize: 36, color: T.text, marginTop: 12 }}>Open Mat</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.14em", color: T.dim, textTransform: "uppercase", marginTop: 4 }}>Reset Password</div>
        </div>
        {resetSent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: T.green, marginBottom: 16 }}>Check your email for a reset link</div>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, marginBottom: 24, lineHeight: 1.6 }}>We sent a password reset link to {email}.</div>
            <button onClick={() => switchMode("login")} style={{
              padding: "10px 24px", background: "#FFFFFF", border: `1.5px solid ${T.border}`,
              borderRadius: 8, fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em",
              color: T.muted, cursor: "pointer", textTransform: "uppercase",
            }}>Back to Login</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Email</div>
              <input value={email} onChange={e => { setEmail(e.target.value); setFieldErrors({}); }} placeholder="your@email.com" style={inputStyle}/>
              {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
            </div>
            {error && <div style={{ fontFamily: F.mono, fontSize: 10, color: T.red, marginBottom: 12, textAlign: "center" }}>{error}</div>}
            <button onClick={handleReset} disabled={!email || loading} style={{
              width: "100%", padding: "14px 24px",
              background: (!email || loading) ? '#F3F4F6' : '#111827',
              border: 'none', color: (!email || loading) ? T.dim : "#fff",
              fontFamily: F.mono, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
              cursor: (!email || loading) ? "default" : "pointer", borderRadius: 8,
              opacity: loading ? 0.6 : 1,
            }}>{loading ? "..." : "Send Reset Link"}</button>
            <button onClick={() => switchMode("login")} style={{
              width: "100%", marginTop: 12, padding: "10px", background: "transparent",
              border: "none", fontFamily: F.mono, fontSize: 10, color: T.dim,
              cursor: "pointer", letterSpacing: "0.1em",
            }}>Back to Login</button>
          </>
        )}
      </div>
    );
  }

  // ─── Login / Signup View ───
  return (
    <div style={{ padding: "60px 24px 40px", display: "flex", flexDirection: "column", minHeight: "100vh", justifyContent: "center", background: T.bg }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ display: "inline-flex", marginBottom: 16 }}><Logo size={64}/></div>
        <div style={{ fontFamily: F.display, fontSize: 36, color: T.text, marginTop: 12 }}>Open Mat</div>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.14em", color: T.dim, textTransform: "uppercase", marginTop: 4 }}>Turn-Based BJJ Strategy</div>
      </div>

      {confirmNotice && (
        <div style={{
          padding: "12px 14px", marginBottom: 16, borderRadius: 8,
          background: `${T.green}08`, border: `1px solid ${T.green}20`,
          fontFamily: F.mono, fontSize: 10, color: T.green, lineHeight: 1.6, textAlign: "center",
        }}>{confirmNotice}</div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", marginBottom: 24, border: `1.5px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
        {["login", "signup"].map(m => (
          <button key={m} onClick={() => switchMode(m)} style={{
            flex: 1, padding: "10px", fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em",
            textTransform: "uppercase", cursor: "pointer", border: "none", fontWeight: mode === m ? 600 : 400,
            background: mode === m ? '#111827' : "#FFFFFF",
            color: mode === m ? '#FFFFFF' : T.dim,
          }}>{m === "login" ? "Log In" : "Sign Up"}</button>
        ))}
      </div>

      {signupComplete && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontFamily: F.display, fontSize: 24, color: T.green, marginBottom: 12 }}>Account Created</div>
          <div style={{ fontFamily: F.body, fontSize: 13, color: T.muted, lineHeight: 1.7, marginBottom: 24 }}>
            We sent a confirmation link to <span style={{ color: T.text, fontWeight: 500 }}>{email}</span>.<br/>
            Check your email and click the link to activate your account, then log in.
          </div>
          <button onClick={() => switchMode("login")} style={{
            padding: "12px 32px", background: '#111827', border: 'none',
            borderRadius: 8, fontFamily: F.mono, fontSize: 11, letterSpacing: "0.12em",
            color: "#fff", cursor: "pointer", textTransform: "uppercase",
          }}>Go to Login</button>
        </div>
      )}

      {!signupComplete && (<>
        {mode === "signup" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Beta Access Key</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={accessKey}
                onChange={e => { const v = e.target.value.toUpperCase(); setAccessKey(v); if (keyValidated) { setKeyValidated(false); setKeyError(null); } }}
                placeholder="e.g. OM-GUARD-7291" disabled={keyValidated}
                style={{ ...inputStyle, flex: 1, borderColor: keyValidated ? T.green : keyError ? T.red : T.border, opacity: keyValidated ? 0.7 : 1 }}
              />
              {!keyValidated ? (
                <button onClick={validateKey} disabled={keyValidating || !accessKey.trim()} style={{
                  padding: "0 16px", background: (!accessKey.trim() || keyValidating) ? '#F3F4F6' : '#111827',
                  border: 'none', color: (!accessKey.trim() || keyValidating) ? T.dim : "#fff",
                  fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: (!accessKey.trim() || keyValidating) ? "default" : "pointer", borderRadius: 8,
                  whiteSpace: "nowrap",
                }}>{keyValidating ? "..." : "Validate"}</button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: T.green, fontFamily: F.mono, fontSize: 12, fontWeight: 700 }}>Valid</div>
              )}
            </div>
            {keyError && <div style={fieldErrorStyle}>{keyError}</div>}
            {!keyValidated && !keyError && (
              <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, marginTop: 6, fontStyle: "italic" }}>
                Don't have a key? Ask your training partner.
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Email</div>
          <input value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(f => ({ ...f, email: undefined })); setConfirmNotice(null); }}
            placeholder="your@email.com" disabled={mode === "signup" && !keyValidated}
            style={{ ...(mode === "signup" && !keyValidated ? disabledInputStyle : inputStyle), borderColor: fieldErrors.email ? T.red : T.border }}
          />
          {fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Password</div>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(f => ({ ...f, password: undefined })); }}
            placeholder="••••••••" disabled={mode === "signup" && !keyValidated}
            style={{ ...(mode === "signup" && !keyValidated ? disabledInputStyle : inputStyle), borderColor: fieldErrors.password ? T.red : T.border }}
          />
          {fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
          {mode === "signup" && password.length > 0 && pwErrors.length > 0 && !fieldErrors.password && (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              {pwErrors.map((e, i) => <div key={i} style={{ fontFamily: F.mono, fontSize: 9, color: T.red }}>{e}</div>)}
            </div>
          )}
        </div>

        {mode === "signup" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: "0.1em", color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Confirm Password</div>
            <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(f => ({ ...f, confirmPassword: undefined })); }}
              placeholder="Confirm password" disabled={!keyValidated}
              style={{ ...(!keyValidated ? disabledInputStyle : inputStyle), borderColor: fieldErrors.confirmPassword ? T.red : T.border }}
            />
            {fieldErrors.confirmPassword && <div style={fieldErrorStyle}>{fieldErrors.confirmPassword}</div>}
          </div>
        )}

        {error && <div style={{ fontFamily: F.mono, fontSize: 10, color: T.red, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          width: "100%", padding: "14px 24px",
          background: !canSubmit ? '#F3F4F6' : '#111827',
          border: 'none', color: !canSubmit ? T.dim : "#fff",
          fontFamily: F.mono, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
          cursor: !canSubmit ? "default" : "pointer", borderRadius: 8,
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? (mode === "signup" ? "Creating account..." : "Logging in...") : mode === "login" ? "Log In" : "Create Account"}
        </button>

        {mode === "login" && (
          <button onClick={() => switchMode("reset")} style={{
            width: "100%", marginTop: 12, padding: "8px", background: "transparent",
            border: "none", fontFamily: F.mono, fontSize: 9, color: T.dim,
            cursor: "pointer", letterSpacing: "0.1em",
          }}>Forgot password?</button>
        )}

        {mode === "signup" && (
          <div style={{ fontFamily: F.mono, fontSize: 9, color: T.dim, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
            Everyone starts at white belt. Your belt is earned through play.
          </div>
        )}
      </>)}
    </div>
  );
}
