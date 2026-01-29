#!/usr/bin/env python3
"""
PostgreSQL Data Export Script for Smash Bros Leaderboard
Exports data from the PostgreSQL database to CSV files for analysis
"""

import os
import psycopg2
import csv
from datetime import datetime
from pathlib import Path

# Database connection from environment variables
DATABASE_URL = os.environ.get('DATABASE_URL')

def export_table(cursor, table_name, output_path):
    """Export a table to CSV"""
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows)

    print(f"Exported {len(rows)} rows from {table_name} to {output_path}")
    return len(rows)

def main():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable not set")
        return False

    # Create data directory if it doesn't exist
    data_dir = Path('data')
    data_dir.mkdir(exist_ok=True)

    # Get current timestamp for filenames
    timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')

    try:
        # Connect to database
        print(f"Connecting to database...")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()

        # Remove old data files
        for old_file in data_dir.glob('*.csv'):
            old_file.unlink()
            print(f"Removed old file: {old_file}")

        # Export tables
        tables = [
            ('public.players', f'public_players_export_{timestamp}.csv'),
            ('public.matches', f'public_matches_export_{timestamp}.csv'),
            ('public.match_participants', f'public_match_participants_export_{timestamp}.csv'),
        ]

        for table_name, filename in tables:
            output_path = data_dir / filename
            export_table(cursor, table_name, output_path)

        cursor.close()
        conn.close()

        print(f"\nData export complete at {timestamp}")
        return True

    except Exception as e:
        print(f"ERROR: Failed to export data: {e}")
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
