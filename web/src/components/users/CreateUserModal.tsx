import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import { Input, Modal, ModalFooter, Select } from "~/components/global";
import { type Role, roleMap, roleOptions } from "~/models";
import { emailField, requiredText } from "~/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserSchema) => Promise<void> | void;
};

const createUserSchema = v.object({
  name: requiredText(100),
  email: emailField(),
  role: v.picklist(Object.keys(roleMap) as Role[], "Selecciona un rol válido"),
});

export type CreateUserSchema = v.InferOutput<typeof createUserSchema>;

export const CreateUserModal: Component<Props> = (props) => {
  const [form, { Form, Field }] = createForm<CreateUserSchema>({
    validate: valiForm(createUserSchema),
    validateOn: "change",
    initialValues: { name: "", email: "", role: "READER" },
  });

  createEffect(() => {
    if (props.open) {
      reset(form);
    }
  });

  return (
    <Form
      onSubmit={(values) => props.onSubmit(v.parse(createUserSchema, values))}
    >
      <Modal
        open={props.open}
        title="Crear usuario"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Crear"
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
              label="Nombre completo"
            />
          )}
        </Field>

        <Field name="email">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Correo"
              type="email"
              inputmode="email"
            />
          )}
        </Field>

        <Field name="role">
          {(field, fieldProps) => (
            <Select
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Rol"
              options={roleOptions}
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
