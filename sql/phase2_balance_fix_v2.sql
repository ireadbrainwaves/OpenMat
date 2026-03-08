-- ============================================================
-- PHASE 2 BALANCE FIX v2 — Complete Deploy Package
-- Run this entire file in Supabase SQL Editor (one shot)
-- ============================================================

-- 1. WRESTLER DECK FIX
UPDATE public.techniques SET archetype_affinity = array_append(archetype_affinity, 'wrestler')
WHERE id IN ('t_sc_kimura','t_sc_americana','t_sc_arm_triangle','t_mount_americana','t_mount_armbar','t_mount_ezekiel','t_ns_kimura')
AND NOT ('wrestler' = ANY(archetype_affinity));

INSERT INTO public.player_move_stacks (profile_id, technique_id, is_starter)
SELECT '00000001-0000-0000-0000-000000000001', t.id, true
FROM public.techniques t
WHERE t.id IN ('t_sc_kimura','t_sc_americana','t_sc_arm_triangle','t_mount_americana','t_mount_armbar','t_mount_ezekiel','t_ns_kimura','t_sc_to_mount','t_sc_to_ns','t_sc_to_kob','t_sc_to_kesa','t_kob_to_mount')
ON CONFLICT (profile_id, technique_id) DO NOTHING;

INSERT INTO public.player_move_stacks (profile_id, technique_id, is_starter)
SELECT p.id, t.id, true
FROM public.profiles p
CROSS JOIN public.techniques t
WHERE p.archetype = 'wrestler'
AND t.id IN ('t_sc_kimura','t_sc_americana','t_sc_arm_triangle','t_mount_americana','t_mount_armbar','t_ns_kimura')
ON CONFLICT (profile_id, technique_id) DO NOTHING;

-- 2. NERF SUBMISSION HUNTER
UPDATE public.archetype_position_matrix SET status = 'neutral'
WHERE archetype = 'submission_hunter' AND status = 'dominant'
AND position_id IN ('guard_closed','guard_half_top','passing_hq','standing_neutral','clinch_neutral');

UPDATE public.archetype_position_matrix SET status = 'defending'
WHERE archetype = 'submission_hunter' AND status = 'neutral'
AND position_id IN ('side_control_bottom','north_south_bottom','kesa_gatame_bottom','knee_on_belly_bottom','mount_bottom','turtle_bottom');

-- 3. BUFF WRESTLER
UPDATE public.archetype_position_matrix SET status = 'dominant'
WHERE archetype = 'wrestler' AND position_id IN ('side_control_top','north_south_top','kesa_gatame_top','knee_on_belly_top','mount_top','standing_neutral','clinch_neutral');

UPDATE public.archetype_position_matrix SET status = 'defending'
WHERE archetype = 'wrestler' AND status = 'disadvantaged'
AND position_id LIKE 'guard_%';

