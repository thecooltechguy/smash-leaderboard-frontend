#!/usr/bin/env python3
"""
Generate team match statistics (2v2, 3v3, etc.)
Teams are identified by grouping participants who won together vs lost together
"""

import pandas as pd
import numpy as np
from collections import defaultdict, Counter
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
participants_df['created_at'] = pd.to_datetime(participants_df['created_at'], format='mixed')
participants_df['created_at_pst'] = participants_df['created_at'] - pd.Timedelta(hours=8)

player_lookup = players_df.set_index('id')['display_name'].to_dict()

# Find all matches and categorize them
match_counts = participants_df.groupby('match_id').size()

# 1v1 matches (exactly 2 participants)
one_v_one_ids = match_counts[match_counts == 2].index

# Team matches (more than 2 participants)
team_match_ids = match_counts[match_counts > 2].index
team_matches = participants_df[participants_df['match_id'].isin(team_match_ids)]

print(f"Found {len(one_v_one_ids)} 1v1 matches")
print(f"Found {len(team_match_ids)} team matches (3+ players)")

# Categorize team matches by format
match_formats = defaultdict(list)
for match_id in team_match_ids:
    match_data = team_matches[team_matches['match_id'] == match_id]
    winners = match_data[match_data['has_won'] == True]
    losers = match_data[match_data['has_won'] == False]
    format_key = f"{len(winners)}v{len(losers)}"
    match_formats[format_key].append(match_id)

print("\nMatch formats:")
for fmt, matches in sorted(match_formats.items()):
    print(f"  {fmt}: {len(matches)} matches")

teams_data = {
    'total_team_matches': len(team_match_ids),
    'match_formats': {fmt: len(matches) for fmt, matches in match_formats.items()}
}

# ============================================================
# TRUE 2v2 MATCHES (exactly 2 on each side)
# ============================================================
print("\nAnalyzing true 2v2 matches...")
two_v_two_ids = match_formats.get('2v2', [])
duo_stats = defaultdict(lambda: {'wins': 0, 'losses': 0})

for match_id in two_v_two_ids:
    match_data = team_matches[team_matches['match_id'] == match_id]
    winners = match_data[match_data['has_won'] == True]
    losers = match_data[match_data['has_won'] == False]

    winning_duo = tuple(sorted([player_lookup.get(p, str(p)) for p in winners['player'].values]))
    losing_duo = tuple(sorted([player_lookup.get(p, str(p)) for p in losers['player'].values]))

    duo_stats[winning_duo]['wins'] += 1
    duo_stats[losing_duo]['losses'] += 1

# Build duo rankings
best_duos = []
for duo, stats in duo_stats.items():
    total = stats['wins'] + stats['losses']
    if total >= 2:  # At least 2 games together
        best_duos.append({
            'duo': f"{duo[0]} & {duo[1]}",
            'player1': duo[0],
            'player2': duo[1],
            'wins': stats['wins'],
            'losses': stats['losses'],
            'total': total,
            'win_rate': round(stats['wins'] / total * 100, 1)
        })

teams_data['true_2v2_count'] = len(two_v_two_ids)
teams_data['best_duos'] = sorted(best_duos, key=lambda x: (x['win_rate'], x['total']), reverse=True)[:20]
teams_data['most_active_duos'] = sorted(best_duos, key=lambda x: x['total'], reverse=True)[:20]

print(f"  Found {len(two_v_two_ids)} true 2v2 matches")
print(f"  {len(duo_stats)} unique duo combinations")

# ============================================================
# ALL TEAM COMPOSITIONS (any size)
# ============================================================
print("\nAnalyzing all team compositions...")
team_stats = defaultdict(lambda: {'wins': 0, 'losses': 0, 'kos': 0, 'falls': 0})
player_team_stats = defaultdict(lambda: {'wins': 0, 'losses': 0, 'teammates': Counter()})

for match_id in team_match_ids:
    match_data = team_matches[team_matches['match_id'] == match_id]

    winners = match_data[match_data['has_won'] == True]
    losers = match_data[match_data['has_won'] == False]

    winning_team = tuple(sorted([player_lookup.get(p, str(p)) for p in winners['player'].values]))
    losing_team = tuple(sorted([player_lookup.get(p, str(p)) for p in losers['player'].values]))

    # Track team stats
    team_stats[winning_team]['wins'] += 1
    team_stats[winning_team]['kos'] += int(winners['total_kos'].sum())
    team_stats[winning_team]['falls'] += int(winners['total_falls'].sum())

    team_stats[losing_team]['losses'] += 1
    team_stats[losing_team]['kos'] += int(losers['total_kos'].sum())
    team_stats[losing_team]['falls'] += int(losers['total_falls'].sum())

    # Track individual player team performance
    for player in winning_team:
        player_team_stats[player]['wins'] += 1
        for teammate in winning_team:
            if teammate != player:
                player_team_stats[player]['teammates'][teammate] += 1

    for player in losing_team:
        player_team_stats[player]['losses'] += 1
        for teammate in losing_team:
            if teammate != player:
                player_team_stats[player]['teammates'][teammate] += 1

