import type { Form, IdType, Price, PublicForm, PublicOption } from "~/models";
import { Method, request } from "~/utils";

type StaffItem = {
  id: string;
  name: string;
  hintText: string;
  prices: Price[];
  sessionDate?: string;
  mealDate?: string;
};

const toPublicOption = (item: StaffItem): PublicOption => ({
  id: item.id,
  name: item.name,
  hintText: item.hintText,
  date: item.sessionDate ?? item.mealDate ?? "",
  prices: item.prices,
});

/** Built from the staff endpoints because the public one hides disabled forms. */
export async function fetchStaffForm(
  formId: string,
  withIdTypes = true,
): Promise<PublicForm> {
  const base = `form/${encodeURIComponent(formId)}`;
  const active = { active: "true" };
  const [form, sessions, meals, idTypes] = await Promise.all([
    request<Form>(base, Method.GET),
    request<StaffItem[]>(`${base}/session`, Method.GET, active),
    request<StaffItem[]>(`${base}/meal`, Method.GET, active),
    withIdTypes
      ? request<IdType[]>("id-type", Method.GET, active)
      : Promise.resolve([]),
  ]);

  return {
    id: form.id,
    title: form.title,
    description: form.description,
    showArrivalAndDeparture: form.showArrivalAndDeparture,
    showInsurance: form.showInsurance,
    showEmergencyContact: form.showEmergencyContact,
    disableSessionSelection: form.disableSessionSelection,
    disableMealSelection: form.disableMealSelection,
    disableDonation: form.disableDonation,
    currencies: form.currencies.map((currency) => ({
      code: currency.code,
      displayName: currency.displayName,
      isDefault: currency.isDefault ?? false,
    })),
    idTypes: idTypes.map(({ id, label, allowLetters, maxLen }) => ({
      id,
      label,
      allowLetters,
      maxLen,
    })),
    sessions: sessions.map(toPublicOption),
    meals: meals.map(toPublicOption),
    // The edit modals do not estimate the order; the server recomputes discounts
    discounts: [],
  };
}
