"""
Open Mat — Core Game Loop / Move Resolution Engine
====================================================
Server-side only. Never run client-side (prevents cheating).

Core concept:
  - Both players simultaneously select a move from their available options
  - Moves are revealed and resolved based on the positional graph
  - Resolution determines: new position, points awarded, or submission (instant win)

Resolution priority:
  1. Submission vs wrong/no counter = INSTANT WIN
  2. Submission vs correct counter = submission defended, position holds
  3. Technique vs counter = counter wins, position changes accordingly
  4. Both play transitions = attacker's move resolves (dominant player is attacker)
  5. Both play neutral moves = position holds, turn spent

Design decisions:
  - The player in the DOMINANT position is the "attacker" for resolution ties
  - Counter must be SPECIFIC — no universal escape button
  - Position pairs ensure both players always know their perspective
  - Points accumulate per ADCC rules (takedown, sweep, mount, back, KOB)
"""

import json
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from copy import deepcopy


# ============================================================
# ENUMS
# ============================================================

class MatchPhase(Enum):
    WAITING = "waiting"           # Lobby, waiting for opponent
    ACTIVE = "active"             # Normal play
    OVERTIME = "overtime"         # Sudden death, submissions only
    FINISHED = "finished"         # Match over

class MoveType(Enum):
    TRANSITION = "transition"
    SUBMISSION = "submission"
    SWEEP = "sweep"
    TAKEDOWN = "takedown"
    ESCAPE = "escape"

class TurnResult(Enum):
    POSITION_CHANGE = "position_change"
    SUBMISSION_WIN = "submission_win"
    SUBMISSION_DEFENDED = "submission_defended"
    COUNTER_SUCCESS = "counter_success"
    HOLD_POSITION = "hold_position"
    SCRAMBLE = "scramble"


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class Player:
    id: str
    name: str
    belt: str
    archetype: str
    elo: int = 1200
    move_stack: list = field(default_factory=list)   # technique IDs in their deck
    points: int = 0
    position_id: str = ""                            # current position node

@dataclass
class MoveSelection:
    player_id: str
    technique_id: str       # the technique or counter they chose
    is_counter: bool = False  # True if this is a defensive counter selection

@dataclass
class TurnOutcome:
    turn_number: int
    result: TurnResult
    p1_move: str            # technique ID player 1 chose
    p2_move: str            # technique ID player 2 chose
    winner_id: Optional[str] = None         # who won this exchange (if applicable)
    new_position_id: Optional[str] = None   # resulting position
    p1_points_delta: int = 0
    p2_points_delta: int = 0
    description: str = ""   # human-readable narration of what happened
    submission_by: Optional[str] = None     # player ID if submission win

@dataclass
class MatchState:
    match_id: str
    player1: Player
    player2: Player
    current_position: str = "standing_neutral"
    turn: int = 0
    max_turns: int = 30
    phase: MatchPhase = MatchPhase.ACTIVE
    overtime_turns: int = 0
    max_overtime: int = 5
    history: list = field(default_factory=list)    # list of TurnOutcome
    winner_id: Optional[str] = None
    win_method: str = ""


# ============================================================
# GRAPH LOADER
# ============================================================

