// Suggestions, not stock/variant eligibility. Verified 2026-11-10.
// Models: https://www.nippontoyota.co.in/
// HyCross colours: https://www.toyotabharat.com/showroom/innova/
export const toyotaModels = ['Glanza','Urban Cruiser Taisor','Rumion','Urban Cruiser Hyryder','Urban Cruiser Ebella','Innova Crysta','Innova HyCross','Hilux','Fortuner','Legender','Camry','Vellfire','Land Cruiser 300'];
// Crysta colours: https://www.toyotabharat.com/showroom/innova-crysta/
export const modelColours: Record<string,string[]> = {
  'Innova Crysta':['Avant-Garde Bronze Metallic','Platinum White Pearl','Super White','Attitude Black Mica'],
  'Innova HyCross':['Blackish Ageha Glass Flake','Super White','Platinum White Pearl','Attitude Black Mica','Avant Garde Bronze Metallic'],
};
export type BookingSuggestions = Record<string,string[]>;
