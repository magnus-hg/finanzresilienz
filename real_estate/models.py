class RealEstateObject:
    def __init__(self, property_price, purchase_fees, building_portion, value_increase_per_year, depreciation_per_year, maintenance_cost_per_year, maintenance_cost_increase_per_year):

        self.total_price = property_price + purchase_fees

        self.initial_building_value = property_price * building_portion
        self.building_book_value = self.initial_building_value
        self.building_market_value = self.initial_building_value
        
        self.initial_land_value = property_price * (1 - building_portion)
        self.land_value = self.initial_land_value
        
        self.initial_total_value = self.initial_building_value + self.initial_land_value
        self.total_value = self.initial_total_value
        
        self.value_increase_rate = value_increase_per_year 
        self.depreciation_rate = depreciation_per_year     
        
        self.fully_depreciated = False
        
        self.initial_maintenance_cost_per_year = maintenance_cost_per_year
        self.maintenance_cost_per_year = maintenance_cost_per_year
        self.maintenance_cost_increase_per_year = maintenance_cost_increase_per_year
        
        self.current_year = 0
        
        
    def simulate_year(self):
        building_market_value_increase = self.building_market_value * self.value_increase_rate
        land_value_increase = self.land_value * self.value_increase_rate
        
        value_increase = land_value_increase + building_market_value_increase
        
        self.land_value += land_value_increase
        self.building_market_value += building_market_value_increase
        
        self.total_value = self.land_value + self.building_market_value
        
        depreciation_amount = self.initial_building_value * self.depreciation_rate
        depreciable_amount = min(depreciation_amount, self.building_book_value)
            
        self.building_book_value = max(self.building_book_value - depreciable_amount, 0.0)
        if self.building_book_value <= 1e-6:
            self.building_book_value = 0.0
            self.fully_depreciated = True
        
        self.maintenance_cost_per_year *= (1 + self.maintenance_cost_increase_per_year)
        
        self.current_year += 1
        
        return self.total_value, value_increase, depreciable_amount, self.maintenance_cost_per_year, self.current_year, self.fully_depreciated
        
        
        
class AnnuityLoan:
    def __init__(self, principal_amount, interest_per_year, initial_repayment_per_year):
        self.principal_amount = principal_amount
        self.interest_per_year = interest_per_year # Zins
        self.initial_repayment_per_year = initial_repayment_per_year # Tilgung
        self.rate_per_year = self.interest_per_year + self.initial_repayment_per_year
        self.annuity = self.rate_per_year * self.principal_amount
        
        self.current_year = 0
        self.remaining_principal_amount = self.principal_amount
        self.paid_off = False
        
        
    def simulate_year(self):
        if self.paid_off:
            self.current_year += 1
            return 0, 0, 0, self.current_year, True
    
        interest_payment = self.remaining_principal_amount * self.interest_per_year
        loan_repayment = self.annuity - interest_payment
        
        if (self.remaining_principal_amount - loan_repayment) <= 0:
            self.paid_off = True
            loan_repayment = self.remaining_principal_amount

        
        self.remaining_principal_amount = self.remaining_principal_amount - loan_repayment
        
        self.current_year += 1
        
        return self.remaining_principal_amount, loan_repayment, interest_payment, self.current_year, self.paid_off




class Tenant:
    def __init__(self, net_rent_per_year, net_rent_increase_per_year, maintenance_cost_per_year, maintenance_cost_increase_per_year):
        self.net_rent_per_year = net_rent_per_year
        self.net_rent_increase_per_year = net_rent_increase_per_year
        self.maintenance_cost_per_year = maintenance_cost_per_year
        self.maintenance_cost_increase_per_year  = maintenance_cost_increase_per_year
        
        self.current_year = 0 
        
    def simulate_year(self):
        self.net_rent_per_year *= (1 + self.net_rent_increase_per_year)
        self.maintenance_cost_per_year *= (1 + self.maintenance_cost_increase_per_year)
        
        self.current_year += 1
        
        return self.net_rent_per_year, self.maintenance_cost_per_year




class Landlord:
    def __init__(self, initial_taxable_income_per_year, taxable_income_increase_per_year, marital_status):
        self.initial_taxable_income_per_year = initial_taxable_income_per_year
        self.taxable_income_per_year = self.initial_taxable_income_per_year
        self.taxable_income_increase_per_year = taxable_income_increase_per_year
        
        self.marital_status = marital_status
    
        self.current_year = 0
        
    
    def simulate_year(self):
        self.taxable_income_per_year = self.taxable_income_per_year * (1 + self.taxable_income_increase_per_year)
        
        self.current_year += 1
        
        return self.taxable_income_per_year




