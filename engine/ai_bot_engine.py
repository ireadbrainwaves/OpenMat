"""
Open Mat - AI Bot Engine v2
============================
Uses service role key to run AI matches directly.
No auth login needed - operates as admin.
Run: python ai_bot_engine.py
"""

import requests
import json
import time
import random
import csv
import uuid
from datetime import datetime, timezone

# ===== CONFIG =====
SUPABASE_URL = 'https://efsswnwiehpejczlttwr.supabase.co'
SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmc3N3bndpZWhwZWpjemx0dHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgzMTQ5OCwiZXhwIjoyMDg4NDA3NDk4fQ.tVx88CtH9W7j_5IdO0_AL36ehpCE22Yn8Xqbk1nAgbk'

AI_PLAYERS = [
    {'id': '00000001-0000-0000-0000-000000000001', 'name': 'Iron Mike', 'archetype': 'wrestler', 'belt': 'blue'},
    {'id': '00000002-0000-0000-0000-000000000002', 'name': 'Miyao', 'archetype': 'guard_puller', 'belt': 'blue'},
    {'id': '00000003-0000-0000-0000-000000000003', 'name': 'Haisam', 'archetype': 'leg_locker', 'belt': 'purple'},
    {'id': '00000004-0000-0000-0000-000000000004', 'name': 'Rodolfo', 'archetype': 'pressure_passer', 'belt': 'blue'},
    {'id': '00000005-0000-0000-0000-000000000005', 'name': 'Marcelo', 'archetype': 'submission_hunter', 'belt': 'blue'},
    {'id': '00000006-0000-0000-0000-000000000006', 'name': 'Ruotolo', 'archetype': 'scrambler', 'belt': 'blue'},
]

BELT_ORDER = {'white': 1, 'blue': 2, 'purple': 3, 'brown': 4, 'black': 5}
NUM_MATCHES = 100


# ===== API HELPERS =====
HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def db_get(table, params=''):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{table}?{params}', headers=HEADERS)
    return r.json() if r.status_code == 200 else []

def db_insert(table, data):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/{table}', headers=HEADERS, json=data)
    if r.status_code in (200, 201):
        try: return r.json()
        except: return [data]
    print(f'  DB INSERT ERROR ({table}): {r.status_code} {r.text[:200]}')
    return None

def db_update(table, match_filter, data):
    r = requests.patch(f'{SUPABASE_URL}/rest/v1/{table}?{match_filter}', headers=HEADERS, json=data)
    if r.status_code in (200, 204):
        try: return r.json()
        except: return True
    print(f'  DB UPDATE ERROR ({table}): {r.status_code} {r.text[:200]}')
    return None

def db_rpc(fn, params):
    r = requests.post(f'{SUPABASE_URL}/rest/v1/rpc/{fn}', headers=HEADERS, json=params)
    if r.status_code == 200:
        try: return r.json()
        except: return True
    print(f'  RPC ERROR ({fn}): {r.status_code} {r.text[:200]}')
    return None


# ===== LOAD GRAPH =====
def load_graph():
    positions = {p['id']: p for p in db_get('positions', 'select=*')}
    techniques = {t['id']: t for t in db_get('techniques', 'select=*')}
    counters = {c['id']: c for c in db_get('counter_techniques', 'select=*')}
    
    matrix = {}
    for row in db_get('archetype_position_matrix', 'select=*'):
        if row['position_id'] not in matrix:
            matrix[row['position_id']] = {}
        matrix[row['position_id']][row['archetype']] = row['status']

    tech_from = {}
    for t in techniques.values():
        tech_from.setdefault(t['from_position'], []).append(t)

    return {'positions': positions, 'techniques': techniques, 'counters': counters,
            'matrix': matrix, 'tech_from': tech_from}


def get_status(graph, pos_id, archetype):
    return graph['matrix'].get(pos_id, {}).get(archetype, 'neutral')


def get_moves(graph, pos_id, belt, deck, archetype, overtime=False):
    belt_lvl = BELT_ORDER.get(belt, 1)
    status = get_status(graph, pos_id, archetype)
    moves = []
    for t in graph['tech_from'].get(pos_id, []):
        if BELT_ORDER.get(t['belt_unlock'], 1) > belt_lvl: continue
        if t['id'] not in deck: continue
        if overtime and t['type'] != 'submission': continue
        if status in ('defending', 'disadvantaged') and t['type'] != 'escape': continue
        moves.append(t)
    return moves


# ===== AI BRAIN =====
def ai_pick_stance(status, gp=10):
    # Low GP: prefer setup (recovery) or defend (free counters)
    if gp <= 2:
        r = random.random()
        return 'setup' if r < 0.6 else 'defend' if r < 0.9 else 'attack'
    if gp <= 4:
        r = random.random()
        return 'setup' if r < 0.4 else 'defend' if r < 0.7 else 'attack'
    
    if status == 'dominant':
        r = random.random()
        return 'attack' if r < 0.6 else 'setup' if r < 0.85 else 'defend'
    elif status == 'neutral':
        r = random.random()
        return 'attack' if r < 0.4 else 'setup' if r < 0.7 else 'defend'
    elif status == 'defending':
        r = random.random()
        return 'defend' if r < 0.5 else 'setup' if r < 0.8 else 'attack'
    else:
        r = random.random()
        return 'defend' if r < 0.7 else 'setup' if r < 0.9 else 'attack'


