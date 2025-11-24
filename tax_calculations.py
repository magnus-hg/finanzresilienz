"""Tax calculation helpers for 2026 German income tax rules.

This module centralizes the income tax formulas so they can be reused across
Flask views and tested in isolation.
"""
from typing import Tuple


def est_2026(zve: float) -> float:
    """
    Einkommensteuer nach § 32a EStG (Grundtarif) gemäß:
      a) bis 12.348 €:       0
      b) 12.349–17.799 €:    (914,51*y + 1.400)*y, y = (zvE - 12.348)/10.000
      c) 17.800–69.878 €:    (173,1*z + 2.397)*z + 1.034,87, z = (zvE - 17.799)/10.000
      d) 69.879–277.825 €:   0,42*zvE - 11.135,63
      e) ab 277.826 €:       0,45*zvE - 19.470,38
    zvE wird wie im Gesetz auf volle Euro abgerundet.
    """
    x = int(zve)  # auf volle Euro abrunden

    if x <= 12_348:
        return 0.0

    if x <= 17_799:
        y = (x - 12_348) / 10_000
        return (914.51 * y + 1_400.0) * y

    if x <= 69_878:
        z = (x - 17_799) / 10_000
        return (173.1 * z + 2_397.0) * z + 1_034.87

    if x <= 277_825:
        return 0.42 * x - 11_135.63

    return 0.45 * x - 19_470.38


def _marginal_rate(zve: float) -> float:
    x = int(zve)
    if x <= 12_348:
        return 0.0
    if x <= 17_799:
        y = (x - 12_348) / 10_000
        return (2 * 914.51 * y + 1_400.0) / 10_000 * 100
    if x <= 69_878:
        z = (x - 17_799) / 10_000
        return (2 * 173.1 * z + 2_397.0) / 10_000 * 100
    if x <= 277_825:
        return 42.0
    return 45.0


def est_2026_married(zve1: float, zve2: float) -> float:
    """
    Einkommensteuer für Ehegatten/Lebenspartner im Splittingtarif 2026.

    Vorgehen:
      - gemeinsames zvE = zve1 + zve2
      - halbieren
      - Grundtarif (est_2026) auf das halbe zvE anwenden
      - Ergebnis verdoppeln
    """
    total = zve1 + zve2
    half = total / 2.0
    return 2.0 * est_2026(half)


def tax_rates_single(zve: float) -> Tuple[float, float, float]:
    """
    Returns:
      est: Einkommensteuer
      avg_rate: Durchschnittssteuersatz (in %)
      marginal_rate: Grenzsteuersatz (in %)
    """

    x = int(zve)
    est = est_2026(zve)
    avg_rate = est / x * 100 if x > 0 else 0
    marginal = _marginal_rate(x)
    return est, avg_rate, marginal


def tax_rates_married(zve1: float, zve2: float) -> Tuple[float, float, float]:
    total_income = max(zve1 + zve2, 0.0)
    if total_income <= 0:
        return 0.0, 0.0, 0.0

    est = est_2026_married(zve1, zve2)
    avg_rate = est / total_income * 100
    marginal = _marginal_rate(total_income / 2.0)
    return est, avg_rate, marginal
