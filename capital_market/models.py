class CapitalMarketInvestment:
    def __init__(self, name, isin, expected_return):
        self.name = name
        self.isin = isin
        self.expected_return = expected_return
        self.current_value = 0
        self.current_year = -1
    
    
    def simulate_year(self, investment_amount):
        self.current_value += investment_amount
        self.current_value += self.current_value * self.expected_return
        self.current_year += 1
        
        return self.current_value, self.current_year
        
        
def simulate_market_investment(name, isin, expected_return, initial_investment_amount, yearly_investment_rate, years):
    cmi = CapitalMarketInvestment(name, isin, expected_return)
    values = []
    for year in range(years):
        if year == 0:
            current_value, _ = cmi.simulate_year(initial_investment_amount + yearly_investment_rate)
            values.append(current_value)
        else:
            current_value, _ = cmi.simulate_year(yearly_investment_rate)
            values.append(current_value)

    return values, years