def ai_pick_move(graph, pos_id, belt, deck, archetype, opp_stance, counters, opp_pos=None, opp_archetype=None, my_gp=10):
    moves = get_moves(graph, pos_id, belt, deck, archetype)
    # Filter by GP cost - can't pick moves you can't afford
    affordable = [m for m in moves if m.get('gp_cost', 1) <= my_gp]
    if not affordable:
        affordable = moves  # fallback if somehow everything is too expensive
    
    subs = [m for m in affordable if m['type'] == 'submission']
    escapes = [m for m in affordable if m['type'] == 'escape']
    transitions = [m for m in affordable if m['type'] in ('transition', 'sweep', 'takedown')]
    status = get_status(graph, pos_id, archetype)

    # SMART COUNTER PICKING: only relevant when opponent is attacking
    smart_counters = set()
    if opp_pos and opp_stance == 'attack':
        opp_moves = graph['tech_from'].get(opp_pos, [])
        for om in opp_moves:
            for c in (om.get('counters') or []):
                if c in counters:
                    smart_counters.add(c)
    smart_counter_list = list(smart_counters) if smart_counters else []

    # GP-aware decisions: if low GP, prefer cheap moves
    low_gp = my_gp <= 3

    if opp_stance == 'attack':
        if status in ('defending', 'disadvantaged'):
            if escapes: return random.choice(escapes)['id'], False
            if smart_counter_list: return random.choice(smart_counter_list), True
        r = random.random()
        if r < 0.4 and smart_counter_list: return random.choice(smart_counter_list), True
        if r < 0.6 and escapes: return random.choice(escapes)['id'], False
        if not low_gp and r < 0.8 and subs: return random.choice(subs)['id'], False
        if transitions: return random.choice(transitions)['id'], False

    elif opp_stance == 'defend':
        if not low_gp and subs and status == 'dominant' and random.random() < 0.6: return random.choice(subs)['id'], False
        if transitions and random.random() < 0.7: return random.choice(transitions)['id'], False
        if not low_gp and subs: return random.choice(subs)['id'], False
        if transitions: return random.choice(transitions)['id'], False

    elif opp_stance == 'setup':
        if not low_gp and subs and status == 'dominant' and random.random() < 0.5: return random.choice(subs)['id'], False
        if transitions: return random.choice(transitions)['id'], False
        if not low_gp and subs: return random.choice(subs)['id'], False

    if affordable: return random.choice(affordable)['id'], False
    if escapes: return random.choice(escapes)['id'], False
    if smart_counter_list: return random.choice(smart_counter_list), True
    return 't_base_out_defense', True