class PositionalGraph:
    """Loads and indexes the positional graph for fast lookups."""

    def __init__(self, graph_path: str):
        with open(graph_path, 'r') as f:
            data = json.load(f)

        self.positions = {p['id']: p for p in data['positions']}
        self.techniques = {t['id']: t for t in data['techniques']}
        self.counters = {c['id']: c for c in data['counter_techniques']}
        self.position_pairs = data.get('position_pairs', {})
        self.belt_order = {b: info['order'] for b, info in data['belt_progression'].items()}
        self.archetypes = data.get('archetype_definitions', {})

        # Build reverse pair map (both directions)
        self._pair_map = {}
        for a, b in self.position_pairs.items():
            if a == '_note':
                continue
            self._pair_map[a] = b
            self._pair_map[b] = a

        # Index: techniques available FROM each position
        self.techniques_from = {}
        for t in data['techniques']:
            self.techniques_from.setdefault(t['from'], []).append(t)

        # Index: techniques that lead TO each position
        self.techniques_to = {}
        for t in data['techniques']:
            if t['to'] is not None:
                self.techniques_to.setdefault(t['to'], []).append(t)

    def get_paired_position(self, position_id: str) -> Optional[str]:
        """Get the other player's perspective of a position."""
        return self._pair_map.get(position_id)

    def get_available_moves(self, position_id: str, player_belt: str,
                            move_stack: list, overtime: bool = False) -> list:
        """
        Get moves available to a player at a position, filtered by:
          - Position validity (technique must originate from this position)
          - Belt level (technique must be unlocked at player's belt)
          - Move stack (technique must be in player's deck)
          - Overtime mode (submissions only)
        """
        belt_level = self.belt_order.get(player_belt, 1)
        all_moves = self.techniques_from.get(position_id, [])

        available = []
        for t in all_moves:
            # Belt check
            tech_belt = self.belt_order.get(t['belt_unlock'], 1)
            if tech_belt > belt_level:
                continue
            # Deck check
            if t['id'] not in move_stack:
                continue
            # Overtime: submissions only
            if overtime and t['type'] != 'submission':
                continue
            available.append(t)

        return available

    def get_counter_options(self, technique_id: str, player_belt: str,
                            move_stack: list) -> list:
        """
        Get valid counters a player can use against a specific incoming technique.
        Counter must be:
          - Listed in the technique's counters array
          - In the player's move stack OR in the universal counter_techniques list
        """
        technique = self.techniques.get(technique_id)
        if not technique:
            return []

        belt_level = self.belt_order.get(player_belt, 1)
        valid_counters = []

        for counter_id in technique.get('counters', []):
            # Check if it's a universal counter (always available)
            if counter_id in self.counters:
                valid_counters.append({
                    'id': counter_id,
                    'name': self.counters[counter_id]['name'],
                    'description': self.counters[counter_id]['description'],
                    'is_universal': True
                })
            # Check if it's a technique in their deck
            elif counter_id in self.techniques:
                t = self.techniques[counter_id]
                tech_belt = self.belt_order.get(t['belt_unlock'], 1)
                if tech_belt <= belt_level and counter_id in move_stack:
                    valid_counters.append({
                        'id': counter_id,
                        'name': t['name'],
                        'description': f"Counter with {t['name']}",
                        'is_universal': False
                    })

        return valid_counters


# ============================================================
# MOVE RESOLUTION ENGINE
# ============================================================

