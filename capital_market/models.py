"""Dataclasses describing capital-market entities."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Property:
    identifier: str
    price_eur: int
    living_space_sqm: float
    rooms: int
    latitude: float
    longitude: float
    address: str
    property_type: str
    rent_price_eur: Optional[int] = None

    @property
    def price_per_sqm(self) -> float:
        return round(self.price_eur / self.living_space_sqm, 2)

    @property
    def rent_per_sqm(self) -> Optional[float]:
        if self.rent_price_eur is None:
            return None
        return round(self.rent_price_eur / self.living_space_sqm, 2)


@dataclass
class CapitalMarketInvestment:
    """Simple wrapper for capital-market portfolio assumptions."""

    ticker: str
    allocation_target_pct: float
    expected_return_rate: float
    volatility: float
    dividend_yield: float
    fees_pct: float
    rebalancing_rule: str = "annual"

    @property
    def net_return_rate(self) -> float:
        """Expected annual return after subtracting fees."""

        return self.expected_return_rate - self.fees_pct

    def projected_value(self, initial_investment: float, years: int) -> float:
        """Project investment value using geometric compounding."""

        if initial_investment <= 0 or years <= 0:
            return initial_investment
        growth_factor = (1 + self.net_return_rate) ** years
        return round(initial_investment * growth_factor, 2)

    def expected_dividend_income(self, initial_investment: float) -> float:
        """Estimate one year of dividend income on the position."""

        if initial_investment <= 0:
            return 0.0
        return round(initial_investment * max(self.dividend_yield, 0.0), 2)