# ===== RESOLVE TURN (client-side for AI matches) =====
# ===== RESOLVE TURN (client-side for AI matches) =====
def resolve_turn_local(graph, match, p1_move_id, p1_is_counter, p2_move_id, p2_is_counter, p1_info, p2_info):
    """Resolve a turn locally with GP and chain mechanics."""
    p1_tech = graph['techniques'].get(p1_move_id)
    p2_tech = graph['techniques'].get(p2_move_id)
    p1_is_c = p1_is_counter or p1_move_id in graph['counters']
    p2_is_c = p2_is_counter or p2_move_id in graph['counters']
    p1_pos = match['player1_position']
    p2_pos = match['player2_position']
    p1_status = get_status(graph, p1_pos, p1_info['archetype'])
    p2_status = get_status(graph, p2_pos, p2_info['archetype'])
    p1_dom = p1_status == 'dominant'
    p2_dom = p2_status == 'dominant'
    p1_stance = match.get('player1_stance', 'setup')
    p2_stance = match.get('player2_stance', 'setup')
    p1_def_bonus = 0.15 if p1_stance == 'defend' else 0.0
    p2_def_bonus = 0.15 if p2_stance == 'defend' else 0.0

    # GP
    p1_gp = match.get('player1_gp', 10)
    p2_gp = match.get('player2_gp', 10)
    p1_gp_cost = (p1_tech.get('gp_cost', 1) if p1_tech and not p1_is_c else 0)
    p2_gp_cost = (p2_tech.get('gp_cost', 1) if p2_tech and not p2_is_c else 0)
    p1_rec = 1 + (1 if p1_stance == 'setup' else 0) + (1 if p1_dom else 0) - (1 if p1_status == 'disadvantaged' else 0)
    p2_rec = 1 + (1 if p2_stance == 'setup' else 0) + (1 if p2_dom else 0) - (1 if p2_status == 'disadvantaged' else 0)
    new_p1_gp = max(0, min(12, p1_gp - p1_gp_cost + p1_rec))
    new_p2_gp = max(0, min(12, p2_gp - p2_gp_cost + p2_rec))

    # Chain
    p1_chain = match.get('player1_chain', 0)
    p2_chain = match.get('player2_chain', 0)
    if p1_tech and not p1_is_c: p1_chain += 1
    else: p1_chain = 0
    if p2_tech and not p2_is_c: p2_chain += 1
    else: p2_chain = 0
    p1_cb = min(0.30, max(0, (p1_chain - 1) * 0.10)) if p1_chain >= 2 else 0
    p2_cb = min(0.30, max(0, (p2_chain - 1) * 0.10)) if p2_chain >= 2 else 0

    result = {'new_pos': match['current_position'], 'new_p1': p1_pos, 'new_p2': p2_pos,
              'p1_pts': 0, 'p2_pts': 0, 'sub_win': None, 'winner': None, 'desc': 'Position holds.',
              'result_type': 'hold_position', 'p1_gp': new_p1_gp, 'p2_gp': new_p2_gp,
              'p1_chain': p1_chain, 'p2_chain': p2_chain, 'p1_gp_cost': p1_gp_cost, 'p2_gp_cost': p2_gp_cost}

    # P1 sub
    if p1_tech and p1_tech['type'] == 'submission' and (not p2_tech or p2_tech['type'] != 'submission'):
        cc = p2_move_id in (p1_tech.get('counters') or [])
        dc = (0.75 if cc else 0.25 if p2_is_c else 0.20 if (p2_tech and p2_tech['type'] == 'escape') else 0.05) + p2_def_bonus - p1_cb
        if p2_gp <= 2: dc -= 0.15
        dc = max(0.0, min(0.95, dc))
        if random.random() < dc:
            result['desc'] = f"{p2_info['name']} defends {p1_tech['name']}!"; result['result_type'] = 'submission_defended'; result['p2_chain'] = 0
        else:
            result['start_minigame'] = True; result['mg_attacker'] = p1_info; result['mg_defender'] = p2_info; result['mg_tech'] = p1_tech
            result['desc'] = f"{p1_info['name']} locks in {p1_tech['name']}! Sub minigame!"
            if p1_chain >= 3: result['desc'] += f' ({p1_chain}-chain!)'
            result['result_type'] = 'position_change'
    # P2 sub
    elif p2_tech and p2_tech['type'] == 'submission' and (not p1_tech or p1_tech['type'] != 'submission'):
        cc = p1_move_id in (p2_tech.get('counters') or [])
        dc = (0.75 if cc else 0.25 if p1_is_c else 0.20 if (p1_tech and p1_tech['type'] == 'escape') else 0.05) + p1_def_bonus - p2_cb
        if p1_gp <= 2: dc -= 0.15
        dc = max(0.0, min(0.95, dc))
        if random.random() < dc:
            result['desc'] = f"{p1_info['name']} defends {p2_tech['name']}!"; result['result_type'] = 'submission_defended'; result['p1_chain'] = 0
        else:
            result['start_minigame'] = True; result['mg_attacker'] = p2_info; result['mg_defender'] = p1_info; result['mg_tech'] = p2_tech
            result['desc'] = f"{p2_info['name']} locks in {p2_tech['name']}! Sub minigame!"
            if p2_chain >= 3: result['desc'] += f' ({p2_chain}-chain!)'
            result['result_type'] = 'position_change'
    # Both subs
    elif p1_tech and p1_tech['type'] == 'submission' and p2_tech and p2_tech['type'] == 'submission':
        if p1_dom or p1_gp > p2_gp:
            result['sub_win'] = p1_info['id']; result['desc'] = f"Both attack! {p1_info['name']} wins with {p1_tech['name']}!"; result['result_type'] = 'submission_win'
        elif p2_dom or p2_gp > p1_gp:
            result['sub_win'] = p2_info['id']; result['desc'] = f"Both attack! {p2_info['name']} wins with {p2_tech['name']}!"; result['result_type'] = 'submission_win'
        else:
            if random.random() < 0.3:
                w = random.choice([p1_info, p2_info]); wt = p1_tech if w == p1_info else p2_tech
                result['sub_win'] = w['id']; result['desc'] = f"Sub exchange! {w['name']} catches {wt['name']}!"; result['result_type'] = 'submission_win'
            else: result['desc'] = 'Both go for subs - scramble!'; result['p1_chain'] = 0; result['p2_chain'] = 0
    # Escape vs transition
    elif p1_tech and p1_tech['type'] == 'escape' and p2_tech and p2_tech['type'] not in ('submission', 'escape'):
        result['winner'] = p1_info['id']; result['p1_pts'] = p1_tech.get('points_awarded', 0)
        result['desc'] = f"{p1_info['name']} escapes with {p1_tech['name']}!"
        if p1_tech.get('to_position'): result['new_pos'] = p1_tech['to_position']
        result['result_type'] = 'position_change'; result['p2_chain'] = 0
    elif p2_tech and p2_tech['type'] == 'escape' and p1_tech and p1_tech['type'] not in ('submission', 'escape'):
        result['winner'] = p2_info['id']; result['p2_pts'] = p2_tech.get('points_awarded', 0)
        result['desc'] = f"{p2_info['name']} escapes with {p2_tech['name']}!"
        if p2_tech.get('to_position'): result['new_pos'] = p2_tech['to_position']
        result['result_type'] = 'position_change'; result['p1_chain'] = 0
    # Both counters = scramble
    elif p1_is_c and p2_is_c:
        result['new_pos'] = 'scramble'; result['new_p1'] = 'scramble'; result['new_p2'] = 'scramble'
        result['desc'] = 'Both defensive - scramble!'; result['result_type'] = 'position_change'
        result['p1_chain'] = 0; result['p2_chain'] = 0
    # P1 attacks, P2 counters
    elif p1_tech and not p1_is_c and p2_is_c:
        cc = p2_move_id in (p1_tech.get('counters') or [])
        ch = max(0.05, min(0.95, (0.70 if cc else 0.20) + p2_def_bonus - p1_cb))
        if random.random() < ch:
            result['winner'] = p2_info['id']; result['desc'] = f"{p2_info['name']} counters {p1_tech['name']}!"; result['result_type'] = 'counter_success'; result['p1_chain'] = 0
        else:
            result['winner'] = p1_info['id']; result['p1_pts'] = p1_tech.get('points_awarded', 0)
            result['desc'] = f"{p1_info['name']} powers through {p1_tech['name']}!"
            if p1_tech.get('to_position'): result['new_pos'] = p1_tech['to_position']
            result['result_type'] = 'position_change'
    # P2 attacks, P1 counters
    elif p2_tech and not p2_is_c and p1_is_c:
        cc = p1_move_id in (p2_tech.get('counters') or [])
        ch = max(0.05, min(0.95, (0.70 if cc else 0.20) + p1_def_bonus - p2_cb))
        if random.random() < ch:
            result['winner'] = p1_info['id']; result['desc'] = f"{p1_info['name']} counters {p2_tech['name']}!"; result['result_type'] = 'counter_success'; result['p2_chain'] = 0
        else:
            result['winner'] = p2_info['id']; result['p2_pts'] = p2_tech.get('points_awarded', 0)
            result['desc'] = f"{p2_info['name']} powers through {p2_tech['name']}!"
            if p2_tech.get('to_position'): result['new_pos'] = p2_tech['to_position']
            result['result_type'] = 'position_change'
    # Both transition
    elif p1_tech and p2_tech:
        p1e = p1_tech['difficulty'] + (1 if p1_dom else 0) + p1_cb * 5
        p2e = p2_tech['difficulty'] + (1 if p2_dom else 0) + p2_cb * 5
        fav = p1_info if p1e >= p2e else p2_info
        fav_tech = p1_tech if p1e >= p2e else p2_tech
        und = p2_info if p1e >= p2e else p1_info
        und_tech = p2_tech if p1e >= p2e else p1_tech
        if random.random() < 0.65:
            result['winner'] = fav['id']
            result['desc'] = f"{fav['name']} executes {fav_tech['name']}!"
            if fav_tech.get('to_position'): result['new_pos'] = fav_tech['to_position']
            if fav == p1_info: result['p1_pts'] = fav_tech.get('points_awarded', 0); result['p2_chain'] = 0
            else: result['p2_pts'] = fav_tech.get('points_awarded', 0); result['p1_chain'] = 0
        else:
            result['winner'] = und['id']
            result['desc'] = f"{und['name']} executes {und_tech['name']}!"
            if und_tech.get('to_position'): result['new_pos'] = und_tech['to_position']
            if und == p1_info: result['p1_pts'] = und_tech.get('points_awarded', 0); result['p2_chain'] = 0
            else: result['p2_pts'] = und_tech.get('points_awarded', 0); result['p1_chain'] = 0
        result['result_type'] = 'position_change'
    elif p1_tech:
        result['winner'] = p1_info['id']; result['p1_pts'] = p1_tech.get('points_awarded', 0)
        result['desc'] = f"{p1_info['name']} hits {p1_tech['name']}!"
        if p1_tech.get('to_position'): result['new_pos'] = p1_tech['to_position']
        result['result_type'] = 'position_change'
    elif p2_tech:
        result['winner'] = p2_info['id']; result['p2_pts'] = p2_tech.get('points_awarded', 0)
        result['desc'] = f"{p2_info['name']} hits {p2_tech['name']}!"
        if p2_tech.get('to_position'): result['new_pos'] = p2_tech['to_position']
        result['result_type'] = 'position_change'

    # Position pairing
    if result['new_pos'] != match['current_position']:
        pos_data = graph['positions'].get(result['new_pos'], {})
        pair_id = pos_data.get('pair_id')
        if pos_data.get('is_dominant') or pair_id:
            def_pos = pair_id or {'clinch':'defending_clinch','passing':'defending_passing','leg_entanglement':'defending_leg_entanglement','back':'defending_back','mount':'defending_mount'}.get(pos_data.get('family',''), result['new_pos'])
            if result['winner'] == p1_info['id'] or not result['winner']:
                result['new_p1'] = result['new_pos']; result['new_p2'] = def_pos
            else:
                result['new_p2'] = result['new_pos']; result['new_p1'] = def_pos
        else:
            result['new_p1'] = result['new_pos']; result['new_p2'] = result['new_pos']

    if result['p1_pts'] > 0: result['desc'] += f" +{result['p1_pts']}"
    if result['p2_pts'] > 0: result['desc'] += f" +{result['p2_pts']}"
    result['desc'] += f" [GP:{new_p1_gp}/{new_p2_gp}]"
    if p1_chain >= 2 or p2_chain >= 2: result['desc'] += f" [Chain:{result['p1_chain']}/{result['p2_chain']}]"
    return result



