"""
Open Mat — AI Bot Engine v5 (Session 5, Service Role)
No auth needed — uses service role key + bot_* SQL functions.

Changes from v4b:
  - Archetype-aware move scoring (matches client botEngine.js)
  - Survive mechanic (resolve_survive RPC when hand is empty)
  - Archetype-aware drill selection (no more hardcoded drills)
  - Works with new starter decks from Session 5

Usage:
  python ai_bot_engine.py                    # Run 10 round-robin matches
  python ai_bot_engine.py --matches 50       # Run 50 matches
  python ai_bot_engine.py --reset            # Reset bot elos and clear old matches
  python ai_bot_engine.py --matchup wrestler guard_puller --matches 20
"""

import requests, json, time, random, sys, csv, os
from datetime import datetime
from itertools import combinations

# ═══ CONFIG ═══
SUPABASE_URL = "https://efsswnwiehpejczlttwr.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmc3N3bndpZWhwZWpjemx0dHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgzMTQ5OCwiZXhwIjoyMDg4NDA3NDk4fQ.tVx88CtH9W7j_5IdO0_AL36ehpCE22Yn8Xqbk1nAgbk"
HEADERS = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}

BOTS = {
    "wrestler":         {"id": "00000001-0000-0000-0000-000000000001", "name": "Iron Mike"},
    "guard_puller":     {"id": "00000002-0000-0000-0000-000000000002", "name": "Miyao"},
    "leg_locker":       {"id": "00000003-0000-0000-0000-000000000003", "name": "Haisam"},
    "pressure_passer":  {"id": "00000004-0000-0000-0000-000000000004", "name": "Rodolfo"},
    "submission_hunter":{"id": "00000005-0000-0000-0000-000000000005", "name": "Marcelo"},
    "scrambler":        {"id": "00000006-0000-0000-0000-000000000006", "name": "Ruotolo"},
}

GP_COSTS = {"submission": 3, "sweep": 2, "takedown": 2, "transition": 1, "escape": 1, "counter": 0}

# Archetype-aware move scoring (mirrors client botEngine.js)
ARCHETYPE_TYPE_SCORES = {
    "submission_hunter": {"submission": 5, "transition": 2, "escape": 1, "sweep": 1, "takedown": 0},
    "wrestler":          {"takedown": 5, "submission": 3, "transition": 2, "escape": 2, "sweep": 0},
    "guard_puller":      {"sweep": 5, "submission": 4, "transition": 2, "escape": 2, "takedown": 0},
    "pressure_passer":   {"transition": 4, "submission": 4, "takedown": 3, "escape": 1, "sweep": 0},
    "leg_locker":        {"submission": 5, "transition": 4, "escape": 1, "sweep": 1, "takedown": 0},
    "scrambler":         {"transition": 4, "sweep": 3, "takedown": 3, "escape": 2, "submission": 1},
}

DOMINANT_POSITIONS = {
    "side_control_top", "mount_top", "mount_high_top", "back_control_top",
    "knee_on_belly_top", "north_south_top", "kesa_gatame_top",
    "turtle_top", "mount_technical_top", "mount_s_mount_top",
    "passing_hq", "passing_standing_open", "passing_smash_pass",
    "passing_knee_slice", "passing_body_fold", "passing_torreando",
    "passing_leg_drag", "passing_long_step",
    "clinch_bodylock", "clinch_double_underhooks", "clinch_front_headlock",
    "clinch_russian_tie",
    "leg_entanglement_ashi_garami", "leg_entanglement_inside_sankaku",
    "leg_entanglement_outside_ashi", "leg_entanglement_411",
    "leg_entanglement_game_over", "leg_entanglement_reap",
    "crucifix_top", "back_body_triangle",
}

