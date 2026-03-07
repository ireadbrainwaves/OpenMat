-- ============================================================
-- OPEN MAT — SUPABASE SCHEMA
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- This creates all tables, indexes, RLS policies, and server-side
-- functions for match resolution, Elo calculation, and real-time play.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  belt TEXT NOT NULL DEFAULT 'white' CHECK (belt IN ('white','blue','purple','brown','black')),
  archetype TEXT NOT NULL DEFAULT 'wrestler' CHECK (archetype IN ('wrestler','guard_puller','leg_locker','pressure_passer','submission_hunter','scrambler')),
  elo INTEGER NOT NULL DEFAULT 1200,
  gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  submissions_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_elo ON public.profiles(elo DESC);
CREATE INDEX idx_profiles_gym ON public.profiles(gym_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- ============================================================
-- 2. GYMS
-- ============================================================
CREATE TABLE public.gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  location TEXT,
  created_by UUID REFERENCES public.profiles(id),
  member_count INTEGER NOT NULL DEFAULT 0,
  avg_elo INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gyms_slug ON public.gyms(slug);

-- ============================================================
-- 3. GYM MEMBERSHIPS
-- ============================================================
CREATE TABLE public.gym_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','coach','owner')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, gym_id)
);

CREATE INDEX idx_gym_memberships_gym ON public.gym_memberships(gym_id);
CREATE INDEX idx_gym_memberships_profile ON public.gym_memberships(profile_id);

-- ============================================================
-- 4. POSITIONAL GRAPH (stored in DB so it can expand)
-- ============================================================
CREATE TABLE public.positions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  description TEXT,
  points_value INTEGER NOT NULL DEFAULT 0,
  is_dominant BOOLEAN NOT NULL DEFAULT FALSE,
  is_submission_position BOOLEAN NOT NULL DEFAULT FALSE,
  pair_id TEXT REFERENCES public.positions(id)
);

CREATE INDEX idx_positions_family ON public.positions(family);

CREATE TABLE public.techniques (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  from_position TEXT NOT NULL REFERENCES public.positions(id),
  to_position TEXT REFERENCES public.positions(id), -- NULL = submission (terminal)
  type TEXT NOT NULL CHECK (type IN ('transition','submission','sweep','takedown','escape')),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  counters TEXT[] NOT NULL DEFAULT '{}', -- array of technique/counter IDs
  belt_unlock TEXT NOT NULL DEFAULT 'white' CHECK (belt_unlock IN ('white','blue','purple','brown','black')),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  archetype_affinity TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_techniques_from ON public.techniques(from_position);
CREATE INDEX idx_techniques_to ON public.techniques(to_position);
CREATE INDEX idx_techniques_type ON public.techniques(type);
CREATE INDEX idx_techniques_belt ON public.techniques(belt_unlock);

CREATE TABLE public.counter_techniques (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- ============================================================
-- 5. PLAYER MOVE STACKS (personal decks)
-- ============================================================
CREATE TABLE public.player_move_stacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  technique_id TEXT NOT NULL REFERENCES public.techniques(id),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_starter BOOLEAN NOT NULL DEFAULT FALSE, -- from archetype starter deck
  UNIQUE(profile_id, technique_id)
);

CREATE INDEX idx_move_stacks_profile ON public.player_move_stacks(profile_id);

-- ============================================================
-- 6. MATCHES
-- ============================================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID NOT NULL REFERENCES public.profiles(id),
  player2_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','overtime','finished','cancelled')),
  match_type TEXT NOT NULL DEFAULT 'ranked' CHECK (match_type IN ('ranked','friendly','open_mat')),

  -- Game state
  current_position TEXT REFERENCES public.positions(id) DEFAULT 'standing_neutral',
  player1_position TEXT REFERENCES public.positions(id) DEFAULT 'standing_neutral',
  player2_position TEXT REFERENCES public.positions(id) DEFAULT 'standing_neutral',
  player1_points INTEGER NOT NULL DEFAULT 0,
  player2_points INTEGER NOT NULL DEFAULT 0,
  current_turn INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 30,
  overtime_turns INTEGER NOT NULL DEFAULT 0,
  max_overtime INTEGER NOT NULL DEFAULT 5,

  -- Move submission (hidden until both submitted)
  player1_move TEXT,          -- technique/counter ID
  player1_move_is_counter BOOLEAN DEFAULT FALSE,
  player1_move_locked BOOLEAN NOT NULL DEFAULT FALSE,
  player2_move TEXT,
  player2_move_is_counter BOOLEAN DEFAULT FALSE,
  player2_move_locked BOOLEAN NOT NULL DEFAULT FALSE,

  -- Result
  winner_id UUID REFERENCES public.profiles(id),
  win_method TEXT,
  player1_elo_before INTEGER,
  player2_elo_before INTEGER,
  player1_elo_delta INTEGER DEFAULT 0,
  player2_elo_delta INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  turn_deadline TIMESTAMPTZ  -- timer for current turn
);

CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_matches_player1 ON public.matches(player1_id);
CREATE INDEX idx_matches_player2 ON public.matches(player2_id);
CREATE INDEX idx_matches_active ON public.matches(status) WHERE status IN ('waiting','active','overtime');

-- ============================================================
-- 7. MATCH TURNS (history / play-by-play)
-- ============================================================
CREATE TABLE public.match_turns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  player1_move TEXT NOT NULL,
  player1_move_is_counter BOOLEAN NOT NULL DEFAULT FALSE,
  player2_move TEXT NOT NULL,
  player2_move_is_counter BOOLEAN NOT NULL DEFAULT FALSE,
  result TEXT NOT NULL CHECK (result IN ('position_change','submission_win','submission_defended','counter_success','hold_position','scramble')),
  winner_id UUID REFERENCES public.profiles(id),
  new_position TEXT REFERENCES public.positions(id),
  player1_points_delta INTEGER NOT NULL DEFAULT 0,
  player2_points_delta INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, turn_number)
);

CREATE INDEX idx_match_turns_match ON public.match_turns(match_id);

-- ============================================================
-- 8. MATCH INVITES (challenge system)
-- ============================================================
CREATE TABLE public.match_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL DEFAULT 'ranked',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  match_id UUID REFERENCES public.matches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_invites_to ON public.match_invites(to_profile_id, status);
CREATE INDEX idx_invites_from ON public.match_invites(from_profile_id);

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counter_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_move_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_invites ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only own profile can update
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Gyms: anyone can read, creator can update
CREATE POLICY "Gyms are viewable by everyone" ON public.gyms FOR SELECT USING (true);
CREATE POLICY "Gym creator can update" ON public.gyms FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Any user can create gym" ON public.gyms FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Gym memberships: members can see their gym, anyone can join
CREATE POLICY "Memberships viewable by gym members" ON public.gym_memberships FOR SELECT USING (true);
CREATE POLICY "Users can join gyms" ON public.gym_memberships FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can leave gyms" ON public.gym_memberships FOR DELETE USING (auth.uid() = profile_id);

-- Positional graph: read-only for everyone (admin writes via service key)
CREATE POLICY "Graph is readable by everyone" ON public.positions FOR SELECT USING (true);
CREATE POLICY "Techniques readable by everyone" ON public.techniques FOR SELECT USING (true);
CREATE POLICY "Counters readable by everyone" ON public.counter_techniques FOR SELECT USING (true);

-- Move stacks: users can read own, public read for opponents
CREATE POLICY "Move stacks viewable by everyone" ON public.player_move_stacks FOR SELECT USING (true);
CREATE POLICY "Users manage own move stack" ON public.player_move_stacks FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can remove from own stack" ON public.player_move_stacks FOR DELETE USING (auth.uid() = profile_id);

-- Matches: participants can read their matches, anyone can see finished
CREATE POLICY "Match participants can view" ON public.matches FOR SELECT
  USING (auth.uid() IN (player1_id, player2_id) OR status = 'finished');
CREATE POLICY "Participants can update match" ON public.matches FOR UPDATE
  USING (auth.uid() IN (player1_id, player2_id) AND status IN ('waiting','active','overtime'));
