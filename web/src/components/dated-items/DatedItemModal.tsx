import { createForm, reset, valiForm } from "@modular-forms/solid";
import dayjs from "dayjs";
import { type Component, createEffect, For } from "solid-js";
import * as v from "valibot";
import {
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
} from "~/components/global";
import type { CurrencyRef } from "~/models";
import {
  getPricesOrDefault,
  optionalText,
  pricesField,
  requiredDate,
  requiredText,
} from "~/utils";
import type { DatedItem, DatedItemConfig } from "./config";

const datedItemSchema = v.object({
  name: requiredText(100),
  hintText: optionalText(64),
  date: requiredDate(),
  prices: pricesField(),
});

export type DatedItemSchema = v.InferOutput<typeof datedItemSchema>;

type Props = {
  config: DatedItemConfig;
  open: boolean;
  item: DatedItem | null;
  currencies: CurrencyRef[];

  onClose: () => void;
  onSubmit: (values: DatedItemSchema) => Promise<void> | void;
};

export const DatedItemModal: Component<Props> = (props) => {
  const [form, { Form, Field }] = createForm<DatedItemSchema>({
    validate: valiForm(datedItemSchema),
    validateOn: "change",
    initialValues: { name: "", hintText: "", date: "", prices: {} },
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          name: props.item?.name ?? "",
          hintText: props.item?.hintText ?? "",
          date: props.item?.date ?? "",
          prices: getPricesOrDefault(props.currencies, props.item),
        },
      });
    }
  });

  return (
    <Form
      onSubmit={(values) => props.onSubmit(v.parse(datedItemSchema, values))}
    >
      <Modal
        open={props.open}
        title={
          props.item
            ? `Editar ${props.item.name}`
            : `Agregar ${props.config.singular}`
        }
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel={props.item ? "Guardar" : "Crear"}
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="name">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Nombre"
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

        <Field name="date">
          {(field, fieldProps) => (
            <DatePicker
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Fecha"
              minDate={dayjs().subtract(1, "year")}
              maxDate={dayjs().add(1, "year")}
              required
              withTime={props.config.withTime}
            />
          )}
        </Field>

        <h2 class="subtitle">Precios</h2>

        <For each={props.currencies}>
          {(currency) => (
            <Field name={`prices.${currency.code}`}>
              {(field, fieldProps) => (
                <MoneyInput
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  required
                  label={`Precio (${currency.displayName})`}
                />
              )}
            </Field>
          )}
        </For>
      </Modal>
    </Form>
  );
};
