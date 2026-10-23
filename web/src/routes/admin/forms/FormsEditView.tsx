import { useParams } from "@solidjs/router";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { MealsSection, SessionsSection } from "~/components/dated-items";
import { DiscountsSection } from "~/components/discounts";
import { FormDetailsSection } from "~/components/forms";
import { AdminWrapper } from "~/components/layout";
import type { Form, PricedItem } from "~/models";
import { Method, request } from "~/utils";

const AdminFormsEditView: Component = () => {
  const params = useParams<{ id: string }>();

  const [form, { mutate: setForm }] = createResource(
    () => params.id,
    (id) => request<Form>(`form/${id}`, Method.GET),
  );

  const [sessions, setSessions] = createSignal<PricedItem[]>([]);
  const [meals, setMeals] = createSignal<PricedItem[]>([]);
  const [discounts, setDiscounts] = createSignal<PricedItem[]>([]);

  const missingPriceWarnings = createMemo(() => {
    const currentForm = form();
    if (!currentForm) {
      return [] as string[];
    }

    const warnings: string[] = [];

    const addMissingPriceWarnings = (label: string, items: PricedItem[]) => {
      for (const item of items) {
        const missing = currentForm.currencies.filter(
          (c) => !item.prices.some((p) => p.currencyCode === c.code),
        );
        if (missing.length > 0) {
          warnings.push(
            `${label} "${item.name}": falta precio en ${missing.map((c) => c.displayName).join(", ")}`,
          );
        }
      }
    };

    addMissingPriceWarnings("Sesión", sessions());
    addMissingPriceWarnings("Comida", meals());
    addMissingPriceWarnings("Descuento", discounts());

    return warnings;
  });

  return (
    <AdminWrapper previous="/admin/forms" title={form()?.title ?? ""}>
      <Show when={missingPriceWarnings().length > 0}>
        <div class="message is-warning">
          <div class="message-header">
            <p>Algunos elementos no tienen precio en todas las monedas:</p>
          </div>

          <div class="message-body">
            <ul>
              {missingPriceWarnings().map((warning) => (
                <li>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      </Show>

      <FormDetailsSection formId={params.id} form={form} setForm={setForm} />

      <SessionsSection
        formId={params.id}
        currencies={form()?.currencies ?? []}
        onItems={setSessions}
      />

      <MealsSection
        formId={params.id}
        currencies={form()?.currencies ?? []}
        onItems={setMeals}
      />

      <DiscountsSection
        formId={params.id}
        currencies={form()?.currencies ?? []}
        onItems={setDiscounts}
      />
    </AdminWrapper>
  );
};

export default AdminFormsEditView;
