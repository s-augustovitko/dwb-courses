import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect, Show } from "solid-js";
import * as v from "valibot";
import { Modal, ModalFooter, Switch } from "~/components/global";
import { formatCents, Method } from "~/utils";
import { useStaffAction } from "./staffAction";
import type { ActionProps } from "./types";

const cancelSchema = (receivedMoney: boolean) =>
  v.object({
    // Optional: the switch only renders when money was received.
    confirmReceivedMoney: v.pipe(
      v.optional(v.boolean(), false),
      v.check(
        (confirmed) => confirmed || !receivedMoney,
        "Confirma que se recibió dinero",
      ),
    ),
  });

type CancelSchema = v.InferInput<ReturnType<typeof cancelSchema>>;

export const CancelModal: Component<ActionProps> = (props) => {
  const send = useStaffAction(props);
  const hasMoney = () => props.reg.paidCents > 0;

  const [form, { Form, Field }] = createForm<CancelSchema>({
    validate: (values) =>
      valiForm<CancelSchema>(cancelSchema(hasMoney()))(values),
    validateOn: "change",
  });

  createEffect(() => {
    if (props.open) {
      reset(form, { initialValues: { confirmReceivedMoney: false } });
    }
  });

  async function submit(values: CancelSchema) {
    const parsed = v.parse(cancelSchema(hasMoney()), values);
    await send("/cancel", Method.POST, {
      confirmReceivedMoney: parsed.confirmReceivedMoney,
    });
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Cancelar inscripción"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Cancelar inscripción"
            danger
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <p>
          ¿Cancelar la inscripción de{" "}
          <strong>
            {props.reg.firstName} {props.reg.lastName}
          </strong>
          ? Su enlace público dejará de funcionar y podrá inscribirse de nuevo.
        </p>
        <Show when={hasMoney()}>
          <div class="notification is-warning mt-3">
            Esta inscripción recibió{" "}
            {formatCents(props.reg.currencyCode, props.reg.paidCents)}. Registra
            primero un reembolso si corresponde.
          </div>
          <Field name="confirmReceivedMoney" type="boolean">
            {(field, fieldProps) => (
              <Switch
                {...fieldProps}
                checked={field.value}
                error={field.error}
                label="Entiendo que se recibió dinero"
              />
            )}
          </Field>
        </Show>
      </Modal>
    </Form>
  );
};
