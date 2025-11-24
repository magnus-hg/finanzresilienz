"""Rent-related helper logic."""
from .models import RentParams


def rent_for_year(params: RentParams, year_index: int) -> tuple[float, float, float]:
    """Calculate rent progression for a given year index.

    Args:
        params: Rent configuration.
        year_index: Zero-based index for the simulation year (0 = start year).

    Returns:
        Tuple of (net_cold_month, warm_month, warm_year).
    """

    n_increases = year_index // params.rent_increase_interval_years
    factor = (1 + params.rent_increase_rate) ** n_increases

    net_cold_month = params.net_cold_rent_month * factor
    warm_month = net_cold_month + params.operating_costs_month
    warm_year = warm_month * 12
    return net_cold_month, warm_month, warm_year
