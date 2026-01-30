#!/usr/bin/env python3
"""
Generate betting odds for head-to-head matchups
"""

import pandas as pd
import numpy as np
from collections import defaultdict
import json
import glob

# Find the latest data files
def get_latest_file(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        raise FileNotFoundError(f"No files found matching {pattern}")
    return files[-1]

# Load data
players_df = pd.read_csv(get_latest_file('data/public_players_export_*.csv'))
participants_df = pd.read_csv(get_latest_file('data/public_match_participants_export_*.csv'))

player_lookup = players_df.set_index('id')['display_name'].to_dict()

# Get all 1v1 matches (exactly 2 participants)
match_counts = participants_df.groupby('match_id').size()
one_v_one_matches = match_counts[match_counts == 2].index

participants_1v1 = participants_df[participants_df['match_id'].isin(one_v_one_matches)]

# Calculate head-to-head records
h2h_records = defaultdict(lambda: {'wins': 0, 'losses': 0})
match_groups = participants_1v1.groupby('match_id')

for match_id, group in match_groups:
    rows = list(group.itertuples())
    if len(rows) != 2:
        continue

    p1_id, p2_id = rows[0].player, rows[1].player
    p1_name = player_lookup.get(p1_id)
    p2_name = player_lookup.get(p2_id)

    if not p1_name or not p2_name:
        continue

    key = tuple(sorted([p1_name, p2_name]))

    if rows[0].has_won:
        winner, loser = p1_name, p2_name
    else:
        winner, loser = p2_name, p1_name

    h2h_records[(winner, loser)]['wins'] += 1

# Consolidate records (combine (A,B) and (B,A) into one record)
matchups = {}
processed = set()

for (p1, p2), data in h2h_records.items():
    key = tuple(sorted([p1, p2]))
    if key in processed:
        continue

    # Get wins for both sides
    p1_wins = h2h_records.get((key[0], key[1]), {'wins': 0})['wins']
    p2_wins = h2h_records.get((key[1], key[0]), {'wins': 0})['wins']

    total = p1_wins + p2_wins
    if total < 5:  # Minimum 5 games for betting
        continue

    # Calculate win probability
    p1_prob = p1_wins / total if total > 0 else 0.5
    p2_prob = p2_wins / total if total > 0 else 0.5

    # Convert to American odds
    def prob_to_american(prob):
        if prob <= 0:
            return '+999'
        if prob >= 1:
            return '-999'
        if prob >= 0.5:
            # Favorite (negative odds)
            return f'-{int((prob / (1 - prob)) * 100)}'
        else:
            # Underdog (positive odds)
            return f'+{int(((1 - prob) / prob) * 100)}'

    # Convert to decimal odds
    def prob_to_decimal(prob):
        if prob <= 0:
            return 99.0
        return round(1 / prob, 2)

    matchups[f"{key[0]} vs {key[1]}"] = {
        'player1': key[0],
        'player2': key[1],
        'p1_wins': p1_wins,
        'p2_wins': p2_wins,
        'total': total,
        'p1_prob': round(p1_prob * 100, 1),
        'p2_prob': round(p2_prob * 100, 1),
        'p1_american': prob_to_american(p1_prob),
        'p2_american': prob_to_american(p2_prob),
        'p1_decimal': prob_to_decimal(p1_prob),
        'p2_decimal': prob_to_decimal(p2_prob),
        'confidence': 'high' if total >= 30 else 'medium' if total >= 15 else 'low'
    }
    processed.add(key)

# Sort by total games
betting_data = {
    'matchups': sorted(matchups.values(), key=lambda x: x['total'], reverse=True),
    'total_matchups': len(matchups)
}

# Find biggest upsets potential (where underdog has > 35% chance)
betting_data['upset_alerts'] = [m for m in betting_data['matchups']
                                if min(m['p1_prob'], m['p2_prob']) >= 35 and m['total'] >= 15]

# Find safest bets (highest win rate differential with high sample)
betting_data['safest_bets'] = sorted([m for m in betting_data['matchups'] if m['total'] >= 20],
                                     key=lambda x: abs(x['p1_prob'] - 50), reverse=True)[:10]

# Calculate player power rankings (based on h2h performance)
player_h2h_stats = defaultdict(lambda: {'wins': 0, 'losses': 0, 'opponents': set()})
for m in betting_data['matchups']:
    player_h2h_stats[m['player1']]['wins'] += m['p1_wins']
    player_h2h_stats[m['player1']]['losses'] += m['p2_wins']
    player_h2h_stats[m['player1']]['opponents'].add(m['player2'])
    player_h2h_stats[m['player2']]['wins'] += m['p2_wins']
    player_h2h_stats[m['player2']]['losses'] += m['p1_wins']
    player_h2h_stats[m['player2']]['opponents'].add(m['player1'])

power_rankings = []
for player, stats in player_h2h_stats.items():
    total = stats['wins'] + stats['losses']
    if total >= 30 and len(stats['opponents']) >= 3:
        power_rankings.append({
            'player': player,
            'h2h_wins': stats['wins'],
            'h2h_losses': stats['losses'],
            'h2h_rate': round(stats['wins'] / total * 100, 1),
            'opponents': len(stats['opponents'])
        })

betting_data['power_rankings'] = sorted(power_rankings, key=lambda x: x['h2h_rate'], reverse=True)

with open('betting_data.json', 'w') as f:
    json.dump(betting_data, f, indent=2)

print(f"Generated betting data for {len(matchups)} matchups")
print(f"Top safest bet: {betting_data['safest_bets'][0]['player1']} vs {betting_data['safest_bets'][0]['player2']}")
