"""Shared loan-related calculations."""
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


def calc_annuity(principal: float, rate: float, years: int) -> float:
    """Calculate the annual annuity payment for a loan."""

    if rate == 0:
        return principal / years
    factor = rate / (1 - (1 + rate) ** (-years))
    return principal * factor


def amortization_step(balance: float, rate: float, annuity: float) -> tuple[float, float, float]:
    """Execute a single amortization period using an annuity repayment."""

    interest = balance * rate
    repayment = annuity - interest
    new_balance = balance - repayment
    return new_balance, interest, repayment


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
        new_balance, interest, principal_payment = amortization_step(balance, interest_rate, annuity)

        if principal_payment > balance:
            principal_payment = balance
            payment_this_year = interest + principal_payment
            new_balance = 0.0
        else:
            payment_this_year = annuity

        total_interest += interest
        total_paid += payment_this_year

        if abs(new_balance) < 0.01:
            new_balance = 0.0

        schedule.append(
            YearRecord(
                year=year,
                interest_paid=interest,
                principal_paid=principal_payment,
                remaining_principal=new_balance,
            )
        )

        if new_balance <= 0:
            break

        balance = new_balance
        year += 1

    return schedule, total_interest, total_paid
