"""Application configuration. Values can be overridden with environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(os.environ.get("ACEO_DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.environ.get("ACEO_DB_PATH", DATA_DIR / "app.db"))
WORKSPACE_DIR = Path(os.environ.get("ACEO_WORKSPACE_DIR", DATA_DIR / "workspace"))
UPLOAD_DIR = Path(os.environ.get("ACEO_UPLOAD_DIR", DATA_DIR / "uploads"))
BACKUP_DIR = Path(os.environ.get("ACEO_BACKUP_DIR", DATA_DIR / "backups"))
SECRET_KEY_PATH = DATA_DIR / ".secret_key"

DEFAULT_USER_NAME = os.environ.get("ACEO_USER", "Usuario")

# Safety limits for the agent executor
MAX_TOOL_ITERATIONS = int(os.environ.get("ACEO_MAX_TOOL_ITER", "8"))
MAX_TASK_ATTEMPTS = int(os.environ.get("ACEO_MAX_ATTEMPTS", "3"))
EXECUTOR_POLL_SECONDS = float(os.environ.get("ACEO_EXECUTOR_POLL", "1.5"))

for d in (DATA_DIR, WORKSPACE_DIR, UPLOAD_DIR, BACKUP_DIR):
    d.mkdir(parents=True, exist_ok=True)
