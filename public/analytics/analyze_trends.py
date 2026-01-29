#!/usr/bin/env python3
"""
Find crazy trends, correlations, and patterns in the data
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import json
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

participants_df['created_at'] = pd.to_datetime(participants_df['created_at'], format='mixed')
matches_df['created_at'] = pd.to_datetime(matches_df['created_at'], format='mixed')

# Convert from GMT to PST (subtract 8 hours)
participants_df['created_at_pst'] = participants_df['created_at'] - pd.Timedelta(hours=8)

participants_df['hour'] = participants_df['created_at_pst'].dt.hour
participants_df['weekday'] = participants_df['created_at_pst'].dt.day_name()
participants_df['month'] = participants_df['created_at_pst'].dt.month
participants_df['week'] = participants_df['created_at_pst'].dt.isocalendar().week
participants_df['date'] = participants_df['created_at_pst'].dt.date

player_lookup = players_df.set_index('id')['display_name'].to_dict()

print("🔍 Finding crazy trends and correlations...\n")

trends = {}

# ============================================================
# 1. WIN RATE BY HOUR - When is the best time to play?
# ============================================================
print("Analyzing hourly patterns...")
hourly_wr = participants_df.groupby('hour').agg({
    'has_won': ['mean', 'count']
}).round(3)
hourly_wr.columns = ['win_rate', 'games']
hourly_wr['win_rate'] = hourly_wr['win_rate'] * 100

best_hour = hourly_wr['win_rate'].idxmax()
worst_hour = hourly_wr['win_rate'].idxmin()
# This should be ~50% overall, but let's see the variance

trends['hourly_pattern'] = {
    'insight': 'Win rates vary by hour',
    'best_hour': int(best_hour),
    'best_hour_wr': round(hourly_wr.loc[best_hour, 'win_rate'], 1),
    'worst_hour': int(worst_hour),
    'worst_hour_wr': round(hourly_wr.loc[worst_hour, 'win_rate'], 1),
}
print(f"  Best hour: {best_hour}:00 ({hourly_wr.loc[best_hour, 'win_rate']:.1f}%)")
print(f"  Worst hour: {worst_hour}:00 ({hourly_wr.loc[worst_hour, 'win_rate']:.1f}%)")

# ============================================================
# 2. MOMENTUM - Does winning lead to more winning?
# ============================================================
print("\nAnalyzing momentum effects...")

momentum_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    if len(data) < 50:
        continue

    # Win rate after a win vs after a loss
    prev_result = None
    after_win_results = []
    after_loss_results = []

    for _, row in data.iterrows():
        if prev_result is not None:
            if prev_result:
                after_win_results.append(row['has_won'])
            else:
                after_loss_results.append(row['has_won'])
        prev_result = row['has_won']

    if len(after_win_results) >= 20 and len(after_loss_results) >= 20:
        wr_after_win = np.mean(after_win_results) * 100
        wr_after_loss = np.mean(after_loss_results) * 100
        momentum_stats.append({
            'player': player_lookup[player_id],
            'wr_after_win': wr_after_win,
            'wr_after_loss': wr_after_loss,
            'momentum_boost': wr_after_win - wr_after_loss
        })

mom_df = pd.DataFrame(momentum_stats)
avg_momentum = mom_df['momentum_boost'].mean()
biggest_momentum = mom_df.loc[mom_df['momentum_boost'].idxmax()]
reverse_momentum = mom_df.loc[mom_df['momentum_boost'].idxmin()]

trends['momentum'] = {
    'insight': 'Winning affects next game performance',
    'avg_momentum_boost': round(avg_momentum, 1),
    'biggest_momentum_player': biggest_momentum['player'],
    'biggest_momentum_boost': round(biggest_momentum['momentum_boost'], 1),
    'biggest_momentum_detail': f"{biggest_momentum['wr_after_win']:.1f}% after win vs {biggest_momentum['wr_after_loss']:.1f}% after loss",
    'reverse_momentum_player': reverse_momentum['player'],
    'reverse_momentum': round(reverse_momentum['momentum_boost'], 1),
    'reverse_detail': f"Actually plays BETTER after losing"
}
print(f"  Avg momentum boost: +{avg_momentum:.1f}% after a win")
print(f"  Biggest momentum: {biggest_momentum['player']} (+{biggest_momentum['momentum_boost']:.1f}%)")
print(f"  Reverse momentum: {reverse_momentum['player']} ({reverse_momentum['momentum_boost']:.1f}%)")

# ============================================================
# 3. FATIGUE - Does playing many games in a row hurt performance?
# ============================================================
print("\nAnalyzing fatigue effects...")

# Group games into sessions (games within 30 min of each other)
fatigue_data = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    if len(data) < 30:
        continue

    session_game_num = 1
    last_time = None

    for _, row in data.iterrows():
        if last_time is not None:
            time_diff = (row['created_at'] - last_time).total_seconds() / 60
            if time_diff > 30:  # New session
                session_game_num = 1
            else:
                session_game_num += 1

        fatigue_data.append({
            'player': player_lookup[player_id],
            'session_game': session_game_num,
            'won': row['has_won']
        })
        last_time = row['created_at']

fatigue_df = pd.DataFrame(fatigue_data)
early_games = fatigue_df[fatigue_df['session_game'] <= 3]['won'].mean() * 100
late_games = fatigue_df[fatigue_df['session_game'] >= 8]['won'].mean() * 100

trends['fatigue'] = {
    'insight': 'Performance changes during long sessions',
    'first_3_games_wr': round(early_games, 1),
    'after_8_games_wr': round(late_games, 1),
    'fatigue_drop': round(early_games - late_games, 1)
}
print(f"  First 3 games of session: {early_games:.1f}%")
print(f"  After 8+ games: {late_games:.1f}%")

# ============================================================
# 4. CHARACTER COUNTER-PICKS - Which chars beat which?
# ============================================================
print("\nAnalyzing character matchups...")

# Find most lopsided matchups
matchup_data = defaultdict(lambda: {'wins': 0, 'total': 0})
match_groups = participants_df.groupby('match_id')

for match_id, group in match_groups:
    if len(group) != 2:
        continue
    rows = group.to_dict('records')
    char1, char2 = rows[0]['smash_character'], rows[1]['smash_character']
    won1 = rows[0]['has_won']

    key = tuple(sorted([char1, char2]))
    matchup_data[key]['total'] += 1
    if (char1 < char2 and won1) or (char1 > char2 and not won1):
        matchup_data[key]['wins'] += 1

# Find most lopsided
lopsided = []
for (c1, c2), data in matchup_data.items():
    if data['total'] >= 10:
        wr = data['wins'] / data['total'] * 100
        if wr > 70 or wr < 30:
            lopsided.append({
                'char1': c1,
                'char2': c2,
                'char1_wr': round(wr, 1),
                'total': data['total']
            })

lopsided = sorted(lopsided, key=lambda x: abs(x['char1_wr'] - 50), reverse=True)[:5]
trends['lopsided_matchups'] = lopsided
print(f"  Found {len(lopsided)} very lopsided matchups")

# ============================================================
# 5. REVENGE GAMES - Do players perform better in rematches?
# ============================================================
print("\nAnalyzing revenge patterns...")

revenge_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')

    last_opponent = None
    last_result = None
    revenge_games = []
    normal_games = []

    for _, row in data.iterrows():
        match_data = participants_df[participants_df['match_id'] == row['match_id']]
        opponents = match_data[match_data['player'] != player_id]['player'].values

        if len(opponents) == 1:
            opp = opponents[0]
            if last_opponent == opp and last_result == False:
                # This is a revenge game!
                revenge_games.append(row['has_won'])
            else:
                normal_games.append(row['has_won'])

            last_opponent = opp
            last_result = row['has_won']

    if len(revenge_games) >= 5:
        revenge_wr = np.mean(revenge_games) * 100
        normal_wr = np.mean(normal_games) * 100 if normal_games else 50
        revenge_stats.append({
            'player': player_lookup[player_id],
            'revenge_wr': revenge_wr,
            'normal_wr': normal_wr,
            'revenge_boost': revenge_wr - normal_wr,
            'revenge_games': len(revenge_games)
        })

if revenge_stats:
    rev_df = pd.DataFrame(revenge_stats)
    best_revenge = rev_df.loc[rev_df['revenge_boost'].idxmax()]
    trends['revenge'] = {
        'insight': 'Some players are revenge specialists',
        'best_revenge_player': best_revenge['player'],
        'revenge_wr': round(best_revenge['revenge_wr'], 1),
        'normal_wr': round(best_revenge['normal_wr'], 1),
        'revenge_boost': round(best_revenge['revenge_boost'], 1)
    }
    print(f"  Best revenge player: {best_revenge['player']} (+{best_revenge['revenge_boost']:.1f}%)")

# ============================================================
# 6. CLUTCH FACTOR - Performance in close games
# ============================================================
print("\nAnalyzing clutch performance...")

# Close games = winner had 1 stock left (approximated by falls = kos - 1)
clutch_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id]
    if len(data) < 30:
        continue

    # Games where they barely won or barely lost
    close_games = data[(data['total_kos'] >= 2) & (abs(data['total_kos'] - data['total_falls']) <= 1)]
    blowout_games = data[abs(data['total_kos'] - data['total_falls']) >= 2]

    if len(close_games) >= 10 and len(blowout_games) >= 10:
        close_wr = close_games['has_won'].mean() * 100
        blowout_wr = blowout_games['has_won'].mean() * 100
        clutch_stats.append({
            'player': player_lookup[player_id],
            'close_wr': close_wr,
            'blowout_wr': blowout_wr,
            'clutch_factor': close_wr - blowout_wr
        })

if clutch_stats:
    clutch_df = pd.DataFrame(clutch_stats)
    most_clutch = clutch_df.loc[clutch_df['clutch_factor'].idxmax()]
    least_clutch = clutch_df.loc[clutch_df['clutch_factor'].idxmin()]
    trends['clutch'] = {
        'most_clutch_player': most_clutch['player'],
        'most_clutch_close_wr': round(most_clutch['close_wr'], 1),
        'most_clutch_blowout_wr': round(most_clutch['blowout_wr'], 1),
        'clutch_boost': round(most_clutch['clutch_factor'], 1),
        'least_clutch_player': least_clutch['player'],
        'choke_factor': round(abs(least_clutch['clutch_factor']), 1)
    }
    print(f"  Most clutch: {most_clutch['player']} (+{most_clutch['clutch_factor']:.1f}% in close games)")
    print(f"  Least clutch: {least_clutch['player']} ({least_clutch['clutch_factor']:.1f}%)")

# ============================================================
# 7. DAY OF WEEK TRENDS
# ============================================================
print("\nAnalyzing day of week patterns...")

day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
day_games = participants_df.groupby('weekday').size().reindex(day_order)
busiest_day = day_games.idxmax()
quietest_day = day_games.idxmin()

trends['day_activity'] = {
    'busiest_day': busiest_day,
    'busiest_games': int(day_games.max()),
    'quietest_day': quietest_day,
    'quietest_games': int(day_games.min()),
    'friday_vs_monday': round(day_games['Friday'] / day_games['Monday'], 1)
}
print(f"  Busiest: {busiest_day} ({day_games.max()} games)")
print(f"  Quietest: {quietest_day} ({day_games.min()} games)")

# ============================================================
# 8. HOT STREAKS - Longest streaks by various players
# ============================================================
print("\nFinding notable streaks...")

def find_streaks(player_id, win=True):
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    streaks = []
    current = 0
    for _, row in data.iterrows():
        if row['has_won'] == win:
            current += 1
        else:
            if current > 0:
                streaks.append(current)
            current = 0
    if current > 0:
        streaks.append(current)
    return max(streaks) if streaks else 0

# Find who has the most 5+ win streaks
streak_counts = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    if len(data) < 50:
        continue

    five_plus_streaks = 0
    current = 0
    for _, row in data.iterrows():
        if row['has_won']:
            current += 1
        else:
            if current >= 5:
                five_plus_streaks += 1
            current = 0

    streak_counts.append({
        'player': player_lookup[player_id],
        'five_plus_streaks': five_plus_streaks,
        'games': len(data)
    })

streak_df = pd.DataFrame(streak_counts)
streak_df['streak_rate'] = streak_df['five_plus_streaks'] / streak_df['games'] * 100
most_streaky = streak_df.loc[streak_df['five_plus_streaks'].idxmax()]

trends['streakiness'] = {
    'most_streaky_player': most_streaky['player'],
    'five_plus_streaks': int(most_streaky['five_plus_streaks']),
    'games': int(most_streaky['games'])
}
print(f"  Most streaky: {most_streaky['player']} ({most_streaky['five_plus_streaks']} hot streaks)")

# ============================================================
# 9. MATCHUP SPECIALISTS - Players who dominate specific opponents
# ============================================================
print("\nFinding matchup specialists...")

matchup_records = defaultdict(lambda: {'wins': 0, 'total': 0})
for match_id, group in match_groups:
    if len(group) != 2:
        continue
    rows = list(group.itertuples())
    p1, p2 = rows[0].player, rows[1].player
    if p1 not in player_lookup or p2 not in player_lookup:
        continue

    won1 = rows[0].has_won
    key = (player_lookup[p1], player_lookup[p2])
    matchup_records[key]['total'] += 1
    if won1:
        matchup_records[key]['wins'] += 1

# Find most dominant head-to-head
dominant_matchups = []
for (p1, p2), data in matchup_records.items():
    if data['total'] >= 15:
        wr = data['wins'] / data['total'] * 100
        if wr >= 65:
            dominant_matchups.append({
                'winner': p1,
                'loser': p2,
                'wins': data['wins'],
                'total': data['total'],
                'wr': round(wr, 1)
            })

dominant_matchups = sorted(dominant_matchups, key=lambda x: x['wr'], reverse=True)[:5]
trends['dominant_matchups'] = dominant_matchups
if dominant_matchups:
    print(f"  Most dominant: {dominant_matchups[0]['winner']} vs {dominant_matchups[0]['loser']} ({dominant_matchups[0]['wr']}%)")

# ============================================================
# 10. CHARACTER LOYALTY CORRELATION
# ============================================================
print("\nAnalyzing character loyalty vs win rate...")

loyalty_data = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id]
    if len(data) < 30:
        continue

    char_counts = data['smash_character'].value_counts()
    main_pct = char_counts.iloc[0] / len(data) * 100
    win_rate = data['has_won'].mean() * 100

    loyalty_data.append({
        'player': player_lookup[player_id],
        'loyalty': main_pct,
        'win_rate': win_rate
    })

loyalty_df = pd.DataFrame(loyalty_data)
correlation = loyalty_df['loyalty'].corr(loyalty_df['win_rate'])
trends['loyalty_correlation'] = {
    'correlation': round(correlation, 3),
    'insight': 'Negative = diverse players win more' if correlation < 0 else 'Positive = loyal players win more'
}
print(f"  Loyalty vs Win Rate correlation: {correlation:.3f}")

# ============================================================
# 11. FIRST GAME OF SESSION
# ============================================================
print("\nAnalyzing first game performance...")

first_game_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    if len(data) < 30:
        continue

    first_games = []
    other_games = []
    last_time = None

    for _, row in data.iterrows():
        if last_time is None or (row['created_at'] - last_time).total_seconds() > 1800:
            first_games.append(row['has_won'])
        else:
            other_games.append(row['has_won'])
        last_time = row['created_at']

    if len(first_games) >= 10 and len(other_games) >= 20:
        first_wr = np.mean(first_games) * 100
        other_wr = np.mean(other_games) * 100
        first_game_stats.append({
            'player': player_lookup[player_id],
            'first_wr': first_wr,
            'other_wr': other_wr,
            'warmup_effect': other_wr - first_wr
        })

fg_df = pd.DataFrame(first_game_stats)
needs_warmup = fg_df.loc[fg_df['warmup_effect'].idxmax()]
cold_starter = fg_df.loc[fg_df['warmup_effect'].idxmin()]

trends['warmup'] = {
    'needs_warmup_player': needs_warmup['player'],
    'first_wr': round(needs_warmup['first_wr'], 1),
    'warmed_up_wr': round(needs_warmup['other_wr'], 1),
    'warmup_boost': round(needs_warmup['warmup_effect'], 1),
    'cold_starter_player': cold_starter['player'],
    'cold_start_advantage': round(abs(cold_starter['warmup_effect']), 1)
}
print(f"  Needs warmup most: {needs_warmup['player']} (+{needs_warmup['warmup_effect']:.1f}% after warmup)")
print(f"  Best cold starter: {cold_starter['player']}")

# ============================================================
# 12. MONTHLY TRENDS
# ============================================================
print("\nAnalyzing monthly activity...")

participants_df['year_month'] = participants_df['created_at_pst'].dt.to_period('M')
monthly_games = participants_df.groupby('year_month').size()
peak_month = str(monthly_games.idxmax())
peak_games = int(monthly_games.max())

trends['monthly'] = {
    'peak_month': peak_month,
    'peak_games': peak_games,
    'trend': 'Activity peaked mid-season'
}
print(f"  Peak month: {peak_month} ({peak_games} games)")

# ============================================================
# 13. TIME BETWEEN GAMES
# ============================================================
print("\nAnalyzing game frequency...")

game_gaps = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    if len(data) < 20:
        continue

    gaps = data['created_at'].diff().dropna().dt.total_seconds() / 60  # in minutes
    avg_gap = gaps[gaps < 60].mean()  # Only within-session gaps

    if not np.isnan(avg_gap):
        game_gaps.append({
            'player': player_lookup[player_id],
            'avg_gap_mins': avg_gap
        })

gap_df = pd.DataFrame(game_gaps)
fastest = gap_df.loc[gap_df['avg_gap_mins'].idxmin()]
slowest = gap_df.loc[gap_df['avg_gap_mins'].idxmax()]

trends['game_speed'] = {
    'fastest_player': fastest['player'],
    'fastest_gap': round(fastest['avg_gap_mins'], 1),
    'slowest_player': slowest['player'],
    'slowest_gap': round(slowest['avg_gap_mins'], 1)
}
print(f"  Fastest games: {fastest['player']} ({fastest['avg_gap_mins']:.1f} min avg)")
print(f"  Slowest games: {slowest['player']} ({slowest['avg_gap_mins']:.1f} min avg)")

# ============================================================
# SAVE
# ============================================================
with open('trends_stats.json', 'w') as f:
    json.dump(trends, f, indent=2, default=str)

print("\n✨ Trends saved to trends_stats.json!")
print("\n" + "="*60)
print("KEY INSIGHTS")
print("="*60)
for key, data in trends.items():
    print(f"\n{key}:")
    if isinstance(data, dict):
        for k, v in data.items():
            print(f"  {k}: {v}")
    else:
        print(f"  {data}")