class MoveResolver:
    """
    The core resolution engine. Takes two simultaneous moves and determines
    the outcome based on the positional graph rules.

    Resolution flow:
    1. Validate both moves are legal from current position
    2. Determine who is attacker vs defender (dominant position = attacker)
    3. Resolve based on move type interactions
    4. Calculate points and new position
    5. Check for submission / match end
    """

    def __init__(self, graph: PositionalGraph):
        self.graph = graph

    def resolve_turn(self, state: MatchState, p1_move: MoveSelection,
                     p2_move: MoveSelection) -> TurnOutcome:
        """
        Main resolution function. Takes current match state and both
        players' move selections, returns the turn outcome.
        """
        # Determine who is in which position perspective
        pos = self.graph.positions[state.current_position]
        paired = self.graph.get_paired_position(state.current_position)

        # Determine attacker/defender
        # The player whose current position is_dominant is the attacker
        # For neutral positions, P1 (first listed) gets slight priority
        p1_pos_id = state.player1.position_id
        p2_pos_id = state.player2.position_id

        p1_is_dominant = self.graph.positions.get(p1_pos_id, {}).get('is_dominant', False)
        p2_is_dominant = self.graph.positions.get(p2_pos_id, {}).get('is_dominant', False)

        # Get the actual techniques
        p1_tech = self.graph.techniques.get(p1_move.technique_id)
        p2_tech = self.graph.techniques.get(p2_move.technique_id)

        # Handle counter selections (defensive moves from counter_techniques list)
        p1_is_counter = p1_move.is_counter or p1_move.technique_id in self.graph.counters
        p2_is_counter = p2_move.is_counter or p2_move.technique_id in self.graph.counters

        # ---- CASE 1: Both players attempt submissions ----
        if (p1_tech and p1_tech['type'] == 'submission' and
            p2_tech and p2_tech['type'] == 'submission'):
            return self._resolve_double_submission(state, p1_move, p2_move,
                                                    p1_is_dominant)

        # ---- CASE 2: P1 attempts submission, P2 defends ----
        if p1_tech and p1_tech['type'] == 'submission':
            return self._resolve_submission_attempt(
                state, attacker=state.player1, defender=state.player2,
                sub_move=p1_move, defense_move=p2_move,
                defense_is_counter=p2_is_counter)

        # ---- CASE 3: P2 attempts submission, P1 defends ----
        if p2_tech and p2_tech['type'] == 'submission':
            return self._resolve_submission_attempt(
                state, attacker=state.player2, defender=state.player1,
                sub_move=p2_move, defense_move=p1_move,
                defense_is_counter=p1_is_counter)

        # ---- CASE 4: One attacks, one counters ----
        if not p1_is_counter and p2_is_counter:
            return self._resolve_attack_vs_counter(
                state, attacker=state.player1, defender=state.player2,
                attack_move=p1_move, counter_move=p2_move)

        if p1_is_counter and not p2_is_counter:
            return self._resolve_attack_vs_counter(
                state, attacker=state.player2, defender=state.player1,
                attack_move=p2_move, counter_move=p1_move)

        # ---- CASE 5: Both play transitions / non-submission moves ----
        return self._resolve_both_transition(state, p1_move, p2_move,
                                              p1_is_dominant)

    def _resolve_submission_attempt(self, state: MatchState,
                                     attacker: Player, defender: Player,
                                     sub_move: MoveSelection,
                                     defense_move: MoveSelection,
                                     defense_is_counter: bool) -> TurnOutcome:
        """
        Attacker attempts submission. Defender either:
          a) Plays the CORRECT counter → submission defended, position holds
          b) Plays WRONG counter or non-counter → SUBMISSION WINS (instant)
        """
        sub_tech = self.graph.techniques[sub_move.technique_id]
        valid_counters = [c for c in sub_tech.get('counters', [])]

        # Check if defender's move is a valid counter to this specific submission
        defender_countered = defense_move.technique_id in valid_counters

        if defender_countered:
            # Submission defended — position holds
            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.SUBMISSION_DEFENDED,
                p1_move=sub_move.technique_id if attacker.id == state.player1.id else defense_move.technique_id,
                p2_move=defense_move.technique_id if attacker.id == state.player1.id else sub_move.technique_id,
                new_position_id=state.current_position,
                description=f"{defender.name} defends {sub_tech['name']}! Position holds."
            )
        else:
            # SUBMISSION WINS — match over
            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.SUBMISSION_WIN,
                p1_move=sub_move.technique_id if attacker.id == state.player1.id else defense_move.technique_id,
                p2_move=defense_move.technique_id if attacker.id == state.player1.id else sub_move.technique_id,
                winner_id=attacker.id,
                submission_by=attacker.id,
                new_position_id=state.current_position,
                description=f"{attacker.name} hits {sub_tech['name']}! TAP! Match over."
            )

    def _resolve_double_submission(self, state: MatchState,
                                    p1_move: MoveSelection,
                                    p2_move: MoveSelection,
                                    p1_is_dominant: bool) -> TurnOutcome:
        """
        Both players attempt submissions simultaneously.
        Resolution: dominant position's submission takes priority.
        If neutral: both cancel out, position holds.
        """
        p1_tech = self.graph.techniques[p1_move.technique_id]
        p2_tech = self.graph.techniques[p2_move.technique_id]

        if p1_is_dominant:
            # P1's sub takes priority — check if P2's move happens to counter it
            if p2_move.technique_id in p1_tech.get('counters', []):
                return TurnOutcome(
                    turn_number=state.turn,
                    result=TurnResult.SUBMISSION_DEFENDED,
                    p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                    new_position_id=state.current_position,
                    description=f"Both go for submissions! {state.player2.name}'s {p2_tech['name']} incidentally defends {p1_tech['name']}."
                )
            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.SUBMISSION_WIN,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                winner_id=state.player1.id, submission_by=state.player1.id,
                new_position_id=state.current_position,
                description=f"Both go for submissions! {state.player1.name}'s {p1_tech['name']} from dominant position wins! TAP!"
            )
        elif not p1_is_dominant:
            # P2 is dominant
            if p1_move.technique_id in p2_tech.get('counters', []):
                return TurnOutcome(
                    turn_number=state.turn,
                    result=TurnResult.SUBMISSION_DEFENDED,
                    p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                    new_position_id=state.current_position,
                    description=f"Both go for submissions! {state.player1.name}'s {p1_tech['name']} incidentally defends {p2_tech['name']}."
                )
            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.SUBMISSION_WIN,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                winner_id=state.player2.id, submission_by=state.player2.id,
                new_position_id=state.current_position,
                description=f"Both go for submissions! {state.player2.name}'s {p2_tech['name']} from dominant position wins! TAP!"
            )
        else:
            # Truly neutral — both cancel
            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.HOLD_POSITION,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                new_position_id=state.current_position,
                description=f"Both go for submissions simultaneously! Neither lands — scramble back to position."
            )

    def _resolve_attack_vs_counter(self, state: MatchState,
                                    attacker: Player, defender: Player,
                                    attack_move: MoveSelection,
                                    counter_move: MoveSelection) -> TurnOutcome:
        """
        One player attacks with a technique, the other plays a counter.
        If counter is valid for that technique → counter succeeds, position holds or improves for defender.
        If counter is invalid → attack goes through.
        """
        attack_tech = self.graph.techniques.get(attack_move.technique_id)
        if not attack_tech:
            # Attacker played something invalid — position holds
            return TurnOutcome(
                turn_number=state.turn, result=TurnResult.HOLD_POSITION,
                p1_move=attack_move.technique_id if attacker.id == state.player1.id else counter_move.technique_id,
                p2_move=counter_move.technique_id if attacker.id == state.player1.id else attack_move.technique_id,
                new_position_id=state.current_position,
                description="Invalid move — position holds."
            )

        valid_counters = attack_tech.get('counters', [])
        counter_success = counter_move.technique_id in valid_counters

        is_p1_attacker = attacker.id == state.player1.id

        if counter_success:
            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.COUNTER_SUCCESS,
                p1_move=attack_move.technique_id if is_p1_attacker else counter_move.technique_id,
                p2_move=counter_move.technique_id if is_p1_attacker else attack_move.technique_id,
                winner_id=defender.id,
                new_position_id=state.current_position,
                description=f"{defender.name} reads the {attack_tech['name']} and counters! Position holds."
            )
        else:
            # Attack goes through
            new_pos = attack_tech['to'] if attack_tech['to'] else state.current_position
            pts = attack_tech.get('points_awarded', 0)
            p1_pts = pts if is_p1_attacker else 0
            p2_pts = 0 if is_p1_attacker else pts

            return TurnOutcome(
                turn_number=state.turn,
                result=TurnResult.POSITION_CHANGE,
                p1_move=attack_move.technique_id if is_p1_attacker else counter_move.technique_id,
                p2_move=counter_move.technique_id if is_p1_attacker else attack_move.technique_id,
                winner_id=attacker.id,
                new_position_id=new_pos,
                p1_points_delta=p1_pts, p2_points_delta=p2_pts,
                description=f"{attacker.name} hits {attack_tech['name']}! {f'{pts} points!' if pts > 0 else ''}"
            )

    def _resolve_both_transition(self, state: MatchState,
                                  p1_move: MoveSelection,
                                  p2_move: MoveSelection,
                                  p1_is_dominant: bool) -> TurnOutcome:
        """
        Both players play non-submission, non-counter moves.
        Resolution priority: dominant player's move resolves.
        If neutral: compare difficulty — higher difficulty = riskier but wins ties.
        If BOTH play counters: position holds but we track stall count.
        """
        p1_tech = self.graph.techniques.get(p1_move.technique_id)
        p2_tech = self.graph.techniques.get(p2_move.technique_id)

        p1_is_counter = p1_move.technique_id in self.graph.counters
        p2_is_counter = p2_move.technique_id in self.graph.counters

        # Both counters — nobody attacks, position holds
        # In a real game this would be "feeling each other out"
        if p1_is_counter and p2_is_counter:
            return TurnOutcome(
                turn_number=state.turn, result=TurnResult.HOLD_POSITION,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                new_position_id=state.current_position,
                description="Both players defensive — feeling each other out."
            )

        # One has a technique, the other only a counter (wrong read)
        if p1_tech and not p2_tech:
            new_pos = p1_tech['to'] if p1_tech['to'] else state.current_position
            pts = p1_tech.get('points_awarded', 0)
            return TurnOutcome(
                turn_number=state.turn, result=TurnResult.POSITION_CHANGE,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                winner_id=state.player1.id, new_position_id=new_pos,
                p1_points_delta=pts,
                description=f"{state.player1.name} executes {p1_tech['name']}! {f'{pts} points!' if pts > 0 else ''}"
            )
        if p2_tech and not p1_tech:
            new_pos = p2_tech['to'] if p2_tech['to'] else state.current_position
            pts = p2_tech.get('points_awarded', 0)
            return TurnOutcome(
                turn_number=state.turn, result=TurnResult.POSITION_CHANGE,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                winner_id=state.player2.id, new_position_id=new_pos,
                p2_points_delta=pts,
                description=f"{state.player2.name} executes {p2_tech['name']}! {f'{pts} points!' if pts > 0 else ''}"
            )

        if not p1_tech and not p2_tech:
            return TurnOutcome(
                turn_number=state.turn, result=TurnResult.HOLD_POSITION,
                p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
                new_position_id=state.current_position,
                description="Both players defensive — feeling each other out."
            )

        # Both have real techniques — resolve by dominance then difficulty
        if p1_is_dominant and p1_tech:
            winner, w_tech, loser = state.player1, p1_tech, state.player2
            is_p1_winner = True
        elif not p1_is_dominant and p2_tech:
            winner, w_tech, loser = state.player2, p2_tech, state.player1
            is_p1_winner = False
        elif p1_tech and p2_tech:
            # Neutral — higher difficulty move wins (riskier = rewards)
            # Tie-break: random coin flip to avoid deterministic stalls
            import random
            if p1_tech['difficulty'] > p2_tech['difficulty']:
                winner, w_tech, loser = state.player1, p1_tech, state.player2
                is_p1_winner = True
            elif p2_tech['difficulty'] > p1_tech['difficulty']:
                winner, w_tech, loser = state.player2, p2_tech, state.player1
                is_p1_winner = False
            elif random.random() < 0.5:
                winner, w_tech, loser = state.player1, p1_tech, state.player2
                is_p1_winner = True
            else:
                winner, w_tech, loser = state.player2, p2_tech, state.player1
                is_p1_winner = False
        elif p1_tech:
            winner, w_tech, loser = state.player1, p1_tech, state.player2
            is_p1_winner = True
        else:
            winner, w_tech, loser = state.player2, p2_tech, state.player1
            is_p1_winner = False

        # Check if the loser's move happens to counter the winner's
        if w_tech['id'] in [self.graph.techniques.get(loser_id, {}).get('id')
                            for loser_id in w_tech.get('counters', [])]:
            pass  # Already handled above in attack_vs_counter

        new_pos = w_tech['to'] if w_tech['to'] else state.current_position
        pts = w_tech.get('points_awarded', 0)

        return TurnOutcome(
            turn_number=state.turn,
            result=TurnResult.POSITION_CHANGE,
            p1_move=p1_move.technique_id, p2_move=p2_move.technique_id,
            winner_id=winner.id,
            new_position_id=new_pos,
            p1_points_delta=pts if is_p1_winner else 0,
            p2_points_delta=0 if is_p1_winner else pts,
            description=f"{winner.name} executes {w_tech['name']}! {f'{pts} points!' if pts > 0 else ''}"
        )