DRILL_PRIORITY = {
    "submission_hunter": ["submission"],
    "wrestler":          ["takedown", "submission"],
    "guard_puller":      ["sweep", "submission"],
    "pressure_passer":   ["transition", "submission"],
    "leg_locker":        ["submission", "transition"],
    "scrambler":         ["transition", "takedown", "sweep"],
}

# ═══ SUPABASE HELPERS ═══
def sb_get(table, params=None):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, params=params or {})
    return r.json() if r.ok else []

def sb_post(table, data):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=data)
    return r.json() if r.ok else None

def sb_patch(table, data, params):
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/{table}", headers=HEADERS, json=data, params=params)
    return r.json() if r.ok else None

def sb_rpc(fn, data=None):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/{fn}", headers=HEADERS, json=data or {})
    if r.ok:
        try: return r.json()
        except: return True
    elif r.status_code == 409:
        return 409
    else:
        print(f"  RPC {fn} error: {r.status_code} {r.text[:200]}")
        return None

# ═══ GAME DATA ═══
_graph = None
def load_graph():
    global _graph
    if _graph: return _graph
    positions = sb_get("positions", {"select": "*"})
    techniques = sb_get("techniques", {"select": "*"})
    counters = sb_get("counter_techniques", {"select": "*"})
    matrix = sb_get("archetype_position_matrix", {"select": "*"})
    _graph = {
        "positions": {p["id"]: p for p in positions},
        "techniques": {t["id"]: t for t in techniques},
        "counters": {c["id"]: c for c in counters},
        "matrix": {},
    }
    for m in matrix:
        _graph["matrix"][f"{m['archetype']}:{m['position_id']}"] = m["status"]
    print(f"  Graph loaded: {len(positions)} positions, {len(techniques)} techniques, {len(counters)} counters, {len(matrix)} matrix entries")
    return _graph

def get_status(position, archetype):
    return load_graph()["matrix"].get(f"{archetype}:{position}", "neutral")

def get_moves(position, deck_ids, archetype):
    g = load_graph()
    return [t for tid, t in g["techniques"].items() if t.get("from_position") == position and tid in deck_ids]

def get_counters():
    return list(load_graph()["counters"].values())[:10]

# ═══ BOT BRAIN ═══
def pick_stance(archetype, position, my_gp):
    if my_gp <= 3: return "setup"
    weights = {
        "wrestler":          [60, 20, 20],
        "guard_puller":      [40, 35, 25],
        "leg_locker":        [50, 30, 20],
        "pressure_passer":   [45, 30, 25],
        "submission_hunter": [65, 15, 20],
        "scrambler":         [45, 20, 35],
    }
    status = get_status(position, archetype)
    w = list(weights.get(archetype, [40, 30, 30]))
    if status == "dominant": w[0] += 15; w[1] -= 10
    elif status == "disadvantaged": w[1] += 15; w[0] -= 10
    elif status == "defending": w[1] += 10; w[2] += 5; w[0] -= 15
    w = [max(5, x) for x in w]
    return random.choices(["attack", "defend", "setup"], weights=w)[0]

def score_move_for_archetype(tech, archetype, my_gp):
    """Score a move using archetype-aware type preferences (mirrors client botEngine.js)."""
    score = 0.0
    move_type = tech.get("type", "")
    to_pos = tech.get("to_position")

    # Base type scoring per archetype
    scores = ARCHETYPE_TYPE_SCORES.get(archetype, ARCHETYPE_TYPE_SCORES["scrambler"])
    score += scores.get(move_type, 0)

    # Bonus for advancing to a dominant position
    if to_pos and to_pos in DOMINANT_POSITIONS:
        score += 1

    # Penalty when low on GP
    cost = GP_COSTS.get(move_type, 1)
    if my_gp <= cost + 1:
        score -= 1

    # Random noise so bots aren't robotic (±1)
    score += random.uniform(-1, 1)

    return score

