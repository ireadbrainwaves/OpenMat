-- ============================================================
-- PHASE 3 DATABASE MIGRATION
-- Deck Building, Archetype Mastery & Hand System
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. ADD TIER SYSTEM TO PLAYER MOVE STACKS
ALTER TABLE public.player_move_stacks ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'trained' CHECK (tier IN ('drilled','trained','known'));
ALTER TABLE public.player_move_stacks ADD COLUMN IF NOT EXISTS times_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.player_move_stacks ADD COLUMN IF NOT EXISTS times_succeeded INTEGER NOT NULL DEFAULT 0;

-- Set all existing starter moves to 'trained' (already done by default)
-- Known moves will be added as players unlock them

-- 2. CREATE ARCHETYPE MASTERY TABLE
CREATE TABLE IF NOT EXISTS public.archetype_mastery (
  id SERIAL PRIMARY KEY,
  archetype TEXT NOT NULL,
  move_type TEXT NOT NULL,
  success_modifier FLOAT NOT NULL DEFAULT 0,
  gp_modifier INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  UNIQUE(archetype, move_type)
);

-- Enable RLS
ALTER TABLE public.archetype_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read mastery" ON public.archetype_mastery FOR SELECT USING (true);

-- Seed mastery data
INSERT INTO public.archetype_mastery (archetype, move_type, success_modifier, gp_modifier, label) VALUES
-- WRESTLER: dominates takedowns and top game
('wrestler', 'takedown', 0.20, -1, 'primary'),
('wrestler', 'transition', 0.10, 0, 'secondary'),
('wrestler', 'submission', 0.10, 0, 'secondary'),
('wrestler', 'escape', 0.05, 0, 'neutral'),
('wrestler', 'sweep', -0.10, 1, 'weakness'),

-- GUARD PULLER: dominates sweeps and guard subs
('guard_puller', 'sweep', 0.20, -1, 'primary'),
('guard_puller', 'submission', 0.15, 0, 'secondary'),
('guard_puller', 'escape', 0.10, 0, 'secondary'),
('guard_puller', 'transition', 0.0, 0, 'neutral'),
('guard_puller', 'takedown', -0.15, 1, 'weakness'),

-- LEG LOCKER: dominates leg subs and leg transitions
('leg_locker', 'submission', 0.20, -1, 'primary'),
('leg_locker', 'transition', 0.10, 0, 'secondary'),
('leg_locker', 'escape', 0.05, 0, 'neutral'),
('leg_locker', 'sweep', 0.0, 0, 'neutral'),
('leg_locker', 'takedown', -0.15, 1, 'weakness'),

-- PRESSURE PASSER: dominates guard passes and top subs
('pressure_passer', 'transition', 0.20, -1, 'primary'),
('pressure_passer', 'submission', 0.10, 0, 'secondary'),
('pressure_passer', 'escape', 0.0, 0, 'neutral'),
('pressure_passer', 'takedown', 0.05, 0, 'neutral'),
('pressure_passer', 'sweep', -0.15, 1, 'weakness'),

-- SUB HUNTER: universal sub bonus but weaker elsewhere
('submission_hunter', 'submission', 0.12, -1, 'primary'),
('submission_hunter', 'sweep', 0.05, 0, 'secondary'),
('submission_hunter', 'escape', 0.0, 0, 'neutral'),
('submission_hunter', 'transition', -0.10, 1, 'weakness'),
('submission_hunter', 'takedown', -0.10, 1, 'weakness'),

-- SCRAMBLER: universal transition bonus, weak at finishing
('scrambler', 'transition', 0.12, -1, 'primary'),
('scrambler', 'escape', 0.12, -1, 'primary'),
('scrambler', 'takedown', 0.10, 0, 'secondary'),
('scrambler', 'sweep', 0.05, 0, 'neutral'),
('scrambler', 'submission', -0.15, 1, 'weakness')

ON CONFLICT (archetype, move_type) DO UPDATE SET
  success_modifier = EXCLUDED.success_modifier,
  gp_modifier = EXCLUDED.gp_modifier,
  label = EXCLUDED.label;