# ===== SUB MINIGAME =====
def ai_pick_sub_attacker_choice(gp, squeeze_count, survive_count, graph, attacker_info, match):
    """AI picks attacker choice in sub minigame."""
    # Has another sub to transition to?
    can_transition = False
    pos = match['player1_position'] if attacker_info['id'] == match['player1_id'] else match['player2_position']
    # If we've squeezed a lot and they're surviving, try transition
    if survive_count >= 2 and gp >= 1:
        return 'transition_sub'
    # Low GP: adjust (cheaper)
    if gp <= 2:
        return 'adjust'
    # High squeeze count = close to finishing, squeeze more
    if squeeze_count >= 2:
        return 'squeeze' if gp >= 2 else 'adjust'
    # Default: mostly squeeze
    r = random.random()
    if r < 0.6: return 'squeeze'
    if r < 0.85: return 'adjust'
    return 'transition_sub'

def ai_pick_sub_defender_choice(gp, status, graph, defender_info, def_pos, deck):
    """AI picks defender choice in sub minigame based on deck and archetype status."""
    # Check what options are available based on deck
    has_escape = any(t['type'] == 'escape' and t['from_position'] == def_pos for t in graph['techniques'].values() if t['id'] in deck)
    has_sweep = any(t['type'] in ('sweep','transition') and t['from_position'] == def_pos for t in graph['techniques'].values() if t['id'] in deck)
    has_sub = any(t['type'] == 'submission' and t['from_position'] == def_pos for t in graph['techniques'].values() if t['id'] in deck)
    
    # Disadvantaged: only technical escape
    if status == 'disadvantaged':
        return 'technical_escape'
    # Defending: technical escape or explode
    if status == 'defending':
        if gp <= 1: return 'survive'
        return 'explode' if random.random() < 0.5 else 'technical_escape'
    # Neutral/Dominant: full options
    if gp <= 1: return 'survive'
    r = random.random()
    if r < 0.25 and has_escape: return 'explode'
    if r < 0.45: return 'technical_escape'
    if r < 0.65 and has_sweep and gp >= 2: return 'sweep_scramble'
    if r < 0.80 and has_sub and gp >= 3: return 'reversal_sub'
    return 'survive'

