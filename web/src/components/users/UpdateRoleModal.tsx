import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import { Modal, ModalFooter, Select } from "~/components/global";
import { type Role, roleMap, roleOptions, type User } from "~/models";

type Props = {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSubmit: (values: UpdateUserRoleSchema) => void;
};

const updateUserRoleSchema = v.object({
  role: v.picklist(Object.keys(roleMap) as Role[], "Selecciona un rol válido"),
});

export type UpdateUserRoleSchema = v.InferOutput<typeof updateUserRoleSchema>;

export const UpdateRoleModal: Component<Props> = (props) => {
  const [form, { Form, Field }] = createForm<UpdateUserRoleSchema>({
    validate: valiForm(updateUserRoleSchema),
    validateOn: "change",
    initialValues: { role: "READER" },
  });

  createEffect(() => {
    if (props.open) {
      reset(form, { initialValues: { role: props.user?.role ?? "READER" } });
    }
  });

  return (
    <Form
      onSubmit={(values) =>
        props.onSubmit(v.parse(updateUserRoleSchema, values))
      }
    >
      <Modal
        open={props.open}
        title={`Editar rol de ${props.user?.name ?? ""}`}
        onClose={props.onClose}
        footer={<ModalFooter submitLabel="Guardar" onCancel={props.onClose} />}
      >
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