-- 3. ADD DRILL SLOTS TO MATCHES (stores pre-match drill picks as JSON)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_drilled_moves TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_drilled_moves TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. ADD HAND TRACKING TO MATCHES (current hand per player)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_hand TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_hand TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 5. SET DRILL DEFAULTS FOR AI BOTS
-- Iron Mike (wrestler): drills takedowns and top subs
UPDATE public.player_move_stacks SET tier = 'drilled'
WHERE profile_id = '00000001-0000-0000-0000-000000000001'
AND technique_id IN ('t_double_leg', 't_body_lock_takedown', 't_sc_kimura', 't_sc_americana', 't_mount_armbar');

-- Miyao (guard puller): drills sweeps and guard subs
UPDATE public.player_move_stacks SET tier = 'drilled'
WHERE profile_id = '00000002-0000-0000-0000-000000000002'
AND technique_id IN ('t_scissor_sweep', 't_hip_bump_sweep', 't_armbar_closed_guard', 't_triangle_closed_guard', 't_pull_guard_standing');

-- Haisam (leg locker): drills leg locks
UPDATE public.player_move_stacks SET tier = 'drilled'
WHERE profile_id = '00000003-0000-0000-0000-000000000003'
AND technique_id IN ('t_outside_heel_hook', 't_inside_heel_hook', 't_kneebar', 't_imanari_roll', 't_ankle_lock');

-- Rodolfo (pressure passer): drills passes and top subs
UPDATE public.player_move_stacks SET tier = 'drilled'
WHERE profile_id = '00000004-0000-0000-0000-000000000004'
AND technique_id IN ('t_guard_break_stack', 't_guard_break_knee_slice', 't_sc_kimura', 't_sc_americana', 't_kob_to_mount');

-- Marcelo (sub hunter): drills his best subs
UPDATE public.player_move_stacks SET tier = 'drilled'
WHERE profile_id = '00000005-0000-0000-0000-000000000005'
AND technique_id IN ('t_armbar_closed_guard', 't_triangle_closed_guard', 't_guillotine_standing', 't_rnc', 't_mount_armbar');

-- Ruotolo (scrambler): drills transitions
UPDATE public.player_move_stacks SET tier = 'drilled'
WHERE profile_id = '00000006-0000-0000-0000-000000000006'
AND technique_id IN ('t_double_leg', 't_snap_down', 't_arm_drag_standing', 't_scramble_from_sc_bot', 't_scramble_from_mount_bot');

-- 6. FUNCTION: DRAW HAND
-- Draws a hand of moves for a player based on position, tier, and archetype status
CREATE OR REPLACE FUNCTION public.draw_hand(
  p_profile_id UUID,
  p_position TEXT,
  p_archetype TEXT,
  p_drilled_moves TEXT[]
)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hand TEXT[] := ARRAY[]::TEXT[];
  v_status TEXT;
  v_hand_size INTEGER;
  v_trained_count INTEGER;
  v_known_count INTEGER;
  v_rec RECORD;