CREATE POLICY "Any user can create match" ON public.matches FOR INSERT WITH CHECK (auth.uid() = player1_id);

-- CRITICAL: Hide opponent's move until both are locked
-- This is handled by a view (see below)

-- Match turns: visible to match participants and after match ends
CREATE POLICY "Turn history viewable by participants" ON public.match_turns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
      AND (auth.uid() IN (m.player1_id, m.player2_id) OR m.status = 'finished')
    )
  );

-- Invites: sender and receiver can see
CREATE POLICY "Invite participants can view" ON public.match_invites FOR SELECT
  USING (auth.uid() IN (from_profile_id, to_profile_id));
CREATE POLICY "Users can send invites" ON public.match_invites FOR INSERT
  WITH CHECK (auth.uid() = from_profile_id);
CREATE POLICY "Receiver can update invite" ON public.match_invites FOR UPDATE
  USING (auth.uid() = to_profile_id);

-- ============================================================
-- 10. SECURE VIEW: MATCH STATE (hides opponent move)
-- ============================================================
-- Players subscribe to this view — it only shows the opponent's
-- move AFTER both players have locked in.

CREATE OR REPLACE VIEW public.match_live_state AS
SELECT
  m.id,
  m.status,
  m.current_position,
  m.player1_id,
  m.player2_id,
  m.player1_position,
  m.player2_position,
  m.player1_points,
  m.player2_points,
  m.current_turn,
  m.max_turns,
  m.turn_deadline,
  m.winner_id,
  m.win_method,
  -- Only show YOUR move always, opponent's move only when both locked
  CASE
    WHEN auth.uid() = m.player1_id THEN m.player1_move
    WHEN auth.uid() = m.player2_id AND m.player1_move_locked AND m.player2_move_locked THEN m.player1_move
    ELSE NULL
  END AS player1_move,
  CASE
    WHEN auth.uid() = m.player2_id THEN m.player2_move
    WHEN auth.uid() = m.player1_id AND m.player1_move_locked AND m.player2_move_locked THEN m.player2_move
    ELSE NULL
  END AS player2_move,
  m.player1_move_locked,
  m.player2_move_locked
FROM public.matches m
WHERE auth.uid() IN (m.player1_id, m.player2_id);

-- ============================================================
-- 11. SERVER-SIDE FUNCTIONS
-- ============================================================

