from dataclasses import dataclass
from typing import List, Tuple

MAX_AMORTIZATION_YEARS = 100


@dataclass
class YearRecord:
    """Represents a single year in the amortization schedule."""

    year: int
    interest_paid: float
    principal_paid: float
    remaining_principal: float


def mortgage_schedule(
    principal: float,
    interest_rate: float,
    initial_tilgung_rate: float,
    max_years: int = MAX_AMORTIZATION_YEARS,
) -> Tuple[List[YearRecord], float, float]:
    """Calculate an annual amortization schedule for an annuity mortgage."""

    if interest_rate < 0 or initial_tilgung_rate <= 0:
        raise ValueError("Interest must be >= 0 and initial tilgung > 0.")

    annuity = principal * (interest_rate + initial_tilgung_rate)
    if annuity <= principal * interest_rate:
        raise ValueError("Annuität is not high enough to reduce the principal. Increase Tilgung.")

    balance = principal
    schedule: List[YearRecord] = []
    total_interest = 0.0
    total_paid = 0.0
    year = 1

    while balance > 0 and year <= max_years:
        interest = balance * interest_rate
        principal_payment = annuity - interest

        if principal_payment > balance:
            principal_payment = balance
            payment_this_year = interest + principal_payment
        else:
            payment_this_year = annuity

        balance -= principal_payment

        total_interest += interest
        total_paid += payment_this_year

        if abs(balance) < 0.01:
            balance = 0.0

        schedule.append(
            YearRecord(
                year=year,
                interest_paid=interest,
                principal_paid=principal_payment,
                remaining_principal=balance,
            )
        )

        if balance <= 0:
            break

        year += 1

    return schedule, total_interest, total_paid
