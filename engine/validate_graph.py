import json
import sys

import os
script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, 'positional_graph.json'), 'r') as f:
    graph = json.load(f)

positions = {p['id']: p for p in graph['positions']}
techniques = {t['id']: t for t in graph['techniques']}
counters = {c['id']: c for c in graph['counter_techniques']}

errors = []
warnings = []

# --- Basic counts ---
print("=" * 60)
print("OPEN MAT — POSITIONAL GRAPH VALIDATION REPORT")
print("=" * 60)
print(f"\nTotal Positions (Nodes): {len(positions)}")
print(f"Total Techniques (Edges): {len(techniques)}")
print(f"Total Counter Techniques: {len(counters)}")

# --- Count by type ---
by_type = {}
for t in graph['techniques']:
    by_type.setdefault(t['type'], []).append(t)

print(f"\nTechniques by Type:")
for ttype, tlist in sorted(by_type.items()):
    print(f"  {ttype}: {len(tlist)}")

submissions = [t for t in graph['techniques'] if t['type'] == 'submission']
print(f"\nTotal Submissions (Terminal Edges): {len(submissions)}")

# --- Count by family ---
by_family = {}
for p in graph['positions']:
    by_family.setdefault(p['family'], []).append(p)

print(f"\nPositions by Family:")
for fam, plist in sorted(by_family.items()):
    print(f"  {fam}: {len(plist)}")

# --- Count by belt ---
by_belt = {}
for t in graph['techniques']:
    by_belt.setdefault(t['belt_unlock'], []).append(t)

print(f"\nTechniques by Belt Unlock:")
for belt in ['white', 'blue', 'purple', 'brown', 'black']:
    count = len(by_belt.get(belt, []))
    print(f"  {belt}: {count}")

# --- Check technique references ---
print(f"\n{'=' * 60}")
print("REFERENCE INTEGRITY CHECKS")
print("=" * 60)

for t in graph['techniques']:
    # Check 'from' exists
    if t['from'] not in positions:
        errors.append(f"Technique '{t['id']}' references non-existent FROM position: '{t['from']}'")
    # Check 'to' exists (null = submission terminal)
    if t['to'] is not None and t['to'] not in positions:
        errors.append(f"Technique '{t['id']}' references non-existent TO position: '{t['to']}'")
    # Check counters exist
    for c in t.get('counters', []):
        if c not in counters and c not in techniques:
            warnings.append(f"Technique '{t['id']}' references counter '{c}' not found in counter_techniques or techniques")

# --- Check position_pairs ---
for top, bottom in graph['position_pairs'].items():
    if top != '_note':
        if top not in positions:
            errors.append(f"Position pair references non-existent position: '{top}'")
        if bottom not in positions:
            errors.append(f"Position pair references non-existent position: '{bottom}'")

# --- Check archetype starter decks ---
for arch_id, arch in graph['archetype_definitions'].items():
    for tid in arch['starter_techniques']:
        if tid not in techniques:
            errors.append(f"Archetype '{arch_id}' references non-existent starter technique: '{tid}'")

# --- Check for orphan positions (no edges in or out) ---
positions_with_edges = set()
for t in graph['techniques']:
    positions_with_edges.add(t['from'])
    if t['to'] is not None:
        positions_with_edges.add(t['to'])

orphans = set(positions.keys()) - positions_with_edges
if orphans:
    for o in orphans:
        warnings.append(f"Orphan position (no techniques connect to/from): '{o}'")

# --- Check for dead-end positions (can reach but can't leave, excluding pure bottom positions) ---
positions_with_outgoing = set()
for t in graph['techniques']:
    positions_with_outgoing.add(t['from'])

# Positions you can reach but have no way out
reachable = set()
for t in graph['techniques']:
    if t['to'] is not None:
        reachable.add(t['to'])

dead_ends = reachable - positions_with_outgoing
for d in dead_ends:
    p = positions.get(d)
    if p and not p['name'].endswith('(Defending)') and not p['name'].endswith('(Bottom)'):
        warnings.append(f"Potential dead-end position (reachable but no outgoing techniques): '{d}' ({p['name']})")

# --- Report ---
print(f"\nErrors: {len(errors)}")
for e in errors:
    print(f"  [ERROR] {e}")

print(f"\nWarnings: {len(warnings)}")
for w in warnings:
    print(f"  [WARN] {w}")

# --- Connectivity summary ---
print(f"\n{'=' * 60}")
print("CONNECTIVITY SUMMARY")
print("=" * 60)

for pid, p in sorted(positions.items()):
    outgoing = [t for t in graph['techniques'] if t['from'] == pid]
    incoming = [t for t in graph['techniques'] if t['to'] == pid]
    sub_threats = [t for t in outgoing if t['type'] == 'submission']
    print(f"  {p['name']}")
    print(f"    Out: {len(outgoing)} | In: {len(incoming)} | Subs: {len(sub_threats)}")

# Final
print(f"\n{'=' * 60}")
if not errors:
    print("GRAPH VALIDATION PASSED — No critical errors.")
else:
    print(f"GRAPH VALIDATION FAILED — {len(errors)} errors found.")
print(f"{len(warnings)} warnings to review.")
print("=" * 60)