class RealEstateInvestment:
    def __init__(self, real_estate_object, annuity_loan, tenant, landlord, tax_interface, initial_year):
        self.real_estate_object = real_estate_object
        self.annuity_loan = annuity_loan
        self.tenant = tenant
        self.landlord = landlord
        
        self.tax_interface = tax_interface
        
        self.initial_year = initial_year
        self.current_year = self.initial_year
        
        self.initial_wealth = real_estate_object.initial_total_value - annuity_loan.principal_amount
        self.current_wealth = self.initial_wealth
        
        self.invested_capital = real_estate_object.total_price
    
    
    def simulate_year(self):
        property_value, value_increase, depreciated_amount, maintenance_cost_landlord, current_year, is_fully_depreciated = self.real_estate_object.simulate_year()
        remaining_principal_amount, loan_repayment, interest_payment, current_year, is_paid_off = self.annuity_loan.simulate_year()
        rent, _ = self.tenant.simulate_year()
        taxable_income = self.landlord.simulate_year()
        
        effective_property_value = property_value - remaining_principal_amount
        cashflow_before_tax = rent - loan_repayment - interest_payment - maintenance_cost_landlord
        taxable_income_increase = rent - depreciated_amount - interest_payment - maintenance_cost_landlord
        
        tax_wo_real_estate, _, _ = self.tax_interface.calculate_tax(self.landlord.marital_status, taxable_income, self.current_year)
        tax_w_real_estate, _, _ = self.tax_interface.calculate_tax(self.landlord.marital_status, taxable_income + taxable_income_increase, self.current_year)
        additional_tax = tax_w_real_estate - tax_wo_real_estate
        
        cashflow_after_tax = cashflow_before_tax - additional_tax
        
        wealth_increase = value_increase + rent - interest_payment - maintenance_cost_landlord - additional_tax
        self.current_wealth += wealth_increase
        
        return_on_equity = wealth_increase / self.invested_capital
        return_on_equity_wo_value_increase = (wealth_increase - value_increase) / self.invested_capital
        
        self.current_year += 1
        
        
        return self.current_wealth, return_on_equity, return_on_equity_wo_value_increase
        


class TaxInterface:
    """
    German income tax approximation with 2026 as base law.

    For year >= base_year, taxable income is deflated into base_year euros
    using a bracket_shift_rate_per_year (e.g. 0.02 for 2% p.a.),
    the 2026 curve is applied, and the tax result is re-inflated.
    """

    def __init__(self, base_year: int = 2026, bracket_shift_rate_per_year: float = 0.02):
        self.base_year = base_year
        self.bracket_shift_rate_per_year = bracket_shift_rate_per_year

    # ---------- PUBLIC API ----------

    def calculate_tax(self, marital_status: str, taxable_income: float, year: int):
        """
        :param marital_status: "single" or "married"
        :param taxable_income: taxable income (zvE) in that year, nominal €
        :param year: tax year, must be >= base_year
        :return: (tax_amount, average_rate_percent, marginal_rate_percent)
        """
        if year < self.base_year:
            raise ValueError(f"Unsupported tax year: {year} (must be >= {self.base_year})")

        income = max(float(taxable_income), 0.0)
        if income <= 0:
            return 0.0, 0.0, 0.0

        status = marital_status.strip().lower()
        if status not in ("single", "married"):
            raise ValueError(f"Invalid marital status: {marital_status!r}")

        # --- Indexation: convert nominal income into base-year real income ---
        factor = (1.0 + self.bracket_shift_rate_per_year) ** (year - self.base_year)
        income_real = income / factor  # income in base_year euros

        # Apply base-year tax law on real income
        if status == "single":
            tax_real, _, marginal = self._single_base(income_real)
        else:
            tax_real, _, marginal = self._married_base(income_real)

        # Re-inflate tax result to nominal euros
        tax_nominal = tax_real * factor

        # Average rate based on nominal income
        avg_rate = tax_nominal / income * 100.0 if income > 0 else 0.0

        # Marginal rate stays the base-year marginal at real income (dimensionless)
        marginal_rate = marginal

        return tax_nominal, avg_rate, marginal_rate

    # ---------- BASE-YEAR (2026) LAW ----------

    def _single_base(self, zve_real: float):
        """
        2026 Grundtabelle on real (base-year) zvE.
        Returns (tax_real, avg_rate_percent, marginal_rate_percent).
        """
        tax = self._est_2026(zve_real)
        x = max(int(zve_real), 1)
        avg = tax / x * 100.0
        marginal = self._marginal_2026(zve_real)
        return tax, avg, marginal

    def _married_base(self, joint_zve_real: float):
        """
        2026 Splittingtabelle on real (base-year) zvE.
        Returns (tax_real, avg_rate_percent, marginal_rate_percent).
        """
        if joint_zve_real <= 0:
            return 0.0, 0.0, 0.0

        half = joint_zve_real / 2.0
        tax_half = self._est_2026(half)
        tax = 2.0 * tax_half

        x = max(joint_zve_real, 1.0)
        avg = tax / x * 100.0

        # marginal is derivative w.r.t. half zvE; for splitting, we use marginal at half income
        marginal = self._marginal_2026(half)
        return tax, avg, marginal

    # ---------- 2026 ESTIMATE + MARGINAL CURVE (unchanged) ----------

    @staticmethod
    def _est_2026(zve: float) -> float:
        """
        Base-year (2026) tax function in base-year euros.
        """
        x = int(zve)

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

    @staticmethod
    def _marginal_2026(zve: float) -> float:
        """
        Base-year marginal rate in percent, as function of base-year zvE.
        """
        x = int(zve)

        if x <= 12_348:
            return 0.0

        if x <= 17_799:
            y = (x - 12_348) / 10_000
            # derivative of (914.51*y + 1400)*y w.r.t. x, scaled to %
            return (2 * 914.51 * y + 1_400.0) / 10_000 * 100.0

        if x <= 69_878:
            z = (x - 17_799) / 10_000
            # derivative of (173.1*z + 2397)*z + 1034.87
            return (2 * 173.1 * z + 2_397.0) / 10_000 * 100.0

        if x <= 277_825:
            return 42.0

        return 45.0