def pick_move(position, archetype, deck, my_gp, opp_stance, my_stance):
    """Returns (technique_id, is_counter, needs_survive).
    needs_survive=True means no moves available — caller decides whether to resolve_survive."""
    deck_ids = set(d["technique_id"] for d in deck)
    moves = get_moves(position, deck_ids, archetype)
    counters = get_counters()

    # No moves from this position in deck
    if not moves:
        if counters:
            return random.choice(counters)["id"], True, False
        return None, False, True  # needs survive

    # Counter opportunities
    if my_stance == "defend" and random.random() < 0.15 and counters:
        return random.choice(counters)["id"], True, False
    if opp_stance == "attack" and my_gp <= 3 and counters and random.random() < 0.2:
        return random.choice(counters)["id"], True, False

    # Score moves using archetype-aware scoring
    scored = []
    for m in moves:
        cost = GP_COSTS.get(m.get("type"), 1)
        if cost > my_gp:
            continue
        s = score_move_for_archetype(m, archetype, my_gp)
        scored.append((m, s))

    if not scored:
        # Dead zone fallback: use ANY technique from this position
        g = load_graph()
        all_from_pos = [t for t in g["techniques"].values() if t.get("from_position") == position]
        affordable = [t for t in all_from_pos if GP_COSTS.get(t.get("type"), 1) <= my_gp]
        if affordable:
            fallback_scored = [(t, score_move_for_archetype(t, archetype, my_gp)) for t in affordable]
            fallback_scored.sort(key=lambda x: x[1], reverse=True)
            return fallback_scored[0][0]["id"], False, False
        if counters:
            return random.choice(counters)["id"], True, False
        return None, False, True  # needs survive

    # Pick best move (deterministic: sort by score, pick top)
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[0][0]["id"], False, False

def pick_sub_choice(is_attacker, my_gp, archetype):
    if is_attacker:
        opts = [("squeeze", 2), ("adjust", 1), ("transition_sub", 1)]
        aff = [(o, c) for o, c in opts if my_gp >= c]
        if not aff: return "adjust"
        if my_gp >= 4: return random.choices(["squeeze", "adjust", "transition_sub"], weights=[60, 25, 15])[0]
        return random.choice([o for o, c in aff])
    else:
        opts = [("technical_escape", 1), ("explode", 2), ("survive", 1), ("sweep_scramble", 2), ("reversal_sub", 3)]
        aff = [(o, c) for o, c in opts if my_gp >= c]
        if not aff: return "survive"
        if archetype == "scrambler" and my_gp >= 2:
            return random.choices(["technical_escape", "explode", "sweep_scramble"], weights=[30, 30, 40])[0]
        if archetype == "submission_hunter" and my_gp >= 3 and random.random() < 0.3:
            return "reversal_sub"
        return random.choice([o for o, c in aff])

