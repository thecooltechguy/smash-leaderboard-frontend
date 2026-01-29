#!/usr/bin/env python3
"""
Smash Bros Office Leaderboard Analysis
Comprehensive analysis of 6 months of game history
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import json
from pathlib import Path
import glob

# Find the latest data files
def get_latest_file(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        raise FileNotFoundError(f"No files found matching {pattern}")
    return files[-1]

# Load the data
players_df = pd.read_csv(get_latest_file('data/public_players_export_*.csv'))
matches_df = pd.read_csv(get_latest_file('data/public_matches_export_*.csv'))
participants_df = pd.read_csv(get_latest_file('data/public_match_participants_export_*.csv'))

# Convert timestamps
players_df['created_at'] = pd.to_datetime(players_df['created_at'], format='mixed')
matches_df['created_at'] = pd.to_datetime(matches_df['created_at'], format='mixed')
participants_df['created_at'] = pd.to_datetime(participants_df['created_at'], format='mixed')

print(f"Total players: {len(players_df)}")
print(f"Total matches: {len(matches_df)}")
print(f"Total match participants: {len(participants_df)}")

# Create player lookup
player_lookup = players_df.set_index('id')['display_name'].to_dict()

# ============================================================
# SECTION 1: OVERALL STATISTICS
# ============================================================

def get_overall_stats():
    """Calculate overall statistics"""
    total_matches = len(matches_df)
    total_players = len(players_df)
    active_players = len(players_df[players_df['inactive'] == False])

    date_range_start = matches_df['created_at'].min()
    date_range_end = matches_df['created_at'].max()
    days_of_play = (date_range_end - date_range_start).days

    total_kos = participants_df['total_kos'].sum()
    total_falls = participants_df['total_falls'].sum()
    total_sds = participants_df['total_sds'].sum()

    unique_characters = participants_df['smash_character'].nunique()

    # Matches per day
    matches_per_day = total_matches / max(days_of_play, 1)

    # Average participants per match
    avg_participants = len(participants_df) / total_matches

    return {
        'total_matches': int(total_matches),
        'total_players': int(total_players),
        'active_players': int(active_players),
        'date_range_start': date_range_start.strftime('%Y-%m-%d'),
        'date_range_end': date_range_end.strftime('%Y-%m-%d'),
        'days_of_play': int(days_of_play),
        'total_kos': int(total_kos),
        'total_falls': int(total_falls),
        'total_sds': int(total_sds),
        'unique_characters_played': int(unique_characters),
        'avg_matches_per_day': round(matches_per_day, 1),
        'avg_participants_per_match': round(avg_participants, 2)
    }

# ============================================================
# SECTION 2: PLAYER STATISTICS
# ============================================================

def get_player_stats():
    """Calculate per-player statistics"""
    # Merge participants with player names
    player_stats = []

    for player_id in participants_df['player'].unique():
        player_matches = participants_df[participants_df['player'] == player_id]

        if player_id not in player_lookup:
            continue

        name = player_lookup[player_id]
        total_games = len(player_matches)
        wins = player_matches['has_won'].sum()
        losses = total_games - wins
        win_rate = (wins / total_games * 100) if total_games > 0 else 0

        total_kos = player_matches['total_kos'].sum()
        total_falls = player_matches['total_falls'].sum()
        total_sds = player_matches['total_sds'].sum()

        # KD ratio
        kd_ratio = total_kos / max(total_falls, 1)

        # Characters played
        chars_played = player_matches['smash_character'].nunique()
        favorite_char = player_matches['smash_character'].mode()
        favorite_char = favorite_char.iloc[0] if len(favorite_char) > 0 else 'N/A'

        # ELO from players table
        player_row = players_df[players_df['id'] == player_id]
        elo = player_row['elo'].iloc[0] if len(player_row) > 0 else 1200
        country = player_row['country'].iloc[0] if len(player_row) > 0 else ''

        player_stats.append({
            'id': int(player_id),
            'name': name,
            'total_games': int(total_games),
            'wins': int(wins),
            'losses': int(losses),
            'win_rate': round(win_rate, 1),
            'total_kos': int(total_kos),
            'total_falls': int(total_falls),
            'total_sds': int(total_sds),
            'kd_ratio': round(kd_ratio, 2),
            'characters_played': int(chars_played),
            'favorite_character': favorite_char,
            'elo': int(elo),
            'country': country if pd.notna(country) else ''
        })

    return sorted(player_stats, key=lambda x: x['total_games'], reverse=True)

# ============================================================
# SECTION 3: CHARACTER STATISTICS
# ============================================================

def get_character_stats():
    """Calculate per-character statistics"""
    char_stats = []

    for char in participants_df['smash_character'].unique():
        char_matches = participants_df[participants_df['smash_character'] == char]

        times_played = len(char_matches)
        wins = char_matches['has_won'].sum()
        win_rate = (wins / times_played * 100) if times_played > 0 else 0

        total_kos = char_matches['total_kos'].sum()
        total_falls = char_matches['total_falls'].sum()
        total_sds = char_matches['total_sds'].sum()

        avg_kos = total_kos / times_played
        avg_falls = total_falls / times_played

        # Unique players who used this character
        unique_players = char_matches['player'].nunique()

        char_stats.append({
            'character': char,
            'times_played': int(times_played),
            'wins': int(wins),
            'win_rate': round(win_rate, 1),
            'total_kos': int(total_kos),
            'total_falls': int(total_falls),
            'total_sds': int(total_sds),
            'avg_kos_per_game': round(avg_kos, 2),
            'avg_falls_per_game': round(avg_falls, 2),
            'unique_players': int(unique_players)
        })

    return sorted(char_stats, key=lambda x: x['times_played'], reverse=True)

# ============================================================
# SECTION 4: HEAD-TO-HEAD RIVALRIES
# ============================================================

def get_rivalries():
    """Find the biggest rivalries (most frequent matchups)"""
    # Group participants by match
    match_participants = participants_df.groupby('match_id')['player'].apply(list).to_dict()

    # Count matchups
    matchup_counts = defaultdict(lambda: {'total': 0, 'p1_wins': 0, 'p2_wins': 0})

    for match_id, players in match_participants.items():
        if len(players) == 2:
            p1, p2 = sorted(players)
            match_data = participants_df[participants_df['match_id'] == match_id]

            p1_won = match_data[match_data['player'] == p1]['has_won'].iloc[0] if len(match_data[match_data['player'] == p1]) > 0 else False

            key = (p1, p2)
            matchup_counts[key]['total'] += 1
            if p1_won:
                matchup_counts[key]['p1_wins'] += 1
            else:
                matchup_counts[key]['p2_wins'] += 1

    # Convert to list
    rivalries = []
    for (p1, p2), data in matchup_counts.items():
        if p1 not in player_lookup or p2 not in player_lookup:
            continue
        if data['total'] < 3:  # At least 3 matches to be a rivalry
            continue

        rivalries.append({
            'player1': player_lookup[p1],
            'player2': player_lookup[p2],
            'total_matches': data['total'],
            'player1_wins': data['p1_wins'],
            'player2_wins': data['p2_wins'],
            'dominance': max(data['p1_wins'], data['p2_wins']) / data['total'] * 100
        })

    return sorted(rivalries, key=lambda x: x['total_matches'], reverse=True)[:20]

# ============================================================
# SECTION 5: TIME-BASED TRENDS
# ============================================================

def get_time_trends():
    """Analyze activity over time"""
    matches_df['date'] = matches_df['created_at'].dt.date
    matches_df['month'] = matches_df['created_at'].dt.to_period('M')
    matches_df['weekday'] = matches_df['created_at'].dt.day_name()
    matches_df['hour'] = matches_df['created_at'].dt.hour

    # Matches per month
    monthly = matches_df.groupby('month').size()
    monthly_data = [{'month': str(m), 'matches': int(c)} for m, c in monthly.items()]

    # Matches per weekday
    weekday_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    weekday_counts = matches_df['weekday'].value_counts()
    weekday_data = [{'day': d, 'matches': int(weekday_counts.get(d, 0))} for d in weekday_order]

    # Matches per hour
    hourly = matches_df.groupby('hour').size()
    hourly_data = [{'hour': int(h), 'matches': int(c)} for h, c in hourly.items()]

    # Most active days
    daily = matches_df.groupby('date').size().reset_index(name='matches')
    daily = daily.sort_values('matches', ascending=False).head(10)
    busiest_days = [{'date': str(row['date']), 'matches': int(row['matches'])} for _, row in daily.iterrows()]

    return {
        'monthly': monthly_data,
        'weekday': weekday_data,
        'hourly': hourly_data,
        'busiest_days': busiest_days
    }

# ============================================================
# SECTION 6: FUN FACTS & RECORDS
# ============================================================

def get_fun_facts():
    """Extract interesting facts and records"""
    facts = {}

    # Perfect games (3 KOs, 0 Falls in a 1v1)
    perfect_games = participants_df[
        (participants_df['total_kos'] == 3) &
        (participants_df['total_falls'] == 0) &
        (participants_df['has_won'] == True)
    ]
    facts['perfect_games_count'] = int(len(perfect_games))

    # Most KOs in a single match
    max_kos_row = participants_df.loc[participants_df['total_kos'].idxmax()]
    facts['most_kos_single_match'] = {
        'player': player_lookup.get(max_kos_row['player'], 'Unknown'),
        'kos': int(max_kos_row['total_kos']),
        'character': max_kos_row['smash_character']
    }

    # Most SDs (self destructs)
    top_sd_players = participants_df.groupby('player')['total_sds'].sum().sort_values(ascending=False)
    facts['top_sd_players'] = [
        {'player': player_lookup.get(p, 'Unknown'), 'sds': int(s)}
        for p, s in top_sd_players.head(5).items() if p in player_lookup
    ]

    # Most diverse player (most characters played)
    char_diversity = participants_df.groupby('player')['smash_character'].nunique().sort_values(ascending=False)
    facts['most_diverse_players'] = [
        {'player': player_lookup.get(p, 'Unknown'), 'characters': int(c)}
        for p, c in char_diversity.head(5).items() if p in player_lookup
    ]

    # One-trick ponies (players who mainly use one character)
    one_tricks = []
    for player_id in participants_df['player'].unique():
        if player_id not in player_lookup:
            continue
        player_chars = participants_df[participants_df['player'] == player_id]
        total = len(player_chars)
        if total < 10:  # Need at least 10 games
            continue
        char_counts = player_chars['smash_character'].value_counts()
        main_char_pct = char_counts.iloc[0] / total * 100
        if main_char_pct >= 50:  # At least 50% one character
            one_tricks.append({
                'player': player_lookup[player_id],
                'character': char_counts.index[0],
                'percentage': round(main_char_pct, 1),
                'games': int(total)
            })
    facts['one_trick_ponies'] = sorted(one_tricks, key=lambda x: x['percentage'], reverse=True)[:10]

    # Longest win streak (approximate - by checking consecutive wins)
    def get_win_streaks():
        streaks = []
        for player_id in participants_df['player'].unique():
            if player_id not in player_lookup:
                continue
            player_matches = participants_df[participants_df['player'] == player_id].sort_values('created_at')
            current_streak = 0
            max_streak = 0

            for _, row in player_matches.iterrows():
                if row['has_won']:
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    current_streak = 0

            if max_streak >= 3:
                streaks.append({
                    'player': player_lookup[player_id],
                    'streak': max_streak
                })
        return sorted(streaks, key=lambda x: x['streak'], reverse=True)[:10]

    facts['longest_win_streaks'] = get_win_streaks()

    # Characters never used
    all_smash_chars = set(participants_df['smash_character'].unique())
    facts['total_characters_used'] = len(all_smash_chars)

    # Comebacks (won despite having more falls/SDs)
    comeback_count = 0
    for match_id in participants_df['match_id'].unique():
        match_data = participants_df[participants_df['match_id'] == match_id]
        if len(match_data) == 2:
            winner = match_data[match_data['has_won'] == True]
            loser = match_data[match_data['has_won'] == False]
            if len(winner) == 1 and len(loser) == 1:
                # Winner had more falls + SDs than KOs at some point (approximation)
                winner_sds = winner['total_sds'].iloc[0]
                if winner_sds > 0:
                    comeback_count += 1
    facts['matches_won_despite_sds'] = comeback_count

    # Countries represented
    countries = players_df['country'].dropna().unique()
    facts['countries_represented'] = [c for c in countries if c and c != '']
    facts['country_count'] = len([c for c in countries if c and c != ''])

    # Average match duration estimate (based on timestamps between matches - rough)
    facts['avg_kos_per_match'] = round(participants_df['total_kos'].sum() / len(matches_df), 1)

    return facts

# ============================================================
# SECTION 7: ELO RANKINGS & LEADERBOARD
# ============================================================

def get_leaderboard():
    """Get current ELO leaderboard"""
    # Get players with at least some games
    active_player_ids = participants_df['player'].unique()

    leaderboard = []
    for _, player in players_df.iterrows():
        if player['id'] not in active_player_ids:
            continue

        player_matches = participants_df[participants_df['player'] == player['id']]
        games = len(player_matches)

        if games < 5:  # Minimum 5 games to be on leaderboard
            continue

        wins = player_matches['has_won'].sum()

        leaderboard.append({
            'rank': 0,  # Will be set after sorting
            'name': player['display_name'],
            'elo': int(player['elo']),
            'games': int(games),
            'wins': int(wins),
            'losses': int(games - wins),
            'win_rate': round(wins / games * 100, 1),
            'country': player['country'] if pd.notna(player['country']) else ''
        })

    leaderboard = sorted(leaderboard, key=lambda x: x['elo'], reverse=True)
    for i, p in enumerate(leaderboard):
        p['rank'] = i + 1

    return leaderboard

# ============================================================
# SECTION 8: CHARACTER MATCHUPS
# ============================================================

def get_character_matchups():
    """Analyze character vs character win rates"""
    # Only look at 1v1 matches
    match_sizes = participants_df.groupby('match_id').size()
    onevsone_matches = match_sizes[match_sizes == 2].index

    matchups = defaultdict(lambda: {'wins': 0, 'total': 0})

    for match_id in onevsone_matches:
        match_data = participants_df[participants_df['match_id'] == match_id]
        if len(match_data) != 2:
            continue

        chars = match_data['smash_character'].values
        winner_row = match_data[match_data['has_won'] == True]

        if len(winner_row) != 1:
            continue

        winner_char = winner_row['smash_character'].iloc[0]
        loser_char = match_data[match_data['has_won'] == False]['smash_character'].iloc[0]

        key = tuple(sorted([winner_char, loser_char]))
        matchups[key]['total'] += 1

        if chars[0] < chars[1]:
            if winner_char == chars[0]:
                matchups[key]['wins'] += 1
        else:
            if winner_char == chars[1]:
                matchups[key]['wins'] += 1

    # Convert to list with win rates
    matchup_list = []
    for (char1, char2), data in matchups.items():
        if data['total'] < 3:  # Need at least 3 matches
            continue
        win_rate = data['wins'] / data['total'] * 100
        matchup_list.append({
            'character1': char1,
            'character2': char2,
            'total_matches': data['total'],
            'char1_win_rate': round(win_rate, 1),
            'char2_win_rate': round(100 - win_rate, 1)
        })

    return sorted(matchup_list, key=lambda x: x['total_matches'], reverse=True)[:30]

# ============================================================
# SECTION 9: RECENT FORM
# ============================================================

def get_recent_form():
    """Get players' recent form (last 10 games)"""
    recent_form = []

    for player_id in participants_df['player'].unique():
        if player_id not in player_lookup:
            continue

        player_matches = participants_df[participants_df['player'] == player_id].sort_values('created_at', ascending=False)

        if len(player_matches) < 10:
            continue

        last_10 = player_matches.head(10)
        wins = last_10['has_won'].sum()

        # Also get last 10 before that for comparison
        prev_10 = player_matches.iloc[10:20] if len(player_matches) >= 20 else None
        prev_wins = prev_10['has_won'].sum() if prev_10 is not None and len(prev_10) == 10 else None

        form_trend = 'stable'
        if prev_wins is not None:
            if wins > prev_wins + 2:
                form_trend = 'hot'
            elif wins < prev_wins - 2:
                form_trend = 'cold'

        recent_form.append({
            'player': player_lookup[player_id],
            'last_10_wins': int(wins),
            'last_10_losses': int(10 - wins),
            'form_trend': form_trend,
            'win_rate': round(wins / 10 * 100, 1)
        })

    return sorted(recent_form, key=lambda x: x['last_10_wins'], reverse=True)

