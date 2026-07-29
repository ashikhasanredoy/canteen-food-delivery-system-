#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║     University Canteen Food Delivery System — Launcher       ║
║                                                              ║
║  Double-click this file OR run:  python3 run.py              ║
╚══════════════════════════════════════════════════════════════╝

This single file starts the complete system:
  ✅  Backend  (FastAPI API server)
  ✅  Frontend (HTML pages served via FastAPI)
  ✅  Admin    (Admin dashboard at /admin)

All in one command — no separate steps needed.
"""

import sys
import os
import subprocess
import time
import webbrowser

# ── Resolve project root ──────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

HOST = "127.0.0.1"
PORT = 8000

# ── Banner ────────────────────────────────────────────────────────────────────
def print_banner():
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║      University Canteen Food Delivery System                 ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print(f"║  🌐  Main Site   →  http://{HOST}:{PORT}                     ║")
    print(f"║  🛒  Buyer/Seller →  http://{HOST}:{PORT}                    ║")
    print(f"║  🚴  Delivery Boy →  http://{HOST}:{PORT}/delivery           ║")
    print(f"║  🔐  Admin Panel  →  http://{HOST}:{PORT}/admin              ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  Admin Credentials:  admin  /  canteen@2024                  ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  💾  All data is saved in: backend/database/canteen.db       ║")
    print("║      Restarting will NOT delete any data.                    ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print("║  ⛔  Press  Ctrl + C  to stop the server                     ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()

# ── Check Python version ──────────────────────────────────────────────────────
def check_python():
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required.")
        print(f"   Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python {sys.version.split()[0]}")

# ── Check & install dependencies ─────────────────────────────────────────────
def check_dependencies():
    required = ["fastapi", "uvicorn", "sqlalchemy", "starlette", "jinja2"]
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"⚠️  Installing missing packages: {', '.join(missing)}")
        req_file = os.path.join(PROJECT_ROOT, "requirements.txt")
        if os.path.exists(req_file):
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file, "-q"])
        else:
            subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing + ["-q"])
        print("✅ Dependencies installed.")
    else:
        print("✅ All dependencies are installed.")

# ── Ensure database directory exists ─────────────────────────────────────────
def ensure_database():
    db_dir = os.path.join(PROJECT_ROOT, "backend", "database")
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, "canteen.db")
    if os.path.exists(db_path):
        size_kb = os.path.getsize(db_path) / 1024
        print(f"✅ Database found ({size_kb:.0f} KB) — existing data preserved.")
    else:
        print("📦 Database will be created fresh on first startup.")

# ── Open browser after server starts ─────────────────────────────────────────
def open_browser_after_delay():
    import threading
    def _open():
        time.sleep(2.0)
        try:
            webbrowser.open(f"http://{HOST}:{PORT}")
            print(f"🌐 Browser opened → http://{HOST}:{PORT}")
        except Exception:
            pass
    t = threading.Thread(target=_open, daemon=True)
    t.start()

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print_banner()

    print("🔍 Checking environment...")
    check_python()
    check_dependencies()
    ensure_database()

    print()
    print("🚀 Starting server...")
    print(f"   → http://{HOST}:{PORT}")
    print()

    # Open browser automatically
    open_browser_after_delay()

    # Start uvicorn server
    try:
        import uvicorn
        uvicorn.run(
            "backend.main:app",
            host=HOST,
            port=PORT,
            reload=False,       # Set True for development auto-reload
            log_level="warning" # Use "info" for verbose logs
        )
    except KeyboardInterrupt:
        print()
        print("✅ Server stopped. Goodbye!")
        print("   Your data is safely saved in: backend/database/canteen.db")
        print()
