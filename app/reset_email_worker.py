"""Detached password-reset email worker."""
import sys

from app import _process_reset_email


MAX_EMAIL_INPUT_LENGTH = 320


def main():
    email = sys.stdin.read(MAX_EMAIL_INPUT_LENGTH + 1).strip()
    if not email or len(email) > MAX_EMAIL_INPUT_LENGTH or '\x00' in email:
        return 2
    _process_reset_email(email)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