# ============================================================
# MATCH ENGINE
# ============================================================

class MatchEngine:
    """
    Orchestrates the full match lifecycle.
    Manages turns, applies outcomes, checks win conditions,
    handles overtime, and computes Elo changes.
    """

    def __init__(self, graph: PositionalGraph):
        self.graph = graph
        self.resolver = MoveResolver(graph)

    def create_match(self, match_id: str, player1: Player,
                     player2: Player, max_turns: int = 30) -> MatchState:
        """Initialize a new match at standing neutral."""
        player1.position_id = "standing_neutral"
        player2.position_id = "standing_neutral"
        player1.points = 0
        player2.points = 0

        return MatchState(
            match_id=match_id,
            player1=player1,
            player2=player2,
            current_position="standing_neutral",
            max_turns=max_turns,
            phase=MatchPhase.ACTIVE
        )

    def get_player_options(self, state: MatchState, player_id: str) -> dict:
        """
        Returns available moves and counter options for a player.
        This is what gets sent to the client for move selection UI.
        """
        player = state.player1 if player_id == state.player1.id else state.player2
        is_overtime = state.phase == MatchPhase.OVERTIME

        moves = self.graph.get_available_moves(
            player.position_id, player.belt, player.move_stack, is_overtime
        )

        # Also provide counter options (universal counters available to everyone)
        counters = []
        for c_id, c_data in self.graph.counters.items():
            counters.append({
                'id': c_id,
                'name': c_data['name'],
                'description': c_data['description']
            })

        return {
            'position': player.position_id,
            'position_name': self.graph.positions[player.position_id]['name'],
            'is_dominant': self.graph.positions[player.position_id].get('is_dominant', False),
            'available_moves': [
                {
                    'id': m['id'],
                    'name': m['name'],
                    'type': m['type'],
                    'to': m['to'],
                    'to_name': self.graph.positions[m['to']]['name'] if m['to'] else 'SUBMISSION',
                    'points': m['points_awarded'],
                    'difficulty': m['difficulty'],
                    'counters': m['counters']
                }
                for m in moves
            ],
            'available_counters': counters,
            'turn': state.turn,
            'phase': state.phase.value,
            'your_points': player.points,
            'opponent_points': (state.player2 if player_id == state.player1.id
                                else state.player1).points
        }

    def process_turn(self, state: MatchState,
                     p1_move: MoveSelection,
                     p2_move: MoveSelection) -> TurnOutcome:
        """
        Process a single turn. Both moves must be submitted before calling.
        Returns the outcome and mutates match state.
        """
        if state.phase == MatchPhase.FINISHED:
            raise ValueError("Match is already finished")

        state.turn += 1

        # Resolve the turn
        outcome = self.resolver.resolve_turn(state, p1_move, p2_move)

        # Apply outcome to state
        self._apply_outcome(state, outcome)

        # Check win conditions
        self._check_win_conditions(state, outcome)

        # Record history
        state.history.append(outcome)

        return outcome

    def _apply_outcome(self, state: MatchState, outcome: TurnOutcome):
        """Apply turn outcome to match state."""
        # Update points
        state.player1.points += outcome.p1_points_delta
        state.player2.points += outcome.p2_points_delta

        # Update position
        if outcome.new_position_id:
            state.current_position = outcome.new_position_id

            paired = self.graph.get_paired_position(outcome.new_position_id)
            pos = self.graph.positions.get(outcome.new_position_id, {})

            if paired:
                # Paired position — winner gets the position they earned
                # Look at the technique to determine who ends up where
                winner_is_p1 = outcome.winner_id == state.player1.id if outcome.winner_id else True

                # The technique's 'to' field tells us what position the mover ends up in
                # If the 'to' position is dominant, the mover (winner) gets it
                # If the 'to' position is bottom/defensive, the mover chose an escape TO that
                if pos.get('is_dominant', False):
                    if winner_is_p1:
                        state.player1.position_id = outcome.new_position_id
                        state.player2.position_id = paired
                    else:
                        state.player2.position_id = outcome.new_position_id
                        state.player1.position_id = paired
                else:
                    # 'to' is the non-dominant side (e.g. escape to half guard bottom)
                    # The mover goes to the 'to' position, opponent gets paired
                    if winner_is_p1:
                        state.player1.position_id = outcome.new_position_id
                        state.player2.position_id = paired
                    else:
                        state.player2.position_id = outcome.new_position_id
                        state.player1.position_id = paired
            else:
                # Non-paired position (standing_neutral, scramble, guards, passing, leg entanglements)
                # For guards: the bottom player is IN the guard, top player is passing
                # Determine based on who was the mover
                if outcome.winner_id == state.player1.id:
                    state.player1.position_id = outcome.new_position_id
                    # Opponent gets the "other side" — for guards, that means passing/top
                    # For passing positions, opponent is in guard
                    family = pos.get('family', '')
                    if family == 'guard' and not pos.get('is_dominant'):
                        # P1 pulled/recovered guard, P2 is on top trying to pass
                        state.player2.position_id = 'passing_standing_open'
                    elif family == 'passing':
                        # P1 is passing, P2 is in open guard
                        state.player2.position_id = 'guard_open_bottom'
                    elif family == 'leg_entanglement':
                        # Both in the entanglement
                        state.player2.position_id = outcome.new_position_id
                    else:
                        state.player2.position_id = outcome.new_position_id
                else:
                    state.player2.position_id = outcome.new_position_id
                    family = pos.get('family', '')
                    if family == 'guard' and not pos.get('is_dominant'):
                        state.player1.position_id = 'passing_standing_open'
                    elif family == 'passing':
                        state.player1.position_id = 'guard_open_bottom'
                    elif family == 'leg_entanglement':
                        state.player1.position_id = outcome.new_position_id
                    else:
                        state.player1.position_id = outcome.new_position_id

    def _check_win_conditions(self, state: MatchState, outcome: TurnOutcome):
        """Check if match should end."""
        # Submission = instant win
        if outcome.result == TurnResult.SUBMISSION_WIN:
            state.phase = MatchPhase.FINISHED
            state.winner_id = outcome.submission_by
            state.win_method = f"Submission — {self.graph.techniques.get(outcome.p1_move, self.graph.techniques.get(outcome.p2_move, {})).get('name', 'Unknown')}"
            return

        # Turn limit reached
        if state.phase == MatchPhase.ACTIVE and state.turn >= state.max_turns:
            if state.player1.points != state.player2.points:
                # Points winner
                state.phase = MatchPhase.FINISHED
                state.winner_id = (state.player1.id if state.player1.points > state.player2.points
                                   else state.player2.id)
                state.win_method = f"Points — {state.player1.points} to {state.player2.points}"
            else:
                # Tied — go to overtime
                state.phase = MatchPhase.OVERTIME
                state.overtime_turns = 0

        # Overtime turn limit
        if state.phase == MatchPhase.OVERTIME:
            state.overtime_turns += 1
            if state.overtime_turns >= state.max_overtime:
                # Overtime expired with no sub — decide by points, then by last attacker
                if state.player1.points != state.player2.points:
                    state.phase = MatchPhase.FINISHED
                    state.winner_id = (state.player1.id if state.player1.points > state.player2.points
                                       else state.player2.id)
                    state.win_method = f"Points after OT — {state.player1.points} to {state.player2.points}"
                else:
                    # True draw — last player to score wins
                    state.phase = MatchPhase.FINISHED
                    # Look back through history for last point scorer
                    for h in reversed(state.history):
                        if h.p1_points_delta > 0:
                            state.winner_id = state.player1.id
                            state.win_method = "Last to score"
                            return
                        if h.p2_points_delta > 0:
                            state.winner_id = state.player2.id
                            state.win_method = "Last to score"
                            return
                    # Absolute draw (no one scored ever) — draw
                    state.win_method = "Draw"

    def compute_elo_change(self, winner_elo: int, loser_elo: int,
                           k_factor: int = 32) -> tuple:
        """
        Standard chess Elo calculation.
        Returns (winner_delta, loser_delta).
        """
        expected_winner = 1.0 / (1.0 + 10 ** ((loser_elo - winner_elo) / 400.0))
        expected_loser = 1.0 - expected_winner

        winner_delta = round(k_factor * (1.0 - expected_winner))
        loser_delta = round(k_factor * (0.0 - expected_loser))

        return winner_delta, loser_delta

    def get_match_summary(self, state: MatchState) -> dict:
        """Generate end-of-match summary."""
        elo_change = (0, 0)
        if state.winner_id:
            winner = state.player1 if state.winner_id == state.player1.id else state.player2
            loser = state.player2 if state.winner_id == state.player1.id else state.player1
            elo_change = self.compute_elo_change(winner.elo, loser.elo)

        return {
            'match_id': state.match_id,
            'winner_id': state.winner_id,
            'win_method': state.win_method,
            'total_turns': state.turn,
            'final_score': {
                state.player1.id: state.player1.points,
                state.player2.id: state.player2.points
            },
            'elo_change': {
                state.player1.id: elo_change[0] if state.winner_id == state.player1.id else elo_change[1],
                state.player2.id: elo_change[1] if state.winner_id == state.player1.id else elo_change[0]
            },
            'phase': state.phase.value,
            'history': [
                {
                    'turn': h.turn_number,
                    'result': h.result.value,
                    'description': h.description,
                    'p1_move': h.p1_move,
                    'p2_move': h.p2_move,
                    'p1_points': h.p1_points_delta,
                    'p2_points': h.p2_points_delta
                }
                for h in state.history
            ]
        }