# ============================================================
# SECTION 10: PLAYER JOURNEYS
# ============================================================

def get_player_journeys():
    """Track how players' performance evolved over time"""
    journeys = {}

    # Get top 10 most active players
    top_players = participants_df['player'].value_counts().head(10).index

    for player_id in top_players:
        if player_id not in player_lookup:
            continue

        player_matches = participants_df[participants_df['player'] == player_id].sort_values('created_at')
        player_matches['month'] = player_matches['created_at'].dt.to_period('M')

        monthly_stats = []
        for month, group in player_matches.groupby('month'):
            wins = group['has_won'].sum()
            total = len(group)
            monthly_stats.append({
                'month': str(month),
                'games': int(total),
                'wins': int(wins),
                'win_rate': round(wins / total * 100, 1) if total > 0 else 0
            })

        journeys[player_lookup[player_id]] = monthly_stats

    return journeys

# ============================================================
# MAIN EXECUTION
# ============================================================

if __name__ == '__main__':
    print("\n=== Analyzing Smash Bros Office Leaderboard Data ===\n")

    results = {
        'generated_at': datetime.now().isoformat(),
        'overall': get_overall_stats(),
        'players': get_player_stats(),
        'characters': get_character_stats(),
        'rivalries': get_rivalries(),
        'time_trends': get_time_trends(),
        'fun_facts': get_fun_facts(),
        'leaderboard': get_leaderboard(),
        'character_matchups': get_character_matchups(),
        'recent_form': get_recent_form(),
        'player_journeys': get_player_journeys()
    }

    # Save to JSON
    with open('analysis_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)

    print("Analysis complete! Results saved to analysis_results.json")

    # Print summary
    print(f"\n📊 SUMMARY:")
    print(f"  • {results['overall']['total_matches']} matches played over {results['overall']['days_of_play']} days")
    print(f"  • {results['overall']['total_players']} total players ({results['overall']['active_players']} active)")
    print(f"  • {results['overall']['total_kos']} total KOs, {results['overall']['total_sds']} self-destructs")
    print(f"  • {results['overall']['unique_characters_played']} unique characters played")
    print(f"\n🏆 TOP 5 BY ELO:")
    for p in results['leaderboard'][:5]:
        print(f"  {p['rank']}. {p['name']}: {p['elo']} ELO ({p['wins']}W-{p['losses']}L)")
    print(f"\n🎮 MOST PLAYED CHARACTERS:")
    for c in results['characters'][:5]:
        print(f"  • {c['character']}: {c['times_played']} games ({c['win_rate']}% win rate)")
