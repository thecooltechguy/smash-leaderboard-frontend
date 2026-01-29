#!/usr/bin/env python3
"""
Daily Sports Report Generator for Smash Bros Leaderboard
Generates an LLM-powered daily recap that sounds like a sports broadcast
"""

import pandas as pd
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
import anthropic

# PST timezone offset (UTC-8)
PST_OFFSET = timedelta(hours=-8)

def get_yesterday_matches(participants_df, matches_df, player_lookup, reset_hour=8):
    """Get all matches from yesterday (8am to 8am PST window)"""
    now_utc = datetime.utcnow()
    now_pst = now_utc + PST_OFFSET

    # Yesterday's window: 8am yesterday to 8am today (PST)
    today_reset = now_pst.replace(hour=reset_hour, minute=0, second=0, microsecond=0)
    yesterday_reset = today_reset - timedelta(days=1)

    # Convert back to UTC for database comparison
    start_utc = yesterday_reset - PST_OFFSET
    end_utc = today_reset - PST_OFFSET

    print(f"Searching for matches between {start_utc} and {end_utc} UTC")
    print(f"(That's {yesterday_reset} to {today_reset} PST)")

    # Filter matches in the time window
    yesterday_matches = matches_df[
        (matches_df['created_at'] >= start_utc) &
        (matches_df['created_at'] < end_utc)
    ]

    match_ids = yesterday_matches['id'].tolist()
    yesterday_participants = participants_df[participants_df['match_id'].isin(match_ids)]

    return yesterday_matches, yesterday_participants, yesterday_reset.strftime('%B %d, %Y')

def analyze_daily_stats(yesterday_matches, yesterday_participants, player_lookup):
    """Analyze key stats from yesterday's matches"""
    if len(yesterday_matches) == 0:
        return None

    stats = {
        'total_matches': len(yesterday_matches),
        'total_participants': len(yesterday_participants),
        'total_kos': int(yesterday_participants['total_kos'].sum()),
        'total_falls': int(yesterday_participants['total_falls'].sum()),
        'total_sds': int(yesterday_participants['total_sds'].sum()),
    }

    # Player performance
    player_stats = []
    for player_id in yesterday_participants['player'].unique():
        if player_id not in player_lookup:
            continue
        player_matches = yesterday_participants[yesterday_participants['player'] == player_id]
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

    # Most active player
    if player_stats:
        stats['most_active'] = max(player_stats, key=lambda x: x['games'])
        stats['best_kd'] = max(player_stats, key=lambda x: x['kd_ratio']) if any(p['games'] >= 3 for p in player_stats) else None
        stats['hottest_player'] = max([p for p in player_stats if p['games'] >= 3], key=lambda x: x['win_rate'], default=None)

    # Character usage
    char_usage = yesterday_participants['smash_character'].value_counts()
    stats['top_characters'] = [
        {'character': char, 'times_played': int(count)}
        for char, count in char_usage.head(5).items()
    ]

    # Perfect games (3 KOs, 0 falls)
    perfect_games = yesterday_participants[
        (yesterday_participants['total_kos'] == 3) &
        (yesterday_participants['total_falls'] == 0) &
        (yesterday_participants['has_won'] == True)
    ]
    if len(perfect_games) > 0:
        stats['perfect_games'] = [
            {
                'player': player_lookup.get(row['player'], 'Unknown'),
                'character': row['smash_character']
            }
            for _, row in perfect_games.iterrows()
            if row['player'] in player_lookup
        ]
    else:
        stats['perfect_games'] = []

    # Notable moments: highest KO game, biggest SD disasters
    max_kos_row = yesterday_participants.loc[yesterday_participants['total_kos'].idxmax()]
    stats['most_kos_single_match'] = {
        'player': player_lookup.get(max_kos_row['player'], 'Unknown'),
        'kos': int(max_kos_row['total_kos']),
        'character': max_kos_row['smash_character']
    }

    # Biggest rivalries of the day (head-to-head matchups)
    match_participants = yesterday_participants.groupby('match_id')
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
        {
            'player1': k[0],
            'player2': k[1],
            'total_games': v['total'],
            'p1_wins': v['p1_wins'],
            'p2_wins': v['p2_wins']
        }
        for k, v in sorted(rivalries.items(), key=lambda x: x[1]['total'], reverse=True)[:5]
    ]

    # Win streaks
    streaks = {}
    for player_id in yesterday_participants['player'].unique():
        if player_id not in player_lookup:
            continue
        player_matches = yesterday_participants[
            yesterday_participants['player'] == player_id
        ].sort_values('created_at')
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

def generate_llm_report(stats, date_str):
    """Use Claude to generate a sports-style daily report"""
    if stats is None:
        return {
            'date': date_str,
            'generated_at': datetime.now().isoformat(),
            'headline': 'REST DAY AT THE ARENA',
            'report': f'No matches were recorded on {date_str}. The arena was quiet as competitors took a well-deserved break. Will we see explosive action tomorrow? Stay tuned!',
            'highlights': [],
            'stats_summary': None
        }

    # Build the prompt
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

BIGGEST SINGLE-MATCH PERFORMANCE:
{stats['most_kos_single_match']['player']} landed {stats['most_kos_single_match']['kos']} KOs with {stats['most_kos_single_match']['character']}

HEAD-TO-HEAD RIVALRIES:
{json.dumps(stats['daily_rivalries'], indent=2)}

WIN STREAKS:
{json.dumps(stats['win_streaks'], indent=2) if stats['win_streaks'] else 'No notable streaks'}