-- 4. BREAK CLOSED GUARD LOOP
INSERT INTO public.counter_techniques (id, name) VALUES
('t_pull_back_down', 'Pull Back to Closed Guard'),
('t_re_pummel', 'Re-Pummel / Underhook')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.techniques (id, name, from_position, to_position, type, points_awarded, counters, belt_unlock, difficulty, archetype_affinity, gp_cost) VALUES
('t_guard_break_standup', 'Stand Up in Guard', 'guard_closed', 'passing_standing_open', 'transition', 0, ARRAY['t_pull_back_down'], 'white', 1, ARRAY['wrestler','pressure_passer','scrambler'], 1),
('t_guard_break_knee_slice', 'Knee Slice Pass (from Closed Guard)', 'guard_closed', 'side_control_top', 'transition', 3, ARRAY['t_re_close_guard','t_hip_escape'], 'blue', 3, ARRAY['pressure_passer','wrestler'], 2),
('t_guard_break_stack', 'Stack Pass (from Closed Guard)', 'guard_closed', 'side_control_top', 'transition', 3, ARRAY['t_re_close_guard','t_hip_escape'], 'white', 2, ARRAY['pressure_passer','wrestler'], 2),
('t_guard_bottom_stand', 'Technical Stand Up (from Guard Bottom)', 'guard_closed', 'standing_neutral', 'escape', 0, ARRAY['t_snap_down'], 'white', 2, ARRAY['wrestler','scrambler'], 1),
('t_pull_back_down', 'Pull Back to Closed Guard', 'guard_closed', 'guard_closed', 'escape', 0, ARRAY[]::text[], 'white', 1, ARRAY['guard_puller'], 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, from_position = EXCLUDED.from_position, to_position = EXCLUDED.to_position,
  type = EXCLUDED.type, counters = EXCLUDED.counters, archetype_affinity = EXCLUDED.archetype_affinity, gp_cost = EXCLUDED.gp_cost;

INSERT INTO public.player_move_stacks (profile_id, technique_id, is_starter)
SELECT p.id, t.id, true
FROM public.profiles p CROSS JOIN public.techniques t
WHERE t.id IN ('t_guard_break_standup','t_guard_break_knee_slice','t_guard_break_stack','t_guard_bottom_stand')
AND (p.archetype = ANY(t.archetype_affinity))
ON CONFLICT (profile_id, technique_id) DO NOTHING;

-- 5. SPEED UP STANDING
INSERT INTO public.techniques (id, name, from_position, to_position, type, points_awarded, counters, belt_unlock, difficulty, archetype_affinity, gp_cost) VALUES
('t_body_lock_takedown', 'Body Lock Takedown', 'standing_neutral', 'side_control_top', 'takedown', 2, ARRAY['t_sprawl','t_re_pummel'], 'white', 2, ARRAY['wrestler','pressure_passer'], 2),
('t_ankle_pick', 'Ankle Pick', 'standing_neutral', 'side_control_top', 'takedown', 2, ARRAY['t_sprawl'], 'blue', 3, ARRAY['wrestler','scrambler'], 2),
('t_snap_down', 'Snap Down to Front Headlock', 'standing_neutral', 'clinch_front_headlock', 'transition', 0, ARRAY['t_re_pummel'], 'white', 2, ARRAY['wrestler','scrambler'], 1),
('t_pull_guard_standing', 'Pull Guard', 'standing_neutral', 'guard_closed', 'transition', 0, ARRAY[]::text[], 'white', 1, ARRAY['guard_puller','leg_locker'], 1),
('t_imanari_roll', 'Imanari Roll', 'standing_neutral', 'leg_entanglement_outside_ashi', 'transition', 0, ARRAY['t_sprawl'], 'purple', 4, ARRAY['leg_locker'], 2),
('t_arm_drag_standing', 'Arm Drag to Back', 'standing_neutral', 'back_control_top', 'transition', 0, ARRAY['t_re_pummel'], 'blue', 3, ARRAY['scrambler','guard_puller'], 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, from_position = EXCLUDED.from_position, to_position = EXCLUDED.to_position,
  type = EXCLUDED.type, counters = EXCLUDED.counters, archetype_affinity = EXCLUDED.archetype_affinity, gp_cost = EXCLUDED.gp_cost;

INSERT INTO public.player_move_stacks (profile_id, technique_id, is_starter)
SELECT p.id, t.id, true
FROM public.profiles p CROSS JOIN public.techniques t
WHERE t.id IN ('t_body_lock_takedown','t_ankle_pick','t_snap_down','t_pull_guard_standing','t_imanari_roll','t_arm_drag_standing')
AND (p.archetype = ANY(t.archetype_affinity))
ON CONFLICT (profile_id, technique_id) DO NOTHING;

-- 6. FIX DEAD ZONES
INSERT INTO public.techniques (id, name, from_position, to_position, type, points_awarded, counters, belt_unlock, difficulty, archetype_affinity, gp_cost) VALUES
('t_scramble_from_sc_bot', 'Scramble (from Side Control Bottom)', 'side_control_bottom', 'scramble', 'escape', 0, ARRAY[]::text[], 'white', 2, ARRAY['wrestler','scrambler'], 1),
('t_scramble_from_mount_bot', 'Scramble (from Mount Bottom)', 'mount_bottom', 'scramble', 'escape', 0, ARRAY[]::text[], 'white', 3, ARRAY['wrestler','scrambler'], 2),
('t_scramble_from_turtle_bot', 'Granby Roll (from Turtle Bottom)', 'turtle_bottom', 'scramble', 'escape', 0, ARRAY[]::text[], 'white', 2, ARRAY['scrambler','wrestler'], 1),
('t_scramble_from_ns_bot', 'Scramble (from North-South Bottom)', 'north_south_bottom', 'scramble', 'escape', 0, ARRAY[]::text[], 'white', 3, ARRAY['wrestler','scrambler'], 2),
('t_scramble_from_kob_bot', 'Scramble (from KOB Bottom)', 'knee_on_belly_bottom', 'scramble', 'escape', 0, ARRAY[]::text[], 'white', 2, ARRAY['scrambler','wrestler'], 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, from_position = EXCLUDED.from_position, to_position = EXCLUDED.to_position,
  type = EXCLUDED.type, archetype_affinity = EXCLUDED.archetype_affinity, gp_cost = EXCLUDED.gp_cost;

INSERT INTO public.player_move_stacks (profile_id, technique_id, is_starter)
SELECT p.id, t.id, true
FROM public.profiles p CROSS JOIN public.techniques t
WHERE t.id IN ('t_scramble_from_sc_bot','t_scramble_from_mount_bot','t_scramble_from_turtle_bot','t_scramble_from_ns_bot','t_scramble_from_kob_bot')
ON CONFLICT (profile_id, technique_id) DO NOTHING;

-- 7. ONBOARDING — defending position escapes for everyone
INSERT INTO public.player_move_stacks (profile_id, technique_id, is_starter)
SELECT p.id, t.id, true
FROM public.profiles p CROSS JOIN public.techniques t
WHERE t.from_position IN ('defending_clinch','defending_passing','defending_leg_entanglement','defending_back','defending_mount','scramble')
ON CONFLICT (profile_id, technique_id) DO NOTHING;

-- 8. GUARD PULLER — more aggressive from bottom
UPDATE public.archetype_position_matrix SET status = 'dominant'
WHERE archetype = 'guard_puller' AND position_id IN ('guard_closed','guard_half_bottom','guard_open_bottom','guard_butterfly_bottom');

UPDATE public.archetype_position_matrix SET status = 'defending'
WHERE archetype = 'guard_puller' AND position_id IN ('side_control_top','north_south_top','kesa_gatame_top','knee_on_belly_top');

-- 9. PRESSURE PASSER BUFF
UPDATE public.archetype_position_matrix SET status = 'dominant'
WHERE archetype = 'pressure_passer' AND position_id IN ('side_control_top','north_south_top','kesa_gatame_top','knee_on_belly_top','guard_closed','guard_half_top');

-- 10. SCRAMBLER BUFF
UPDATE public.archetype_position_matrix SET status = 'dominant'
WHERE archetype = 'scrambler' AND position_id = 'scramble';

UPDATE public.archetype_position_matrix SET status = 'neutral'
WHERE archetype = 'scrambler' AND status = 'defending'
AND position_id NOT LIKE 'defending_%';

-- 11. RESET FOR TESTING
UPDATE public.profiles SET elo = 1200, matches_played = 0, matches_won = 0, submissions_earned = 0
WHERE id IN ('00000001-0000-0000-0000-000000000001','00000002-0000-0000-0000-000000000002','00000003-0000-0000-0000-000000000003','00000004-0000-0000-0000-000000000004','00000005-0000-0000-0000-000000000005','00000006-0000-0000-0000-000000000006');

DELETE FROM match_turns;
DELETE FROM match_invites;
DELETE FROM matches;
