import json, random  
    
   
class RealEstateMarketStatisticsPlaceholder():
    def __init__(self, config_file):
        self.placeholder_data = json.loads(config_file)
        
    def get_object_statistics(self, region):
        if region == "germany":
            return self.placeholder_data["germany_placeholder"].copy()
        else:
            return self.placeholder_data["plz_placeholder"].copy()



class RealEstateObjectGenerator():
    def __init__(self, market_statistics_placeholder, value_range=0.2, num_objects_per_region=10):
        self.market_statistics_placeholder = market_statistics_placeholder
        self.num_objects_per_region = num_objects_per_region
        self.value_range = value_range
        
    def get_random_value(self, attribute):
        min_bound = attribute - attribute * self.value_range / 2
        max_bound = attribute + attribute * self.value_range / 2
        return random.uniform(min_bound, max_bound)
        
    
    def get_object(self, region):
        object_statistics = self.market_statistics_placeholder.get_object_statistics(region)
        object_statistics["avg_kaltmiete_euro_per_sqm"] = self.get_random_value(object_statistics["avg_kaltmiete_euro_per_sqm"])
        object_statistics["avg_kaufpreis_euro_per_sqm"] = self.get_random_value(object_statistics["avg_kaufpreis_euro_per_sqm"])
        object_statistics["avg_hausgeld_umlagefaehig_euro_per_sqm"] = self.get_random_value(object_statistics["avg_hausgeld_umlagefaehig_euro_per_sqm"])
        object_statistics["avg_hausgeld_nicht_umlagefaehig_euro_per_sqm"] = self.get_random_value(object_statistics["avg_hausgeld_nicht_umlagefaehig_euro_per_sqm"])
        
        return object_statistics
        
        
    def get_objects(self, region):
        real_estate_objects = []
        for object_counter in range(self.num_objects_per_region):
            real_estate_objects.append(self.get_object(region))
                        
        return real_estate_objects

        
    
class RealEstateMarket():
    def __init__(self, market_statistics_provider, market_objects_provider):
        self.market_statistics_provider = market_statistics_provider
        self.market_objects_provider = market_objects_provider
        
        
    def get_objects(self, region):
        return self.market_objects_provider.get_objects(region)
        
        
def get_real_estate_market_placeholder(json_file):
    market_statistics_provider = RealEstateMarketStatisticsPlaceholder(json_file)
    market_objects_provider = RealEstateObjectGenerator(market_statistics_provider)
    real_estate_market = RealEstateMarket(market_statistics_provider, market_objects_provider)
    
    return real_estate_market
    
