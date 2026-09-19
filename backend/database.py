from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Safely add new columns to existing tables (SQLite safe)."""
    with engine.connect() as conn:
        for col in ["admin_fee REAL DEFAULT 0", "delivery_fee REAL DEFAULT 0", "delivery_boy_id TEXT", "email TEXT", "otp_code TEXT", "order_group_id TEXT"]:
            try:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass  # Column already exists

        # Migrate foods table
        try:
            conn.execute(text("ALTER TABLE foods ADD COLUMN meal_type TEXT DEFAULT 'both'"))
            conn.commit()
        except Exception:
            pass  # Column already exists

        try:
            conn.execute(text("ALTER TABLE complaints ADD COLUMN shop_name TEXT"))
            conn.commit()
        except Exception:
            pass  # Column already exists

        try:
            conn.execute(text("ALTER TABLE delivery_boys ADD COLUMN last_seen DATETIME"))
            conn.commit()
        except Exception:
            pass  # Column already exists

def seed_default_settings():
    """Insert default fee settings if they don't exist yet."""
    db = SessionLocal()
    try:
        from backend.models import Setting
        defaults = {
            "admin_fee_percent": "1.0",
            "delivery_fee_percent": "1.0",
        }
        for key, value in defaults.items():
            exists = db.query(Setting).filter(Setting.key == key).first()
            if not exists:
                db.add(Setting(key=key, value=value))
        db.commit()
    finally:
        db.close()


def seed_default_admin():
    """Insert default admin credentials if no admin exists yet. Safe to call on every startup."""
    db = SessionLocal()
    try:
        from backend.models import Admin
        if db.query(Admin).count() == 0:
            import hashlib, secrets
            # Use a simple but deterministic default password hash approach
            # Stored as SHA-256 placeholder until bcrypt is available
            try:
                import bcrypt
                pw_hash = bcrypt.hashpw(b"canteen@2024", bcrypt.gensalt()).decode("utf-8")
            except ImportError:
                pw_hash = "PLAIN:canteen@2024"  # fallback if bcrypt not installed
            db.add(Admin(
                admin_id="admin",
                name="System Admin",
                password_hash=pw_hash,
            ))
            db.commit()
            print("[DB SEED] Default admin created: admin / canteen@2024")
        else:
            print("[DB SEED] Admin already exists, skipping seed.")
    except Exception as e:
        db.rollback()
        print(f"[DB SEED] seed_default_admin skipped: {e}")
    finally:
        db.close()