def resolve_sub_minigame_local(match, attacker, defender, graph, att_deck, def_deck):
    """Run the full sub minigame locally. Returns (winner_id or None, method, description_log)."""
    sub_tech = graph['techniques'].get(match.get('sub_technique_id', ''), {})
    sub_name = sub_tech.get('name', 'Unknown Sub')
    att_gp = match.get('att_gp', 8)
    def_gp = match.get('def_gp', 8)
    squeeze_count = 1  # Entry counts as first squeeze
    survive_count = 0
    log = []
    
    def_pos = match['player2_position'] if attacker['id'] == match['player1_id'] else match['player1_position']
    def_status = get_status(graph, def_pos, defender['archetype'])
    
    for phase_turn in range(1, 6):  # Max 5 sub minigame turns
        # Attacker picks
        att_choice = ai_pick_sub_attacker_choice(att_gp, squeeze_count, survive_count, graph, attacker, match)
        # Defender picks
        def_choice = ai_pick_sub_defender_choice(def_gp, def_status, graph, defender, def_pos, def_deck)
        
        # GP costs
        att_costs = {'squeeze': 2, 'adjust': 1, 'transition_sub': 1}
        def_costs = {'explode': 2, 'survive': 1, 'technical_escape': 1, 'sweep_scramble': 2, 'reversal_sub': 3}
        att_gp = max(0, att_gp - att_costs.get(att_choice, 0))
        def_gp = max(0, def_gp - def_costs.get(def_choice, 0))
        
        desc = f"  Sub T{phase_turn}: {att_choice} vs {def_choice} | GP:{att_gp}/{def_gp}"
        
        # SQUEEZE
        if att_choice == 'squeeze':
            squeeze_count += 1
            tap_chance = 0.30 + (squeeze_count * 0.15) - (survive_count * 0.12)
            if def_gp <= 2: tap_chance += 0.15
            if def_status == 'disadvantaged': tap_chance += 0.10
            tap_chance = max(0.10, min(0.90, tap_chance))
            
            if def_choice == 'explode':
                if random.random() < tap_chance:
                    desc += f" | {attacker['name']} SQUEEZES! {defender['name']} TAPS!"
                    log.append(desc)
                    return attacker['id'], f'Submission - {sub_name}', log, att_gp, def_gp
                else:
                    desc += f" | {defender['name']} EXPLODES out! Scramble!"
                    log.append(desc)
                    return None, 'escaped_scramble', log, att_gp, def_gp
            elif def_choice == 'survive':
                survive_count += 1
                if random.random() < tap_chance:
                    desc += f" | {attacker['name']} SQUEEZES! {defender['name']} TAPS!"
                    log.append(desc)
                    return attacker['id'], f'Submission - {sub_name}', log, att_gp, def_gp
                else:
                    desc += f" | {defender['name']} survives the squeeze! {sub_name} still locked..."
            elif def_choice == 'technical_escape':
                esc_chance = max(0.15, 0.70 - squeeze_count * 0.10)
                if random.random() < esc_chance:
                    desc += f" | {defender['name']} technical escapes!"
                    log.append(desc)
                    return None, 'escaped_position', log, att_gp, def_gp
                elif random.random() < tap_chance:
                    desc += f" | Escape fails! {attacker['name']} finishes {sub_name}! TAP!"
                    log.append(desc)
                    return attacker['id'], f'Submission - {sub_name}', log, att_gp, def_gp
                else:
                    desc += f" | Escape fails but survives..."
            elif def_choice == 'sweep_scramble':
                if random.random() < 0.50:
                    desc += f" | {defender['name']} sweeps out!"
                    log.append(desc)
                    return None, 'escaped_scramble', log, att_gp, def_gp
                elif random.random() < tap_chance + 0.10:
                    desc += f" | Sweep fails! {attacker['name']} finishes! TAP!"
                    log.append(desc)
                    return attacker['id'], f'Submission - {sub_name}', log, att_gp, def_gp
                else:
                    desc += f" | Sweep fails, still locked..."
            elif def_choice == 'reversal_sub':
                if random.random() < 0.30:
                    desc += f" | {defender['name']} REVERSES! Tables turned!"
                    log.append(desc)
                    # Swap roles - simplified: just escape for now
                    return None, 'escaped_scramble', log, att_gp, def_gp
                elif random.random() < tap_chance + 0.15:
                    desc += f" | Reversal BACKFIRES! {attacker['name']} finishes! TAP!"
                    log.append(desc)
                    return attacker['id'], f'Submission - {sub_name}', log, att_gp, def_gp
                else:
                    desc += f" | Reversal fails, sub loosened..."
                    survive_count += 1
        
        # ADJUST
        elif att_choice == 'adjust':
            if def_choice == 'explode':
                if random.random() < 0.55:
                    desc += f" | {defender['name']} explodes during adjustment!"
                    log.append(desc)
                    return None, 'escaped_scramble', log, att_gp, def_gp
                else:
                    desc += f" | Grip adjusted, still locked."
            elif def_choice == 'survive':
                survive_count += 1
                desc += f" | Both cautious. Sub loosening..."
            elif def_choice == 'technical_escape':
                if random.random() < 0.80:
                    desc += f" | {defender['name']} escapes during adjustment!"
                    log.append(desc)
                    return None, 'escaped_position', log, att_gp, def_gp
                else:
                    desc += f" | Caught the escape, readjusted."
            elif def_choice == 'sweep_scramble':
                if random.random() < 0.60:
                    desc += f" | {defender['name']} sweeps during adjustment!"
                    log.append(desc)
                    return None, 'escaped_scramble', log, att_gp, def_gp
                else:
                    desc += f" | Sweep fails, still locked."
            elif def_choice == 'reversal_sub':
                if random.random() < 0.40:
                    desc += f" | {defender['name']} catches reversal during adjustment!"
                    log.append(desc)
                    return None, 'escaped_scramble', log, att_gp, def_gp
                else:
                    squeeze_count += 1
                    desc += f" | Reversal fails, grip tightened."
        
        # TRANSITION SUB
        elif att_choice == 'transition_sub':
            # Pick new sub
            new_subs = [t for t in graph['techniques'].values() if t['id'] in att_deck and t['type'] == 'submission' and t['id'] != match.get('sub_technique_id')]
            if new_subs:
                new_sub = random.choice(new_subs)
                sub_name = new_sub['name']
                match['sub_technique_id'] = new_sub['id']
                squeeze_count = 1; survive_count = 0
                desc += f" | Chains into {sub_name}!"
                if def_choice == 'survive' and random.random() < 0.35:
                    desc += f" Caught off guard - TAP!"
                    log.append(desc)
                    return attacker['id'], f'Submission chain - {sub_name}', log, att_gp, def_gp
            else:
                squeeze_count += 1
                desc += f" | No transition available, tightened grip."
        
        log.append(desc)
    
    # 5 turns of minigame without finish = sub loosened, escape
    log.append(f"  {sub_name} loosened over time. {defender['name']} escapes!")
    return None, 'escaped_timeout', log, att_gp, def_gp


