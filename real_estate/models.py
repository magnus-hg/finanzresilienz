"""Domain models for real estate simulations."""
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


@dataclass
class RentalInvestment:
    """Bundle inputs and helpers for buy-to-let simulations."""

    property_params: PropertyParams
    loan_params: LoanParams
    rent_params: RentParams
    holding_years: int
    vacancy_rate: float = 0.0
    maintenance_reserve_pct: float = 0.0
    tax_rate: float = 0.0

    def _adjusted_rent_params(self) -> RentParams:
        """Apply vacancy and maintenance assumptions to rent params."""

        vacancy_multiplier = max(0.0, min(1.0, 1 - self.vacancy_rate))
        maintenance_reserve = self.property_params.purchase_price * self.maintenance_reserve_pct
        return RentParams(
            net_cold_rent_month=self.rent_params.net_cold_rent_month * vacancy_multiplier,
            operating_costs_month=self.rent_params.operating_costs_month,
            mgmt_costs_annual=self.rent_params.mgmt_costs_annual + maintenance_reserve,
            rent_increase_rate=self.rent_params.rent_increase_rate,
            rent_increase_interval_years=self.rent_params.rent_increase_interval_years,
        )

    def to_simulation_params(self, start_year: int) -> SimulationParams:
        """Translate inputs into reusable ``SimulationParams``."""

        return SimulationParams(
            start_year=start_year,
            n_years=self.holding_years,
            property_params=self.property_params,
            loan_params=self.loan_params,
            rent_params=self._adjusted_rent_params(),
            tax_rate=self.tax_rate,
        )

    def run_simulation(self, start_year: int):
        """Convenience wrapper to execute the simulation pipeline."""

        from .simulation import simulate

        params = self.to_simulation_params(start_year)
        return simulate(params)


@dataclass
class SelfUsedPropertyInvestment:
    """Represents a self-occupied property with financing details."""

    property_params: PropertyParams
    loan_params: LoanParams
    imputed_rent_savings: float = 0.0
    maintenance_reserve_pct: float = 0.0
    opportunity_cost_rate: float = 0.0
    holding_years: int = 30

    def _annuity(self) -> float:
        from .finance import calc_annuity

        if self.loan_params.annuity is not None:
            return self.loan_params.annuity
        return calc_annuity(
            self.loan_params.principal, self.loan_params.interest_rate, self.loan_params.years
        )

    def _mortgage_projection(self, years: int) -> tuple[float, float]:
        """Return remaining balance and cumulative interest after ``years``."""

        from .finance import amortization_step

        balance = self.loan_params.principal
        interest_paid = 0.0
        annuity = self._annuity()
        for _ in range(years):
            balance, interest, repayment = amortization_step(balance, self.loan_params.interest_rate, annuity)
            interest_paid += interest
            if balance <= 0:
                balance = 0.0
                break
        return balance, interest_paid

    def projected_equity(self, years: Optional[int] = None) -> float:
        """Estimate equity after property appreciation and amortization."""

        target_years = years if years is not None else self.holding_years
        value = self.property_params.purchase_price * (1 + self.property_params.value_growth_rate) ** target_years
        remaining_balance, _ = self._mortgage_projection(target_years)
        return value - remaining_balance

    def total_cost_of_ownership(self, years: Optional[int] = None) -> float:
        """Approximate cumulative ownership cost net of imputed rent savings."""

        target_years = years if years is not None else self.holding_years
        _, interest_paid = self._mortgage_projection(target_years)

        transaction_costs = self.property_params.purchase_price * self.property_params.transaction_cost_factor
        maintenance = self.property_params.purchase_price * self.maintenance_reserve_pct * target_years
        imputed_savings = self.imputed_rent_savings * 12 * target_years

        equity_contribution = max(
            self.property_params.purchase_price + transaction_costs - self.loan_params.principal, 0.0
        )
        opportunity_cost = equity_contribution * ((1 + self.opportunity_cost_rate) ** target_years - 1)

        return transaction_costs + maintenance + interest_paid + opportunity_cost - imputed_savings






class RealEstateObject:
    def __init__(self, total_price, building_portion, value_increase_per_year, depreciation_per_year, maintenance_cost_per_year, maintenance_cost_increase_per_year):
        self.initial_total_value = total_price
        self.total_value = self.initial_total_value
        
        # Land and Building Value based on initial total price
        self.initial_building_value = total_price * building_portion
        self.building_value = self.initial_building_value
        self.land_value = total_price * (1 - building_portion)
        
        # Rates (as decimal, e.g., 0.02 for 2%)
        self.value_increase_rate = value_increase_per_year 
        self.depreciation_rate = depreciation_per_year     
        
        self.fully_depreciated = False
        
        self.initial_maintenance_cost_per_year = maintenance_cost_per_year
        self.maintenance_cost_per_year = maintenance_cost_per_year
        self.maintenance_cost_increase_per_year = maintenance_cost_increase_per_year
        
        self.current_year = 0
        
        
    def simulate_year(self):
        value_increase = self.total_value * self.value_increase_rate
        self.total_value += value_increase
        
        depreciation_amount = self.initial_building_value * self.depreciation_rate
        
        depreciatiable_amount = min(full_depreciation, self.building_value)
            
        self.building_value -= depreciatiable_amount
        
        if self.building_value = 0:
            self.fully_depreciated = True
        
        self.maintenance_cost_per_year *= (1 + self.maintenance_cost_increase_per_year)
        
        self.current_year += 1
        
        return self.total_value, value_increase, depreciatiable_amount, self.maintenance_cost_per_year, self.current_year, self.fully_depreciated
        
        
        
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
        self.net_rent_per_year = net_rent_increase_per_year
        self.maintenance_cost = maintenance_cost_per_year
        self.maintenance_cost_increase_per_year  = maintenance_cost_increase_per_year
        
        self.current_year = 0 
        
    def simulate_year(self):
        self.net_rent_per_year *= (1 + self.net_rent_increase_per_year)
        self.maintenance_cost_per_year *= (1 + self.maintenance_cost_increase_per_year)
        
        self.current_year += 1
        
        return self.net_rent_per_year, self.maintenance_cost_per_year




class Landlord:
    def __init__(self, initial_taxable_income_per_year, taxable_income_increase_per_year, maritial_status):
        self.initial_taxable_income_per_year = initial_taxable_income_per_year
        self.taxable_income_per_year = self.initial_taxable_income_per_year
        self.taxable_income_increase_per_year = taxable_income_increase_per_year
        
        self.maritial_status = maritial_status
    
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
        
    
    def simulate_year(self):
        property_value, value_increase, depreciated_amount, maintenance_cost_landlord, current_year, is_fully_depreciated = self.real_estate_object.simulate_year()
        remaining_principal_amount, loan_repayment, interest_payment, current_year, is_paid_off = self.annuity_loan.simulate_year()
        rent, maintenance_cost_tenant = self.tenant.simulate_year()
        taxable_income = self.landlord.simulate_year()
        
        effective_property_value = property_value - remaining_principal_amount
        cashflow_before_tax = rent - loan_repayment - interest_payment - maintenance_cost_landlord
        taxable_income_increase = rent - depreciated_amount - interest_payment - maintenance_cost_landlord
        
        tax_wo_real_estate = self.tax_interface(taxable_income, year)
        tax_w_real_estate = self.tax_interface(taxable_income + taxable_income_increase, year)
        additional_tax = tax_w_real_estate - tax_wo_real_estate
        
        cashflow_after_tax = cashflow_before_tax - additional_tax
        
        return total_value, total_cost, tax_deductable
        