BEGIN
  -- Get archetype status at position
  SELECT status INTO v_status FROM public.archetype_position_matrix
  WHERE position_id = p_position AND archetype = p_archetype;
  v_status := COALESCE(v_status, 'neutral');

  -- Hand size based on status
  v_trained_count := CASE v_status WHEN 'dominant' THEN 3 WHEN 'neutral' THEN 2 WHEN 'defending' THEN 2 ELSE 1 END;
  v_known_count := CASE v_status WHEN 'dominant' THEN 1 WHEN 'neutral' THEN 1 ELSE 0 END;

  -- Add drilled moves valid for this position
  FOR v_rec IN
    SELECT ms.technique_id FROM public.player_move_stacks ms
    JOIN public.techniques t ON ms.technique_id = t.id
    WHERE ms.profile_id = p_profile_id
    AND ms.technique_id = ANY(p_drilled_moves)
    AND t.from_position = p_position
  LOOP
    v_hand := array_append(v_hand, v_rec.technique_id);
  END LOOP;

  -- Add trained moves (random, position-valid, not already in hand)
  FOR v_rec IN
    SELECT ms.technique_id FROM public.player_move_stacks ms
    JOIN public.techniques t ON ms.technique_id = t.id
    WHERE ms.profile_id = p_profile_id
    AND ms.tier = 'trained'
    AND t.from_position = p_position
    AND NOT (ms.technique_id = ANY(v_hand))
    ORDER BY random()
    LIMIT v_trained_count
  LOOP
    v_hand := array_append(v_hand, v_rec.technique_id);
  END LOOP;

  -- Add known moves (rare, position-valid, not already in hand)
  IF v_known_count > 0 AND random() < 0.15 THEN
    FOR v_rec IN
      SELECT ms.technique_id FROM public.player_move_stacks ms
      JOIN public.techniques t ON ms.technique_id = t.id
      WHERE ms.profile_id = p_profile_id
      AND ms.tier = 'known'
      AND t.from_position = p_position
      AND NOT (ms.technique_id = ANY(v_hand))
      ORDER BY random()
      LIMIT 1
    LOOP
      v_hand := array_append(v_hand, v_rec.technique_id);
    END LOOP;
  END IF;

  -- Fallback: if hand is empty, add any available move from position
  IF array_length(v_hand, 1) IS NULL OR array_length(v_hand, 1) = 0 THEN
    FOR v_rec IN
      SELECT ms.technique_id FROM public.player_move_stacks ms
      JOIN public.techniques t ON ms.technique_id = t.id
      WHERE ms.profile_id = p_profile_id AND t.from_position = p_position
      ORDER BY random() LIMIT 3
    LOOP
      v_hand := array_append(v_hand, v_rec.technique_id);
    END LOOP;
  END IF;

  RETURN v_hand;
END;
$$;

-- 7. FUNCTION: GET MASTERY MODIFIER
CREATE OR REPLACE FUNCTION public.get_mastery(
  p_archetype TEXT,
  p_move_type TEXT
)
RETURNS TABLE(success_mod FLOAT, gp_mod INTEGER) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT am.success_modifier, am.gp_modifier
  FROM public.archetype_mastery am
  WHERE am.archetype = p_archetype AND am.move_type = p_move_type;

  -- Default if no row found
  IF NOT FOUND THEN
    success_mod := 0; gp_mod := 0;
    RETURN NEXT;
  END IF;
END;
$$;

-- 8. FUNCTION: SET DRILLED MOVES (pre-match game plan)
CREATE OR REPLACE FUNCTION public.set_drilled_moves(
  p_match_id UUID,
  p_moves TEXT[]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match RECORD;
  v_player_num INTEGER;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF auth.uid() = v_match.player1_id THEN v_player_num := 1;
  ELSIF auth.uid() = v_match.player2_id THEN v_player_num := 2;
  ELSE RAISE EXCEPTION 'Not a participant'; END IF;

  -- Limit to 5 drilled moves max
  IF array_length(p_moves, 1) > 5 THEN RAISE EXCEPTION 'Max 5 drilled moves'; END IF;

  IF v_player_num = 1 THEN
    UPDATE public.matches SET player1_drilled_moves = p_moves WHERE id = p_match_id;
  ELSE
    UPDATE public.matches SET player2_drilled_moves = p_moves WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. UPDATE RESOLVE_TURN TO USE MASTERY + TIER
-- The key change: when calculating success chances, add:
--   mastery_bonus (from archetype_mastery table)
--   tier_bonus (+0.15 for drilled, 0 for trained, -0.10 for known)
--   gp_cost adjusted by mastery gp_modifier and tier

-- We'll update resolve_turn in the next deploy to incorporate these.
-- For now the functions and data are ready.

-- 10. RESET FOR TESTING
UPDATE public.profiles SET elo = 1200, matches_played = 0, matches_won = 0, submissions_earned = 0
WHERE id IN ('00000001-0000-0000-0000-000000000001','00000002-0000-0000-0000-000000000002','00000003-0000-0000-0000-000000000003','00000004-0000-0000-0000-000000000004','00000005-0000-0000-0000-000000000005','00000006-0000-0000-0000-000000000006');

DELETE FROM match_turns;
DELETE FROM match_invites;
DELETE FROM matches;
