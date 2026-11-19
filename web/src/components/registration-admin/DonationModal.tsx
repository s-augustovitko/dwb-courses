import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import { Modal, ModalFooter, MoneyInput } from "~/components/global";
import {
  centsToDecimal,
  MAX_DONATION_CENTS,
  Method,
  optionalMoneyField,
  parseMoneyToCents,
} from "~/utils";
import { useStaffAction } from "./staffAction";
import type { ActionProps } from "./types";

const donationSchema = v.object({
  amount: optionalMoneyField(MAX_DONATION_CENTS),
});

type DonationSchema = v.InferInput<typeof donationSchema>;

export const DonationModal: Component<ActionProps> = (props) => {
  const send = useStaffAction(props);

  const [form, { Form, Field }] = createForm<DonationSchema>({
    validate: valiForm(donationSchema),
    validateOn: "change",
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          amount:
            props.reg.donationCents > 0
              ? centsToDecimal(props.reg.donationCents)
              : "",
        },
      });
    }
  });

  async function submit(values: DonationSchema) {
    const parsed = v.parse(donationSchema, values);
    const cents = parsed.amount ? (parseMoneyToCents(parsed.amount) ?? 0) : 0;

    await send("/donation", Method.PUT, { donationCents: cents });
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Editar donación"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Guardar"
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="amount">
          {(field, fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={field.value}
              error={field.error}
              label={`Monto (${props.reg.currencyCode})`}
              hint={
                props.reg.disableDonation
                  ? "Este formulario no acepta donaciones; déjalo vacío para quitarla"
                  : "Déjalo vacío para quitar la donación"
              }
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
