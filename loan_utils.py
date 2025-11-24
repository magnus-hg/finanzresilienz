"""Shared loan-related calculations (re-exported from :mod:`real_estate.finance`)."""
from real_estate.finance import (
    MAX_AMORTIZATION_YEARS,
    YearRecord,
    amortization_step,
    calc_annuity,
    mortgage_schedule,
)

__all__ = [
    "YearRecord",
    "calc_annuity",
    "amortization_step",
    "mortgage_schedule",
    "MAX_AMORTIZATION_YEARS",
]