# Find best teams (min 2 games)
best_teams = []
for team, stats in team_stats.items():
    total = stats['wins'] + stats['losses']
    if total >= 2:
        best_teams.append({
            'team': ' & '.join(team),
            'members': list(team),
            'size': len(team),
            'wins': stats['wins'],
            'losses': stats['losses'],
            'total': total,
            'win_rate': round(stats['wins'] / total * 100, 1),
            'total_kos': int(stats['kos']),
            'total_falls': int(stats['falls'])
        })

teams_data['best_teams'] = sorted(best_teams, key=lambda x: (x['win_rate'], x['total']), reverse=True)[:20]
teams_data['most_active_teams'] = sorted(best_teams, key=lambda x: x['total'], reverse=True)[:20]

# Best team players (min 3 team games)
team_player_rankings = []
for player, stats in player_team_stats.items():
    total = stats['wins'] + stats['losses']
    if total >= 3:
        best_teammate = stats['teammates'].most_common(1)[0] if stats['teammates'] else (None, 0)
        team_player_rankings.append({
            'player': player,
            'team_wins': stats['wins'],
            'team_losses': stats['losses'],
            'team_games': total,
            'team_win_rate': round(stats['wins'] / total * 100, 1),
            'best_teammate': best_teammate[0],
            'games_with_best': best_teammate[1]
        })

teams_data['team_player_rankings'] = sorted(team_player_rankings, key=lambda x: (x['team_win_rate'], x['team_games']), reverse=True)

# ============================================================
# PARTNERSHIP STATS (who plays together most, regardless of format)
# ============================================================
print("\nAnalyzing partnerships...")
partnership_stats = defaultdict(lambda: {'games': 0, 'wins': 0})

for match_id in team_match_ids:
    match_data = team_matches[team_matches['match_id'] == match_id]
    winners = match_data[match_data['has_won'] == True]
    losers = match_data[match_data['has_won'] == False]

    winning_names = [player_lookup.get(p, str(p)) for p in winners['player'].values]
    losing_names = [player_lookup.get(p, str(p)) for p in losers['player'].values]

    # Track partnerships on winning team
    for i, p1 in enumerate(winning_names):
        for p2 in winning_names[i+1:]:
            pair = tuple(sorted([p1, p2]))
            partnership_stats[pair]['games'] += 1
            partnership_stats[pair]['wins'] += 1

    # Track partnerships on losing team
    for i, p1 in enumerate(losing_names):
        for p2 in losing_names[i+1:]:
            pair = tuple(sorted([p1, p2]))
            partnership_stats[pair]['games'] += 1

best_partnerships = []
for pair, stats in partnership_stats.items():
    if stats['games'] >= 2:
        best_partnerships.append({
            'partnership': f"{pair[0]} & {pair[1]}",
            'player1': pair[0],
            'player2': pair[1],
            'games_together': stats['games'],
            'wins_together': stats['wins'],
            'win_rate': round(stats['wins'] / stats['games'] * 100, 1)
        })

teams_data['best_partnerships'] = sorted(best_partnerships, key=lambda x: (x['win_rate'], x['games_together']), reverse=True)[:20]
teams_data['most_frequent_partnerships'] = sorted(best_partnerships, key=lambda x: x['games_together'], reverse=True)[:20]

# Summary stats
teams_data['summary'] = {
    'total_team_matches': len(team_match_ids),
    'true_2v2_matches': len(two_v_two_ids),
    'total_unique_teams': len(team_stats),
    'total_unique_duos': len(duo_stats),
    'total_partnerships': len(partnership_stats)
}

with open('teams_data.json', 'w') as f:
    json.dump(teams_data, f, indent=2)

print(f"\n✨ Teams data saved!")
print(f"Total team matches: {teams_data['summary']['total_team_matches']}")
print(f"True 2v2 matches: {teams_data['summary']['true_2v2_matches']}")
print(f"Unique teams: {teams_data['summary']['total_unique_teams']}")
print(f"Unique duos (from 2v2): {teams_data['summary']['total_unique_duos']}")
print(f"Total partnerships: {teams_data['summary']['total_partnerships']}")
if teams_data['best_teams']:
    print(f"Best team: {teams_data['best_teams'][0]['team']} ({teams_data['best_teams'][0]['win_rate']}%)")
if teams_data['best_duos']:
    print(f"Best duo (2v2 only): {teams_data['best_duos'][0]['duo']} ({teams_data['best_duos'][0]['win_rate']}%)")
