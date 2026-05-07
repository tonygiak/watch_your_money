"""Greek ΑΦΜ (Tax Identification Number) MOD-11 checksum validator.

Mirror of ``mobile/src/lib/afm.ts`` — the algorithm is the same so the
client and server stay in lockstep on the rules:

  1. Multiply each of the first 8 digits by its weight: ``d[i] * 2^(8-i)``
     (i.e. d1*256, d2*128, d3*64, d4*32, d5*16, d6*8, d7*4, d8*2).
  2. Sum the weighted values.
  3. Take the sum modulo 11.
  4. If the result is 10, the check digit must be 0; otherwise it must
     equal the result.

The all-zeros "000000000" is rejected as a sentinel — no real ΑΦΜ uses
it (DES-0004 §3.3 / BLG-0017).

Server-side validation is defense-in-depth on top of the mobile validator
(DES-0004 §4 — "server-side ΑΦΜ MOD-11 validation"). The function NEVER
echoes the raw ΑΦΜ in any log line — ΑΦΜ is identifying data per
DES-0004 §7.
"""

from __future__ import annotations

from typing import Literal

AfmReason = Literal[
    "empty",
    "non_numeric",
    "wrong_length",
    "all_zeros",
    "checksum",
]


class InvalidAfmError(ValueError):
    """Raised when ΑΦΜ validation fails. ``reason`` carries the structured
    reason code (mirrors ``mobile/src/lib/afm.ts AfmValidationError``)."""

    def __init__(self, reason: AfmReason, message: str) -> None:
        super().__init__(message)
        self.reason: AfmReason = reason


def validate_afm(value: str | None) -> str:
    """Return the trimmed-valid ΑΦΜ or raise :class:`InvalidAfmError`.

    The returned value is the trimmed 9-digit string (always ASCII).
    """
    if value is None:
        raise InvalidAfmError("empty", "ΑΦΜ is required")
    trimmed = value.strip()
    if not trimmed:
        raise InvalidAfmError("empty", "ΑΦΜ is required")
    if not trimmed.isascii() or not trimmed.isdigit():
        raise InvalidAfmError("non_numeric", "ΑΦΜ must be 9 ASCII digits")
    if len(trimmed) != 9:
        raise InvalidAfmError("wrong_length", "ΑΦΜ must be exactly 9 digits")
    if trimmed == "000000000":
        raise InvalidAfmError("all_zeros", "ΑΦΜ cannot be all zeros")

    total = 0
    for i in range(8):
        digit = ord(trimmed[i]) - 48  # ASCII '0' = 48
        total += digit * (2 ** (8 - i))
    mod = total % 11
    expected = 0 if mod == 10 else mod
    actual = ord(trimmed[8]) - 48
    if expected != actual:
        raise InvalidAfmError("checksum", "ΑΦΜ checksum invalid")
    return trimmed


def is_valid_afm(value: str | None) -> bool:
    """Boolean convenience wrapper around :func:`validate_afm`."""
    try:
        validate_afm(value)
        return True
    except InvalidAfmError:
        return False
