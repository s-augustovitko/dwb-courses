import { createForm, getValue, reset, valiForm } from "@modular-forms/solid";
import dayjs from "dayjs";
import { type Component, createEffect, For, Show } from "solid-js";
import * as v from "valibot";
import {
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  Select,
} from "~/components/global";
import {
  type CurrencyRef,
  type Discount,
  type DiscountType,
  discountTypeMap,
  discountTypeOptions,
} from "~/models";
import {
  DATE_RANGE_MESSAGE,
  getPricesOrDefault,
  isInDateRange,
  isValidDate,
  optionalText,
  parseMoneyToCents,
  pricesField,
  REQUIRED,
  requiredText,
} from "~/utils";

type Props = {
  open: boolean;
  discount: Discount | null;
  currencies: CurrencyRef[];

  onClose: () => void;
  onSubmit: (values: CreateUpdateDiscountSchema) => Promise<void> | void;
};

type CutoffInput = { discountType: DiscountType; cutoffDate: string };

const whenEarlyBird =
  (isValid: (cutoff: string) => boolean) => (input: CutoffInput) =>
    input.discountType !== "EARLY_BIRD" || isValid(input.cutoffDate);

function discountSchema(savedCutoff: () => string) {
  return v.pipe(
    // MEALS_INCLUDED hides the price inputs and the server uses the selected
    // meals' total, so its prices become 0 here (the typed ones stay in the form).
    v.looseObject({ discountType: v.string() }),

    v.transform((input) =>
      input.discountType === "MEALS_INCLUDED"
        ? { ...input, prices: {} }
        : input,
    ),

    v.object({
      discountType: v.picklist(
        Object.keys(discountTypeMap) as DiscountType[],
        "Selecciona un tipo",
      ),
      name: requiredText(100),
      hintText: optionalText(64),
      cutoffDate: v.string(),
      prices: pricesField(),
    }),

    // MEALS_INCLUDED may be 0; the rest need ≥ 0.01.
    v.rawCheck(({ dataset, addIssue }) => {
      const input = dataset.value as Partial<CutoffInput> & {
        prices?: Record<string, unknown>;
      };

      if (input.discountType === "MEALS_INCLUDED" || !input.prices) return;

      for (const [code, amount] of Object.entries(input.prices)) {
        const cents =
          typeof amount === "string" ? parseMoneyToCents(amount) : null;
        if (cents === null || cents >= 1) continue;

        addIssue({
          message: "El descuento debe ser mayor a 0",
          path: [
            {
              type: "object",
              origin: "value",
              input,
              key: "prices",
              value: input.prices,
            },
            {
              type: "object",
              origin: "value",
              input: input.prices,
              key: code,
              value: amount,
            },
          ],
        });
      }
    }),

    v.forward(
      v.partialCheck(
        [["discountType"], ["cutoffDate"]],
        whenEarlyBird(Boolean),
        REQUIRED,
      ),
      ["cutoffDate"],
    ),

    v.forward(
      v.partialCheck(
        [["discountType"], ["cutoffDate"]],
        whenEarlyBird(
          (cutoff) => !cutoff || (isValidDate(cutoff) && isInDateRange(cutoff)),
        ),
        DATE_RANGE_MESSAGE,
      ),
      ["cutoffDate"],
    ),

    v.forward(
      v.partialCheck(
        [["discountType"], ["cutoffDate"]],
        whenEarlyBird(
          (cutoff) =>
            !cutoff ||
            cutoff === savedCutoff() ||
            dayjs(cutoff).isAfter(dayjs()),
        ),
        "La fecha límite debe ser en el futuro",
      ),
      ["cutoffDate"],
    ),
  );
}

export type CreateUpdateDiscountSchema = v.InferOutput<
  ReturnType<typeof discountSchema>
>;

export const CreateUpdateDiscountModal: Component<Props> = (props) => {
  const schema = discountSchema(() => props.discount?.cutoffDate ?? "");

  const [form, { Form, Field }] = createForm<CreateUpdateDiscountSchema>({
    validate: valiForm(schema),
    validateOn: "change",
    initialValues: {
      discountType: "ALL_SESSIONS",
      name: "",
      hintText: "",
      cutoffDate: "",
      prices: {},
    },
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          discountType: props.discount?.discountType ?? "ALL_SESSIONS",
          name: props.discount?.name ?? "",
          hintText: props.discount?.hintText ?? "",
          cutoffDate: props.discount?.cutoffDate ?? "",
          prices: getPricesOrDefault(props.currencies, props.discount),
        },
      });
    }
  });

  return (
    <Form onSubmit={(values) => props.onSubmit(v.parse(schema, values))}>
      <Modal
        open={props.open}
        title={
          props.discount ? `Editar ${props.discount.name}` : "Agregar descuento"
        }
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel={props.discount ? "Guardar" : "Crear"}
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="discountType">
          {(field, fieldProps) => (
            <Select
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Tipo de descuento"
              options={discountTypeOptions}
              required
            />
          )}
        </Field>

        <Field name="name">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Nombre"
              required
            />
          )}
        </Field>

        <Field name="hintText">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Texto de ayuda"
            />
          )}
        </Field>

        <Field name="cutoffDate">
          {(field, fieldProps) => (
            <Show when={getValue(form, "discountType") === "EARLY_BIRD"}>
              <DatePicker
                {...fieldProps}
                value={field.value}
                error={field.error}
                label="Fecha límite"
                minDate={dayjs()}
                maxDate={dayjs().add(1, "year")}
                required
                withTime
              />
            </Show>
          )}
        </Field>

        <Show when={getValue(form, "discountType") !== "MEALS_INCLUDED"}>
          <h2 class="subtitle">Precios</h2>
        </Show>

        <For each={props.currencies}>
          {(currency) => (
            <Field name={`prices.${currency.code}`}>
              {(field, fieldProps) => (
                <Show
                  when={getValue(form, "discountType") !== "MEALS_INCLUDED"}
                >
                  <MoneyInput
                    {...fieldProps}
                    value={field.value}
                    error={field.error}
                    label={`Precio (${currency.displayName})`}
                    required
                  />
                </Show>
              )}
            </Field>
          )}
        </For>
      </Modal>
    </Form>
  );
};