Generate the report with:
1. A catchy headline (ALL CAPS, exciting, punny if possible)
2. An opening paragraph setting the scene
3. 3-4 paragraphs covering the key storylines (rivalries, upsets, dominant performances, etc.)
4. Player of the day callout
5. A closing teaser for tomorrow

Be enthusiastic, use sports clichés, reference Smash Bros. characters and moves, and make it entertaining!
Keep it around 300-400 words total.

Respond in JSON format:
{{
    "headline": "YOUR HEADLINE HERE",
    "report": "Full report text here with paragraph breaks as \\n\\n",
    "player_of_the_day": {{
        "name": "player name",
        "reason": "short reason why"
    }},
    "highlights": [
        "Highlight 1",
        "Highlight 2",
        "Highlight 3"
    ]
}}"""

    # Call Claude API
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        # Fallback report if no API key
        return generate_fallback_report(stats, date_str)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        response_text = message.content[0].text
        # Parse JSON from response
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
        print(f"LLM API error: {e}")
        return generate_fallback_report(stats, date_str)

def generate_fallback_report(stats, date_str):
    """Generate a basic report without LLM"""
    most_active = stats.get('most_active', {})
    hottest = stats.get('hottest_player', {})

    headline = f"ACTION-PACKED DAY: {stats['total_matches']} MATCHES, {stats['total_kos']} KOS!"

    report = f"""What a day at the Smash Arena! We witnessed {stats['total_matches']} intense matches with a combined {stats['total_kos']} knockouts.

{most_active.get('name', 'Unknown')} was the workhorse of the day, grinding through {most_active.get('games', 0)} matches with {most_active.get('wins', 0)} victories.

"""
    if hottest:
        report += f"The hottest player was {hottest.get('name', 'Unknown')} who maintained an impressive {hottest.get('win_rate', 0)}% win rate.\n\n"

    if stats['perfect_games']:
        perfect = stats['perfect_games'][0]
        report += f"We even saw perfection today - {perfect['player']} delivered a flawless 3-0 with {perfect['character']}!\n\n"

    report += "The arena awaits more battles tomorrow. Who will rise to the top?"

    highlights = [
        f"{stats['total_matches']} total matches played",
        f"{most_active.get('name', 'Unknown')} most active with {most_active.get('games', 0)} games",
    ]
    if stats['perfect_games']:
        highlights.append(f"{len(stats['perfect_games'])} perfect game(s) achieved")

    return {
        'date': date_str,
        'generated_at': datetime.now().isoformat(),
        'headline': headline,
        'report': report,
        'player_of_the_day': {
            'name': most_active.get('name', 'Unknown'),
            'reason': f"Most active player with {most_active.get('games', 0)} games"
        },
        'highlights': highlights,
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

def load_historical_reports():
    """Load existing historical reports"""
    history_file = Path('daily_reports_history.json')
    if history_file.exists():
        with open(history_file, 'r') as f:
            return json.load(f)
    return {'reports': []}

def save_report(report, history):
    """Save the new report and update history"""
    # Save latest report
    with open('daily_report.json', 'w') as f:
        json.dump(report, f, indent=2)

    # Update history (keep last 30 days)
    history['reports'] = [r for r in history['reports'] if r['date'] != report['date']]
    history['reports'].insert(0, report)
    history['reports'] = history['reports'][:30]

    with open('daily_reports_history.json', 'w') as f:
        json.dump(history, f, indent=2)

    print(f"Report saved for {report['date']}")

def main():
    from pathlib import Path
    import glob

    # Find the data files
    data_dir = Path('data')
    players_files = list(data_dir.glob('public_players_export_*.csv'))
    matches_files = list(data_dir.glob('public_matches_export_*.csv'))
    participants_files = list(data_dir.glob('public_match_participants_export_*.csv'))

    if not all([players_files, matches_files, participants_files]):
        print("ERROR: Data files not found in data/ directory")
        return False

    # Load the most recent files
    players_df = pd.read_csv(sorted(players_files)[-1])
    matches_df = pd.read_csv(sorted(matches_files)[-1])
    participants_df = pd.read_csv(sorted(participants_files)[-1])

    # Convert timestamps to datetime (matching backfill_reports.py pattern)
    matches_df['created_at'] = pd.to_datetime(matches_df['created_at'], format='mixed')
    participants_df['created_at'] = pd.to_datetime(participants_df['created_at'], format='mixed')

    # Create player lookup
    player_lookup = players_df.set_index('id')['display_name'].to_dict()

    print(f"Loaded {len(players_df)} players, {len(matches_df)} matches, {len(participants_df)} participants")

    # Get yesterday's matches
    yesterday_matches, yesterday_participants, date_str = get_yesterday_matches(
        participants_df, matches_df, player_lookup
    )

    print(f"Found {len(yesterday_matches)} matches for {date_str}")
    if len(matches_df) > 0:
        print(f"Total matches in database: {len(matches_df)}")
        print(f"Date range in database: {matches_df['created_at'].min()} to {matches_df['created_at'].max()}")

    # Analyze stats
    stats = analyze_daily_stats(yesterday_matches, yesterday_participants, player_lookup)

    # Generate report
    report = generate_llm_report(stats, date_str)

    # Save report
    history = load_historical_reports()
    save_report(report, history)

    print(f"\n=== DAILY REPORT: {date_str} ===")
    print(f"Headline: {report['headline']}")
    print(f"Matches: {stats['total_matches'] if stats else 0}")

    return True

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
