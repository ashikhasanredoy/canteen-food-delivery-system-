import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, "backend", "database")
DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'canteen.db')}"

# Ensure database directory exists
os.makedirs(DATABASE_DIR, exist_ok=True)

# ── Admin credentials ────────────────────────────────────────────
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "canteen@2024")
ADMIN_SESSION_SECRET = os.environ.get("ADMIN_SESSION_SECRET", "super-secret-admin-key-change-in-prod")
