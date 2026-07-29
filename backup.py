#!/usr/bin/env python3
"""
Backup script for the University Canteen Food Delivery System.

Usage:
    python3 backup.py

Creates a timestamped copy of the SQLite database in a 'backups/' folder.
"""
import shutil
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "backend", "database", "canteen.db")
BACKUP_DIR = os.path.join(BASE_DIR, "backups")

os.makedirs(BACKUP_DIR, exist_ok=True)

if not os.path.exists(DB_PATH):
    print("❌ Database not found at:", DB_PATH)
    print("   Start the server at least once to create the database.")
    exit(1)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup_path = os.path.join(BACKUP_DIR, f"canteen_backup_{timestamp}.db")

shutil.copy2(DB_PATH, backup_path)

size_kb = os.path.getsize(backup_path) / 1024
print(f"✅ Backup created successfully!")
print(f"   File: backups/canteen_backup_{timestamp}.db")
print(f"   Size: {size_kb:.1f} KB")

# List existing backups
backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith(".db")])
print(f"\n📦 Total backups stored: {len(backups)}")
for b in backups[-5:]:  # Show last 5
    bpath = os.path.join(BACKUP_DIR, b)
    bsize = os.path.getsize(bpath) / 1024
    print(f"   {b}  ({bsize:.1f} KB)")
