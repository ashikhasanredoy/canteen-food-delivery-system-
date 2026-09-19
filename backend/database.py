from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import DATABASE_URL

# Connect to SQLite database. We set check_same_thread=False because FastAPI handles requests across multiple async worker threads.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Session factory for creating scoped database sessions per request
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class from which all database models inherit
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session for each incoming HTTP request
    and guarantees that the connection is cleanly closed once the response is sent.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """
    Lightweight schema migration utility for SQLite.
    Checks if newly added feature columns exist; if missing, executes ALTER TABLE statements.
    Exceptions are safely ignored because SQLite raises an error if a column already exists.
    """
    with engine.connect() as conn:
        # Columns added for financial fee tracking, courier assignment, and multi-item grouping
        for col in ["admin_fee REAL DEFAULT 0", "delivery_fee REAL DEFAULT 0", "delivery_boy_id TEXT", "email TEXT", "otp_code TEXT", "order_group_id TEXT"]:
            try:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {col}"))
                conn.commit()
            except Exception:
                pass  # Column already exists in schema

        # Food meal category migration (breakfast | lunch | both)
        try:
            conn.execute(text("ALTER TABLE foods ADD COLUMN meal_type TEXT DEFAULT 'both'"))
            conn.commit()
        except Exception:
            pass

        # Complaint store attribution migration
        try:
            conn.execute(text("ALTER TABLE complaints ADD COLUMN shop_name TEXT"))
            conn.commit()
        except Exception:
            pass

        # Courier active presence tracking
        try:
            conn.execute(text("ALTER TABLE delivery_boys ADD COLUMN last_seen DATETIME"))
            conn.commit()
        except Exception:
            pass


def seed_default_settings():
    """
    Seeds initial financial commission percentages (1.0% admin commission, 1.0% rider payout)
    if the database is being booted up for the first time.
    """
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
    """
    Ensures a default root administrator account exists upon initial system startup.
    Default credentials: username 'admin' / password 'canteen@2024'.
    Safe to execute repeatedly — skips seeding if an admin is already detected in the database.
    """
    db = SessionLocal()
    try:
        from backend.models import Admin
        if db.query(Admin).count() == 0:
            try:
                import bcrypt
                pw_hash = bcrypt.hashpw(b"canteen@2024", bcrypt.gensalt()).decode("utf-8")
            except ImportError:
                pw_hash = "PLAIN:canteen@2024"  # Fallback format if bcrypt is absent
            
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
