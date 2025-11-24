"""Compatibility module wrapping the real_estate package."""
from real_estate import (
    LoanParams,
    PropertyParams,
    RentParams,
    SimulationParams,
    rent_for_year,
    simulate,
)

__all__ = [
    "PropertyParams",
    "LoanParams",
    "RentParams",
    "SimulationParams",
    "simulate",
    "rent_for_year",
]
