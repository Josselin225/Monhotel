import base64
import io
import secrets

import pyotp
import qrcode
from django.contrib.auth.hashers import make_password, check_password

ISSUER = 'Mon Hôtel'
BACKUP_CODE_COUNT = 8


def generate_secret() -> str:
    return pyotp.random_base32()


def otpauth_uri(secret: str, username: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name=ISSUER)


def qr_data_uri(uri: str) -> str:
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f'data:image/png;base64,{b64}'


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def generate_backup_codes() -> tuple[list[str], list[str]]:
    """Retourne (codes en clair à afficher une seule fois, hashes à stocker)."""
    plain = [secrets.token_hex(4) for _ in range(BACKUP_CODE_COUNT)]
    hashed = [make_password(c) for c in plain]
    return plain, hashed


def consume_backup_code(hashed_codes: list[str], code: str) -> list[str] | None:
    """Si `code` correspond à un des hashes, retourne la liste amputée de ce code. Sinon None."""
    code = (code or '').strip()
    if not code:
        return None
    for h in hashed_codes:
        if check_password(code, h):
            return [x for x in hashed_codes if x != h]
    return None
