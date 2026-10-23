import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import {
  Modal,
  ModalFooter,
  Select,
  type SelectOption,
} from "~/components/global";

type Props = {
  open: boolean;
  currencyOptions: SelectOption[];

  onClose: () => void;
  onSubmit: (values: AddCurrencySchema) => void;
};

const addCurrencySchema = v.object({
  code: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/, "Selecciona una moneda")),
});

export type AddCurrencySchema = v.InferOutput<typeof addCurrencySchema>;

export const AddCurrencyModal: Component<Props> = (props) => {
  const [form, { Form, Field }] = createForm<AddCurrencySchema>({
    validate: valiForm(addCurrencySchema),
    validateOn: "change",
    initialValues: { code: "" },
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: { code: props.currencyOptions[0]?.value ?? "" },
      });
    }
  });

  return (
    <Form
      onSubmit={(values) => props.onSubmit(v.parse(addCurrencySchema, values))}
    >
      <Modal
        open={props.open}
        title="Agregar moneda"
        onClose={props.onClose}
        footer={<ModalFooter submitLabel="Agregar" onCancel={props.onClose} />}
      >
        <Field name="code">
          {(field, fieldProps) => (
            <Select
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Moneda"
              options={props.currencyOptions}
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
