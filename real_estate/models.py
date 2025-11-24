"""Domain models for real estate simulations."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class PropertyParams:
    """Property-related simulation parameters."""

    purchase_price: float
    transaction_cost_factor: float
    value_growth_rate: float
    depreciation_basis: float
    depreciation_rate: float


@dataclass
class LoanParams:
    """Loan configuration used for amortization calculations."""

    principal: float
    interest_rate: float
    years: int
    annuity: Optional[float] = None


@dataclass
class RentParams:
    """Rent-related assumptions for the simulation horizon."""

    net_cold_rent_month: float
    operating_costs_month: float
    mgmt_costs_annual: float
    rent_increase_rate: float
    rent_increase_interval_years: int


@dataclass
class SimulationParams:
    """Top-level configuration for a rental property simulation."""

    start_year: int
    n_years: int
    property_params: PropertyParams
    loan_params: LoanParams
    rent_params: RentParams
    tax_rate: float = 0.0
