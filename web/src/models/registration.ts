import type { Discount } from "./discounts";
import type { Price } from "./prices";

export type Audience = "LOCAL" | "FOREIGNER";
export type DietaryPreference = "REGULAR" | "VEGETARIAN";

export const dietaryLabels: Record<DietaryPreference, string> = {
  REGULAR: "Regular",
  VEGETARIAN: "Vegetariano",
};

export const dietaryOptions = (
  Object.keys(dietaryLabels) as DietaryPreference[]
).map((value) => ({ value, label: dietaryLabels[value] }));

export type RegistrationStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "CANCELLED";

/** Methods staff can record; the system adds ONLINE_PAYMENT and REFUND. */
export type ManualPaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "YAPE"
  | "PLIN"
  | "OTHER";
export type PaymentMethod = ManualPaymentMethod | "ONLINE_PAYMENT" | "REFUND";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  YAPE: "Yape",
  PLIN: "Plin",
  OTHER: "Otro",
  ONLINE_PAYMENT: "Pago en línea",
  REFUND: "Reembolso",
};

export const manualPaymentMethods: ManualPaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "YAPE",
  "PLIN",
  "OTHER",
];

export type PublicFormSummary = {
  id: string;
  title: string;
};

export type PublicCurrency = {
  code: string;
  displayName: string;
  isDefault: boolean;
};

export type PublicIdType = {
  id: string;
  label: string;
  allowLetters: boolean;
  maxLen: number;
};

export type PublicOption = {
  id: string;
  name: string;
  hintText: string;
  date: string;
  prices: Price[];
};

/** An automatic discount: the server adds it when the selection qualifies. */
export type PublicDiscount = Pick<
  Discount,
  "id" | "discountType" | "name" | "hintText" | "cutoffDate" | "prices"
>;

export type PublicForm = {
  id: string;
  title: string;
  description: string;

  showArrivalAndDeparture: boolean;
  showInsurance: boolean;
  showEmergencyContact: boolean;

  disableSessionSelection: boolean;
  disableMealSelection: boolean;
  disableDonation: boolean;

  currencies: PublicCurrency[];
  idTypes: PublicIdType[];
  sessions: PublicOption[];
  meals: PublicOption[];
  discounts: PublicDiscount[];
};

export type PublicCountry = {
  name: string;
  dialCode: string;
  code: string;
};

export type CartLine = {
  manual: boolean;
  lineId: string;
  itemId: string;
  name: string;
  amountCents: number;
};

export type Cart = {
  orderId: string;
  formId: string;
  status: RegistrationStatus;
  audience: Audience;
  currencyCode: string;
  firstName: string;
  maskedDocument: string;
  maskedEmail: string;
  dietaryPreference: "" | DietaryPreference;
  sessions: CartLine[];
  meals: CartLine[];
  discounts: CartLine[];
  donationCents: number;
  totalCents: number;
  paidCents: number;
  paymentPending: boolean;
  /** Computed by the server: the balance can be paid online right now. */
  onlinePayable: boolean;
};

export type CreateRegistrationResponse = {
  token: string;
  cart: Cart;
};

export type SubmitRegistrationResponse = {
  orderId: string;
  qrUrl: string;
};

export type StaffPayment = {
  method: PaymentMethod;
  amountCents: number;
  providerReference: string;
  note: string;
  /** RFC 3339. */
  createdAt: string;
};

export type StaffRegistration = Omit<
  Cart,
  "firstName" | "maskedDocument" | "maskedEmail" | "onlinePayable"
> & {
  formTitle: string;
  firstName: string;
  lastName: string;
  idTypeId: string;
  idTypeLabel: string;
  documentNumber: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  cancelledAt: string | null;
  balanceCents: number;
  arrivalDate: string | null;
  departureDate: string | null;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactCountryCode: string;
  emergencyContactEmail: string;
  payments: StaffPayment[];
};

export type RegistrationListItem = {
  orderId: string;
  status: RegistrationStatus;
  formId: string;
  formTitle: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  email: string;
  currencyCode: string;
  totalCents: number;
  paidCents: number;
  /** RFC 3339. */
  createdAt: string;
};

export type RegistrationList = {
  items: RegistrationListItem[];
  hasMore: boolean;
};
