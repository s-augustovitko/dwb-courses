import type { Audience, PublicCurrency, PublicForm } from "~/models";

/** Audiences a form supports: local needs the default currency, foreigner needs another one. */
export function audienceOptions(form: PublicForm): Audience[] {
  const hasDefault = form.currencies.some((c) => c.isDefault);
  const hasForeign = form.currencies.some((c) => !c.isDefault);

  return [
    ...(hasDefault ? (["LOCAL"] as const) : []),
    ...(hasForeign ? (["FOREIGNER"] as const) : []),
  ];
}

export function currenciesFor(
  form: PublicForm,
  audience: Audience,
): PublicCurrency[] {
  return form.currencies.filter((c) =>
    audience === "LOCAL" ? c.isDefault : !c.isDefault,
  );
}
