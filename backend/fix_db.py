import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "batches.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check current columns
cursor.execute("PRAGMA table_info(batch_items)")
cols = [row[1] for row in cursor.fetchall()]
print(f"Current batch_items columns: {', '.join(cols)}")

# Add status column if missing
if 'status' not in cols:
    try:
        cursor.execute("ALTER TABLE batch_items ADD COLUMN status TEXT DEFAULT 'pending'")
        print("Added 'status' column")
    except sqlite3.OperationalError as e:
        print(f"Error adding status column: {e}")
else:
        print("'status' column already exists")

# Add error_message column if missing
if 'error_message' not in cols:
    try:
        cursor.execute("ALTER TABLE batch_items ADD COLUMN error_message TEXT")
        print("Added 'error_message' column")
    except sqlite3.OperationalError as e:
        print(f"Error adding error_message column: {e}")
else:
        print("'error_message' column already exists")

conn.commit()

# Verify
cursor.execute("PRAGMA table_info(batch_items)")
cols = [row[1] for row in cursor.fetchall()]
print(f"\nUpdated batch_items columns: {', '.join(cols)}")

conn.close()
print("\nDatabase migration complete!")
