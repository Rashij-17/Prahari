import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    medications = relationship("DBMedicineCabinet", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("DBAppointment", back_populates="user", cascade="all, delete-orphan")


class DBMedicineCabinet(Base):
    __tablename__ = "medicine_cabinet"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    brand_name = Column(String, nullable=False, index=True)
    generic_name = Column(String, default="")
    dosage_strength = Column(String, default="")
    frequency = Column(String, default="")
    instructions = Column(String, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="medications")


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


# Initialize database tables
def init_db():
    Base.metadata.create_all(bind=engine)
