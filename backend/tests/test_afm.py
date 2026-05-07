"""Unit tests for ``app.afm`` — Greek MOD-11 checksum validator.

Mirror of ``mobile/__tests__/lib/afm.test.ts``. Same valid / invalid
samples so any drift between client and server is caught immediately.
"""

from __future__ import annotations

import pytest

from app.afm import InvalidAfmError, is_valid_afm, validate_afm


class TestValidateAfmAccepts:
    @pytest.mark.parametrize(
        "afm",
        [
            "094019245",  # mod 5, check 5
            "094014298",  # mod 8, check 8
            "999114187",  # mod 7, check 7
            "123456783",  # mod 3, check 3
        ],
    )
    def test_valid_samples_round_trip(self, afm: str) -> None:
        assert validate_afm(afm) == afm

    def test_trims_whitespace(self) -> None:
        assert validate_afm("  094019245  ") == "094019245"


class TestValidateAfmRejects:
    @pytest.mark.parametrize("value", [None, "", "   "])
    def test_empty(self, value: str | None) -> None:
        with pytest.raises(InvalidAfmError) as exc:
            validate_afm(value)
        assert exc.value.reason == "empty"

    @pytest.mark.parametrize(
        "value",
        ["12345678a", "abcdefghi", "1234 5678", "١٢٣٤٥٦٧٨٩"],
    )
    def test_non_numeric(self, value: str) -> None:
        with pytest.raises(InvalidAfmError) as exc:
            validate_afm(value)
        assert exc.value.reason == "non_numeric"

    @pytest.mark.parametrize("value", ["12345678", "1234567890"])
    def test_wrong_length(self, value: str) -> None:
        with pytest.raises(InvalidAfmError) as exc:
            validate_afm(value)
        assert exc.value.reason == "wrong_length"

    def test_all_zeros(self) -> None:
        with pytest.raises(InvalidAfmError) as exc:
            validate_afm("000000000")
        assert exc.value.reason == "all_zeros"

    @pytest.mark.parametrize(
        "value", ["094019246", "123456788", "999999999"]
    )
    def test_checksum_mismatch(self, value: str) -> None:
        with pytest.raises(InvalidAfmError) as exc:
            validate_afm(value)
        assert exc.value.reason == "checksum"


class TestIsValidAfm:
    def test_returns_boolean_matching_validate_afm(self) -> None:
        assert is_valid_afm("094019245") is True
        assert is_valid_afm("094019246") is False
        assert is_valid_afm("") is False
        assert is_valid_afm(None) is False