# ═══ MATCH RUNNER ═══
def run_match(bot1_arch, bot2_arch):
    b1 = BOTS[bot1_arch]
    b2 = BOTS[bot2_arch]
    g = load_graph()

    print(f"\n{'='*50}")
    print(f"  {b1['name']} ({bot1_arch}) vs {b2['name']} ({bot2_arch})")
    print(f"{'='*50}")

    # Load decks
    d1 = sb_get("player_move_stacks", {"profile_id": f"eq.{b1['id']}", "select": "technique_id,tier"})
    d2 = sb_get("player_move_stacks", {"profile_id": f"eq.{b2['id']}", "select": "technique_id,tier"})
    print(f"  Decks: {len(d1)} vs {len(d2)}")

    # Create match directly
    match_data = sb_post("matches", {
        "player1_id": b1["id"], "player2_id": b2["id"],
        "status": "active", "current_turn": 1, "max_turns": 20,
        "turn_phase": "stance",
        "player1_position": "standing_neutral", "player2_position": "standing_neutral",
        "player1_points": 0, "player2_points": 0,
        "player1_gp": 10, "player2_gp": 10,
        "player1_chain": 0, "player2_chain": 0,
        "player1_move_locked": False, "player2_move_locked": False,
        "player1_stance_locked": False, "player2_stance_locked": False,
        "player1_feints_remaining": 3, "player2_feints_remaining": 3,
    })
    if not match_data:
        print("  Failed to create match")
        return None
    match_obj = match_data[0] if isinstance(match_data, list) else match_data
    match_id = match_obj["id"]
    print(f"  Match: {match_id[:8]}...")

    # Archetype-aware drill selection
    def pick_drills(deck, archetype, max_slots=3):
        priorities = DRILL_PRIORITY.get(archetype, ["submission", "transition"])
        tech_ids = [d["technique_id"] for d in deck]
        techs = [g["techniques"].get(tid) for tid in tech_ids]
        techs = [t for t in techs if t]
        techs.sort(key=lambda t: (priorities.index(t.get("type", "")) if t.get("type", "") in priorities else 99))
        return [t["id"] for t in techs[:max_slots]]

    drilled1 = pick_drills(d1, bot1_arch)
    drilled2 = pick_drills(d2, bot2_arch)
    sb_rpc("bot_set_drilled_moves", {"p_match_id": match_id, "p_player_id": b1["id"], "p_moves": drilled1})
    sb_rpc("bot_set_drilled_moves", {"p_match_id": match_id, "p_player_id": b2["id"], "p_moves": drilled2})
    print(f"  Drills: {len(drilled1)} vs {len(drilled2)}")

    # Game loop
    sub_minigame_attempts = 0
    for turn in range(1, 60):
        m = sb_get("matches", {"id": f"eq.{match_id}", "select": "*"})
        if not m: print("  Match lost!"); return None
        m = m[0]

        if m["status"] == "finished":
            print(f"  Finished turn {m.get('current_turn', '?')}")
            break

        phase = m.get("turn_phase", "stance")
        b1_gp = (m.get("player1_gp") or 10)
        b2_gp = (m.get("player2_gp") or 10)
        b1_pos = m["player1_position"]
        b2_pos = m["player2_position"]

        # Sub minigame
        if phase == "sub_minigame" and m.get("sub_minigame_active"):
            sub_minigame_attempts += 1
            if sub_minigame_attempts > 10:
                print(f"  Sub minigame stuck after 10 attempts — force finishing match")
                p1_pts = m.get("player1_points", 0) or 0
                p2_pts = m.get("player2_points", 0) or 0
                winner = b1["id"] if p1_pts > p2_pts else (b2["id"] if p2_pts > p1_pts else None)
                sb_rpc("finish_match", {"p_match_id": match_id, "p_winner_id": winner, "p_method": "points" if winner else "draw"})
                break
            b1_is_att = m.get("sub_attacker_id") == b1["id"]
            if not (m.get("sub_attacker_locked") if b1_is_att else m.get("sub_defender_locked")):
                ch = pick_sub_choice(b1_is_att, b1_gp, bot1_arch)
                result = sb_rpc("bot_submit_sub_choice", {"p_match_id": match_id, "p_player_id": b1["id"], "p_choice": ch})
                if result == 409:
                    print(f"  Sub choice p1 already resolved (409), skipping")
            if not (m.get("sub_defender_locked") if b1_is_att else m.get("sub_attacker_locked")):
                ch = pick_sub_choice(not b1_is_att, b2_gp, bot2_arch)
                result = sb_rpc("bot_submit_sub_choice", {"p_match_id": match_id, "p_player_id": b2["id"], "p_choice": ch})
                if result == 409:
                    print(f"  Sub choice p2 already resolved (409), skipping")
            time.sleep(0.2)
            continue
        else:
            sub_minigame_attempts = 0

        # Stance phase
        if phase == "stance":
            if not m.get("player1_stance_locked"):
                st = pick_stance(bot1_arch, b1_pos, b1_gp)
                sb_rpc("bot_submit_stance", {"p_match_id": match_id, "p_player_id": b1["id"], "p_stance": st})
            if not m.get("player2_stance_locked"):
                st = pick_stance(bot2_arch, b2_pos, b2_gp)
                sb_rpc("bot_submit_stance", {"p_match_id": match_id, "p_player_id": b2["id"], "p_stance": st})
            time.sleep(0.2)

        # Move phase
        elif phase == "move":
            b1_stance = m.get("player1_stance", "attack")
            b2_stance = m.get("player2_stance", "attack")

            # Pick moves for both bots first (don't resolve survive yet)
            b1_mid, b1_ic, b1_survive = None, False, False
            b2_mid, b2_ic, b2_survive = None, False, False

            if not m.get("player1_move_locked"):
                b1_mid, b1_ic, b1_survive = pick_move(b1_pos, bot1_arch, d1, b1_gp, b2_stance, b1_stance)
            if not m.get("player2_move_locked"):
                b2_mid, b2_ic, b2_survive = pick_move(b2_pos, bot2_arch, d2, b2_gp, b1_stance, b2_stance)

            # Resolve survive interactions:
            # If one needs survive but opponent picked a SUB → skip survive, let the sub land
            # If one needs survive and opponent picked non-sub → call resolve_survive
            # If both need survive → both resolve_survive (reset to neutral)
            b1_move_type = g["techniques"].get(b1_mid, {}).get("type") if b1_mid else None
            b2_move_type = g["techniques"].get(b2_mid, {}).get("type") if b2_mid else None

            if b1_survive:
                if b2_move_type == "submission":
                    print(f"    {b1['name']} caught — {b2['name']} lands sub, no survive")
                    # Don't survive — let resolve_turn handle the sub
                else:
                    print(f"    {b1['name']} no moves from {b1_pos} — calling resolve_survive")
                    sb_rpc("resolve_survive", {"p_match_id": match_id, "p_player_id": b1["id"]})

            if b2_survive:
                if b1_move_type == "submission":
                    print(f"    {b2['name']} caught — {b1['name']} lands sub, no survive")
                else:
                    print(f"    {b2['name']} no moves from {b2_pos} — calling resolve_survive")
                    sb_rpc("resolve_survive", {"p_match_id": match_id, "p_player_id": b2["id"]})

            # Submit actual moves
            if b1_mid:
                sb_rpc("bot_submit_move", {"p_match_id": match_id, "p_player_id": b1["id"], "p_technique_id": b1_mid, "p_is_counter": b1_ic})
            if b2_mid:
                sb_rpc("bot_submit_move", {"p_match_id": match_id, "p_player_id": b2["id"], "p_technique_id": b2_mid, "p_is_counter": b2_ic})
            time.sleep(0.2)

        elif phase == "resolving":
            time.sleep(0.3)
        else:
            time.sleep(0.2)

    # Final state
    m = sb_get("matches", {"id": f"eq.{match_id}", "select": "*"})[0]
    p1_pts = m.get("player1_points", 0) or 0
    p2_pts = m.get("player2_points", 0) or 0

    # Finish if still active
    if m["status"] != "finished":
        winner = b1["id"] if p1_pts > p2_pts else (b2["id"] if p2_pts > p1_pts else None)
        sb_rpc("finish_match", {"p_match_id": match_id, "p_winner_id": winner, "p_method": "points" if winner else "draw"})
        m = sb_get("matches", {"id": f"eq.{match_id}", "select": "*"})[0]

    winner_id = m.get("winner_id")
    method = m.get("win_method", "draw")
    result_str = f"{b1['name']} WINS" if winner_id == b1["id"] else (f"{b2['name']} WINS" if winner_id == b2["id"] else "DRAW")
    print(f"  {result_str} ({method}) | {p1_pts}-{p2_pts} | Turn {m.get('current_turn', '?')}")

    return {
        "match_id": match_id, "bot1": bot1_arch, "bot2": bot2_arch,
        "b1_name": b1["name"], "b2_name": b2["name"],
        "b1_pts": p1_pts, "b2_pts": p2_pts,
        "winner": bot1_arch if winner_id == b1["id"] else (bot2_arch if winner_id == b2["id"] else "draw"),
        "method": method, "turns": m.get("current_turn", 0),
    }

