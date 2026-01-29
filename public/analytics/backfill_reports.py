#!/usr/bin/env python3
"""
Backfill daily reports for the past N days
"""

import pandas as pd
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
import glob
import anthropic

# PST timezone offset (UTC-8)
PST_OFFSET = timedelta(hours=-8)

def get_latest_file(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        raise FileNotFoundError(f"No files found matching {pattern}")
    return files[-1]

def get_matches_for_date(participants_df, matches_df, player_lookup, target_date, reset_hour=8):
    """Get all matches for a specific date (8am to 8am PST window)"""
    # target_date is the date we're reporting ON (e.g., Jan 20)
    # We want matches from 8am on target_date to 8am on target_date+1

    start_pst = target_date.replace(hour=reset_hour, minute=0, second=0, microsecond=0)
    end_pst = start_pst + timedelta(days=1)

    # Convert to UTC for database comparison
    start_utc = start_pst - PST_OFFSET
    end_utc = end_pst - PST_OFFSET

    # Filter matches in the time window
    day_matches = matches_df[
        (matches_df['created_at'] >= start_utc) &
        (matches_df['created_at'] < end_utc)
    ]

    match_ids = day_matches['id'].tolist()
    day_participants = participants_df[participants_df['match_id'].isin(match_ids)]

    return day_matches, day_participants, start_pst.strftime('%B %d, %Y')

def analyze_daily_stats(day_matches, day_participants, player_lookup):
    """Analyze key stats from a day's matches"""
    if len(day_matches) == 0:
        return None

    stats = {
        'total_matches': len(day_matches),
        'total_participants': len(day_participants),
        'total_kos': int(day_participants['total_kos'].sum()),
        'total_falls': int(day_participants['total_falls'].sum()),
        'total_sds': int(day_participants['total_sds'].sum()),
    }

    # Player performance
    player_stats = []
    for player_id in day_participants['player'].unique():
        if player_id not in player_lookup:
            continue
        player_matches = day_participants[day_participants['player'] == player_id]
        wins = player_matches['has_won'].sum()
        games = len(player_matches)
        kos = player_matches['total_kos'].sum()
        falls = player_matches['total_falls'].sum()
        sds = player_matches['total_sds'].sum()
        chars = player_matches['smash_character'].value_counts()

        player_stats.append({
            'name': player_lookup[player_id],
            'games': int(games),
            'wins': int(wins),
            'losses': int(games - wins),
            'win_rate': round(wins / games * 100, 1) if games > 0 else 0,
            'kos': int(kos),
            'falls': int(falls),
            'sds': int(sds),
            'kd_ratio': round(kos / max(falls, 1), 2),
            'main_character': chars.index[0] if len(chars) > 0 else 'Unknown',
            'character_games': int(chars.iloc[0]) if len(chars) > 0 else 0
        })

    stats['player_stats'] = sorted(player_stats, key=lambda x: x['games'], reverse=True)

    if player_stats:
        stats['most_active'] = max(player_stats, key=lambda x: x['games'])
        stats['best_kd'] = max([p for p in player_stats if p['games'] >= 3], key=lambda x: x['kd_ratio'], default=None)
        stats['hottest_player'] = max([p for p in player_stats if p['games'] >= 3], key=lambda x: x['win_rate'], default=None)

    # Character usage
    char_usage = day_participants['smash_character'].value_counts()
    stats['top_characters'] = [
        {'character': char, 'times_played': int(count)}
        for char, count in char_usage.head(5).items()
    ]

    # Perfect games
    perfect_games = day_participants[
        (day_participants['total_kos'] == 3) &
        (day_participants['total_falls'] == 0) &
        (day_participants['has_won'] == True)
    ]
    stats['perfect_games'] = [
        {'player': player_lookup.get(row['player'], 'Unknown'), 'character': row['smash_character']}
        for _, row in perfect_games.iterrows()
        if row['player'] in player_lookup
    ]

    # Most KOs
    if len(day_participants) > 0:
        max_kos_row = day_participants.loc[day_participants['total_kos'].idxmax()]
        stats['most_kos_single_match'] = {
            'player': player_lookup.get(max_kos_row['player'], 'Unknown'),
            'kos': int(max_kos_row['total_kos']),
            'character': max_kos_row['smash_character']
        }

    # Rivalries
    match_participants = day_participants.groupby('match_id')
    rivalries = {}
    for match_id, group in match_participants:
        if len(group) == 2:
            players = group['player'].tolist()
            p1, p2 = sorted(players)
            if p1 in player_lookup and p2 in player_lookup:
                key = (player_lookup[p1], player_lookup[p2])
                if key not in rivalries:
                    rivalries[key] = {'p1_wins': 0, 'p2_wins': 0, 'total': 0}
                rivalries[key]['total'] += 1
                winner = group[group['has_won'] == True]['player'].iloc[0]
                if winner == p1:
                    rivalries[key]['p1_wins'] += 1
                else:
                    rivalries[key]['p2_wins'] += 1

    stats['daily_rivalries'] = [
        {'player1': k[0], 'player2': k[1], 'total_games': v['total'], 'p1_wins': v['p1_wins'], 'p2_wins': v['p2_wins']}
        for k, v in sorted(rivalries.items(), key=lambda x: x[1]['total'], reverse=True)[:5]
    ]

    # Win streaks
    streaks = {}
    for player_id in day_participants['player'].unique():
        if player_id not in player_lookup:
            continue
        player_matches = day_participants[day_participants['player'] == player_id].sort_values('created_at')
        current_streak = 0
        max_streak = 0
        for _, row in player_matches.iterrows():
            if row['has_won']:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
        if max_streak >= 3:
            streaks[player_lookup[player_id]] = max_streak

    stats['win_streaks'] = [
        {'player': name, 'streak': streak}
        for name, streak in sorted(streaks.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    return stats

def generate_llm_report(stats, date_str, client):
    """Use Claude to generate a sports-style daily report"""
    if stats is None:
        return {
            'date': date_str,
            'generated_at': datetime.now().isoformat(),
            'headline': 'REST DAY AT THE ARENA',
            'report': f'No matches were recorded on {date_str}. The arena was quiet as competitors took a well-deserved break.',
            'highlights': [],
            'player_of_the_day': None,
            'stats_summary': None
        }

    prompt = f"""You are an enthusiastic sports broadcaster covering competitive Super Smash Bros. at an office league.
Generate a fun, energetic daily recap report for {date_str}. Write it like you're delivering the evening sports news.

Here are the stats from today's action:

OVERALL:
- Total Matches: {stats['total_matches']}
- Total KOs: {stats['total_kos']}
- Total Falls: {stats['total_falls']}
- Self-Destructs: {stats['total_sds']}

PLAYER PERFORMANCES:
{json.dumps(stats['player_stats'][:10], indent=2)}

MOST ACTIVE PLAYER: {stats.get('most_active', {}).get('name', 'N/A')} with {stats.get('most_active', {}).get('games', 0)} games
HOTTEST PLAYER: {stats.get('hottest_player', {}).get('name', 'N/A') if stats.get('hottest_player') else 'N/A'} ({stats.get('hottest_player', {}).get('win_rate', 0) if stats.get('hottest_player') else 0}% win rate)
BEST K/D: {stats.get('best_kd', {}).get('name', 'N/A') if stats.get('best_kd') else 'N/A'} ({stats.get('best_kd', {}).get('kd_ratio', 0) if stats.get('best_kd') else 0} K/D)

TOP CHARACTERS TODAY:
{json.dumps(stats['top_characters'], indent=2)}

PERFECT GAMES (3 KOs, 0 Falls):
{json.dumps(stats['perfect_games'], indent=2) if stats['perfect_games'] else 'None today'}

HEAD-TO-HEAD RIVALRIES:
{json.dumps(stats['daily_rivalries'], indent=2)}

WIN STREAKS:
{json.dumps(stats['win_streaks'], indent=2) if stats['win_streaks'] else 'No notable streaks'}

Generate the report with:
1. A catchy headline (ALL CAPS, exciting, punny if possible)
2. An opening paragraph setting the scene
3. 3-4 paragraphs covering the key storylines
4. Player of the day callout
5. A closing teaser

Be enthusiastic, use sports clichés, and make it entertaining! Keep it around 300-400 words.

Respond in JSON format:
{{
    "headline": "YOUR HEADLINE HERE",
    "report": "Full report text here with paragraph breaks as \\n\\n",
    "player_of_the_day": {{
        "name": "player name",
        "reason": "short reason why"
    }},
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
}}"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text
        report_data = json.loads(response_text)
        report_data['date'] = date_str
        report_data['generated_at'] = datetime.now().isoformat()
        report_data['stats_summary'] = {
            'total_matches': stats['total_matches'],
            'total_kos': stats['total_kos'],
            'player_stats': stats['player_stats'][:10],
            'top_characters': stats['top_characters'],
            'perfect_games': stats['perfect_games'],
            'rivalries': stats['daily_rivalries'],
            'win_streaks': stats['win_streaks']
        }
        return report_data
    except Exception as e:
        print(f"LLM error for {date_str}: {e}")
        # Fallback
        return {
            'date': date_str,
            'generated_at': datetime.now().isoformat(),
            'headline': f"ACTION AT THE ARENA: {stats['total_matches']} MATCHES!",
            'report': f"We saw {stats['total_matches']} matches with {stats['total_kos']} total KOs on {date_str}.",
            'player_of_the_day': {'name': stats.get('most_active', {}).get('name', 'Unknown'), 'reason': 'Most active'},
            'highlights': [f"{stats['total_matches']} matches played"],
            'stats_summary': {
                'total_matches': stats['total_matches'],
                'total_kos': stats['total_kos'],
                'player_stats': stats['player_stats'][:10],
                'top_characters': stats['top_characters'],
                'perfect_games': stats['perfect_games'],
                'rivalries': stats['daily_rivalries'],
                'win_streaks': stats['win_streaks']
            }
        }

def main():
    # Load data
    players_df = pd.read_csv(get_latest_file('data/public_players_export_*.csv'))
    matches_df = pd.read_csv(get_latest_file('data/public_matches_export_*.csv'))
    participants_df = pd.read_csv(get_latest_file('data/public_match_participants_export_*.csv'))

    matches_df['created_at'] = pd.to_datetime(matches_df['created_at'], format='mixed')
    participants_df['created_at'] = pd.to_datetime(participants_df['created_at'], format='mixed')

    player_lookup = players_df.set_index('id')['display_name'].to_dict()

    print(f"Loaded {len(players_df)} players, {len(matches_df)} matches, {len(participants_df)} participants")

    # Initialize Anthropic client
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    client = anthropic.Anthropic(api_key=api_key) if api_key else None

    # Load existing history
    history_file = Path('daily_reports_history.json')
    if history_file.exists():
        with open(history_file, 'r') as f:
            history = json.load(f)
    else:
        history = {'reports': []}

    # Generate reports for the past 7 days
    now_pst = datetime.utcnow() + PST_OFFSET

    for days_ago in range(7, 0, -1):  # Start from 7 days ago, work forward
        target_date = now_pst - timedelta(days=days_ago)

        day_matches, day_participants, date_str = get_matches_for_date(
            participants_df, matches_df, player_lookup, target_date
        )

        print(f"\n{date_str}: {len(day_matches)} matches")

        if len(day_matches) == 0:
            print(f"  Skipping - no matches")
            continue

        # Check if we already have this report
        existing = [r for r in history['reports'] if r['date'] == date_str]
        if existing:
            print(f"  Skipping - report already exists")
            continue

        # Analyze and generate report
        stats = analyze_daily_stats(day_matches, day_participants, player_lookup)

        if client:
            report = generate_llm_report(stats, date_str, client)
        else:
            print(f"  No API key - using fallback report")
            report = generate_llm_report(stats, date_str, None)

        # Add to history
        history['reports'].insert(0, report)
        print(f"  Generated report: {report['headline']}")

    # Sort by date (most recent first) and keep last 30
    history['reports'] = sorted(history['reports'], key=lambda x: x['date'], reverse=True)[:30]

    # Save history
    with open('daily_reports_history.json', 'w') as f:
        json.dump(history, f, indent=2)

    # Save most recent as current
    if history['reports']:
        with open('daily_report.json', 'w') as f:
            json.dump(history['reports'][0], f, indent=2)

    print(f"\nBackfill complete! Generated {len(history['reports'])} reports")

if __name__ == '__main__':
    main()
