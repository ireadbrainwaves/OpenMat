# Open Mat — Claude Code Context

## Architecture
- SQL engine: ALL game logic in PostgreSQL RPC functions
- React frontend: display/input layer ONLY — no game logic in client
- Supabase: Auth + PostgreSQL + Realtime
- GitHub Pages hosting
- Python bot engine calls same Postgres RPCs as real players

## Key Rules
1. Fix mechanics, not stats — when balance is broken, redesign the mechanic
2. Stance affects resolution bonuses server-side ONLY — never filters move visibility
3. Position determines options, archetype determines effectiveness, stance determines bonuses
4. Complete file rewrites > incremental patches
5. SQL changes in Claude.ai project, JS/React in Claude Code
6. No game logic in the client — ever
7. PostgREST is strict: parseInt for integers, p_ prefix on RPC params, exact column names
8. The graph cache lives at G in supabase.js: G.techniques[id], G.techFrom[posId], G.positions[posId], G.matrix[posId][archetype]

## Current State
- 66 positions, 9 families, 215+ techniques, 75 counters
- 12 starter decks (validated against BJJ gameplans)
- 6 archetypes: Iron Mike, Marcelo, Miyao, Haisam, Rodolfo, Ruotolo
- Tiered hand draw: Drilled (always) → Trained (random fill) → Known (15% chance)
- Survive/Spaz universal mechanics for empty positions
- Tutorial → Archetype → Deck → Lobby onboarding flow

## File Map
- src/lib/supabase.js — Client, graph cache (G), drawHand(), getMoves()
- src/lib/constants.js — Archetypes, belt configs, GP costs
- src/lib/botEngine.js — Bot AI engine
- src/lib/tokens.js — Token utilities
- src/screens/MatchScreen.jsx — Main game screen
- src/screens/TutorialScreen.jsx — Guided first match
- src/screens/OnboardScreen.jsx — 4-step onboard flow
- src/screens/DeckScreen.jsx — Deck management
- src/screens/GamePlanScreen.jsx — Game plan editor
- src/screens/GymScreen.jsx — Training/gym screen
- src/screens/LobbyScreen.jsx — Match lobby
- src/screens/PostMatchScreen.jsx — Post-match summary
- src/screens/ProfileScreen.jsx — Player profile
- src/components/UI.jsx — Shared components
- src/components/BeltProgress.jsx — Belt progression display

## Known Patterns
- Stance filters are cockroaches — removed 3x, check for regressions
- Bot sub minigame needs await + refresh after response
- Deck IDs shifted from 25-36 to 49-60 after rebuild
- t_guillotine_standing is from clinch_front_headlock, NOT standing_neutral

## Testing
- Python bot engine: run from terminal, not client-side
- Full flow test: signup → tutorial → archetype → deck → bot match → post-match
- Check console for [HAND] debug logs on draw issues

## Superpowers Overrides
- When debugging: ALWAYS check if the bug is a mechanic issue or a stat issue before fixing
- When brainstorming: Reference this file and GAME_DESIGN_OVERHAUL.md for context
- When reviewing: Check for stance filter regressions, RLS violations, and service key exposure
- Architecture: SQL engine in Postgres, React is display layer only. Don't move game logic to client.
- Batch changes: Complete file rewrites, not incremental patches
