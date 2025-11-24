import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from tax_calculations import (  # noqa: E402
    est_2026,
    est_2026_married,
    tax_rates_married,
    tax_rates_single,
)


@pytest.mark.parametrize(
    "zve, expected_est",
    [
        (0, 0.0),
        (12_348, 0.0),
        (12_349, 0.1400091451),
        (17_799, 1_034.8720234851),
        (69_878, 18_213.062999171),
        (277_825, 105_550.87),
    ],
)
def test_est_2026_bracket_boundaries(zve, expected_est):
    assert est_2026(zve) == pytest.approx(expected_est)


@pytest.mark.parametrize(
    "income, expected_est, expected_avg, expected_marginal",
    [
        (12_348, 0.0, 0.0, 0.0),
        (12_349, 0.1400091451, 0.0011337690914244069, 14.00182902),
        (17_799, 1_034.8720234851, 5.814214413647396, 23.969988020000002),
    ],
)
def test_tax_rates_single_at_boundaries(income, expected_est, expected_avg, expected_marginal):
    est, avg, marginal = tax_rates_single(income)
    assert est == pytest.approx(expected_est)
    assert avg == pytest.approx(expected_avg)
    assert marginal == pytest.approx(expected_marginal)


@pytest.mark.parametrize(
    "income1, income2, expected_est",
    [
        (12_348, 12_348, 0.0),
        (17_799, 17_799, 2_069.7440469702),
        (69_878, 69_878, 36_426.125998342),
        (277_825, 277_825, 211_101.74),
    ],
)
def test_est_2026_married_bracket_boundaries(income1, income2, expected_est):
    assert est_2026_married(income1, income2) == pytest.approx(expected_est)


@pytest.mark.parametrize(
    "income1, income2, expected_marginal",
    [
        (17_799, 17_799, 23.969988020000002),
        (69_878, 69_878, 41.9997498),
        (277_825, 277_825, 42.0),
    ],
)
def test_tax_rates_married_uses_splitting(income1, income2, expected_marginal):
    est, avg, marginal = tax_rates_married(income1, income2)
    combined = income1 + income2
    expected_avg = est / combined * 100 if combined else 0.0

    assert est == pytest.approx(est_2026_married(income1, income2))
    assert avg == pytest.approx(expected_avg)
    assert marginal == pytest.approx(expected_marginal)
