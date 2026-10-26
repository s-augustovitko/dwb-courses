import type { SelectOption } from "~/components/global";
import type { FormListItem } from "~/models";
import { Method, request } from "~/utils";

const fetchForms = (enabled: "true" | "false") =>
  request<FormListItem[]>("form", Method.GET, { enabled });

// Registrations outlive their form being disabled, so offer both: active first.
export const fetchAllForms = () =>
  Promise.all([fetchForms("true"), fetchForms("false")]).then((lists) =>
    lists.flat(),
  );

export const toFormOption = (form: FormListItem): SelectOption => ({
  value: form.id,
  label: form.isEnabled ? form.title : `${form.title} (inactivo)`,
});
