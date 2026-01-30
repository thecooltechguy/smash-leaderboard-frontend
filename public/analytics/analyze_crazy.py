#!/usr/bin/env python3
"""
Crazy & Quirky Smash Bros Statistics
Deep dive into weird patterns and fun facts
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

# Convert from GMT to PST (subtract 8 hours)
participants_df['created_at_pst'] = participants_df['created_at'] - pd.Timedelta(hours=8)

# Add time features (using PST)
participants_df['hour'] = participants_df['created_at_pst'].dt.hour
participants_df['weekday'] = participants_df['created_at_pst'].dt.day_name()
participants_df['month'] = participants_df['created_at_pst'].dt.month_name()
participants_df['is_weekend'] = participants_df['created_at_pst'].dt.dayofweek >= 5
participants_df['is_late_night'] = (participants_df['hour'] >= 22) | (participants_df['hour'] <= 4)
participants_df['time_period'] = participants_df['hour'].apply(lambda h:
    'Late Night (10PM-4AM)' if h >= 22 or h <= 4 else
    'Morning (5AM-11AM)' if h <= 11 else
    'Afternoon (12PM-5PM)' if h <= 17 else
    'Evening (6PM-9PM)')

player_lookup = players_df.set_index('id')['display_name'].to_dict()

print("Calculating crazy statistics...")

crazy_stats = {}

# ============================================================
# 1. CHARACTER BY DAY OF WEEK
# ============================================================
print("  - Character popularity by day...")
char_by_day = {}
for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
    day_data = participants_df[participants_df['weekday'] == day]
    top_char = day_data['smash_character'].value_counts().head(1)
    if len(top_char) > 0:
        char_by_day[day] = {
            'character': top_char.index[0],
            'plays': int(top_char.values[0])
        }

crazy_stats['character_by_day'] = char_by_day

# ============================================================
# 2. TOP PLAYERS BY TIME OF DAY
# ============================================================
print("  - Late night warriors...")

# Late night specialists (best win rate after 10PM)
late_night = participants_df[participants_df['is_late_night']]
late_night_stats = []
for player_id in late_night['player'].unique():
    if player_id not in player_lookup:
        continue
    player_late = late_night[late_night['player'] == player_id]
    if len(player_late) < 10:  # Min 10 late night games
        continue
    wins = player_late['has_won'].sum()
    total = len(player_late)
    late_night_stats.append({
        'player': player_lookup[player_id],
        'games': int(total),
        'wins': int(wins),
        'win_rate': round(wins / total * 100, 1)
    })

crazy_stats['late_night_warriors'] = sorted(late_night_stats, key=lambda x: x['win_rate'], reverse=True)[:5]

# ============================================================
# 3. JMOON SPECIFIC STATS
# ============================================================
print("  - jmoon deep dive...")

jmoon_id = 38  # From the data
jmoon_data = participants_df[participants_df['player'] == jmoon_id]

jmoon_stats = {
    'total_games': int(len(jmoon_data)),
    'total_wins': int(jmoon_data['has_won'].sum()),
}

# jmoon win rate by time period
for period in ['Late Night (10PM-4AM)', 'Morning (5AM-11AM)', 'Afternoon (12PM-5PM)', 'Evening (6PM-9PM)']:
    period_data = jmoon_data[jmoon_data['time_period'] == period]
    if len(period_data) > 0:
        jmoon_stats[f'winrate_{period}'] = {
            'games': int(len(period_data)),
            'win_rate': round(period_data['has_won'].mean() * 100, 1)
        }

# jmoon by day
jmoon_by_day = {}
for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
    day_data = jmoon_data[jmoon_data['weekday'] == day]
    if len(day_data) > 0:
        jmoon_by_day[day] = {
            'games': int(len(day_data)),
            'win_rate': round(day_data['has_won'].mean() * 100, 1)
        }
jmoon_stats['by_day'] = jmoon_by_day

# jmoon best and worst characters
jmoon_char_stats = []
for char in jmoon_data['smash_character'].unique():
    char_data = jmoon_data[jmoon_data['smash_character'] == char]
    if len(char_data) >= 5:  # Min 5 games
        jmoon_char_stats.append({
            'character': char,
            'games': int(len(char_data)),
            'win_rate': round(char_data['has_won'].mean() * 100, 1)
        })

jmoon_stats['best_character'] = max(jmoon_char_stats, key=lambda x: x['win_rate']) if jmoon_char_stats else None
jmoon_stats['worst_character'] = min(jmoon_char_stats, key=lambda x: x['win_rate']) if jmoon_char_stats else None
jmoon_stats['most_played_character'] = max(jmoon_char_stats, key=lambda x: x['games']) if jmoon_char_stats else None

crazy_stats['jmoon_deep_dive'] = jmoon_stats

# ============================================================
# 4. WEEKEND VS WEEKDAY WARRIORS
# ============================================================
print("  - Weekend vs weekday warriors...")

weekend_warriors = []
weekday_warriors = []

for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    player_data = participants_df[participants_df['player'] == player_id]

    weekend = player_data[player_data['is_weekend']]
    weekday = player_data[~player_data['is_weekend']]

    if len(weekend) >= 10 and len(weekday) >= 10:
        weekend_wr = weekend['has_won'].mean() * 100
        weekday_wr = weekday['has_won'].mean() * 100
        diff = weekend_wr - weekday_wr

        if diff > 10:
            weekend_warriors.append({
                'player': player_lookup[player_id],
                'weekend_wr': round(weekend_wr, 1),
                'weekday_wr': round(weekday_wr, 1),
                'diff': round(diff, 1),
                'weekend_games': int(len(weekend)),
                'weekday_games': int(len(weekday))
            })
        elif diff < -10:
            weekday_warriors.append({
                'player': player_lookup[player_id],
                'weekend_wr': round(weekend_wr, 1),
                'weekday_wr': round(weekday_wr, 1),
                'diff': round(abs(diff), 1),
                'weekend_games': int(len(weekend)),
                'weekday_games': int(len(weekday))
            })

crazy_stats['weekend_warriors'] = sorted(weekend_warriors, key=lambda x: x['diff'], reverse=True)[:5]
crazy_stats['weekday_warriors'] = sorted(weekday_warriors, key=lambda x: x['diff'], reverse=True)[:5]

# ============================================================
# 5. LONGEST LOSING STREAKS
# ============================================================
print("  - Longest losing streaks...")

def get_losing_streaks():
    streaks = []
    for player_id in participants_df['player'].unique():
        if player_id not in player_lookup:
            continue
        player_matches = participants_df[participants_df['player'] == player_id].sort_values('created_at')
        current_streak = 0
        max_streak = 0

        for _, row in player_matches.iterrows():
            if not row['has_won']:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0

        if max_streak >= 5:
            streaks.append({
                'player': player_lookup[player_id],
                'streak': max_streak
            })
    return sorted(streaks, key=lambda x: x['streak'], reverse=True)[:10]

crazy_stats['longest_losing_streaks'] = get_losing_streaks()

# ============================================================
# 6. COMEBACK KINGS (players who win more often when behind)
# ============================================================
print("  - Comeback analysis...")

# Players with best win rate when they had SDs in the match
comeback_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    player_data = participants_df[participants_df['player'] == player_id]

    # Games with self-destructs
    sd_games = player_data[player_data['total_sds'] > 0]
    if len(sd_games) >= 5:
        sd_win_rate = sd_games['has_won'].mean() * 100
        comeback_stats.append({
            'player': player_lookup[player_id],
            'sd_games': int(len(sd_games)),
            'sd_win_rate': round(sd_win_rate, 1)
        })

crazy_stats['comeback_kings'] = sorted(comeback_stats, key=lambda x: x['sd_win_rate'], reverse=True)[:5]

# ============================================================
# 7. CLUTCH VS CHOKE PLAYERS
# ============================================================
print("  - Clutch vs choke analysis...")

# Players whose win rate differs significantly in close games (winner had 1 KO margin)
# This is approximated by looking at games where falls == kos - 1 or kos - 2

# ============================================================
# 8. MOST PLAYED MATCHUP BY DAY
# ============================================================
print("  - Matchup by day...")

matchup_by_day = {}
for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
    day_matches = participants_df[participants_df['weekday'] == day]
    match_ids = day_matches['match_id'].unique()

    matchups = defaultdict(int)
    for mid in match_ids:
        match_data = day_matches[day_matches['match_id'] == mid]
        players_in_match = match_data['player'].values
        if len(players_in_match) == 2:
            p1, p2 = sorted(players_in_match)
            if p1 in player_lookup and p2 in player_lookup:
                matchups[(player_lookup[p1], player_lookup[p2])] += 1

    if matchups:
        top_matchup = max(matchups.items(), key=lambda x: x[1])
        matchup_by_day[day] = {
            'players': f"{top_matchup[0][0]} vs {top_matchup[0][1]}",
            'times': top_matchup[1]
        }

crazy_stats['top_matchup_by_day'] = matchup_by_day

# ============================================================
# 9. CURSED CHARACTERS (lowest overall win rate)
# ============================================================
print("  - Cursed characters...")

char_win_rates = []
for char in participants_df['smash_character'].unique():
    char_data = participants_df[participants_df['smash_character'] == char]
    if len(char_data) >= 20:  # Min 20 games
        char_win_rates.append({
            'character': char,
            'plays': int(len(char_data)),
            'win_rate': round(char_data['has_won'].mean() * 100, 1)
        })

crazy_stats['cursed_characters'] = sorted(char_win_rates, key=lambda x: x['win_rate'])[:5]
crazy_stats['blessed_characters'] = sorted(char_win_rates, key=lambda x: x['win_rate'], reverse=True)[:5]

# ============================================================
# 10. FRIDAY NIGHT SPECIALS
# ============================================================
print("  - Friday night analysis...")

friday_night = participants_df[
    (participants_df['weekday'] == 'Friday') &
    (participants_df['hour'] >= 18)
]

friday_night_char = friday_night['smash_character'].value_counts().head(3)
crazy_stats['friday_night_favorites'] = [
    {'character': char, 'plays': int(count)}
    for char, count in friday_night_char.items()
]

# Friday night top player
friday_stats = []
for player_id in friday_night['player'].unique():
    if player_id not in player_lookup:
        continue
    player_fn = friday_night[friday_night['player'] == player_id]
    if len(player_fn) >= 10:
        friday_stats.append({
            'player': player_lookup[player_id],
            'games': int(len(player_fn)),
            'win_rate': round(player_fn['has_won'].mean() * 100, 1)
        })

crazy_stats['friday_night_king'] = max(friday_stats, key=lambda x: x['win_rate']) if friday_stats else None

# ============================================================
# 11. EARLY BIRD VS NIGHT OWL
# ============================================================
print("  - Early bird vs night owl...")

morning_games = participants_df[(participants_df['hour'] >= 5) & (participants_df['hour'] <= 10)]
night_games = participants_df[(participants_df['hour'] >= 22) | (participants_df['hour'] <= 2)]

early_birds = []
night_owls = []

for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue

    player_morning = morning_games[morning_games['player'] == player_id]
    player_night = night_games[night_games['player'] == player_id]

    if len(player_morning) >= 5:
        early_birds.append({
            'player': player_lookup[player_id],
            'games': int(len(player_morning)),
            'win_rate': round(player_morning['has_won'].mean() * 100, 1)
        })

    if len(player_night) >= 5:
        night_owls.append({
            'player': player_lookup[player_id],
            'games': int(len(player_night)),
            'win_rate': round(player_night['has_won'].mean() * 100, 1)
        })

crazy_stats['early_birds'] = sorted(early_birds, key=lambda x: x['games'], reverse=True)[:5]
crazy_stats['night_owls'] = sorted(night_owls, key=lambda x: x['games'], reverse=True)[:5]

# ============================================================
# 12. MOST KOS IN A SINGLE GAME
# ============================================================
print("  - Single game records...")

top_ko_game = participants_df.loc[participants_df['total_kos'].idxmax()]
crazy_stats['single_game_most_kos'] = {
    'player': player_lookup.get(top_ko_game['player'], 'Unknown'),
    'kos': int(top_ko_game['total_kos']),
    'character': top_ko_game['smash_character'],
    'won': bool(top_ko_game['has_won'])
}

# Most SDs in a single game
top_sd_game = participants_df.loc[participants_df['total_sds'].idxmax()]
crazy_stats['single_game_most_sds'] = {
    'player': player_lookup.get(top_sd_game['player'], 'Unknown'),
    'sds': int(top_sd_game['total_sds']),
    'character': top_sd_game['smash_character'],
    'won': bool(top_sd_game['has_won'])
}

# ============================================================
# 13. HABEAS DEEP DIVE (The Grinder)
# ============================================================
print("  - habeas deep dive...")

habeas_id = 21
habeas_data = participants_df[participants_df['player'] == habeas_id]

habeas_stats = {
    'total_games': int(len(habeas_data)),
    'total_wins': int(habeas_data['has_won'].sum()),
    'total_kos': int(habeas_data['total_kos'].sum()),
    'total_sds': int(habeas_data['total_sds'].sum()),
}

# habeas by day
habeas_by_day = {}
for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
    day_data = habeas_data[habeas_data['weekday'] == day]
    if len(day_data) > 0:
        habeas_by_day[day] = {
            'games': int(len(day_data)),
            'win_rate': round(day_data['has_won'].mean() * 100, 1)
        }
habeas_stats['by_day'] = habeas_by_day

# habeas best day
best_day = max(habeas_by_day.items(), key=lambda x: x[1]['win_rate'])
habeas_stats['best_day'] = {'day': best_day[0], 'win_rate': best_day[1]['win_rate']}

worst_day = min(habeas_by_day.items(), key=lambda x: x[1]['win_rate'])
habeas_stats['worst_day'] = {'day': worst_day[0], 'win_rate': worst_day[1]['win_rate']}

crazy_stats['habeas_deep_dive'] = habeas_stats

# ============================================================
# 14. UNDERDOG VICTORIES
# ============================================================
print("  - Underdog analysis...")

# Players who beat jmoon the most
jmoon_losses = participants_df[
    (participants_df['player'] == jmoon_id) &
    (participants_df['has_won'] == False)
]['match_id'].values

jmoon_killers = defaultdict(int)
for match_id in jmoon_losses:
    match_winner = participants_df[
        (participants_df['match_id'] == match_id) &
        (participants_df['has_won'] == True)
    ]
    if len(match_winner) > 0:
        winner_id = match_winner['player'].iloc[0]
        if winner_id in player_lookup:
            jmoon_killers[player_lookup[winner_id]] += 1

crazy_stats['jmoon_killers'] = [
    {'player': p, 'kills': k}
    for p, k in sorted(jmoon_killers.items(), key=lambda x: x[1], reverse=True)[:5]
]

# ============================================================
# 15. UNIQUE CHARACTER PICKS (characters used only once or twice)
# ============================================================
print("  - Unique character picks...")

char_counts = participants_df['smash_character'].value_counts()
rare_chars = char_counts[char_counts <= 5]
crazy_stats['rare_characters'] = [
    {'character': char, 'times_played': int(count)}
    for char, count in rare_chars.head(10).items()
]

# ============================================================
# 16. MONTHLY CHAMPIONS
# ============================================================
print("  - Monthly champions...")

participants_df['year_month'] = participants_df['created_at_pst'].dt.to_period('M')
monthly_champions = {}

for month in participants_df['year_month'].unique():
    month_data = participants_df[participants_df['year_month'] == month]

    player_stats = []
    for player_id in month_data['player'].unique():
        if player_id not in player_lookup:
            continue
        player_month = month_data[month_data['player'] == player_id]
        if len(player_month) >= 5:
            player_stats.append({
                'player': player_lookup[player_id],
                'games': int(len(player_month)),
                'wins': int(player_month['has_won'].sum()),
                'win_rate': round(player_month['has_won'].mean() * 100, 1)
            })

    if player_stats:
        champion = max(player_stats, key=lambda x: (x['win_rate'], x['games']))
        monthly_champions[str(month)] = champion

crazy_stats['monthly_champions'] = monthly_champions

# ============================================================
# 17. BUSIEST HOUR OF THE DAY
# ============================================================
print("  - Busiest hours...")

hourly_games = participants_df.groupby('hour').size()
busiest_hour = hourly_games.idxmax()
crazy_stats['busiest_hour'] = {
    'hour': int(busiest_hour),
    'hour_formatted': f"{busiest_hour}:00 - {busiest_hour + 1}:00",
    'games': int(hourly_games.max())
}

quietest_hour = hourly_games.idxmin()
crazy_stats['quietest_hour'] = {
    'hour': int(quietest_hour),
    'hour_formatted': f"{quietest_hour}:00 - {quietest_hour + 1}:00",
    'games': int(hourly_games.min())
}

# ============================================================
# SAVE RESULTS
# ============================================================

with open('crazy_stats.json', 'w') as f:
    json.dump(crazy_stats, f, indent=2, default=str)

print("\n✨ Crazy stats saved to crazy_stats.json!")

# Print some highlights
print("\n🎮 CRAZY STATS HIGHLIGHTS:")
print(f"\n📅 WEDNESDAY'S FAVORITE: {crazy_stats['character_by_day']['Wednesday']['character']} ({crazy_stats['character_by_day']['Wednesday']['plays']} plays)")
print(f"\n🦉 LATE NIGHT KING: {crazy_stats['late_night_warriors'][0]['player']} ({crazy_stats['late_night_warriors'][0]['win_rate']}% win rate after 10PM)")
print(f"\n👑 JMOON'S BEST TIME: {max(crazy_stats['jmoon_deep_dive']['by_day'].items(), key=lambda x: x[1]['win_rate'])}")
print(f"\n😈 JMOON'S WORST CHARACTER: {crazy_stats['jmoon_deep_dive']['worst_character']}")
print(f"\n📉 LONGEST LOSING STREAK: {crazy_stats['longest_losing_streaks'][0]['player']} ({crazy_stats['longest_losing_streaks'][0]['streak']} losses in a row)")
print(f"\n🗡️ TOP JMOON KILLER: {crazy_stats['jmoon_killers'][0]['player']} ({crazy_stats['jmoon_killers'][0]['kills']} wins vs jmoon)")
print(f"\n⏰ BUSIEST HOUR: {crazy_stats['busiest_hour']['hour_formatted']} ({crazy_stats['busiest_hour']['games']} games)")