-- Function: Submit a move (validates and locks)
CREATE OR REPLACE FUNCTION public.submit_move(
  p_match_id UUID,
  p_technique_id TEXT,
  p_is_counter BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_player_num INTEGER;
BEGIN
  -- Get match
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.status NOT IN ('active','overtime') THEN RAISE EXCEPTION 'Match not active'; END IF;

  -- Determine which player
  IF auth.uid() = v_match.player1_id THEN v_player_num := 1;
  ELSIF auth.uid() = v_match.player2_id THEN v_player_num := 2;
  ELSE RAISE EXCEPTION 'Not a participant';
  END IF;

  -- Check not already locked
  IF v_player_num = 1 AND v_match.player1_move_locked THEN RAISE EXCEPTION 'Move already locked'; END IF;
  IF v_player_num = 2 AND v_match.player2_move_locked THEN RAISE EXCEPTION 'Move already locked'; END IF;

  -- Lock the move
  IF v_player_num = 1 THEN
    UPDATE public.matches SET
      player1_move = p_technique_id,
      player1_move_is_counter = p_is_counter,
      player1_move_locked = TRUE
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches SET
      player2_move = p_technique_id,
      player2_move_is_counter = p_is_counter,
      player2_move_locked = TRUE
    WHERE id = p_match_id;
  END IF;

  -- Check if both moves are now locked — if so, trigger resolution
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match.player1_move_locked AND v_match.player2_move_locked THEN
    PERFORM public.resolve_turn(p_match_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'both_locked', v_match.player1_move_locked AND v_match.player2_move_locked);
END;
$$;

-- Function: Resolve a turn (server-side only, prevents cheating)
CREATE OR REPLACE FUNCTION public.resolve_turn(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_p1_tech RECORD;
  v_p2_tech RECORD;
  v_p1_is_counter BOOLEAN;
  v_p2_is_counter BOOLEAN;
  v_result TEXT;
  v_winner_id UUID;
  v_new_position TEXT;
  v_p1_pts INTEGER := 0;
  v_p2_pts INTEGER := 0;
  v_description TEXT;
  v_sub_win UUID;
  v_new_p1_pos TEXT;
  v_new_p2_pos TEXT;
  v_paired TEXT;
  v_pos RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT v_match.player1_move_locked OR NOT v_match.player2_move_locked THEN
    RAISE EXCEPTION 'Both moves must be locked';
  END IF;

  -- Get technique data (may be NULL if counter-only)
  SELECT * INTO v_p1_tech FROM public.techniques WHERE id = v_match.player1_move;
  SELECT * INTO v_p2_tech FROM public.techniques WHERE id = v_match.player2_move;

  v_p1_is_counter := v_match.player1_move_is_counter OR EXISTS(SELECT 1 FROM public.counter_techniques WHERE id = v_match.player1_move);
  v_p2_is_counter := v_match.player2_move_is_counter OR EXISTS(SELECT 1 FROM public.counter_techniques WHERE id = v_match.player2_move);

  v_new_p1_pos := v_match.player1_position;
  v_new_p2_pos := v_match.player2_position;
  v_new_position := v_match.current_position;
  v_result := 'hold_position';
  v_description := 'Position holds.';

  -- ===== RESOLUTION LOGIC =====

  -- Case: P1 submission
  IF v_p1_tech.id IS NOT NULL AND v_p1_tech.type = 'submission' AND (v_p2_tech.id IS NULL OR v_p2_tech.type != 'submission') THEN
    IF v_match.player2_move = ANY(v_p1_tech.counters) THEN
      v_result := 'submission_defended';
      v_description := format('%s defends the %s!', 'Player 2', v_p1_tech.name);
    ELSE
      v_result := 'submission_win';
      v_sub_win := v_match.player1_id;
      v_description := format('%s hits %s! TAP!', 'Player 1', v_p1_tech.name);
    END IF;

  -- Case: P2 submission
  ELSIF v_p2_tech.id IS NOT NULL AND v_p2_tech.type = 'submission' AND (v_p1_tech.id IS NULL OR v_p1_tech.type != 'submission') THEN
    IF v_match.player1_move = ANY(v_p2_tech.counters) THEN
      v_result := 'submission_defended';
      v_description := format('%s defends the %s!', 'Player 1', v_p2_tech.name);
    ELSE
      v_result := 'submission_win';
      v_sub_win := v_match.player2_id;
      v_description := format('%s hits %s! TAP!', 'Player 2', v_p2_tech.name);
    END IF;

  -- Case: Both submissions (dominant priority)
  ELSIF v_p1_tech.id IS NOT NULL AND v_p1_tech.type = 'submission' AND v_p2_tech.id IS NOT NULL AND v_p2_tech.type = 'submission' THEN
    SELECT * INTO v_pos FROM public.positions WHERE id = v_match.player1_position;
    IF v_pos.is_dominant THEN
      IF v_match.player2_move = ANY(v_p1_tech.counters) THEN
        v_result := 'submission_defended';
        v_description := 'Both go for subs! Dominant position defends.';
      ELSE
        v_result := 'submission_win';
        v_sub_win := v_match.player1_id;
        v_description := format('Both go for subs! %s from dominant position taps!', v_p1_tech.name);
      END IF;
    ELSE
      IF v_match.player1_move = ANY(v_p2_tech.counters) THEN
        v_result := 'submission_defended';
        v_description := 'Both go for subs! Cancelled out.';
      ELSE
        v_result := 'submission_win';
        v_sub_win := v_match.player2_id;
        v_description := format('Both go for subs! %s from dominant position taps!', v_p2_tech.name);
      END IF;
    END IF;

  -- Case: Both counters
  ELSIF v_p1_is_counter AND v_p2_is_counter THEN
    v_result := 'hold_position';
    v_description := 'Both players defensive — feeling each other out.';

  -- Case: P1 attacks, P2 counters
  ELSIF v_p1_tech.id IS NOT NULL AND NOT v_p1_is_counter AND v_p2_is_counter THEN
    IF v_match.player2_move = ANY(v_p1_tech.counters) THEN
      v_result := 'counter_success';
      v_winner_id := v_match.player2_id;
      v_description := format('Player 2 reads the %s and counters!', v_p1_tech.name);
    ELSE
      v_result := 'position_change';
      v_winner_id := v_match.player1_id;
      v_p1_pts := COALESCE(v_p1_tech.points_awarded, 0);
      v_description := format('Player 1 hits %s!%s', v_p1_tech.name, CASE WHEN v_p1_pts > 0 THEN format(' +%s points!', v_p1_pts) ELSE '' END);
      IF v_p1_tech.to_position IS NOT NULL THEN v_new_position := v_p1_tech.to_position; END IF;
    END IF;

  -- Case: P2 attacks, P1 counters
  ELSIF v_p2_tech.id IS NOT NULL AND NOT v_p2_is_counter AND v_p1_is_counter THEN
    IF v_match.player1_move = ANY(v_p2_tech.counters) THEN
      v_result := 'counter_success';
      v_winner_id := v_match.player1_id;
      v_description := format('Player 1 reads the %s and counters!', v_p2_tech.name);
    ELSE
      v_result := 'position_change';
      v_winner_id := v_match.player2_id;
      v_p2_pts := COALESCE(v_p2_tech.points_awarded, 0);
      v_description := format('Player 2 hits %s!%s', v_p2_tech.name, CASE WHEN v_p2_pts > 0 THEN format(' +%s points!', v_p2_pts) ELSE '' END);
      IF v_p2_tech.to_position IS NOT NULL THEN v_new_position := v_p2_tech.to_position; END IF;
    END IF;

  -- Case: Both transition (dominant priority, then difficulty)
  ELSIF v_p1_tech.id IS NOT NULL AND v_p2_tech.id IS NOT NULL THEN
    SELECT * INTO v_pos FROM public.positions WHERE id = v_match.player1_position;
    IF v_pos.is_dominant OR v_p1_tech.difficulty >= v_p2_tech.difficulty THEN
      v_result := 'position_change';
      v_winner_id := v_match.player1_id;
      v_p1_pts := COALESCE(v_p1_tech.points_awarded, 0);
      v_description := format('Player 1 executes %s!%s', v_p1_tech.name, CASE WHEN v_p1_pts > 0 THEN format(' +%s points!', v_p1_pts) ELSE '' END);
      IF v_p1_tech.to_position IS NOT NULL THEN v_new_position := v_p1_tech.to_position; END IF;
    ELSE
      v_result := 'position_change';
      v_winner_id := v_match.player2_id;
      v_p2_pts := COALESCE(v_p2_tech.points_awarded, 0);
      v_description := format('Player 2 executes %s!%s', v_p2_tech.name, CASE WHEN v_p2_pts > 0 THEN format(' +%s points!', v_p2_pts) ELSE '' END);
      IF v_p2_tech.to_position IS NOT NULL THEN v_new_position := v_p2_tech.to_position; END IF;
    END IF;

  -- Fallback: one has tech, other doesn't
  ELSIF v_p1_tech.id IS NOT NULL THEN
    v_result := 'position_change';
    v_winner_id := v_match.player1_id;
    v_p1_pts := COALESCE(v_p1_tech.points_awarded, 0);
    v_description := format('Player 1 hits %s!', v_p1_tech.name);
    IF v_p1_tech.to_position IS NOT NULL THEN v_new_position := v_p1_tech.to_position; END IF;
  ELSIF v_p2_tech.id IS NOT NULL THEN
    v_result := 'position_change';
    v_winner_id := v_match.player2_id;
    v_p2_pts := COALESCE(v_p2_tech.points_awarded, 0);
    v_description := format('Player 2 hits %s!', v_p2_tech.name);
    IF v_p2_tech.to_position IS NOT NULL THEN v_new_position := v_p2_tech.to_position; END IF;
  END IF;

  -- Update position pairing
  IF v_new_position != v_match.current_position THEN
    SELECT pair_id INTO v_paired FROM public.positions WHERE id = v_new_position;
    IF v_paired IS NOT NULL THEN
      SELECT * INTO v_pos FROM public.positions WHERE id = v_new_position;
      IF v_pos.is_dominant THEN
        IF v_winner_id = v_match.player1_id OR v_winner_id IS NULL THEN
          v_new_p1_pos := v_new_position; v_new_p2_pos := v_paired;
        ELSE
          v_new_p2_pos := v_new_position; v_new_p1_pos := v_paired;
        END IF;
      ELSE
        IF v_winner_id = v_match.player1_id OR v_winner_id IS NULL THEN
          v_new_p1_pos := v_new_position; v_new_p2_pos := v_paired;
        ELSE
          v_new_p2_pos := v_new_position; v_new_p1_pos := v_paired;
        END IF;
      END IF;
    ELSE
      -- Non-paired (standing, guard, passing, leg entanglement)
      v_new_p1_pos := v_new_position;
      v_new_p2_pos := v_new_position;
    END IF;
  END IF;

  -- Record the turn
  INSERT INTO public.match_turns (
    match_id, turn_number, player1_move, player1_move_is_counter,
    player2_move, player2_move_is_counter, result, winner_id,
    new_position, player1_points_delta, player2_points_delta, description
  ) VALUES (
    p_match_id, v_match.current_turn + 1, v_match.player1_move, v_match.player1_move_is_counter,
    v_match.player2_move, v_match.player2_move_is_counter, v_result, v_winner_id,
    v_new_position, v_p1_pts, v_p2_pts, v_description
  );

  -- Update match state
  UPDATE public.matches SET
    current_turn = current_turn + 1,
    current_position = v_new_position,
    player1_position = v_new_p1_pos,
    player2_position = v_new_p2_pos,
    player1_points = player1_points + v_p1_pts,
    player2_points = player2_points + v_p2_pts,
    -- Reset moves for next turn
    player1_move = NULL,
    player1_move_is_counter = FALSE,
    player1_move_locked = FALSE,
    player2_move = NULL,
    player2_move_is_counter = FALSE,
    player2_move_locked = FALSE,
    -- Set turn timer (30 seconds per turn)
    turn_deadline = NOW() + INTERVAL '30 seconds'
  WHERE id = p_match_id;

  -- Check for submission win
  IF v_sub_win IS NOT NULL THEN
    PERFORM public.finish_match(p_match_id, v_sub_win, format('Submission — %s',
      CASE WHEN v_sub_win = v_match.player1_id THEN v_p1_tech.name ELSE v_p2_tech.name END));
    RETURN;
  END IF;

  -- Check turn limit
  IF v_match.current_turn + 1 >= v_match.max_turns THEN
    IF v_match.status = 'active' THEN
      IF v_match.player1_points + v_p1_pts != v_match.player2_points + v_p2_pts THEN
        -- Points winner
        IF v_match.player1_points + v_p1_pts > v_match.player2_points + v_p2_pts THEN
          PERFORM public.finish_match(p_match_id, v_match.player1_id,
            format('Points — %s to %s', v_match.player1_points + v_p1_pts, v_match.player2_points + v_p2_pts));
        ELSE
          PERFORM public.finish_match(p_match_id, v_match.player2_id,
            format('Points — %s to %s', v_match.player2_points + v_p2_pts, v_match.player1_points + v_p1_pts));
        END IF;
      ELSE
        -- Tied — go to overtime
        UPDATE public.matches SET status = 'overtime', overtime_turns = 0 WHERE id = p_match_id;
      END IF;
    ELSIF v_match.status = 'overtime' THEN
      UPDATE public.matches SET overtime_turns = overtime_turns + 1 WHERE id = p_match_id;
      IF v_match.overtime_turns + 1 >= v_match.max_overtime THEN
        -- Overtime expired
        IF v_match.player1_points + v_p1_pts > v_match.player2_points + v_p2_pts THEN
          PERFORM public.finish_match(p_match_id, v_match.player1_id, 'Points after OT');
        ELSIF v_match.player2_points + v_p2_pts > v_match.player1_points + v_p1_pts THEN
          PERFORM public.finish_match(p_match_id, v_match.player2_id, 'Points after OT');
        ELSE
          PERFORM public.finish_match(p_match_id, NULL, 'Draw');
        END IF;
      END IF;
    END IF;
  END IF;
END;
$$;

-- Function: Finish match and update Elo
CREATE OR REPLACE FUNCTION public.finish_match(
  p_match_id UUID,
  p_winner_id UUID,
  p_method TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_k INTEGER := 32;
  v_expected_p1 FLOAT;
  v_p1_delta INTEGER;
  v_p2_delta INTEGER;
  v_is_sub BOOLEAN;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;

  -- Calculate Elo
  IF p_winner_id IS NOT NULL THEN
    v_expected_p1 := 1.0 / (1.0 + power(10, (v_match.player2_elo_before - v_match.player1_elo_before)::FLOAT / 400.0));

    IF p_winner_id = v_match.player1_id THEN
      v_p1_delta := round(v_k * (1.0 - v_expected_p1));
      v_p2_delta := -v_p1_delta;
    ELSE
      v_p2_delta := round(v_k * v_expected_p1);
      v_p1_delta := -v_p2_delta;
    END IF;
  ELSE
    v_p1_delta := 0;
    v_p2_delta := 0;
  END IF;

  v_is_sub := p_method LIKE 'Submission%';

  -- Update match
  UPDATE public.matches SET
    status = 'finished',
    winner_id = p_winner_id,
    win_method = p_method,
    player1_elo_delta = v_p1_delta,
    player2_elo_delta = v_p2_delta,
    finished_at = NOW()
  WHERE id = p_match_id;

  -- Update player profiles (only for ranked matches)
  IF v_match.match_type = 'ranked' THEN
    UPDATE public.profiles SET
      elo = elo + v_p1_delta,
      matches_played = matches_played + 1,
      matches_won = matches_won + CASE WHEN p_winner_id = v_match.player1_id THEN 1 ELSE 0 END,
      submissions_earned = submissions_earned + CASE WHEN p_winner_id = v_match.player1_id AND v_is_sub THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = v_match.player1_id;

    UPDATE public.profiles SET
      elo = elo + v_p2_delta,
      matches_played = matches_played + 1,
      matches_won = matches_won + CASE WHEN p_winner_id = v_match.player2_id THEN 1 ELSE 0 END,
      submissions_earned = submissions_earned + CASE WHEN p_winner_id = v_match.player2_id AND v_is_sub THEN 1 ELSE 0 END,
      updated_at = NOW()
    WHERE id = v_match.player2_id;

    -- Update gym avg Elo
    UPDATE public.gyms g SET
      avg_elo = (SELECT COALESCE(AVG(p.elo), 1200) FROM public.profiles p JOIN public.gym_memberships gm ON p.id = gm.profile_id WHERE gm.gym_id = g.id)
    WHERE g.id IN (
      SELECT gym_id FROM public.profiles WHERE id IN (v_match.player1_id, v_match.player2_id) AND gym_id IS NOT NULL
    );
  END IF;
END;
$$;

-- Function: Create match from invite
CREATE OR REPLACE FUNCTION public.create_match_from_invite(p_invite_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_match_id UUID;
  v_p1_elo INTEGER;
  v_p2_elo INTEGER;
BEGIN
  SELECT * INTO v_invite FROM public.match_invites WHERE id = p_invite_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found or already used'; END IF;
  IF auth.uid() != v_invite.to_profile_id THEN RAISE EXCEPTION 'Not the invite recipient'; END IF;

  SELECT elo INTO v_p1_elo FROM public.profiles WHERE id = v_invite.from_profile_id;
  SELECT elo INTO v_p2_elo FROM public.profiles WHERE id = v_invite.to_profile_id;

  INSERT INTO public.matches (
    player1_id, player2_id, status, match_type,
    player1_elo_before, player2_elo_before, started_at,
    turn_deadline
  ) VALUES (
    v_invite.from_profile_id, v_invite.to_profile_id, 'active', v_invite.match_type,
    v_p1_elo, v_p2_elo, NOW(), NOW() + INTERVAL '30 seconds'
  ) RETURNING id INTO v_match_id;

  UPDATE public.match_invites SET status = 'accepted', match_id = v_match_id WHERE id = p_invite_id;

  RETURN v_match_id;
END;
$$;

-- ============================================================
-- 12. REALTIME: Enable realtime on matches table
-- ============================================================
-- Run this in Supabase Dashboard > Database > Replication
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_invites;

-- ============================================================
-- 13. SEED GRAPH DATA FUNCTION
-- ============================================================
-- Call this after creating tables to load the positional graph
-- The actual data will be inserted via a separate seed script

CREATE OR REPLACE FUNCTION public.seed_graph_from_json(p_graph JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pos JSONB;
  v_tech JSONB;
  v_counter JSONB;
BEGIN
  -- Insert positions
  FOR v_pos IN SELECT * FROM jsonb_array_elements(p_graph->'positions')
  LOOP
    INSERT INTO public.positions (id, name, family, description, points_value, is_dominant, is_submission_position)
    VALUES (
      v_pos->>'id', v_pos->>'name', v_pos->>'family', v_pos->>'description',
      (v_pos->>'points_value')::INTEGER, (v_pos->>'is_dominant')::BOOLEAN, (v_pos->>'is_submission_position')::BOOLEAN
    ) ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, family = EXCLUDED.family, description = EXCLUDED.description,
      points_value = EXCLUDED.points_value, is_dominant = EXCLUDED.is_dominant,
      is_submission_position = EXCLUDED.is_submission_position;
  END LOOP;

  -- Update position pairs
  FOR v_pos IN SELECT * FROM jsonb_each_text(p_graph->'position_pairs')
  LOOP
    IF (v_pos->>'key') != '_note' THEN
      UPDATE public.positions SET pair_id = v_pos->>'value' WHERE id = v_pos->>'key';
      UPDATE public.positions SET pair_id = v_pos->>'key' WHERE id = v_pos->>'value';
    END IF;
  END LOOP;

  -- Insert techniques
  FOR v_tech IN SELECT * FROM jsonb_array_elements(p_graph->'techniques')
  LOOP
    INSERT INTO public.techniques (id, name, from_position, to_position, type, points_awarded, counters, belt_unlock, difficulty, archetype_affinity)
    VALUES (
      v_tech->>'id', v_tech->>'name', v_tech->>'from', v_tech->>'to',
      v_tech->>'type', (v_tech->>'points_awarded')::INTEGER,
      ARRAY(SELECT jsonb_array_elements_text(v_tech->'counters')),
      v_tech->>'belt_unlock', (v_tech->>'difficulty')::INTEGER,
      ARRAY(SELECT jsonb_array_elements_text(v_tech->'archetype_affinity'))
    ) ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, from_position = EXCLUDED.from_position, to_position = EXCLUDED.to_position,
      type = EXCLUDED.type, points_awarded = EXCLUDED.points_awarded, counters = EXCLUDED.counters,
      belt_unlock = EXCLUDED.belt_unlock, difficulty = EXCLUDED.difficulty, archetype_affinity = EXCLUDED.archetype_affinity;
  END LOOP;

  -- Insert counter techniques
  FOR v_counter IN SELECT * FROM jsonb_array_elements(p_graph->'counter_techniques')
  LOOP
    INSERT INTO public.counter_techniques (id, name, description)
    VALUES (v_counter->>'id', v_counter->>'name', v_counter->>'description')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
  END LOOP;
END;
$$;

-- ============================================================
-- 14. HELPER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DONE
-- ============================================================
-- After running this migration:
-- 1. Go to Supabase Dashboard > Authentication > Settings > enable email auth
-- 2. Run the graph seed script to populate positions/techniques
-- 3. Enable Realtime on the matches table via Dashboard > Database > Replication
-- 4. Your app connects with the Supabase JS client
