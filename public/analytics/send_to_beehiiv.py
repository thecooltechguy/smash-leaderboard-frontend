#!/usr/bin/env python3
"""
Beehiiv Newsletter Integration for Smash Bros Daily Report
Sends the daily report as a newsletter via Beehiiv API
"""

import json
import os
import sys
import requests
from pathlib import Path
from datetime import datetime


def load_daily_report():
    """Load the daily report JSON"""
    report_file = Path('daily_report.json')
    if not report_file.exists():
        print("ERROR: daily_report.json not found")
        return None

    with open(report_file, 'r') as f:
        return json.load(f)


def format_html_email(report):
    """Convert report to beautiful HTML email format"""

    # Build player stats table HTML
    stats_table_html = ""
    if report.get('stats_summary') and report['stats_summary'].get('player_stats'):
        stats_table_html = """
        <h2 style="color: #1a1a1a; margin-top: 30px; margin-bottom: 15px;">📊 Top Players Today</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Player</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Games</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">W-L</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Win %</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">K/D</th>
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Main</th>
                </tr>
            </thead>
            <tbody>
        """

        for i, player in enumerate(report['stats_summary']['player_stats'][:10]):
            bg_color = "#f9f9f9" if i % 2 == 0 else "#ffffff"
            win_rate_color = "#22c55e" if player['win_rate'] >= 50 else "#ef4444" if player['win_rate'] < 33 else "#f59e0b"

            stats_table_html += f"""
                <tr style="background-color: {bg_color};">
                    <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>{player['name']}</strong></td>
                    <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">{player['games']}</td>
                    <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">{player['wins']}-{player['losses']}</td>
                    <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee; color: {win_rate_color}; font-weight: bold;">{player['win_rate']}%</td>
                    <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">{player['kd_ratio']}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">{player['main_character']}</td>
                </tr>
            """

        stats_table_html += """
            </tbody>
        </table>
        """

    # Build highlights HTML
    highlights_html = ""
    if report.get('highlights'):
        highlights_html = '<ul style="margin: 20px 0; padding-left: 20px;">'
        for highlight in report['highlights']:
            highlights_html += f'<li style="margin-bottom: 8px; line-height: 1.6;">{highlight}</li>'
        highlights_html += '</ul>'

    # Build rivalries section
    rivalries_html = ""
    if report.get('stats_summary', {}).get('rivalries'):
        rivalries_html = """
        <h2 style="color: #1a1a1a; margin-top: 30px; margin-bottom: 15px;">🔥 Top Rivalries</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        """
        for rivalry in report['stats_summary']['rivalries'][:3]:
            total = rivalry['total_games']
            p1_wins = rivalry['p1_wins']
            p2_wins = rivalry['p2_wins']
            rivalries_html += f"""
            <div style="margin-bottom: 10px;">
                <strong>{rivalry['player1']}</strong> vs <strong>{rivalry['player2']}</strong>:
                {p1_wins}-{p2_wins} ({total} game{'s' if total > 1 else ''})
            </div>
            """
        rivalries_html += '</div>'

    # Build perfect games section
    perfect_games_html = ""
    if report.get('stats_summary', {}).get('perfect_games'):
        perfect_games_html = """
        <h2 style="color: #1a1a1a; margin-top: 30px; margin-bottom: 15px;">💯 Perfect Games (3-0)</h2>
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
        """
        for pg in report['stats_summary']['perfect_games']:
            perfect_games_html += f'<div style="margin-bottom: 5px;">🌟 <strong>{pg["player"]}</strong> ({pg["character"]})</div>'
        perfect_games_html += '</div>'

    # Construct full HTML
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">

        <!-- Hero Headline -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px; margin-bottom: 30px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; opacity: 0.9;">
                {report['date']}
            </div>
            <h1 style="font-size: 28px; margin: 0; line-height: 1.2; font-weight: 800;">
                {report['headline']}
            </h1>
        </div>

        <!-- Main Report -->
        <div style="background-color: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; line-height: 1.7; font-size: 16px;">
            {report['report'].replace(chr(10) + chr(10), '</p><p style="margin: 15px 0;">').replace(chr(10), '<br>')}
        </div>

        <!-- Player of the Day -->
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="margin: 0 0 10px 0; font-size: 18px;">🏆 Player of the Day</h2>
            <div style="font-size: 22px; font-weight: bold; margin-bottom: 5px;">{report['player_of_the_day']['name']}</div>
            <div style="opacity: 0.95; font-size: 14px;">{report['player_of_the_day']['reason']}</div>
        </div>

        <!-- Key Highlights -->
        <h2 style="color: #1a1a1a; margin-top: 30px; margin-bottom: 15px;">⚡ Key Highlights</h2>
        {highlights_html}

        {perfect_games_html}

        {stats_table_html}

        {rivalries_html}

        <!-- CTA to Full Report -->
        <div style="text-align: center; margin: 40px 0 30px 0;">
            <a href="https://anishthite.github.io/smash-leaderboard-analysis/daily.html"
               style="display: inline-block; background-color: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Interactive Report →
            </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            Daily Smash Bros Leaderboard Report<br>
            Generated automatically • Powered by Claude AI
        </div>

    </div>
    """

    return html


def send_to_beehiiv(report, html_content, dry_run=False):
    """Send the report to Beehiiv via API"""

    api_key = os.environ.get('BEEHIIV_API_KEY')
    publication_id = os.environ.get('BEEHIIV_PUBLICATION_ID')

    if not api_key:
        print("ERROR: BEEHIIV_API_KEY environment variable not set")
        print("Please set it in your GitHub repository secrets")
        return False

    if not publication_id:
        print("ERROR: BEEHIIV_PUBLICATION_ID environment variable not set")
        print("Please set it in your GitHub repository secrets")
        return False

    # Construct API endpoint
    url = f"https://api.beehiiv.com/v2/publications/{publication_id}/posts"

    # Prepare headers
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    # Prepare post data
    subject_line = f"{report['headline']} - {report['date']}"
    preview_text = report['highlights'][0] if report.get('highlights') else report['report'][:100]

    post_data = {
        "title": subject_line,
        "content_tags": ["daily-report", "smash-bros", "leaderboard"],
        "web_title": subject_line,
        "web_description": preview_text,
        "content_free": html_content,
        "platform": "both",  # Send via email and web
        "status": "confirmed",  # Publish immediately (use "draft" for testing)
    }

    if dry_run:
        print("=== DRY RUN MODE ===")
        print(f"Would send to: {url}")
        print(f"Subject: {subject_line}")
        print(f"Preview: {preview_text[:100]}...")
        print("\nHTML Preview (first 500 chars):")
        print(html_content[:500] + "...")
        return True

    # Send the request
    try:
        print(f"Sending newsletter to Beehiiv...")
        print(f"Subject: {subject_line}")

        response = requests.post(url, headers=headers, json=post_data)

        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ Successfully published to Beehiiv!")
            if result.get('data', {}).get('web_url'):
                print(f"Web URL: {result['data']['web_url']}")
            return True
        else:
            print(f"❌ Failed to publish to Beehiiv")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error sending to Beehiiv: {e}")
        return False


def main():
    """Main execution"""
    # Check for dry run flag
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv

    if dry_run:
        print("Running in DRY RUN mode - no actual newsletter will be sent\n")

    # Load report
    print("Loading daily report...")
    report = load_daily_report()

    if not report:
        return False

    print(f"Report loaded: {report['date']}")
    print(f"Headline: {report['headline']}")

    # Check if there's content to send
    if not report.get('stats_summary'):
        print("No matches today - skipping newsletter send")
        return True

    # Format HTML
    print("Formatting HTML email...")
    html_content = format_html_email(report)

    # Send to Beehiiv
    success = send_to_beehiiv(report, html_content, dry_run=dry_run)

    if success:
        print("\n🎉 Newsletter process completed successfully!")
    else:
        print("\n⚠️  Newsletter process encountered errors")

    return success


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