# ═══ MAIN ═══
def main():
    args = sys.argv[1:]
    num_matches = 10; matchup = None; do_reset = False
    i = 0
    while i < len(args):
        if args[i] == "--matches" and i + 1 < len(args): num_matches = int(args[i + 1]); i += 2
        elif args[i] == "--matchup" and i + 2 < len(args): matchup = (args[i + 1], args[i + 2]); i += 3
        elif args[i] == "--reset": do_reset = True; i += 1
        else: i += 1

    if do_reset:
        print("Resetting...")
        for arch, bot in BOTS.items():
            sb_patch("profiles", {"elo": 1200, "matches_played": 0, "matches_won": 0, "submissions_earned": 0}, {"id": f"eq.{bot['id']}"})
        print("Done!"); return

    print("=" * 60)
    print("  OPEN MAT — AI Bot Engine v5 (Service Role)")
    print("=" * 60)

    print("\nLoading graph...")
    load_graph()
    print(f"\nBots ready: {', '.join(b['name'] for b in BOTS.values())}")

    if matchup:
        pairs = [matchup] * num_matches
    else:
        all_pairs = list(combinations(BOTS.keys(), 2))
        pairs = []
        while len(pairs) < num_matches: random.shuffle(all_pairs); pairs.extend(all_pairs)
        pairs = pairs[:num_matches]

    results = []
    for i, (a1, a2) in enumerate(pairs):
        print(f"\n--- Match {i+1}/{num_matches} ---")
        try:
            r = run_match(a1, a2)
            if r: results.append(r)
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback; traceback.print_exc()
        time.sleep(0.3)

    # Summary
    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    wins = {a: 0 for a in BOTS}; losses = {a: 0 for a in BOTS}; draws = {a: 0 for a in BOTS}; subs = {a: 0 for a in BOTS}
    for r in results:
        if r["winner"] == "draw": draws[r["bot1"]] += 1; draws[r["bot2"]] += 1
        elif r["winner"] == r["bot1"]: wins[r["bot1"]] += 1; losses[r["bot2"]] += 1
        else: wins[r["bot2"]] += 1; losses[r["bot1"]] += 1
        if r["method"] == "submission" and r["winner"] != "draw": subs[r["winner"]] += 1

    print(f"\n{'Archetype':<22} {'W':>4} {'L':>4} {'D':>4} {'Sub':>4} {'Win%':>6}")
    print("-" * 50)
    for arch in sorted(BOTS.keys(), key=lambda a: wins[a], reverse=True):
        total = wins[arch] + losses[arch] + draws[arch]
        pct = f"{wins[arch]/total*100:.0f}%" if total > 0 else "N/A"
        print(f"  {BOTS[arch]['name']:<20} {wins[arch]:>4} {losses[arch]:>4} {draws[arch]:>4} {subs[arch]:>4} {pct:>6}")

    os.makedirs("data/ai_matches", exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = f"data/ai_matches/v5_{ts}.csv"
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["match_id","bot1","bot2","b1_name","b2_name","b1_pts","b2_pts","winner","method","turns"])
        w.writeheader(); w.writerows(results)
    print(f"\nSaved: {csv_path}")

    print("\nElos:")
    for arch, bot in BOTS.items():
        p = sb_get("profiles", {"id": f"eq.{bot['id']}", "select": "elo,matches_won,matches_played"})
        if p: print(f"  {bot['name']:<20} Elo:{p[0].get('elo','?'):>5}  W:{p[0].get('matches_won',0)}  P:{p[0].get('matches_played',0)}")

if __name__ == "__main__":
    main()
