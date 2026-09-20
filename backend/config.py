import os
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# In Vercel serverless environments, the deployment directory is read-only.
# We copy the bundled SQLite database to /tmp so write operations succeed seamlessly.
if os.environ.get("VERCEL"):
    TMP_DB_PATH = "/tmp/canteen.db"
    SRC_DB_PATH = os.path.join(BASE_DIR, "backend", "database", "canteen.db")
    if not os.path.exists(TMP_DB_PATH) and os.path.exists(SRC_DB_PATH):
        try:
            shutil.copy2(SRC_DB_PATH, TMP_DB_PATH)
        except Exception:
            pass
    DATABASE_URL = f"sqlite:///{TMP_DB_PATH}"
else:
    DATABASE_DIR = os.path.join(BASE_DIR, "backend", "database")
    DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'canteen.db')}"
    os.makedirs(DATABASE_DIR, exist_ok=True)

# ── Admin credentials ────────────────────────────────────────────
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "AshikHasanRedoy2027")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Ahr2027#*-hAr")
ADMIN_SESSION_SECRET = os.environ.get("ADMIN_SESSION_SECRET", "super-secret-admin-key-change-in-prod")

# ── Email / OTP Sender Configuration ─────────────────────────────
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "ashikhasanhredoy@gmail.com")
SMTP_USER = os.environ.get("SMTP_USER", "ashikhasanhredoy@gmail.com")
SMTP_PASS = os.environ.get("SMTP_PASS", "fnnglhwcdiixbdde")  # 16-character Gmail App Password
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
