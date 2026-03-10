-- ============================================================
-- OPEN MAT — Desync Fix: Lock Reset Patch
-- Run AFTER phase3_migration.sql
-- 
-- The desync issue: Player A locks move, Player B locks move,
-- resolve_turn runs, but the lock flags don't reset properly.
-- Player A sees "waiting for opponent" on the NEXT turn because
-- their client still sees player2_move_locked = true from last turn.
--
-- Fix: Explicitly reset ALL lock flags when advancing to next turn.
-- ============================================================

-- 1. Wrap the existing resolve_turn to ensure locks are cleared
-- We can't replace resolve_turn without knowing its full body,
-- so instead we create a trigger that fires AFTER any turn advance

CREATE OR REPLACE FUNCTION public.auto_reset_locks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When turn_phase changes to 'stance', ensure all locks are cleared
  -- This catches the transition from resolving → next turn's stance phase
  IF NEW.turn_phase = 'stance' AND (
    OLD.turn_phase != 'stance' OR 
    NEW.current_turn != OLD.current_turn
  ) THEN
    NEW.player1_move_locked := FALSE;
    NEW.player2_move_locked := FALSE;
    NEW.player1_stance_locked := FALSE;
    NEW.player2_stance_locked := FALSE;
    NEW.player1_stance := NULL;
    NEW.player2_stance := NULL;
  END IF;
  
  -- When turn_phase changes to 'move', clear move locks but keep stances
  IF NEW.turn_phase = 'move' AND OLD.turn_phase = 'stance' THEN
    NEW.player1_move_locked := FALSE;
    NEW.player2_move_locked := FALSE;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present (safe to re-run)
DROP TRIGGER IF EXISTS trg_auto_reset_locks ON public.matches;

-- Create trigger BEFORE UPDATE so it modifies the row in-flight
CREATE TRIGGER trg_auto_reset_locks
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_reset_locks();

-- 2. Also fix any currently stuck matches
-- Reset locks on all active matches so they're in a clean state
UPDATE public.matches SET
  player1_move_locked = FALSE,
  player2_move_locked = FALSE,
  player1_stance_locked = FALSE,
  player2_stance_locked = FALSE
WHERE status = 'active' AND turn_phase = 'stance';

-- 3. Verify
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_reset_locks'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE '✅ Desync fix trigger installed!';
  ELSE
    RAISE NOTICE '❌ Trigger not found — check for errors above';
  END IF;
END $$;
