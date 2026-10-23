import { createForm, reset, setValue, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import { Input, Modal, ModalFooter } from "~/components/global";
import type { Currency } from "~/models";
import { REQUIRED, requiredText } from "~/utils";

type Props = {
  open: boolean;
  currency: Currency | null;

  onClose: () => void;
  onSubmit: (values: CreateUpdateCurrencySchema) => Promise<void> | void;
};

const createUpdateCurrencySchema = v.object({
  code: v.pipe(
    v.string(),
    v.nonEmpty(REQUIRED),
    v.regex(/^[A-Z]{3}$/, "Debe ser un código de 3 letras mayúsculas, ej. USD"),
  ),
  displayName: requiredText(100),
});

export type CreateUpdateCurrencySchema = v.InferOutput<
  typeof createUpdateCurrencySchema
>;

export const CreateUpdateCurrencyModal: Component<Props> = (props) => {
  const isUpdate = () => Boolean(props.currency);

  const [form, { Form, Field }] = createForm<CreateUpdateCurrencySchema>({
    validate: valiForm(createUpdateCurrencySchema),
    validateOn: "change",
    initialValues: { code: "", displayName: "" },
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          code: props.currency?.code ?? "",
          displayName: props.currency?.displayName ?? "",
        },
      });
    }
  });

  return (
    <Form
      onSubmit={(values) =>
        props.onSubmit(v.parse(createUpdateCurrencySchema, values))
      }
    >
      <Modal
        open={props.open}
        title={
          isUpdate()
            ? `Editar ${props.currency?.displayName}`
            : "Agregar moneda"
        }
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel={isUpdate() ? "Guardar" : "Crear"}
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="code">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              onInput={(e) =>
                setValue(form, "code", e.currentTarget.value.toUpperCase())
              }
              value={field.value}
              error={field.error}
              required
              label="Código"
              hint="Código ISO 4217 de 3 letras, ej. USD"
              disabled={isUpdate()}
            />
          )}
        </Field>

        <Field name="displayName">
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
      </Modal>
    </Form>
  );
};
