import {
  Field,
  type FormStore,
  getValue,
  getValues,
  setValue,
} from "@modular-forms/solid";
import dayjs from "dayjs";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import {
  MoneyInput,
  RadioGroup,
  Select,
  SwitchGroup,
} from "~/components/global";
import {
  dietaryOptions,
  type PublicCurrency,
  type PublicForm,
  type PublicOption,
} from "~/models";
import { formatDateTime, toggleValue } from "~/utils";
import { OrderTable } from "./OrderTable";
import {
  discountHint,
  estimateOrder,
  isPriced,
  toSwitchOption,
} from "./pricing";
import type { SelectionValues } from "./validation";

type Props = {
  of: FormStore<SelectionValues>;
  form: PublicForm;
  currencies: PublicCurrency[];
};

type Mode = "NONE" | "ALL" | "DAY" | "EACH";

const dayKey = (option: PublicOption) =>
  dayjs(option.date).format("YYYY-MM-DD");

const OptionList: Component<{
  name: string;
  label: string;
  modes: { value: Mode; label: string }[];
  withTime: boolean;
  options: PublicOption[];
  chosen: string[];
  currencyCode: string;
  error?: string;
  defaultMode?: Mode;
  onChange: (ids: string[]) => void;
}> = (props) => {
  const [mode, setMode] = createSignal(
    props.defaultMode && props.chosen.length === 0
      ? props.defaultMode
      : props.modes[0].value,
  );
  const [days, setDays] = createSignal<string[]>([]);

  const switches = createMemo(() =>
    props.options.map((option) =>
      toSwitchOption(option, props.currencyCode, props.withTime),
    ),
  );

  const priced = createMemo(() =>
    props.options.filter((option) => isPriced(option, props.currencyCode)),
  );

  const dayOptions = createMemo(() =>
    [...new Set(priced().map(dayKey))].map((key) => {
      const sessions = priced().filter((option) => dayKey(option) === key);
      return {
        value: key,
        label: formatDateTime(sessions[0].date, "LL"),
        subtitle: `${sessions.length} ${sessions.length === 1 ? "sesión" : "sesiones"}`,
      };
    }),
  );

  const target = () => {
    switch (mode()) {
      case "NONE":
        return [];
      case "ALL":
        return priced().map((option) => option.id);
      case "DAY":
        return priced()
          .filter((option) => days().includes(dayKey(option)))
          .map((option) => option.id);
      case "EACH":
        return undefined;
    }
  };

  createEffect(() => {
    const ids = target();
    const unchanged =
      ids?.length === props.chosen.length &&
      ids.every((id) => props.chosen.includes(id));
    if (ids && !unchanged) props.onChange(ids);
  });

  return (
    <>
      <Select
        name={`${props.name}Mode`}
        label={props.label}
        options={props.modes}
        value={mode()}
        error={mode() === "NONE" || mode() === "ALL" ? props.error : undefined}
        onChange={(e) => setMode(e.currentTarget.value as Mode)}
      />

      <Show when={mode() === "DAY"}>
        <SwitchGroup
          name={`${props.name}Days`}
          label="Días"
          error={props.error}
          value={days()}
          options={dayOptions()}
          onChange={(e) => setDays(toggleValue(days(), e.currentTarget))}
        />
      </Show>

      <Show when={mode() === "EACH"}>
        <SwitchGroup
          name={props.name}
          error={props.error}
          value={props.chosen}
          options={switches()}
          onChange={(e) =>
            props.onChange(toggleValue(props.chosen, e.currentTarget))
          }
        />
      </Show>
    </>
  );
};

export const SelectionFields: Component<Props> = (props) => {
  // Read before the fields mount, e.g. by the subtotal on the first render.
  const evenUnmounted = { shouldActive: false };
  const currencyCode = () =>
    getValue(props.of, "currencyCode", evenUnmounted) ?? "";
  const sessionIds = () =>
    getValue(props.of, "sessionIds", evenUnmounted) ?? [];
  const mealIds = () => getValue(props.of, "mealIds", evenUnmounted) ?? [];

  const mealsChosen = () =>
    props.form.disableMealSelection
      ? props.form.meals.length > 0
      : mealIds().length > 0;

  const estimate = createMemo(() =>
    estimateOrder(props.form, {
      currencyCode: currencyCode(),
      sessionIds: sessionIds(),
      mealIds: mealIds(),
      donationText: getValue(props.of, "donationText", evenUnmounted) ?? "",
      overrides: getValues(props.of, evenUnmounted).overrides,
    }),
  );

  const order = () => estimate().order;

  return (
    <>
      <Field of={props.of} name="currencyCode">
        {(field, fieldProps) => (
          <Show
            when={props.currencies.length > 1}
            fallback={
              <p class="mb-4">
                Moneda: <strong>{props.currencies[0]?.displayName}</strong>
              </p>
            }
          >
            <Select
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Moneda"
              options={props.currencies.map((currency) => ({
                value: currency.code,
                label: currency.displayName,
              }))}
              onChange={(event) => {
                fieldProps.onChange(event);
                setValue(props.of, "sessionIds", []);
                setValue(props.of, "mealIds", []);
              }}
            />
          </Show>
        )}
      </Field>

      <Show when={!props.form.disableSessionSelection}>
        <Field of={props.of} name="sessionIds" type="string[]">
          {(field) => (
            <OptionList
              name="sessionIds"
              label="Sesiones"
              modes={[
                { value: "EACH", label: "Por sesión" },
                { value: "ALL", label: "Todas las sesiones" },
                { value: "DAY", label: "Por días" },
              ]}
              withTime
              options={props.form.sessions}
              chosen={field.value ?? []}
              currencyCode={currencyCode()}
              error={field.error}
              defaultMode="ALL"
              onChange={(ids) => setValue(props.of, "sessionIds", ids)}
            />
          )}
        </Field>
      </Show>

      <Show
        when={!props.form.disableMealSelection && props.form.meals.length > 0}
      >
        <Field of={props.of} name="mealIds" type="string[]">
          {(field) => (
            <OptionList
              name="mealIds"
              label="Comidas"
              modes={[
                { value: "NONE", label: "Sin comidas" },
                { value: "ALL", label: "Todas las comidas" },
                { value: "EACH", label: "Por comida" },
              ]}
              withTime={false}
              options={props.form.meals}
              chosen={field.value ?? []}
              currencyCode={currencyCode()}
              error={field.error}
              onChange={(ids) => setValue(props.of, "mealIds", ids)}
            />
          )}
        </Field>
      </Show>

      <Show when={mealsChosen()}>
        <Field of={props.of} name="dietaryPreference">
          {(field, fieldProps) => (
            <RadioGroup
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Preferencia de comida"
              options={dietaryOptions}
            />
          )}
        </Field>
      </Show>

      <Show when={!props.form.disableDonation}>
        <Field of={props.of} name="donationText">
          {(field, fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Donación (opcional)"
            />
          )}
        </Field>
      </Show>

      <h3 class="title is-4 mt-5 mb-2">Resumen</h3>

      <OrderTable order={order()} totalLabel="Total estimado" summary />

      <div class="notification is-light">
        <For each={estimate().missed}>
          {(missed) => (
            <p class="help is-warning">
              {discountHint(missed, currencyCode())}
            </p>
          )}
        </For>
        <p class="help is-info">El total final se confirma al continuar.</p>
      </div>
    </>
  );
};
