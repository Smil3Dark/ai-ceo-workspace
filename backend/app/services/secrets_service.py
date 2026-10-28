"""Encrypted-at-rest secret storage. Keys are never returned by the API and
never written to logs or activity records."""
from cryptography.fernet import Fernet

from ..config import SECRET_KEY_PATH
from ..models import Secret


def _fernet() -> Fernet:
    if not SECRET_KEY_PATH.exists():
        SECRET_KEY_PATH.write_bytes(Fernet.generate_key())
    return Fernet(SECRET_KEY_PATH.read_bytes())


def store_secret(db, name: str, value: str) -> Secret:
    row = db.query(Secret).filter_by(name=name).first()
    enc = _fernet().encrypt(value.encode()).decode()
    if row:
        row.value_enc = enc
    else:
        row = Secret(name=name, value_enc=enc)
        db.add(row)
    db.commit()
    return row


def read_secret(db, name: str) -> str:
    row = db.query(Secret).filter_by(name=name).first()
    if not row:
        return ""
    try:
        return _fernet().decrypt(row.value_enc.encode()).decode()
    except Exception:  # noqa: BLE001 - corrupt key file
        return ""


def delete_secret(db, name: str) -> None:
    db.query(Secret).filter_by(name=name).delete()
    db.commit()
