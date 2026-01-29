#!/usr/bin/env python3
"""
Find the most interesting outliers and crazy stats
Focus on diversity - find the biggest outlier for each stat
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

# Convert timestamps
players_df['created_at'] = pd.to_datetime(players_df['created_at'], format='mixed')
matches_df['created_at'] = pd.to_datetime(matches_df['created_at'], format='mixed')
participants_df['created_at'] = pd.to_datetime(participants_df['created_at'], format='mixed')

# Add time features
participants_df['hour'] = participants_df['created_at'].dt.hour
participants_df['weekday'] = participants_df['created_at'].dt.day_name()
participants_df['month'] = participants_df['created_at'].dt.month
participants_df['is_weekend'] = participants_df['created_at'].dt.dayofweek >= 5

player_lookup = players_df.set_index('id')['display_name'].to_dict()

print("🔍 Finding the most interesting outliers...\n")

outliers = {}

# ============================================================
# 1. BIGGEST GRINDER (most games played)
# ============================================================
games_by_player = participants_df.groupby('player').size().sort_values(ascending=False)
top_grinder_id = games_by_player.index[0]
outliers['biggest_grinder'] = {
    'stat': 'Most Games Played',
    'player': player_lookup.get(top_grinder_id, 'Unknown'),
    'value': f"{int(games_by_player.iloc[0]):,} games",
    'detail': f"That's {games_by_player.iloc[0] / 224:.1f} games per day on average",
    'runner_up': f"{player_lookup.get(games_by_player.index[1], 'Unknown')} ({int(games_by_player.iloc[1]):,})"
}
print(f"🎮 Biggest Grinder: {outliers['biggest_grinder']['player']} - {outliers['biggest_grinder']['value']}")

# ============================================================
# 2. MOST DOMINANT (highest win rate, min 50 games)
# ============================================================
player_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id]
    if len(data) >= 50:
        player_stats.append({
            'id': player_id,
            'name': player_lookup[player_id],
            'games': len(data),
            'wins': data['has_won'].sum(),
            'win_rate': data['has_won'].mean() * 100,
            'kos': data['total_kos'].sum(),
            'falls': data['total_falls'].sum(),
            'sds': data['total_sds'].sum()
        })

ps_df = pd.DataFrame(player_stats)

most_dominant = ps_df.loc[ps_df['win_rate'].idxmax()]
outliers['most_dominant'] = {
    'stat': 'Highest Win Rate (50+ games)',
    'player': most_dominant['name'],
    'value': f"{most_dominant['win_rate']:.1f}%",
    'detail': f"{int(most_dominant['wins'])}W - {int(most_dominant['games'] - most_dominant['wins'])}L across {int(most_dominant['games'])} games"
}
print(f"👑 Most Dominant: {outliers['most_dominant']['player']} - {outliers['most_dominant']['value']}")

# ============================================================
# 3. BIGGEST UNDERDOG (lowest win rate, min 50 games)
# ============================================================
biggest_underdog = ps_df.loc[ps_df['win_rate'].idxmin()]
outliers['biggest_underdog'] = {
    'stat': 'Lowest Win Rate (50+ games)',
    'player': biggest_underdog['name'],
    'value': f"{biggest_underdog['win_rate']:.1f}%",
    'detail': f"Still showed up for {int(biggest_underdog['games'])} games. Respect."
}
print(f"😅 Biggest Underdog: {outliers['biggest_underdog']['player']} - {outliers['biggest_underdog']['value']}")

# ============================================================
# 4. LONGEST LOSING STREAK
# ============================================================
def get_max_losing_streak(player_id):
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    max_streak = 0
    current = 0
    for _, row in data.iterrows():
        if not row['has_won']:
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 0
    return max_streak

losing_streaks = [(player_lookup.get(pid, 'Unknown'), get_max_losing_streak(pid))
                  for pid in participants_df['player'].unique() if pid in player_lookup]
worst_streak = max(losing_streaks, key=lambda x: x[1])
outliers['worst_losing_streak'] = {
    'stat': 'Longest Losing Streak',
    'player': worst_streak[0],
    'value': f"{worst_streak[1]} consecutive losses",
    'detail': "Kept coming back for more. That's dedication."
}
print(f"📉 Worst Losing Streak: {outliers['worst_losing_streak']['player']} - {outliers['worst_losing_streak']['value']}")

# ============================================================
# 5. LONGEST WINNING STREAK
# ============================================================
def get_max_winning_streak(player_id):
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    max_streak = 0
    current = 0
    for _, row in data.iterrows():
        if row['has_won']:
            current += 1
            max_streak = max(max_streak, current)
        else:
            current = 0
    return max_streak

winning_streaks = [(player_lookup.get(pid, 'Unknown'), get_max_winning_streak(pid))
                   for pid in participants_df['player'].unique() if pid in player_lookup]
best_streak = max(winning_streaks, key=lambda x: x[1])
outliers['best_winning_streak'] = {
    'stat': 'Longest Winning Streak',
    'player': best_streak[0],
    'value': f"{best_streak[1]} consecutive wins",
    'detail': "Absolutely untouchable"
}
print(f"🔥 Best Winning Streak: {outliers['best_winning_streak']['player']} - {outliers['best_winning_streak']['value']}")

# ============================================================
# 6. HIGHEST KD RATIO (min 50 games)
# ============================================================
ps_df['kd'] = ps_df['kos'] / ps_df['falls'].replace(0, 1)
best_kd = ps_df.loc[ps_df['kd'].idxmax()]
outliers['best_kd'] = {
    'stat': 'Best KO/Death Ratio',
    'player': best_kd['name'],
    'value': f"{best_kd['kd']:.2f} K/D",
    'detail': f"{int(best_kd['kos'])} KOs, {int(best_kd['falls'])} deaths"
}
print(f"💀 Best K/D: {outliers['best_kd']['player']} - {outliers['best_kd']['value']}")

# ============================================================
# 7. WORST KD RATIO (min 50 games)
# ============================================================
worst_kd = ps_df.loc[ps_df['kd'].idxmin()]
outliers['worst_kd'] = {
    'stat': 'Worst KO/Death Ratio',
    'player': worst_kd['name'],
    'value': f"{worst_kd['kd']:.2f} K/D",
    'detail': f"Gets KO'd more than they KO"
}
print(f"🪦 Worst K/D: {outliers['worst_kd']['player']} - {outliers['worst_kd']['value']}")

# ============================================================
# 8. MOST SELF-DESTRUCTS (total)
# ============================================================
sd_by_player = participants_df.groupby('player')['total_sds'].sum().sort_values(ascending=False)
top_sd_id = sd_by_player.index[0]
top_sd_games = len(participants_df[participants_df['player'] == top_sd_id])
outliers['most_sds_total'] = {
    'stat': 'Most Self-Destructs (Total)',
    'player': player_lookup.get(top_sd_id, 'Unknown'),
    'value': f"{int(sd_by_player.iloc[0])} SDs",
    'detail': f"That's 1 SD every {top_sd_games / sd_by_player.iloc[0]:.1f} games"
}
print(f"💥 Most SDs: {outliers['most_sds_total']['player']} - {outliers['most_sds_total']['value']}")

# ============================================================
# 9. MOST SD-PRONE (SDs per game, min 30 games)
# ============================================================
sd_rate = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id]
    if len(data) >= 30:
        sd_rate.append({
            'player': player_lookup[player_id],
            'games': len(data),
            'sds': data['total_sds'].sum(),
            'sd_per_game': data['total_sds'].sum() / len(data)
        })

sd_df = pd.DataFrame(sd_rate)
most_sd_prone = sd_df.loc[sd_df['sd_per_game'].idxmax()]
outliers['most_sd_prone'] = {
    'stat': 'Most SD-Prone Player',
    'player': most_sd_prone['player'],
    'value': f"{most_sd_prone['sd_per_game']:.2f} SDs per game",
    'detail': f"{int(most_sd_prone['sds'])} total SDs in {int(most_sd_prone['games'])} games"
}
print(f"🤦 Most SD-Prone: {outliers['most_sd_prone']['player']} - {outliers['most_sd_prone']['value']}")

# ============================================================
# 10. CLEANEST PLAYER (fewest SDs per game, min 50 games)
# ============================================================
cleanest = sd_df[sd_df['games'] >= 50].loc[sd_df[sd_df['games'] >= 50]['sd_per_game'].idxmin()]
outliers['cleanest_player'] = {
    'stat': 'Cleanest Player (Fewest SDs)',
    'player': cleanest['player'],
    'value': f"{cleanest['sd_per_game']:.3f} SDs per game",
    'detail': f"Only {int(cleanest['sds'])} SDs in {int(cleanest['games'])} games"
}
print(f"✨ Cleanest Player: {outliers['cleanest_player']['player']} - {outliers['cleanest_player']['value']}")

# ============================================================
# 11. MOST DIVERSE (most characters played)
# ============================================================
char_diversity = participants_df.groupby('player')['smash_character'].nunique().sort_values(ascending=False)
most_diverse_id = char_diversity.index[0]
outliers['most_diverse'] = {
    'stat': 'Most Characters Played',
    'player': player_lookup.get(most_diverse_id, 'Unknown'),
    'value': f"{char_diversity.iloc[0]} different characters",
    'detail': f"Out of 98 total characters used in the league"
}
print(f"🎭 Most Diverse: {outliers['most_diverse']['player']} - {outliers['most_diverse']['value']}")

# ============================================================
# 12. BIGGEST ONE-TRICK (highest % on one character, min 50 games)
# ============================================================
one_tricks = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id]
    if len(data) >= 50:
        char_counts = data['smash_character'].value_counts()
        main_pct = char_counts.iloc[0] / len(data) * 100
        one_tricks.append({
            'player': player_lookup[player_id],
            'character': char_counts.index[0],
            'pct': main_pct,
            'games': len(data)
        })

one_trick_df = pd.DataFrame(one_tricks)
biggest_one_trick = one_trick_df.loc[one_trick_df['pct'].idxmax()]
outliers['biggest_one_trick'] = {
    'stat': 'Most Loyal to One Character',
    'player': biggest_one_trick['player'],
    'value': f"{biggest_one_trick['pct']:.1f}% on {biggest_one_trick['character']}",
    'detail': f"Across {int(biggest_one_trick['games'])} total games"
}
print(f"🎯 Biggest One-Trick: {outliers['biggest_one_trick']['player']} - {outliers['biggest_one_trick']['value']}")

# ============================================================
# 13. WEEKEND WARRIOR (biggest win rate improvement on weekends)
# ============================================================
weekend_diff = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id]
    weekend = data[data['is_weekend']]
    weekday = data[~data['is_weekend']]
    if len(weekend) >= 10 and len(weekday) >= 10:
        diff = weekend['has_won'].mean() * 100 - weekday['has_won'].mean() * 100
        weekend_diff.append({
            'player': player_lookup[player_id],
            'weekend_wr': weekend['has_won'].mean() * 100,
            'weekday_wr': weekday['has_won'].mean() * 100,
            'diff': diff
        })

weekend_df = pd.DataFrame(weekend_diff)
biggest_weekend_warrior = weekend_df.loc[weekend_df['diff'].idxmax()]
outliers['weekend_warrior'] = {
    'stat': 'Weekend Warrior',
    'player': biggest_weekend_warrior['player'],
    'value': f"+{biggest_weekend_warrior['diff']:.1f}% on weekends",
    'detail': f"Weekend: {biggest_weekend_warrior['weekend_wr']:.1f}% vs Weekday: {biggest_weekend_warrior['weekday_wr']:.1f}%"
}
print(f"🌴 Weekend Warrior: {outliers['weekend_warrior']['player']} - {outliers['weekend_warrior']['value']}")

# ============================================================
# 14. WEEKDAY GRINDER (biggest win rate improvement on weekdays)
# ============================================================
biggest_weekday_grinder = weekend_df.loc[weekend_df['diff'].idxmin()]
outliers['weekday_grinder'] = {
    'stat': 'Weekday Warrior',
    'player': biggest_weekday_grinder['player'],
    'value': f"+{abs(biggest_weekday_grinder['diff']):.1f}% on weekdays",
    'detail': f"Weekday: {biggest_weekday_grinder['weekday_wr']:.1f}% vs Weekend: {biggest_weekday_grinder['weekend_wr']:.1f}%"
}
print(f"💼 Weekday Grinder: {outliers['weekday_grinder']['player']} - {outliers['weekday_grinder']['value']}")

# ============================================================
# 15. NIGHT OWL (most games after 10pm)
# ============================================================
night_games = participants_df[(participants_df['hour'] >= 22) | (participants_df['hour'] <= 4)]
night_counts = night_games.groupby('player').size().sort_values(ascending=False)
top_night_owl = night_counts.index[0]
total_games = len(participants_df[participants_df['player'] == top_night_owl])
outliers['biggest_night_owl'] = {
    'stat': 'Biggest Night Owl',
    'player': player_lookup.get(top_night_owl, 'Unknown'),
    'value': f"{int(night_counts.iloc[0])} late-night games",
    'detail': f"That's {night_counts.iloc[0] / total_games * 100:.1f}% of their games after 10PM"
}
print(f"🦉 Night Owl: {outliers['biggest_night_owl']['player']} - {outliers['biggest_night_owl']['value']}")

# ============================================================
# 16. LATE NIGHT SPECIALIST (best win rate after 10pm, min 20 games)
# ============================================================
late_night_stats = []
for player_id in night_games['player'].unique():
    if player_id not in player_lookup:
        continue
    data = night_games[night_games['player'] == player_id]
    if len(data) >= 20:
        late_night_stats.append({
            'player': player_lookup[player_id],
            'games': len(data),
            'win_rate': data['has_won'].mean() * 100
        })

ln_df = pd.DataFrame(late_night_stats)
late_night_best = ln_df.loc[ln_df['win_rate'].idxmax()]
outliers['late_night_specialist'] = {
    'stat': 'Best After 10PM',
    'player': late_night_best['player'],
    'value': f"{late_night_best['win_rate']:.1f}% win rate",
    'detail': f"Across {int(late_night_best['games'])} late-night games"
}
print(f"🌙 Late Night Specialist: {outliers['late_night_specialist']['player']} - {outliers['late_night_specialist']['value']}")

# ============================================================
# 17. GIANT KILLER (most wins vs #1 ranked player)
# ============================================================
# Find #1 ranked player
elo_ranks = players_df.sort_values('elo', ascending=False)
top_player_id = elo_ranks.iloc[0]['id']
top_player_name = elo_ranks.iloc[0]['display_name']

# Find who beats them most
top_losses = participants_df[
    (participants_df['player'] == top_player_id) &
    (participants_df['has_won'] == False)
]['match_id'].values

killer_counts = defaultdict(int)
for match_id in top_losses:
    winners = participants_df[
        (participants_df['match_id'] == match_id) &
        (participants_df['has_won'] == True)
    ]
    for _, winner in winners.iterrows():
        if winner['player'] in player_lookup and winner['player'] != top_player_id:
            killer_counts[player_lookup[winner['player']]] += 1

top_killer = max(killer_counts.items(), key=lambda x: x[1])
outliers['giant_killer'] = {
    'stat': f'Most Wins vs {top_player_name}',
    'player': top_killer[0],
    'value': f"{top_killer[1]} victories",
    'detail': f"The only real threat to the throne"
}
print(f"🗡️ Giant Killer: {outliers['giant_killer']['player']} - {outliers['giant_killer']['value']}")

# ============================================================
# 18. CURSED CHARACTER
# ============================================================
char_stats = []
for char in participants_df['smash_character'].unique():
    data = participants_df[participants_df['smash_character'] == char]
    if len(data) >= 20:
        char_stats.append({
            'character': char,
            'plays': len(data),
            'win_rate': data['has_won'].mean() * 100
        })

char_df = pd.DataFrame(char_stats)
most_cursed = char_df.loc[char_df['win_rate'].idxmin()]
outliers['most_cursed_char'] = {
    'stat': 'Most Cursed Character',
    'player': most_cursed['character'],
    'value': f"{most_cursed['win_rate']:.1f}% win rate",
    'detail': f"Across {int(most_cursed['plays'])} games. Just don't pick it."
}
print(f"💀 Most Cursed: {outliers['most_cursed_char']['player']} - {outliers['most_cursed_char']['value']}")

# ============================================================
# 19. BLESSED CHARACTER
# ============================================================
most_blessed = char_df.loc[char_df['win_rate'].idxmax()]
outliers['most_blessed_char'] = {
    'stat': 'Most Blessed Character',
    'player': most_blessed['character'],
    'value': f"{most_blessed['win_rate']:.1f}% win rate",
    'detail': f"Across {int(most_blessed['plays'])} games. The secret weapon."
}
print(f"✨ Most Blessed: {outliers['most_blessed_char']['player']} - {outliers['most_blessed_char']['value']}")

# ============================================================
# 20. BIGGEST RIVALRY (most games between two players)
# ============================================================
match_participants = participants_df.groupby('match_id')['player'].apply(list).to_dict()
matchup_counts = defaultdict(int)
for players in match_participants.values():
    if len(players) == 2:
        p1, p2 = sorted(players)
        if p1 in player_lookup and p2 in player_lookup:
            matchup_counts[(player_lookup[p1], player_lookup[p2])] += 1

biggest_rivalry = max(matchup_counts.items(), key=lambda x: x[1])
outliers['biggest_rivalry'] = {
    'stat': 'Biggest Rivalry',
    'player': f"{biggest_rivalry[0][0]} vs {biggest_rivalry[0][1]}",
    'value': f"{biggest_rivalry[1]} matches",
    'detail': "The most frequent matchup in the league"
}
print(f"⚔️ Biggest Rivalry: {outliers['biggest_rivalry']['player']} - {outliers['biggest_rivalry']['value']}")

# ============================================================
# 21. BEST DAY PERFORMANCE (any player, any day)
# ============================================================
day_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
        data = participants_df[(participants_df['player'] == player_id) & (participants_df['weekday'] == day)]
        if len(data) >= 20:
            day_stats.append({
                'player': player_lookup[player_id],
                'day': day,
                'games': len(data),
                'win_rate': data['has_won'].mean() * 100
            })

day_df = pd.DataFrame(day_stats)
best_day_perf = day_df.loc[day_df['win_rate'].idxmax()]
outliers['best_day_performance'] = {
    'stat': f"Best {best_day_perf['day']} Player",
    'player': best_day_perf['player'],
    'value': f"{best_day_perf['win_rate']:.1f}% win rate",
    'detail': f"On {best_day_perf['day']}s across {int(best_day_perf['games'])} games"
}
print(f"📅 Best Day Performance: {outliers['best_day_performance']['player']} - {outliers['best_day_performance']['value']}")

# ============================================================
# 22. WORST DAY PERFORMANCE (any player, any day, min 20 games)
# ============================================================
worst_day_perf = day_df.loc[day_df['win_rate'].idxmin()]
outliers['worst_day_performance'] = {
    'stat': f"Worst {worst_day_perf['day']} Player",
    'player': worst_day_perf['player'],
    'value': f"{worst_day_perf['win_rate']:.1f}% win rate",
    'detail': f"Just don't play on {worst_day_perf['day']}s"
}
print(f"😬 Worst Day: {outliers['worst_day_performance']['player']} - {outliers['worst_day_performance']['value']}")

# ============================================================
# 23. COMEBACK KING (best win rate when they had SDs)
# ============================================================
comeback_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    sd_games = participants_df[(participants_df['player'] == player_id) & (participants_df['total_sds'] > 0)]
    if len(sd_games) >= 10:
        comeback_stats.append({
            'player': player_lookup[player_id],
            'sd_games': len(sd_games),
            'win_rate': sd_games['has_won'].mean() * 100
        })

comeback_df = pd.DataFrame(comeback_stats)
comeback_king = comeback_df.loc[comeback_df['win_rate'].idxmax()]
outliers['comeback_king'] = {
    'stat': 'Comeback King',
    'player': comeback_king['player'],
    'value': f"{comeback_king['win_rate']:.1f}% win rate with SDs",
    'detail': f"Still wins {int(comeback_king['win_rate'])}% of the time after self-destructing"
}
print(f"💪 Comeback King: {outliers['comeback_king']['player']} - {outliers['comeback_king']['value']}")

# ============================================================
# 24. MOST IMPROVED (comparing first 50 games to last 50)
# ============================================================
improvement_stats = []
for player_id in participants_df['player'].unique():
    if player_id not in player_lookup:
        continue
    data = participants_df[participants_df['player'] == player_id].sort_values('created_at')
    if len(data) >= 100:
        first_50 = data.head(50)
        last_50 = data.tail(50)
        improvement = last_50['has_won'].mean() * 100 - first_50['has_won'].mean() * 100
        improvement_stats.append({
            'player': player_lookup[player_id],
            'first_50_wr': first_50['has_won'].mean() * 100,
            'last_50_wr': last_50['has_won'].mean() * 100,
            'improvement': improvement
        })

imp_df = pd.DataFrame(improvement_stats)
most_improved = imp_df.loc[imp_df['improvement'].idxmax()]
outliers['most_improved'] = {
    'stat': 'Most Improved Player',
    'player': most_improved['player'],
    'value': f"+{most_improved['improvement']:.1f}%",
    'detail': f"First 50 games: {most_improved['first_50_wr']:.1f}% → Last 50: {most_improved['last_50_wr']:.1f}%"
}
print(f"📈 Most Improved: {outliers['most_improved']['player']} - {outliers['most_improved']['value']}")

# ============================================================
# 25. FALLEN OFF (biggest decline)
# ============================================================
fallen_off = imp_df.loc[imp_df['improvement'].idxmin()]
outliers['fallen_off'] = {
    'stat': 'Biggest Decline',
    'player': fallen_off['player'],
    'value': f"{fallen_off['improvement']:.1f}%",
    'detail': f"First 50: {fallen_off['first_50_wr']:.1f}% → Last 50: {fallen_off['last_50_wr']:.1f}%"
}
print(f"📉 Fallen Off: {outliers['fallen_off']['player']} - {outliers['fallen_off']['value']}")

# ============================================================
# 26. FRIDAY KING (best on Fridays specifically)
# ============================================================
friday_data = participants_df[participants_df['weekday'] == 'Friday']
friday_stats = []
for player_id in friday_data['player'].unique():
    if player_id not in player_lookup:
        continue
    data = friday_data[friday_data['player'] == player_id]
    if len(data) >= 15:
        friday_stats.append({
            'player': player_lookup[player_id],
            'games': len(data),
            'win_rate': data['has_won'].mean() * 100
        })

fri_df = pd.DataFrame(friday_stats)
friday_king = fri_df.loc[fri_df['win_rate'].idxmax()]
outliers['friday_king'] = {
    'stat': 'Friday King',
    'player': friday_king['player'],
    'value': f"{friday_king['win_rate']:.1f}% win rate",
    'detail': f"Lives for Friday sessions ({int(friday_king['games'])} games)"
}
print(f"🎉 Friday King: {outliers['friday_king']['player']} - {outliers['friday_king']['value']}")

# ============================================================
# 27. 1AM WARRIOR (most games between 1-2am)
# ============================================================
one_am = participants_df[participants_df['hour'] == 1]
one_am_counts = one_am.groupby('player').size().sort_values(ascending=False)
if len(one_am_counts) > 0:
    top_1am = one_am_counts.index[0]
    outliers['1am_warrior'] = {
        'stat': 'The 1AM Warrior',
        'player': player_lookup.get(top_1am, 'Unknown'),
        'value': f"{int(one_am_counts.iloc[0])} games at 1AM",
        'detail': "Why are you playing at 1AM?!"
    }
    print(f"⏰ 1AM Warrior: {outliers['1am_warrior']['player']} - {outliers['1am_warrior']['value']}")

# ============================================================
# 28. PERFECT GAME MASTER
# ============================================================
perfect_games = participants_df[
    (participants_df['total_kos'] >= 3) &
    (participants_df['total_falls'] == 0) &
    (participants_df['has_won'] == True)
]
perfect_counts = perfect_games.groupby('player').size().sort_values(ascending=False)
top_perfect = perfect_counts.index[0]
total_games_player = len(participants_df[participants_df['player'] == top_perfect])
outliers['perfect_game_master'] = {
    'stat': 'Most Perfect Games',
    'player': player_lookup.get(top_perfect, 'Unknown'),
    'value': f"{int(perfect_counts.iloc[0])} flawless victories",
    'detail': f"That's {perfect_counts.iloc[0] / total_games_player * 100:.1f}% of their games"
}
print(f"💯 Perfect Game Master: {outliers['perfect_game_master']['player']} - {outliers['perfect_game_master']['value']}")

# ============================================================
# 29. MOST KOs IN ONE GAME
# ============================================================
max_ko_row = participants_df.loc[participants_df['total_kos'].idxmax()]
outliers['single_game_kos'] = {
    'stat': 'Most KOs in One Match',
    'player': player_lookup.get(max_ko_row['player'], 'Unknown'),
    'value': f"{int(max_ko_row['total_kos'])} KOs",
    'detail': f"Playing as {max_ko_row['smash_character']}"
}
print(f"⚡ Most KOs Single Game: {outliers['single_game_kos']['player']} - {outliers['single_game_kos']['value']}")

# ============================================================
# 30. RAREST CHARACTER USER
# ============================================================
char_counts = participants_df['smash_character'].value_counts()
rare_chars = char_counts[char_counts <= 5]
rare_char_users = []
for char in rare_chars.index:
    users = participants_df[participants_df['smash_character'] == char]['player'].unique()
    for user in users:
        if user in player_lookup:
            rare_char_users.append({
                'player': player_lookup[user],
                'character': char,
                'times': len(participants_df[(participants_df['player'] == user) & (participants_df['smash_character'] == char)])
            })

if rare_char_users:
    most_rare = max(rare_char_users, key=lambda x: x['times'])
    outliers['rare_char_user'] = {
        'stat': 'Rarest Character Specialist',
        'player': most_rare['player'],
        'value': f"{most_rare['character']}",
        'detail': f"One of the only players to use this character"
    }
    print(f"🦄 Rare Char User: {outliers['rare_char_user']['player']} - {outliers['rare_char_user']['value']}")

# ============================================================
# SAVE RESULTS
# ============================================================
with open('outliers_stats.json', 'w') as f:
    json.dump(outliers, f, indent=2, default=str)

print("\n✨ Outliers saved to outliers_stats.json!")

# Print summary
print("\n" + "="*60)
print("SUMMARY OF OUTLIERS")
print("="*60)
for key, data in outliers.items():
    print(f"\n{data['stat']}:")
    print(f"  {data['player']} - {data['value']}")
    print(f"  {data['detail']}")
