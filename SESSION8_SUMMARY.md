# Session 8 Summary

**Date:** March 10, 2026
**Focus:** Sprint 5 completion — deploy blockers, security, bot ladder, variant system

---

## Bugs Fixed

### Prop Mismatches (7 Components)
- Aligned prop names across AuthScreen, LobbyScreen, GamePlanScreen, PostMatchScreen, DeckScreen, OnboardScreen, and MatchScreen with App.jsx router

### OnboardScreen Bugs
- **Keystroke focus loss:** Inline arrow function step components caused React to remount inputs on every render. Extracted NameStep, ArchetypeStep, BeltStep, DeckStep as standalone function components outside OnboardScreen
- **Integer IDs:** STARTER_DECKS updated to use integer technique IDs (25-36) matching the database
- **Archetype mapping:** "submission_hunter" to "sub_hunter" mapping added for starter_decks table compatibility
- **Error handling:** `sb.from().upsert()` and `sb.rpc()` return `{ data, error }` without throwing — try/catch was not catching RPC-level errors. Fixed to destructure and check `{ error }` from both profile upsert and seed_starter_deck. `onDone()` now only fires if both succeed. Added visible red error banner.

### draw_hand RPC
- RPC was missing entirely — wrote and deployed the SQL function
- Signature: `draw_hand(p_profile_id UUID, p_position TEXT, p_archetype TEXT, p_drilled_moves TEXT[])`
- Returns `TEXT[]` — up to 5 technique IDs with tier priority (drilled > trained > known)

### Bot Engine Bugs (botEngine.js)
- **Wrong bot position:** MatchScreen passed `m?.current_position` (shared) instead of per-player position for draw_hand calls. Fixed to compute `botPos = m?.player1_id === botId ? m?.player1_position : m?.player2_position`
- **Sub choice ID mismatches:** Bot sent 'escape'/'reversal'/'chain_sub' but RPC/UI expected 'technical_escape'/'reversal_sub'/'transition_sub'. Added missing 'sweep_scramble'
- **Static think delay:** `THINK_DELAY_MS` was computed once at module load. Changed to getter for fresh random value each call

