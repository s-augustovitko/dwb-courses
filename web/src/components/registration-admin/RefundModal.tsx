import { createForm, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect } from "solid-js";
import * as v from "valibot";
import { Modal, ModalFooter, MoneyInput, TextArea } from "~/components/global";
import {
  amountField,
  centsToDecimal,
  formatCents,
  Method,
  multilineText,
  parseMoneyToCents,
  REQUIRED,
} from "~/utils";
import { useStaffAction } from "./staffAction";
import type { ActionProps } from "./types";

const MIN_NOTE_LEN = 3;
const MAX_NOTE_LEN = 500;

const refundSchema = (paidCents: number, currencyCode: string) =>
  v.object({
    amount: amountField({
      maxCents: paidCents,
      maxMessage: `No puede superar lo recibido (${formatCents(currencyCode, paidCents)})`,
    }),

    // The server counts characters (runes), not UTF-16 units.
    note: v.pipe(
      multilineText(MAX_NOTE_LEN),
      v.nonEmpty(REQUIRED),
      v.check(
        (text) => [...text].length >= MIN_NOTE_LEN,
        `El motivo debe tener al menos ${MIN_NOTE_LEN} caracteres`,
      ),
    ),
  });

type RefundSchema = v.InferInput<ReturnType<typeof refundSchema>>;

export const RefundModal: Component<ActionProps> = (props) => {
  const send = useStaffAction(props);
  const schema = () =>
    refundSchema(props.reg.paidCents, props.reg.currencyCode);

  const [form, { Form, Field }] = createForm<RefundSchema>({
    validate: (values) => valiForm<RefundSchema>(schema())(values),
    validateOn: "change",
  });

  createEffect(() => {
    if (props.open) {
      reset(form, {
        initialValues: {
          amount: centsToDecimal(props.reg.paidCents),
          note: "",
        },
      });
    }
  });

  async function submit(values: RefundSchema) {
    const parsed = v.parse(schema(), values);
    await send("/refunds", Method.POST, {
      amountCents: parseMoneyToCents(parsed.amount),
      note: parsed.note,
    });
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Registrar reembolso"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Registrar reembolso"
            danger
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <p class="mb-3">
          Esto solo deja constancia; no devuelve dinero por ningún medio de
          pago.
        </p>
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
        <Field name="note">
          {(field, fieldProps) => (
            <TextArea
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              label="Motivo"
              hint={`Al menos ${MIN_NOTE_LEN} caracteres`}
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