# ============================================================
# SIMULATION / TEST HARNESS
# ============================================================

def run_test_match():
    """
    Simulate a test match between a Wrestler and a Guard Puller.
    Demonstrates the full game loop.
    """
    # Load graph
    script_dir = os.path.dirname(os.path.abspath(__file__))
    graph_path = os.path.join(script_dir, 'positional_graph.json')
    graph = PositionalGraph(graph_path)

    # Create players
    wrestler = Player(
        id="p1", name="Marcus", belt="blue", archetype="wrestler", elo=1350,
        move_stack=list(graph.archetypes['wrestler']['starter_techniques'])
    )
    guard_puller = Player(
        id="p2", name="Tomás", belt="blue", archetype="guard_puller", elo=1280,
        move_stack=list(graph.archetypes['guard_puller']['starter_techniques'])
    )

    # Create match
    engine = MatchEngine(graph)
    state = engine.create_match("test_001", wrestler, guard_puller, max_turns=30)

    print("=" * 65)
    print("  OPEN MAT — TEST MATCH")
    print("=" * 65)
    print(f"  {wrestler.name} (Wrestler, {wrestler.belt} belt, Elo {wrestler.elo})")
    print(f"  vs")
    print(f"  {guard_puller.name} (Guard Puller, {guard_puller.belt} belt, Elo {guard_puller.elo})")
    print("=" * 65)

    import random
    random.seed(42)  # Deterministic for testing

    for turn in range(1, 16):  # Play 15 turns
        if state.phase == MatchPhase.FINISHED:
            break

        # Get options for each player
        p1_opts = engine.get_player_options(state, wrestler.id)
        p2_opts = engine.get_player_options(state, guard_puller.id)

        # AI: randomly pick a move (real game would be player choice)
        p1_moves = p1_opts['available_moves']
        p2_moves = p2_opts['available_moves']
        p1_counters_list = p1_opts['available_counters']
        p2_counters_list = p2_opts['available_counters']

        # Simple AI: 60% chance to pick a move, 40% to pick a counter
        if p1_moves and random.random() < 0.6:
            p1_choice = random.choice(p1_moves)
            p1_sel = MoveSelection(wrestler.id, p1_choice['id'], is_counter=False)
        elif p1_counters_list:
            p1_sel = MoveSelection(wrestler.id, random.choice(p1_counters_list)['id'], is_counter=True)
        elif p1_moves:
            p1_choice = random.choice(p1_moves)
            p1_sel = MoveSelection(wrestler.id, p1_choice['id'], is_counter=False)
        else:
            p1_sel = MoveSelection(wrestler.id, "t_base_out_defense", is_counter=True)

        if p2_moves and random.random() < 0.6:
            p2_choice = random.choice(p2_moves)
            p2_sel = MoveSelection(guard_puller.id, p2_choice['id'], is_counter=False)
        elif p2_counters_list:
            p2_sel = MoveSelection(guard_puller.id, random.choice(p2_counters_list)['id'], is_counter=True)
        elif p2_moves:
            p2_choice = random.choice(p2_moves)
            p2_sel = MoveSelection(guard_puller.id, p2_choice['id'], is_counter=False)
        else:
            p2_sel = MoveSelection(guard_puller.id, "t_base_out_defense", is_counter=True)

        # Process turn
        outcome = engine.process_turn(state, p1_sel, p2_sel)

        # Display
        p1_name = graph.techniques.get(p1_sel.technique_id, graph.counters.get(p1_sel.technique_id, {})).get('name', p1_sel.technique_id)
        p2_name = graph.techniques.get(p2_sel.technique_id, graph.counters.get(p2_sel.technique_id, {})).get('name', p2_sel.technique_id)

        print(f"\n  Turn {outcome.turn_number}")
        print(f"  ├─ {wrestler.name}: {p1_name}")
        print(f"  ├─ {guard_puller.name}: {p2_name}")
        print(f"  ├─ Result: {outcome.description}")

        pos1 = graph.positions.get(state.player1.position_id, {}).get('name', '?')
        pos2 = graph.positions.get(state.player2.position_id, {}).get('name', '?')
        print(f"  ├─ Positions: {wrestler.name}={pos1} | {guard_puller.name}={pos2}")
        print(f"  └─ Score: {wrestler.name} {state.player1.points} — {state.player2.points} {guard_puller.name}")

    # Match summary
    if state.phase != MatchPhase.FINISHED:
        # Force end
        state.phase = MatchPhase.FINISHED
        if state.player1.points > state.player2.points:
            state.winner_id = state.player1.id
            state.win_method = "Points"
        elif state.player2.points > state.player1.points:
            state.winner_id = state.player2.id
            state.win_method = "Points"
        else:
            state.win_method = "Draw"

    summary = engine.get_match_summary(state)

    print(f"\n{'=' * 65}")
    print(f"  MATCH RESULT")
    print(f"{'=' * 65}")
    if summary['winner_id']:
        winner_name = wrestler.name if summary['winner_id'] == wrestler.id else guard_puller.name
        print(f"  Winner: {winner_name}")
    else:
        print(f"  Result: Draw")
    print(f"  Method: {summary['win_method']}")
    print(f"  Final Score: {wrestler.name} {summary['final_score'][wrestler.id]} — {summary['final_score'][guard_puller.id]} {guard_puller.name}")
    print(f"  Elo Change: {wrestler.name} {summary['elo_change'][wrestler.id]:+d} | {guard_puller.name} {summary['elo_change'][guard_puller.id]:+d}")
    print(f"  Turns Played: {summary['total_turns']}")
    print(f"{'=' * 65}")


if __name__ == "__main__":
    run_test_match()
