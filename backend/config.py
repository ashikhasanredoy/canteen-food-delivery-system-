import os
import shutil

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# In serverless environments (e.g. Vercel, AWS Lambda), the deployment folder is read-only.
# We test if the local directory is writable; if not or if serverless env vars are detected,
# we copy the pre-seeded SQLite database to /tmp/canteen.db so all reads and writes succeed.
def _resolve_database_url():
    db_dir = os.path.join(BASE_DIR, "backend", "database")
    db_file = os.path.join(db_dir, "canteen.db")
    
    is_serverless = bool(
        os.environ.get("VERCEL")
        or os.environ.get("VERCEL_ENV")
        or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
        or os.environ.get("LAMBDA_TASK_ROOT")
    )

    if not is_serverless:
        try:
            os.makedirs(db_dir, exist_ok=True)
            test_file = os.path.join(db_dir, ".write_test")
            with open(test_file, "w") as f:
                f.write("1")
            os.remove(test_file)
            return f"sqlite:///{db_file}"
        except Exception:
            is_serverless = True

    # Serverless / read-only fallback: copy pre-seeded database to /tmp
    tmp_db_file = "/tmp/canteen.db"
    if not os.path.exists(tmp_db_file) and os.path.exists(db_file):
        try:
            shutil.copy2(db_file, tmp_db_file)
        except Exception as e:
            print(f"[DB TMP COPY] Warning: {e}")
    return f"sqlite:///{tmp_db_file}"

DATABASE_URL = _resolve_database_url()

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
