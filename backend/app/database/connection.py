import pkgutil
import importlib
import time
import logging
import urllib.parse

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.utils.logger import get_logger
from app.config.env import env


# ---------------------------------
# Read environment variables
# ---------------------------------
DB_HOST = env("DB_HOST")
DB_PORT = env("DB_PORT")
DB_NAME = env("DB_NAME")
DB_USERNAME = env("DB_USERNAME")
DB_PASSWORD = env("DB_PASSWORD")

# ---------------------------------
# Build SQLAlchemy PostgreSQL URL
# ---------------------------------
# Encode password to handle special characters like @, :, /
password = urllib.parse.quote_plus(DB_PASSWORD)

SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg2://{DB_USERNAME}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

print("Final DB URL =======> ", SQLALCHEMY_DATABASE_URL)


# ---------------------------------
# SQLAlchemy Engine & Session
# ---------------------------------
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# ---------------------------------
# Base Class for Models
# ---------------------------------
class Base(DeclarativeBase):
    pass


# ---------------------------------
# Quick Connection Test
# ---------------------------------
def test_connection():
    try: 
        with engine.connect() as conn: 
            result = conn.execute(text("SELECT version();")) 
            version = result.scalar()
            print(f"✅ Database connected successfully! PostgreSQL version: {version}") 
    except Exception as e: 
        print(f"❌ Database connection failed: {e}")

# if __name__ == "__main__":
test_connection()

# ---------------------------------
# Auto-Import All Model Files
# ---------------------------------
def auto_import_models():
    import app.models
    package = app.models

    for module in pkgutil.iter_modules(package.__path__):
        module_name = module.name
        importlib.import_module(f"app.models.{module_name}")
        # print(f"📌 Model imported: app.models.{module_name}")


# ---------------------------------
# Auto-Create All Tables
# ---------------------------------
def create_all_tables():
    auto_import_models()
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully!")


# ---------------------------------
# FastAPI Dependency
# ---------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------
# Slow Query Logger Setup
# ---------------------------------
try:
    slow_logger = get_logger("slow_queries")
except Exception:
    slow_logger = logging.getLogger("slow_queries")
    handler = logging.FileHandler("logs/slow_queries.log")
    formatter = logging.Formatter(
        "%(asctime)s - [%(levelname)s] - %(message)s"
    )
    handler.setFormatter(formatter)
    slow_logger.addHandler(handler)
    slow_logger.setLevel(logging.WARNING)


@event.listens_for(engine, "before_cursor_execute", retval=False)
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info["query_start_time"] = time.time()


@event.listens_for(engine, "after_cursor_execute", retval=False)
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    start_time = conn.info.get("query_start_time")

    if not start_time:
        return

    exec_time_ms = (time.time() - start_time) * 1000

    # Threshold (ms)
    if exec_time_ms > 300:
        slow_logger.warning(
            f"[{exec_time_ms:.2f} ms] SLOW QUERY:\n{statement}\nPARAMS: {parameters}\n"
        )



