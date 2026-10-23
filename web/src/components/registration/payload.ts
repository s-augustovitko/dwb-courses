import type { Audience, PublicForm } from "~/models";
import { dateInputToUnix, parseMoneyToCents } from "~/utils";
import type { Person, Selection } from "./validation";

/** Overrides left empty keep the catalog price, so they are not sent. */
export function toOverrides(overrides: Record<string, string>) {
  return Object.entries(overrides)
    .filter(([, text]) => text !== "")
    .map(([itemId, text]) => ({
      itemId,
      priceCents: parseMoneyToCents(text),
    }));
}

export function buildPersonPayload(person: Person): Record<string, unknown> {
  return {
    idTypeId: person.idTypeId,
    documentNumber: person.documentNumber,
    firstName: person.firstName,
    lastName: person.lastName,
    countryCode: person.countryCode,
    phoneNumber: person.phoneNumber,
    email: person.email,
    arrivalDate: dateInputToUnix(person.arrivalDate),
    departureDate: dateInputToUnix(person.departureDate),
    insuranceProvider: person.insuranceProvider || null,
    insurancePolicyNumber: person.insurancePolicyNumber || null,
    emergencyContactName: person.emergencyContactName || null,
    emergencyContactPhone: person.emergencyContactPhone || null,
    emergencyContactCountryCode: person.emergencyContactPhone
      ? person.emergencyContactCountryCode
      : null,
    emergencyContactEmail: person.emergencyContactEmail || null,
  };
}

export function buildRegistrationPayload(
  form: PublicForm,
  audience: Audience,
  person: Person,
  selection: Selection,
): Record<string, unknown> {
  return {
    ...buildPersonPayload(person),
    formId: form.id,
    audience,
    currencyCode: selection.currencyCode,
    sessionIds: selection.sessionIds,
    mealIds: selection.mealIds,
    dietaryPreference: selection.dietaryPreference,
    donationCents: parseMoneyToCents(selection.donationText) ?? 0,
  };
}
