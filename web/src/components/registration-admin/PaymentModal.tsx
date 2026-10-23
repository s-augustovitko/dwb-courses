import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import {
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  Select,
  TextArea,
} from "~/components/global";
import { manualPaymentMethods, paymentMethodLabels } from "~/models";
import {
  amountField,
  centsToDecimal,
  formatCents,
  Method,
  multilineText,
  optionalText,
  parseMoneyToCents,
} from "~/utils";
import { useStaffAction } from "./staffAction";
import type { ActionProps } from "./types";

const METHOD_OPTIONS = manualPaymentMethods.map((value) => ({
  value,
  label: paymentMethodLabels[value],
}));

const paymentSchema = (balanceCents: number, currencyCode: string) =>
  v.object({
    method: v.picklist(manualPaymentMethods, "Selecciona un método"),
    amount: amountField({
      maxCents: balanceCents,
      maxMessage: `No puede superar el saldo (${formatCents(currencyCode, balanceCents)})`,
    }),
    providerReference: optionalText(100),
    note: multilineText(500),
  });

type PaymentSchema = v.InferInput<ReturnType<typeof paymentSchema>>;

export const PaymentModal: Component<ActionProps> = (props) => {
  const send = useStaffAction(props);
  const schema = () =>
    paymentSchema(props.reg.balanceCents, props.reg.currencyCode);

  const [form, { Form, Field }] = createForm<PaymentSchema>({
    validate: (values) => valiForm<PaymentSchema>(schema())(values),
    validateOn: "change",
  });

  createEffect(() => {
    if (props.open) {
      const initialValues: PaymentSchema = {
        method: "CASH",
        amount: centsToDecimal(props.reg.balanceCents),
        providerReference: "",
        note: "",
      };
      reset(form, { initialValues });
    }
  });

  async function submit(values: PaymentSchema) {
    const parsed = v.parse(schema(), values);
    await send("/payments", Method.POST, {
      method: parsed.method,
      amountCents: parseMoneyToCents(parsed.amount),
      note: parsed.note || null,
      providerReference: parsed.providerReference || null,
    });
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Registrar pago"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Registrar"
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="method">
          {(field, fieldProps) => (
            <Select
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Método"
              options={METHOD_OPTIONS}
            />
          )}
        </Field>
        <Field name="amount">
          {(field, fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label={`Monto (${props.reg.currencyCode})`}
            />
          )}
        </Field>
        <Field name="providerReference">
          {(field, fieldProps) => (
            <Input
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Referencia (opcional)"
            />
          )}
        </Field>
        <Field name="note">
          {(field, fieldProps) => (
            <TextArea
              {...fieldProps}
              value={field.value}
              error={field.error}
              label="Nota (opcional)"
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
