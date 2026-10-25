import type { PersonValues, SelectionValues } from "./validation";

export const DEFAULT_DIAL_CODE = "+51";

export function emptyPerson(): PersonValues {
  return {
    idTypeId: "",
    documentNumber: "",
    firstName: "",
    lastName: "",
    countryCode: DEFAULT_DIAL_CODE,
    phoneNumber: "",
    email: "",
    arrivalDate: "",
    departureDate: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactCountryCode: DEFAULT_DIAL_CODE,
    emergencyContactEmail: "",
  };
}

export function emptySelection(currencyCode: string): SelectionValues {
  return {
    currencyCode,
    sessionMode: "",
    mealMode: "",
    sessionIds: [],
    mealIds: [],
    dietaryPreference: "",
    donationText: "",
    overrides: {},
  };
}
