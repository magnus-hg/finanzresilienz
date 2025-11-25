class RealEstateFinanceDataProviderPlaceholder():
    def __init__(self, config_file):
        self.placeholder_data = json.loads(config_file)
        
    def get_finance_data(self, region):
        if region == "germany":
            return self.placeholder_data["germany_placeholder"].copy()
        else:
            return self.placeholder_data["plz_placeholder"].copy()
        
        
        
class RealEstateFinanceData():
    def __init__(self, real_estate_finance_data_provider):
        self.real_estate_finance_data_provider = real_estate_finance_data_provider
        
    def get_finance_data(self, region):
        self.real_estate_finance_data_provider.get_finance_data(region)
        


def get_real_estate_finance_data_placeholder(json_file):
    real_estate_finance_data_provider = RealEstateFinanceData(json_file)
    real_estate_finance_data = RealEstateFinanceData(real_estate_finance_data_provider)
    
    return real_estate_finance_data