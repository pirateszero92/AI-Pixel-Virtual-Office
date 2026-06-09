import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Add new columns to agents table
        columns = [
            ("skin_tone", "VARCHAR DEFAULT '#fcd5ce'"),
            ("hair_style", "VARCHAR DEFAULT 'short'"),
            ("hair_color", "VARCHAR DEFAULT '#333333'"),
            ("eye_color", "VARCHAR DEFAULT '#000000'"),
            ("facial_hair", "VARCHAR DEFAULT 'none'"),
            ("glasses", "VARCHAR DEFAULT 'none'"),
            ("hat", "VARCHAR DEFAULT 'none'"),
            ("costume", "VARCHAR DEFAULT 'casual'"),
            ("held_item", "VARCHAR DEFAULT 'none'"),
            ("emoji", "VARCHAR DEFAULT '😐'"),
            ("badge_color", "VARCHAR DEFAULT '#4ade80'")
        ]
        
        for col_name, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE agents ADD COLUMN {col_name} {col_type}"))
                print(f"Added {col_name}")
            except Exception as e:
                print(f"Skipped {col_name}: {e}")
                
        # Create new tables
        conn.execute(text('''
        CREATE TABLE IF NOT EXISTS map_items (
            id SERIAL PRIMARY KEY,
            item_type VARCHAR NOT NULL,
            x FLOAT DEFAULT 0.0,
            y FLOAT DEFAULT 0.0,
            rotation INTEGER DEFAULT 0,
            z_index INTEGER DEFAULT 1
        )
        '''))
        
        conn.execute(text('''
        CREATE TABLE IF NOT EXISTS rooms (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            x FLOAT DEFAULT 0.0,
            y FLOAT DEFAULT 0.0,
            width FLOAT DEFAULT 100.0,
            height FLOAT DEFAULT 100.0,
            color VARCHAR DEFAULT '#38bdf8'
        )
        '''))
        conn.commit()
        print("Migration successful")

if __name__ == "__main__":
    migrate()