# ===== ELO =====
def calc_elo(winner_elo, loser_elo, k=32):
    expected = 1.0 / (1.0 + 10 ** ((loser_elo - winner_elo) / 400.0))
    delta = round(k * (1.0 - expected))
    return delta, -delta


# ===== MATCH RUNNER =====
def run_match(graph, p1, p2, p1_deck, p2_deck, match_num):
    print(f'\n{"="*60}')
    print(f'  Match {match_num}: {p1["name"]} ({p1["archetype"]}) vs {p2["name"]} ({p2["archetype"]})')
    print(f'{"="*60}')

    # Get current Elo
    p1_profile = db_get('profiles', f'id=eq.{p1["id"]}&select=elo')
    p2_profile = db_get('profiles', f'id=eq.{p2["id"]}&select=elo')
    p1_elo = p1_profile[0]['elo'] if p1_profile else 1200
    p2_elo = p2_profile[0]['elo'] if p2_profile else 1200

    # Create match directly
    match_id = str(uuid.uuid4())
    match = {
        'id': match_id,
        'player1_id': p1['id'], 'player2_id': p2['id'],
        'status': 'active', 'match_type': 'ranked',
        'current_position': 'standing_neutral',
        'player1_position': 'standing_neutral', 'player2_position': 'standing_neutral',
        'player1_points': 0, 'player2_points': 0,
        'current_turn': 0, 'max_turns': 30,
        'player1_elo_before': p1_elo, 'player2_elo_before': p2_elo,
        'turn_phase': 'stance',
        'player1_feints_remaining': 3, 'player2_feints_remaining': 3,
        'player1_gp': 10, 'player2_gp': 10,
        'player1_chain': 0, 'player2_chain': 0,
    }
    result = db_insert('matches', match)
    if not result:
        print('  ERROR: Failed to create match')
        return None

    counters = graph['counters']

    for turn in range(1, 31):
        p1_pos = match['player1_position']
        p2_pos = match['player2_position']
        p1_status = get_status(graph, p1_pos, p1['archetype'])
        p2_status = get_status(graph, p2_pos, p2['archetype'])
        p1_gp = match['player1_gp']
        p2_gp = match['player2_gp']

        # Pick stances (GP-aware)
        p1_stance = ai_pick_stance(p1_status, p1_gp)
        p2_stance = ai_pick_stance(p2_status, p2_gp)

        # Pick moves (GP-aware)
        p1_move_id, p1_is_counter = ai_pick_move(graph, p1_pos, p1['belt'], p1_deck, p1['archetype'], p2_stance, counters, p2_pos, p2['archetype'], p1_gp)
        p2_move_id, p2_is_counter = ai_pick_move(graph, p2_pos, p2['belt'], p2_deck, p2['archetype'], p1_stance, counters, p1_pos, p1['archetype'], p2_gp)

        # Store stances in match for resolver
        match['player1_stance'] = p1_stance
        match['player2_stance'] = p2_stance

        # Resolve locally
        outcome = resolve_turn_local(graph, match, p1_move_id, p1_is_counter, p2_move_id, p2_is_counter, p1, p2)

        # Update match state
        match['current_turn'] = turn
        match['current_position'] = outcome['new_pos']
        match['player1_position'] = outcome['new_p1']
        match['player2_position'] = outcome['new_p2']
        match['player1_points'] += outcome['p1_pts']
        match['player2_points'] += outcome['p2_pts']
        match['player1_gp'] = outcome.get('p1_gp', match['player1_gp'])
        match['player2_gp'] = outcome.get('p2_gp', match['player2_gp'])
        match['player1_chain'] = outcome.get('p1_chain', 0)
        match['player2_chain'] = outcome.get('p2_chain', 0)

        # Record turn in DB
        db_insert('match_turns', {
            'match_id': match_id, 'turn_number': turn,
            'player1_move': p1_move_id, 'player1_move_is_counter': p1_is_counter,
            'player2_move': p2_move_id, 'player2_move_is_counter': p2_is_counter,
            'result': outcome['result_type'], 'winner_id': outcome['winner'],
            'new_position': outcome['new_pos'] or match['current_position'],
            'player1_points_delta': outcome['p1_pts'], 'player2_points_delta': outcome['p2_pts'],
            'description': outcome['desc'],
            'player1_stance': p1_stance, 'player2_stance': p2_stance,
            'player1_gp_before': match.get('player1_gp', 10), 'player2_gp_before': match.get('player2_gp', 10),
            'player1_gp_cost': outcome.get('p1_gp_cost', 0), 'player2_gp_cost': outcome.get('p2_gp_cost', 0),
            'player1_chain': outcome.get('p1_chain', 0), 'player2_chain': outcome.get('p2_chain', 0),
        })

        # Print
        p1mn = graph['techniques'].get(p1_move_id, graph['counters'].get(p1_move_id, {}))
        p2mn = graph['techniques'].get(p2_move_id, graph['counters'].get(p2_move_id, {}))
        p1n = p1mn.get('name', p1_move_id) if isinstance(p1mn, dict) else p1_move_id
        p2n = p2mn.get('name', p2_move_id) if isinstance(p2mn, dict) else p2_move_id
        print(f'  T{turn:2d} | {p1_stance:6s} vs {p2_stance:6s} | {p1n:30s} vs {p2n}')
        print(f'       {outcome["desc"]}')
        print(f'       Score: {match["player1_points"]}-{match["player2_points"]} | GP:{match["player1_gp"]}/{match["player2_gp"]} | Chain:{match.get("player1_chain",0)}/{match.get("player2_chain",0)} | {p1["name"]}[{p1_status}] vs {p2["name"]}[{p2_status}]')

        # Check submission entry → minigame
        if outcome.get('start_minigame'):
            att = outcome['mg_attacker']
            defend = outcome['mg_defender']
            mg_tech = outcome['mg_tech']
            match['sub_technique_id'] = mg_tech['id']
            att_deck_ids = p1_deck if att['id'] == p1['id'] else p2_deck
            def_deck_ids = p2_deck if att['id'] == p1['id'] else p1_deck
            match['att_gp'] = match['player1_gp'] if att['id'] == p1['id'] else match['player2_gp']
            match['def_gp'] = match['player2_gp'] if att['id'] == p1['id'] else match['player1_gp']
            
            print(f'       >>> SUB MINIGAME: {att["name"]} locks {mg_tech["name"]} on {defend["name"]}!')
            mg_winner, mg_method, mg_log, mg_att_gp, mg_def_gp = resolve_sub_minigame_local(
                match, att, defend, graph, att_deck_ids, def_deck_ids)
            for line in mg_log:
                print(f'       {line}')
            
            # Update GP after minigame
            if att['id'] == p1['id']:
                match['player1_gp'] = mg_att_gp; match['player2_gp'] = mg_def_gp
            else:
                match['player2_gp'] = mg_att_gp; match['player1_gp'] = mg_def_gp
            
            if mg_winner:
                winner_id = mg_winner
                method = mg_method
                # Record minigame turns in DB
                db_insert('match_turns', {
                    'match_id': match_id, 'turn_number': turn,
                    'player1_move': p1_move_id, 'player1_move_is_counter': p1_is_counter,
                    'player2_move': p2_move_id, 'player2_move_is_counter': p2_is_counter,
                    'description': f'SUB MINIGAME: {mg_method} | ' + ' | '.join([l.strip() for l in mg_log[-2:]]),
                    'result': 'submission_win', 'winner_id': mg_winner,
                    'new_position': match['current_position'],
                    'player1_points_delta': 0, 'player2_points_delta': 0,
                    'player1_gp_before': match['player1_gp'], 'player2_gp_before': match['player2_gp'],
                })
                break
            else:
                # Escaped - reset to scramble or position
                if 'scramble' in mg_method:
                    match['current_position'] = 'scramble'
                    match['player1_position'] = 'scramble'
                    match['player2_position'] = 'scramble'
                match['player1_chain'] = 0; match['player2_chain'] = 0
                print(f'       >>> {defend["name"]} escapes! Back to the match.')
                continue
        
        if outcome.get('sub_win'):
            winner_id = outcome['sub_win']
            method = 'Submission - ' + (graph['techniques'].get(p1_move_id, {}).get('name', '?') if winner_id == p1['id'] else graph['techniques'].get(p2_move_id, {}).get('name', '?'))
            break
    else:
        # 30 turns done - points decision
        if match['player1_points'] > match['player2_points']:
            winner_id = p1['id']
            method = f"Points - {match['player1_points']} to {match['player2_points']}"
        elif match['player2_points'] > match['player1_points']:
            winner_id = p2['id']
            method = f"Points - {match['player2_points']} to {match['player1_points']}"
        else:
            winner_id = None
            method = 'Draw'

    # Calculate Elo
    if winner_id:
        w_elo = p1_elo if winner_id == p1['id'] else p2_elo
        l_elo = p2_elo if winner_id == p1['id'] else p1_elo
        w_delta, l_delta = calc_elo(w_elo, l_elo)
        p1_delta = w_delta if winner_id == p1['id'] else l_delta
        p2_delta = l_delta if winner_id == p1['id'] else w_delta
    else:
        p1_delta = p2_delta = 0

    # Update match in DB
    db_update('matches', f'id=eq.{match_id}', {
        'status': 'finished', 'winner_id': winner_id, 'win_method': method,
        'current_turn': match['current_turn'],
        'current_position': match['current_position'],
        'player1_position': match['player1_position'], 'player2_position': match['player2_position'],
        'player1_points': match['player1_points'], 'player2_points': match['player2_points'],
        'player1_elo_delta': p1_delta, 'player2_elo_delta': p2_delta,
        'finished_at': datetime.now(timezone.utc).isoformat()
    })

    # Update player Elos
    if winner_id:
        db_update('profiles', f'id=eq.{p1["id"]}', {
            'elo': p1_elo + p1_delta,
            'matches_played': db_get('profiles', f'id=eq.{p1["id"]}&select=matches_played')[0]['matches_played'] + 1,
            'matches_won': db_get('profiles', f'id=eq.{p1["id"]}&select=matches_won')[0]['matches_won'] + (1 if winner_id == p1['id'] else 0),
        })
        db_update('profiles', f'id=eq.{p2["id"]}', {
            'elo': p2_elo + p2_delta,
            'matches_played': db_get('profiles', f'id=eq.{p2["id"]}&select=matches_played')[0]['matches_played'] + 1,
            'matches_won': db_get('profiles', f'id=eq.{p2["id"]}&select=matches_won')[0]['matches_won'] + (1 if winner_id == p2['id'] else 0),
        })

    winner_name = p1['name'] if winner_id == p1['id'] else (p2['name'] if winner_id == p2['id'] else 'Draw')
    print(f'\n  RESULT: {winner_name} wins by {method}')
    print(f'  Score: {match["player1_points"]}-{match["player2_points"]} in {match["current_turn"]} turns')
    print(f'  Elo: {p1["name"]} {p1_elo + p1_delta} ({p1_delta:+d}) | {p2["name"]} {p2_elo + p2_delta} ({p2_delta:+d})')

    return {
        'match_id': match_id,
        'p1_name': p1['name'], 'p1_archetype': p1['archetype'],
        'p2_name': p2['name'], 'p2_archetype': p2['archetype'],
        'winner': winner_name, 'method': method,
        'turns': match['current_turn'],
        'p1_points': match['player1_points'], 'p2_points': match['player2_points'],
        'p1_elo_delta': p1_delta, 'p2_elo_delta': p2_delta,
    }


