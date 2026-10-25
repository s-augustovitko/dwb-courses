import { createForm, getValue, reset, valiForm } from "@modular-forms/solid";
import {
  type Component,
  createEffect,
  createResource,
  For,
  Show,
} from "solid-js";
import * as v from "valibot";
import {
  Modal,
  ModalFooter,
  MoneyInput,
  MultiSelect,
  RadioGroup,
  type SelectOption,
} from "~/components/global";
import { LinesSkeleton } from "~/components/layout";
import {
  dietaryField,
  inputField,
  isPriced,
  NO_ITEMS_ERROR,
  NO_SESSION_ERROR,
  overridesField,
  priceIn,
  toOverrides,
  toSwitchOption,
} from "~/components/registration";
import { type CartLine, dietaryOptions, type PublicOption } from "~/models";
import { useNotifications } from "~/stores";
import { formatCents, loadedValue, Method } from "~/utils";
import { useStaffAction } from "./staffAction";
import { fetchStaffForm } from "./staffForm";
import type { ActionProps } from "./types";

// Mirrors editItems in internal/registration/adminitems.go.
const itemsSchema = (sessionsRequired: boolean) =>
  v.lazy((input) => {
    const mealCount = inputField<string[]>(input, "mealIds", []).length;

    return v.object({
      sessionIds: v.pipe(
        v.array(v.string()),
        v.check((ids) => !sessionsRequired || ids.length > 0, NO_SESSION_ERROR),
        v.check((ids) => ids.length + mealCount > 0, NO_ITEMS_ERROR),
      ),
      mealIds: v.optional(v.array(v.string()), []),
      dietaryPreference: v.optional(dietaryField(mealCount > 0), ""),
      overrides: v.optional(overridesField(), {}),
    });
  });

type ItemsSchema = v.InferInput<ReturnType<typeof itemsSchema>>;

/** Catalog options priced at what the order already holds, plus lines the catalog no longer lists. */
function withOrderPrices(
  options: PublicOption[],
  lines: CartLine[],
  currencyCode: string,
): PublicOption[] {
  const orderPrices = (line: CartLine) => [
    { currencyCode, amountCents: line.amountCents },
  ];

  const listed = options.map((option) => {
    const line = lines.find((l) => l.itemId === option.id);
    return line ? { ...option, prices: orderPrices(line) } : option;
  });
  const missing = lines
    .filter((line) => !options.some((option) => option.id === line.itemId))
    .map((line) => ({
      id: line.itemId,
      name: `${line.name} (ya incluida)`,
      hintText: "",
      date: "",
      prices: orderPrices(line),
    }));

  return [...listed, ...missing];
}

function selectOptions(
  options: PublicOption[],
  currencyCode: string,
  withTime: boolean,
): SelectOption[] {
  return options
    .filter((option) => isPriced(option, currencyCode))
    .map((option) => ({
      value: option.id,
      label: `${toSwitchOption(option, currencyCode, withTime).label} - ${formatCents(currencyCode, priceIn(option, currencyCode))}`,
    }));
}

export const EditItemsModal: Component<ActionProps> = (props) => {
  const notifications = useNotifications();
  const send = useStaffAction(props);

  const [staffForm] = createResource(
    () => (props.open ? props.reg.formId : null),
    (id) =>
      fetchStaffForm(id, false).catch(() => {
        notifications.error("No se pudo cargar el formulario");
        return null;
      }),
  );

  const loaded = () => loadedValue(staffForm);

  // Mirrors the server: a form with session selection needs at least one session.
  const sessionsRequired = () => !loaded()?.disableSessionSelection;
  const schema = () => itemsSchema(sessionsRequired());

  const [form, { Form, Field }] = createForm<ItemsSchema>({
    validate: (values) => valiForm<ItemsSchema>(schema())(values),
    validateOn: "change",
  });

  // The fields mount once the form loads, and reset only fills mounted fields.
  createEffect(() => {
    if (props.open && loaded()) {
      reset(form, {
        initialValues: {
          sessionIds: props.reg.sessions.map((line) => line.itemId),
          mealIds: props.reg.meals.map((line) => line.itemId),
          dietaryPreference: props.reg.dietaryPreference,
          overrides: {},
        },
      });
    }
  });

  const sessions = () =>
    withOrderPrices(
      loaded()?.sessions ?? [],
      props.reg.sessions,
      props.reg.currencyCode,
    );
  const meals = () =>
    withOrderPrices(
      loaded()?.meals ?? [],
      props.reg.meals,
      props.reg.currencyCode,
    );

  const originalIds = () =>
    new Set(
      [...props.reg.sessions, ...props.reg.meals].map((line) => line.itemId),
    );
  const selectedIds = () => [
    ...(getValue(form, "sessionIds") ?? []),
    ...(getValue(form, "mealIds") ?? []),
  ];
  const addedOptions = () =>
    [...sessions(), ...meals()].filter(
      (option) =>
        !originalIds().has(option.id) && selectedIds().includes(option.id),
    );

  async function submit(values: ItemsSchema) {
    const parsed = v.parse(schema(), values);
    await send("/items", Method.PUT, {
      sessionIds: parsed.sessionIds,
      mealIds: parsed.mealIds,
      dietaryPreference:
        parsed.mealIds.length > 0 ? parsed.dietaryPreference : "",
      overrides: toOverrides(parsed.overrides),
    });
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Editar sesiones y comidas"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Guardar"
            loading={form.submitting}
            disabled={!loaded()}
            onCancel={props.onClose}
          />
        }
      >
        <Show
          when={loaded()}
          fallback={
            <Show
              when={!staffForm.loading}
              fallback={<LinesSkeleton lines={4} />}
            >
              <p>No se pudo cargar el formulario. Inténtalo de nuevo.</p>
            </Show>
          }
        >
          <p class="help mb-3">
            Las líneas que ya existen conservan su precio. Las nuevas usan el
            precio actual, o el que escribas.
          </p>
          <Field name="sessionIds" type="string[]">
            {(field, fieldProps) => (
              <MultiSelect
                {...fieldProps}
                value={field.value}
                error={field.error}
                required={sessionsRequired()}
                label="Sesiones"
                options={selectOptions(
                  sessions(),
                  props.reg.currencyCode,
                  true,
                )}
              />
            )}
          </Field>
          <Show when={meals().length > 0}>
            <Field name="mealIds" type="string[]">
              {(field, fieldProps) => (
                <MultiSelect
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Comidas"
                  options={selectOptions(
                    meals(),
                    props.reg.currencyCode,
                    false,
                  )}
                />
              )}
            </Field>
          </Show>
          <Field name="dietaryPreference">
            {(field, fieldProps) => (
              <Show when={(getValue(form, "mealIds") ?? []).length > 0}>
                <RadioGroup
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  required
                  label="Preferencia de comida"
                  options={dietaryOptions}
                />
              </Show>
            )}
          </Field>
          <For each={addedOptions()}>
            {(option) => (
              <Field name={`overrides.${option.id}`}>
                {(field, fieldProps) => (
                  <MoneyInput
                    {...fieldProps}
                    value={field.value}
                    error={field.error}
                    label={`Precio de ${option.name} (opcional)`}
                  />
                )}
              </Field>
            )}
          </For>
        </Show>
      </Modal>
    </Form>
  );
};
