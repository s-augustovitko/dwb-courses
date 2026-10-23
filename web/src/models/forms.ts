export type FormListItem = {
  id: string;
  title: string;
  isEnabled: boolean;

  sessionCount: number;
  mealCount: number;
  currenciesCount: number;
  mainCurrency: string;

  updatedAt: string;
};

export type CurrencyRef = {
  code: string;
  displayName: string;
  isDefault?: boolean;
};

export type Form = {
  id: string;
  title: string;
  description: string;

  showArrivalAndDeparture: boolean;
  showInsurance: boolean;
  showEmergencyContact: boolean;

  disableSessionSelection: boolean;
  disableMealSelection: boolean;
  disableDonation: boolean;

  isEnabled: boolean;

  currencies: CurrencyRef[];
};
