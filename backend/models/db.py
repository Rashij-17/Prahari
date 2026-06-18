import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from core.config import settings

# Determine database URL: default to SQLite if DATABASE_URL is not set or empty
db_url = settings.database_url
if not db_url:
    db_url = "sqlite:///./prahari.db"

# SQLite specific connect args
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Supabase UID ("sub" claim)
    email = Column(String, unique=True, index=True, nullable=False)
    allergies = Column(String, default="")             # Base64 encrypted string of JSON
    lab_results = Column(String, default="")           # Base64 encrypted string of JSON/text
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    medications = relationship("DBMedicineCabinet", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("DBAppointment", back_populates="user", cascade="all, delete-orphan")
    caregivers = relationship("DBCaregiver", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("DBWebPushSubscription", back_populates="user", cascade="all, delete-orphan")


class DBMedicineCabinet(Base):
    __tablename__ = "medicine_cabinet"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    brand_name = Column(String, nullable=False, index=True)
    generic_name = Column(String, default="")
    dosage_strength = Column(String, default="")
    frequency = Column(String, default="")
    instructions = Column(String, default="")
    reminder_time = Column(String, default="")         # e.g., "09:00"
    is_high_priority = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="medications")


class DBCaregiver(Base):
    __tablename__ = "caregivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)              # Encrypted
    phone = Column(String, default="")                 # Encrypted
    email = Column(String, default="")                 # Encrypted
    notification_type = Column(String, default="all")  # Encrypted (e.g. "push", "sms", "email", "all")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="caregivers")


class DBClinicalSafetyRule(Base):
    __tablename__ = "clinical_safety_rules"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_name = Column(String, nullable=False, index=True) # generic name in lowercase
    trigger_type = Column(String, nullable=False)                # "drug", "allergy", "lab"
    value_match = Column(String, nullable=False)                 # ingredient/allergen/lab name conflicting
    warning_text = Column(String, nullable=False)                # unencrypted text warning details
    severity = Column(String, default="warning")                 # "warning", "critical"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class DBWebPushSubscription(Base):
    __tablename__ = "web_push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(String, nullable=False)
    keys_p256dh = Column(String, nullable=False)
    keys_auth = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="push_subscriptions")


class DBAppointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    date = Column(String, nullable=False)  # standard YYYY-MM-DD
    time = Column(String, default="")
    notes = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="appointments")


# Helper to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Initialize database tables and run schema alterations
def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Run safe schema migrations for pre-existing tables
    db = SessionLocal()
    try:
        # 1. users table
        for column in ["allergies", "lab_results"]:
            try:
                db.execute(text(f"ALTER TABLE users ADD COLUMN {column} VARCHAR DEFAULT ''"))
                db.commit()
                print(f"Migration: Column '{column}' added to 'users' table.")
            except Exception:
                db.rollback()

        # 2. medicine_cabinet table
        try:
            db.execute(text("ALTER TABLE medicine_cabinet ADD COLUMN reminder_time VARCHAR DEFAULT ''"))
            db.commit()
            print("Migration: Column 'reminder_time' added to 'medicine_cabinet' table.")
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE medicine_cabinet ADD COLUMN is_high_priority BOOLEAN DEFAULT FALSE"))
            db.commit()
            print("Migration: Column 'is_high_priority' added to 'medicine_cabinet' table.")
        except Exception:
            db.rollback()
    finally:
        db.close()
