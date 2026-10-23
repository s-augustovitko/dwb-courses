import { createForm, getValue, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import { Input, Modal, ModalFooter, Switch } from "~/components/global";
import type { IdType } from "~/models";
import { MIN_LETTER_DOCUMENT_LEN, requiredText } from "~/utils";

type Props = {
  open: boolean;
  idType: IdType | null;

  onClose: () => void;
  onSubmit: (values: CreateUpdateIdTypeSchema) => Promise<void> | void;
};

const createUpdateIdTypeSchema = v.pipe(
  v.object({
    label: requiredText(100),
    maxLen: v.pipe(
      v.number("Debe ser un número"),
      v.integer("Debe ser un número entero"),
      v.minValue(1, "Mínimo 1"),
      v.maxValue(32, "Máximo 32"),
    ),
    allowLetters: v.boolean(),
  }),
  v.forward(
    v.partialCheck(
      [["allowLetters"], ["maxLen"]],
      (input) => !input.allowLetters || input.maxLen >= MIN_LETTER_DOCUMENT_LEN,
      `Con letras, mínimo ${MIN_LETTER_DOCUMENT_LEN}`,
    ),
    ["maxLen"],
  ),
);

export type CreateUpdateIdTypeSchema = v.InferOutput<
  typeof createUpdateIdTypeSchema
>;

export const CreateUpdateIdTypeModal: Component<Props> = (props) => {
  const [form, { Form, Field }] = createForm<CreateUpdateIdTypeSchema>({
    validate: valiForm(createUpdateIdTypeSchema),
    validateOn: "change",
    initialValues: { label: "", maxLen: 20, allowLetters: false },
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          label: props.idType?.label ?? "",
          maxLen: props.idType?.maxLen ?? 20,
          allowLetters: props.idType?.allowLetters ?? false,
        },
      });
    }
  });

  return (
    <Form
      onSubmit={(values) =>
        props.onSubmit(v.parse(createUpdateIdTypeSchema, values))
      }
    >
      <Modal
        open={props.open}
        title={
          props.idType
            ? `Editar ${props.idType.label}`
            : "Agregar tipo de identificación"
        }
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel={props.idType ? "Guardar" : "Crear"}
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="label">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Nombre"
              hint="Ej. DNI, Pasaporte, RUC"
            />
          )}
        </Field>

        <Field name="maxLen" type="number">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value?.toString() ?? ""}
              error={field.error}
              required
              type="number"
              step="1"
              label={
                getValue(form, "allowLetters")
                  ? "Longitud máxima"
                  : "Longitud exacta"
              }
              hint={
                getValue(form, "allowLetters")
                  ? `Entre ${MIN_LETTER_DOCUMENT_LEN} y 32; el documento puede tener desde ${MIN_LETTER_DOCUMENT_LEN} caracteres hasta este máximo`
                  : "Entre 1 y 32 dígitos; el documento debe tener exactamente esa cantidad"
              }
            />
          )}
        </Field>

        <Field name="allowLetters" type="boolean">
          {(field, fieldProps) => (
            <Switch
              {...fieldProps}
              checked={field.value}
              error={field.error}
              label="Permite letras (no solo números)"
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