### AuthScreen Fixes
- **Forgot password flow:** 3-mode state machine (login/signup/reset), `resetPasswordForEmail` with redirect to GitHub Pages URL
- **Email validation:** Checks for `@` and dot after `@` with inline field error
- **Password strength:** Minimum 8 characters, must contain a number, must contain an uppercase letter. All validation errors shown inline below password field. Signup button disabled until all checks pass.
- **Confirm password:** Second password input in signup mode, "Passwords don't match" error if mismatched, cleared on mode switch
- **Email confirmation enforcement:** After signup, checks `confirmed_at`/`email_confirmed_at` — if null, shows confirmation screen and does NOT auto-login. On login, checks confirmation status — if unconfirmed, signs out and shows "Please confirm your email first."
- **Duplicate signup prevention:** Button disabled immediately on click, shows "Creating account..." during request. After successful signup, entire form replaced with confirmation message + "Go to Login" button.
- **Duplicate email detection:** Checks `user.identities.length === 0` (Supabase's anti-enumeration response) and shows "An account with this email already exists. Try logging in instead."
- **Rate limit feedback:** Catches 429 status or "rate limit"/"too many" in error messages, shows "Too many attempts. Please wait a minute and try again." Applied to login, signup, and password reset flows.

### RPC Error Handling
- LobbyScreen: Added `error` state and red error banner for `challenge_bot` failures
- GamePlanScreen: Added `error` state and red error banner for `set_drilled_moves` failures, added `console.log('drill params:', ...)` debug line

### App.jsx Cleanup
- Removed dev-only test buttons (testGamePlan, testPostMatch) and their UI
- Removed duplicate top-right Sign Out button (ProfileScreen has its own)

---

## Security

- **Service key audit:** Grepped entire codebase for service role key — confirmed zero matches, only anon key present (JWT decoded: `"role":"anon"`, expires 2036)
- **RLS enabled:** on deck_composition_rules, survive_config, unfamiliar_bonus_config (config tables)
- **Full security audit:** 22-item pre-deploy checklist passed with 0 blockers (no XSS, no service key in client, no email exposure)
- **.gitignore updated:** Added `__pycache__/`, `*.pyc`, `engine/__pycache__/`, `*.csv`, `node_modules/`

---

## New Features

### Ranked Bot Ladder (LobbyScreen.jsx)
- 7 bots in vertical ladder, displayed boss at top, rank 1 at bottom
- **Ranking order:** Iron Mike (white, 1000) > Miyao (white, 1050) > Rodolfo (blue, 1150) > Haisam (blue, 1200) > Ruotolo (purple, 1350) > Marcelo (brown, 1500) > The Professor (black, 3000)
- **Unlock logic:** Queries matches table on mount for wins against each bot. Rank 1 always unlocked, rank N+1 unlocks when rank N beaten
- **Visual states:** Locked (padlock + greyed), current target (glowing border + flavor text), beaten (green checkmark + "Rematch" button)
- **Belt-colored left border** on each rung
- Online Players section replaced with "PvP matchmaking coming soon" footer

### The Professor — Final Boss
- UUID: `00000007-0000-0000-0000-000000000007`
- Archetype: submission_hunter, belt: black, elo: 3000, bot_difficulty: master
- Deck: every technique in the game at tier 'drilled', all 18 variants equipped
- Gold/red gradient card with FINAL BOSS label, pulsing glow animation
- Flavor text: "I know every technique. I've seen every position. Show me something new."

### Master Difficulty (botEngine.js)
- **Stance:** 70% attack, 30% setup, never defends (`MASTER_STANCE_WEIGHTS`)
- **Move selection:** Deterministic scoring (`MASTER_TYPE_SCORES`), no random noise — submissions 10, sweeps 6, takedowns 5, transitions 4, +3 bonus for dominant positions
- **Sub minigame:** Always squeeze as attacker, always technical_escape as defender
- All 3 BotEngine methods accept `difficulty` parameter, passed from MatchScreen via `o.bot_difficulty`

### Variant System
- **Move cards:** Queries `player_move_stacks.equipped_variant` joined with `technique_variants` on match load. Variant moves show gold name + diamond icon, with base technique name below
- **Turn reveal:** Parses `[VARIANT: ...]` from match_turns description. Variant name displayed in gold #FFD700 with shimmer animation, "Variant of [base technique]" subtitle
- **Graceful degradation:** If no variants equipped or technique_variants table missing, everything renders normally

### GamePlan Redesign (GamePlanScreen.jsx)
- Moves grouped by `from_position` in collapsible dropdown sections
- Section headers show formatted position name + move count (e.g. "Closed Guard Top (5 moves)")
- Collapsed by default (chevron: right when closed, down when open), tap to toggle
- Sections with drilled moves auto-expand
- Sort order: sections with drilled moves first, then alphabetical
- Move cards show: drill star, type icon, name, tier symbol, type badge, GP cost
- Summary bar: "X moves across Y positions - Z/4 drill slots used"
- "Ready - Start Match" button fixed at bottom of viewport

### SPA Routing
- Created `public/404.html` for GitHub Pages — converts path to query string for client-side routing

---

## Deploy

- **Live at:** https://ireadbrainwaves.github.io/OpenMat/
- **Build:** 76 modules, ~473 KB JS, ~2.25 KB CSS
- **Pre-deploy checklist:** 22 items PASS, 0 blockers
- **Vite config:** `base: '/OpenMat/'`, `outDir: 'dist'`

---

## Files Changed

| File | Changes |
|------|---------|
| `src/App.jsx` | Removed test buttons, cleaned router, rejoin logic |
| `src/screens/AuthScreen.jsx` | Forgot password, email/password validation, confirm password, email confirmation enforcement, duplicate signup prevention, rate limit feedback |
| `src/screens/OnboardScreen.jsx` | Extracted step components, fixed focus loss, RPC error handling |
| `src/screens/LobbyScreen.jsx` | Complete rewrite — ranked ladder with unlock logic |
| `src/screens/GamePlanScreen.jsx` | Collapsible position-grouped moves, RPC error handling, debug logging |
| `src/screens/MatchScreen.jsx` | Bot difficulty passthrough, variant display on cards + reveal |
| `src/screens/PostMatchScreen.jsx` | Prop alignment |
| `src/screens/DeckScreen.jsx` | Prop alignment |
| `src/lib/botEngine.js` | Master difficulty, fixed sub IDs, dynamic delay, difficulty param |
| `src/index.css` | Added shimmer, bossPulse keyframe animations |
| `public/404.html` | SPA routing for GitHub Pages |
| `.gitignore` | Added __pycache__, *.pyc, engine/__pycache__ |

---

## Database Changes

- **draw_hand:** Created RPC function (returns TEXT[], tier-prioritized hand of 5)
- **resolve_turn:** Updated with variant bonus support (equipped_variant to technique_variants lookup)
- **The Professor:** Inserted into auth.users + profiles + player_move_stacks (every technique at drilled, all 18 variants equipped)
- **Bot updates:** Updated belts/elos for all 6 existing bots to match ladder progression
- **bot_difficulty column:** Added to profiles table (`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bot_difficulty TEXT DEFAULT 'easy'`)
- **RLS:** Enabled on deck_composition_rules, survive_config, unfamiliar_bonus_config

---

## Known Issues (Next Session)

- **Balance:** Scrambler archetype wins 81%, Guard Puller wins 0% — needs archetype_position_matrix tuning
- **Mobile layout:** Some screens need scroll/padding polish on smaller devices
- **Tutorial:** Prototype tutorial exists but is not wired to the real game engine
- **set_drilled_moves:** Needs end-to-end debugging (debug logging added)

---

## Next Session

- Test full player flow end to end (signup > onboard > lobby > game plan > match > post-match)
- Balance fixes for archetype win rates
- Mobile testing and layout polish
- Gym beta distribution
