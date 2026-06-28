"""
scripts/gen_dev_keys.py
───────────────────────
Auto-generates the dev JWT RSA-2048 key pair used by dev_auth.py when
Keycloak is not running.  Keys are written to data/dev/ and are NOT
committed to git (the directory should be in .gitignore).

Also provides a helper that generates strong random values for secrets
that have never been set or still contain placeholder defaults.

Usage:
    # From project root:
    python scripts/gen_dev_keys.py

    # From run_services.py (silent unless keys are missing):
    from scripts.gen_dev_keys import ensure_dev_keys
    ensure_dev_keys()
"""

from __future__ import annotations

import secrets
import subprocess
import sys
from pathlib import Path

ROOT    = Path(__file__).resolve().parent.parent
DEV_DIR = ROOT / "data" / "dev"

PRIVATE_KEY = DEV_DIR / "jwt_private.pem"
PUBLIC_KEY  = DEV_DIR / "jwt_public.pem"


# ── Key generation ────────────────────────────────────────────────────────────

def ensure_dev_keys(force: bool = False) -> None:
    """
    Generate RSA-2048 dev JWT key pair if either file is missing.

    Parameters
    ----------
    force: Regenerate even if the files already exist (useful after a
           key compromise or git-leak).
    """
    if not force and PRIVATE_KEY.exists() and PUBLIC_KEY.exists():
        return

    DEV_DIR.mkdir(parents=True, exist_ok=True)
    print("🔑  Generating dev JWT RSA-2048 key pair …")

    try:
        # Generate private key
        subprocess.run(
            ["openssl", "genrsa", "-out", str(PRIVATE_KEY), "2048"],
            check=True,
            capture_output=True,
        )
        # Derive public key
        subprocess.run(
            ["openssl", "rsa", "-in", str(PRIVATE_KEY), "-pubout", "-out", str(PUBLIC_KEY)],
            check=True,
            capture_output=True,
        )
    except FileNotFoundError:
        _gen_with_cryptography()
    except subprocess.CalledProcessError as exc:
        print(f"  ERROR: openssl failed — {exc.stderr.decode()}", file=sys.stderr)
        sys.exit(1)

    # Restrict permissions on the private key (Linux / macOS / WSL2)
    if sys.platform != "win32":
        PRIVATE_KEY.chmod(0o600)

    print(f"   Private key → {PRIVATE_KEY.relative_to(ROOT)}")
    print(f"   Public  key → {PUBLIC_KEY.relative_to(ROOT)}")
    print("   ✅  Done — add data/dev/*.pem to .gitignore if not already present")


def _gen_with_cryptography() -> None:
    """Fallback: generate keys using the `cryptography` Python package."""
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
    except ImportError:
        print(
            "ERROR: Neither `openssl` nor the `cryptography` package is available.\n"
            "  Install one of:\n"
            "    • openssl (https://slproweb.com/products/Win32OpenSSL.html on Windows)\n"
            "    • pip install cryptography",
            file=sys.stderr,
        )
        sys.exit(1)

    print("  (using `cryptography` Python package instead of openssl)")

    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )

    PRIVATE_KEY.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )

    PUBLIC_KEY.write_bytes(
        private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )


# ── Secret value helpers ──────────────────────────────────────────────────────

def generate_internal_api_key(length: int = 32) -> str:
    """Return a cryptographically secure hex token suitable for INTERNAL_API_KEY."""
    return secrets.token_hex(length)


'''
def generate_postgres_password(length: int = 24) -> str:
    """Return a URL-safe password suitable for POSTGRES_PASSWORD."""
    return secrets.token_urlsafe(length)
'''

def print_suggested_secrets() -> None:
    """Print suggested values for the secrets that commonly need to be changed."""
    print("\n─── Suggested secret values (copy into your .env) ───")
    print(f"INTERNAL_API_KEY={generate_internal_api_key(32)}")
  #  print(f"POSTGRES_PASSWORD={generate_postgres_password(24)}")
    print("\nFor GROQ_API_KEY visit: https://console.groq.com → API Keys\n")


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Dev key and secret generator")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate the JWT key pair even if it already exists (use after a key leak)",
    )
    parser.add_argument(
        "--secrets",
        action="store_true",
        help="Print suggested values for INTERNAL_API_KEY and POSTGRES_PASSWORD",
    )
    args = parser.parse_args()

    if args.force or not (PRIVATE_KEY.exists() and PUBLIC_KEY.exists()):
        ensure_dev_keys(force=args.force)
    else:
        print("✅  Dev JWT key pair already exists — use --force to regenerate")

    if args.secrets:
        print_suggested_secrets()