# ===== MAIN =====
def main():
    print('='*60)
    print('  OPEN MAT - AI BOT ENGINE v2')
    print('='*60)

    print(f'\nLoading graph...')
    graph = load_graph()
    print(f'  {len(graph["positions"])} positions, {len(graph["techniques"])} techniques, {len(graph["counters"])} counters')

    print(f'\nLoading decks...')
    decks = {}
    for ai in AI_PLAYERS:
        stacks = db_get('player_move_stacks', f'profile_id=eq.{ai["id"]}&select=technique_id')
        decks[ai['id']] = [s['technique_id'] for s in stacks]
        print(f'  {ai["name"]}: {len(decks[ai["id"]])} techniques')

    print(f'\nRunning {NUM_MATCHES} matches...')
    results = []
    for i in range(NUM_MATCHES):
        p1, p2 = random.sample(AI_PLAYERS, 2)
        r = run_match(graph, p1, p2, decks[p1['id']], decks[p2['id']], i + 1)
        if r: results.append(r)
        time.sleep(0.2)

    # Summary
    print(f'\n{"="*60}')
    print(f'  TOURNAMENT SUMMARY - {len(results)} matches')
    print(f'{"="*60}')

    arch_stats = {}
    for r in results:
        for prefix, arch, name in [('p1', r['p1_archetype'], r['p1_name']), ('p2', r['p2_archetype'], r['p2_name'])]:
            if arch not in arch_stats:
                arch_stats[arch] = {'name': name, 'wins': 0, 'losses': 0, 'draws': 0, 'subs': 0}
            if r['winner'] == name:
                arch_stats[arch]['wins'] += 1
                if 'Submission' in r['method']: arch_stats[arch]['subs'] += 1
            elif r['winner'] == 'Draw':
                arch_stats[arch]['draws'] += 1
            else:
                arch_stats[arch]['losses'] += 1

    print(f'\n  {"Archetype":<20s} {"W":>3s} {"L":>3s} {"D":>3s} {"Win%":>5s} {"Subs":>4s}')
    print(f'  {"-"*40}')
    for arch in sorted(arch_stats.keys()):
        s = arch_stats[arch]
        total = s['wins'] + s['losses'] + s['draws']
        wr = round(s['wins'] / total * 100) if total > 0 else 0
        print(f'  {arch:<20s} {s["wins"]:3d} {s["losses"]:3d} {s["draws"]:3d} {wr:4d}% {s["subs"]:4d}')

    print(f'\n  Elo Standings:')
    for p in sorted(db_get('profiles', 'username=like.ai_*&select=display_name,archetype,elo&order=elo.desc'), key=lambda x: -x['elo']):
        print(f'  {p["display_name"]:<20s} {p["archetype"]:<20s} {p["elo"]}')

    if results:
        fn = f'ai_matches_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        with open(fn, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=results[0].keys())
            w.writeheader()
            w.writerows(results)
        print(f'\n  Saved to {fn}')


if __name__ == '__main__':
    main()
