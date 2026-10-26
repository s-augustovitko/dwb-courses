import type {
  DietaryPreference,
  PaymentMethod,
  RegistrationStatus,
} from "./registration";

export type DashboardEarning = {
  currencyCode: string;
  totalCents: number;
  paidCents: number;
};

export type DashboardStatusCount = {
  status: RegistrationStatus;
  people: number;
};

export type DashboardSessionCount = {
  sessionId: string;
  name: string;
  formTitle: string;
  status: RegistrationStatus;
  people: number;
};

export type DashboardMealCount = {
  mealId: string;
  name: string;
  formTitle: string;
  status: RegistrationStatus;
  /** Empty when the person did not pick one. */
  dietaryPreference: DietaryPreference | "";
  people: number;
};

export type DashboardPaymentTotal = {
  currencyCode: string;
  currencyName: string;
  method: PaymentMethod;
  status: RegistrationStatus;
  amountCents: number;
};

export type Dashboard = {
  earnings: DashboardEarning[];
  statuses: DashboardStatusCount[];
  sessions: DashboardSessionCount[];
  meals: DashboardMealCount[];
  payments: DashboardPaymentTotal[];
};
