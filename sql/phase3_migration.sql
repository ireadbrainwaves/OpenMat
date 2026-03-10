-- ============================================================
-- OPEN MAT — Phase 3 SQL Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. Ensure player_move_stacks has Phase 3 columns
-- (These may already exist from bot engine work — ALTER IF NOT EXISTS is safe)
DO $$ 
BEGIN
  -- Add tier column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_move_stacks' AND column_name='tier') THEN
    ALTER TABLE public.player_move_stacks ADD COLUMN tier TEXT DEFAULT 'trained' CHECK (tier IN ('drilled','trained','known'));
    RAISE NOTICE 'Added tier column';
  END IF;
  
  -- Add times_used if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_move_stacks' AND column_name='times_used') THEN
    ALTER TABLE public.player_move_stacks ADD COLUMN times_used INTEGER DEFAULT 0;
    RAISE NOTICE 'Added times_used column';
  END IF;
  
  -- Add times_succeeded if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_move_stacks' AND column_name='times_succeeded') THEN
    ALTER TABLE public.player_move_stacks ADD COLUMN times_succeeded INTEGER DEFAULT 0;
    RAISE NOTICE 'Added times_succeeded column';
  END IF;
END $$;

-- 2. Ensure matches has drilled_moves arrays
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='player1_drilled_moves') THEN
    ALTER TABLE public.matches ADD COLUMN player1_drilled_moves TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added player1_drilled_moves';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='player2_drilled_moves') THEN
    ALTER TABLE public.matches ADD COLUMN player2_drilled_moves TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added player2_drilled_moves';
  END IF;
END $$;

-- 3. Create/replace set_drilled_moves function
-- This is called from the Game Plan screen before the match starts
CREATE OR REPLACE FUNCTION public.set_drilled_moves(
  p_match_id UUID,
  p_moves TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  
  IF v_match.player1_id = v_user_id THEN
    UPDATE public.matches SET player1_drilled_moves = p_moves WHERE id = p_match_id;
  ELSIF v_match.player2_id = v_user_id THEN
    UPDATE public.matches SET player2_drilled_moves = p_moves WHERE id = p_match_id;
  ELSE
    RAISE EXCEPTION 'Not a player in this match';
  END IF;
END;
$$;

-- 4. Fix resolve_turn to properly reset lock flags
-- The desync issue happens when move locks don't reset between turns
-- This patches resolve_turn to explicitly clear all locks when advancing
CREATE OR REPLACE FUNCTION public.reset_turn_locks(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.matches SET
    player1_move_locked = FALSE,
    player2_move_locked = FALSE,
    player1_stance_locked = FALSE,
    player2_stance_locked = FALSE,
    player1_stance = NULL,
    player2_stance = NULL
  WHERE id = p_match_id;
END;
$$;

-- 5. Add index for faster match polling (the 2s fallback poll)
CREATE INDEX IF NOT EXISTS idx_matches_status_players 
ON public.matches (status, player1_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_matches_turn_phase 
ON public.matches (id, current_turn, turn_phase, status);

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.set_drilled_moves(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_turn_locks(UUID) TO authenticated;

-- 7. Verify the migration
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check columns exist
  SELECT COUNT(*) INTO v_count FROM information_schema.columns 
  WHERE table_name='player_move_stacks' AND column_name IN ('tier','times_used','times_succeeded');
  RAISE NOTICE 'player_move_stacks Phase 3 columns: %/3', v_count;
  
  SELECT COUNT(*) INTO v_count FROM information_schema.columns 
  WHERE table_name='matches' AND column_name IN ('player1_drilled_moves','player2_drilled_moves');
  RAISE NOTICE 'matches drilled_moves columns: %/2', v_count;
  
  RAISE NOTICE '✅ Phase 3 migration complete!';
END $$;
