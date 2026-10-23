import { createForm, getValue, reset, valiForm } from "@modular-forms/solid";
import { type Component, createEffect, createResource } from "solid-js";
import * as v from "valibot";
import { Modal, ModalFooter, MoneyInput, Select } from "~/components/global";
import type { CartLine, Discount, StaffRegistration } from "~/models";
import { useNotifications } from "~/stores";
import {
  amountField,
  errorText,
  formatCents,
  loadedValue,
  MAX_CENTS,
  Method,
  moneyError,
  parseMoneyToCents,
  request,
} from "~/utils";
import { useStaffAction } from "./staffAction";
import type { ActionProps } from "./types";

const totalCents = (lines: CartLine[]) =>
  lines.reduce((total, line) => total + line.amountCents, 0);

/** What discounts may still take: the server refuses manual discounts that would eat the donation. */
const maxDiscountCents = (reg: StaffRegistration) =>
  Math.max(
    totalCents(reg.sessions) +
      totalCents(reg.meals) -
      totalCents(reg.discounts),
    0,
  );

const discountSchema = (
  roomCents: number,
  roomMessage: string,
  currencyCode: string,
  catalogCents: (discountId: string) => number | undefined,
) =>
  v.pipe(
    v.object({
      discountId: v.pipe(v.string(), v.nonEmpty("Selecciona un descuento")),
      amount: amountField({
        maxCents: MAX_CENTS,
        maxMessage: moneyError(MAX_CENTS),
        optional: true,
      }),
    }),

    v.forward(
      v.partialCheck(
        [["discountId"], ["amount"]],
        (input) =>
          input.amount.trim() !== "" ||
          catalogCents(input.discountId) !== undefined,
        `Este descuento no tiene precio en ${currencyCode}; escribe el monto`,
      ),
      ["amount"],
    ),

    v.forward(
      v.partialCheck(
        [["discountId"], ["amount"]],
        (input) =>
          (input.amount.trim()
            ? (parseMoneyToCents(input.amount) ?? 0)
            : (catalogCents(input.discountId) ?? 0)) <= roomCents,
        roomMessage,
      ),
      ["amount"],
    ),
  );

type DiscountSchema = v.InferInput<ReturnType<typeof discountSchema>>;

export const DiscountModal: Component<ActionProps> = (props) => {
  const notifications = useNotifications();
  const send = useStaffAction(props);

  const [discounts] = createResource(
    () => (props.open ? props.reg.formId : null),
    async (formId) => {
      try {
        const all = await request<Discount[]>(
          `form/${encodeURIComponent(formId)}/discount`,
          Method.GET,
        );
        return all.filter((item) => item.discountType === "OTHER");
      } catch (err) {
        notifications.error(errorText(err));
        return [];
      }
    },
  );

  const catalogPrice = (discountId: string | undefined) =>
    loadedValue(discounts)
      ?.find((item) => item.id === discountId)
      ?.prices.find((p) => p.currencyCode === props.reg.currencyCode);
  const schema = () => {
    const room = maxDiscountCents(props.reg);
    return discountSchema(
      room,
      `No puede superar lo que queda por descontar de sesiones y comidas (${formatCents(props.reg.currencyCode, room)})`,
      props.reg.currencyCode,
      (id) => catalogPrice(id)?.amountCents,
    );
  };

  const [form, { Form, Field }] = createForm<DiscountSchema>({
    validate: (values) => valiForm<DiscountSchema>(schema())(values),
    validateOn: "change",
  });

  createEffect(() => {
    if (props.open) {
      reset(form, { initialValues: { discountId: "", amount: "" } });
    }
  });

  const options = () => [
    { value: "", label: "Selecciona un descuento manual" },
    ...(loadedValue(discounts) ?? []).map((item) => ({
      value: item.id,
      label: item.name,
    })),
  ];

  const catalogHint = (discountId: string | undefined) => {
    if (!discountId) return "Déjalo vacío para usar el precio del catálogo";
    const price = catalogPrice(discountId);
    return price
      ? `Si lo dejas vacío se usa ${formatCents(props.reg.currencyCode, price.amountCents)}`
      : `Sin precio de catálogo en ${props.reg.currencyCode}`;
  };

  async function submit(values: DiscountSchema) {
    const parsed = v.parse(schema(), values);
    const cents = parsed.amount ? parseMoneyToCents(parsed.amount) : null;
    await send("/discounts", Method.POST, {
      discountId: parsed.discountId,
      ...(cents === null ? {} : { amountCents: cents }),
    });
  }

  return (
    <Form onSubmit={submit}>
      <Modal
        open={props.open}
        title="Agregar descuento"
        onClose={props.onClose}
        loading={form.submitting}
        footer={
          <ModalFooter
            submitLabel="Agregar"
            loading={form.submitting}
            onCancel={props.onClose}
          />
        }
      >
        <Field name="discountId">
          {(field, fieldProps) => (
            <Select
              {...fieldProps}
              value={field.value}
              error={field.error}
              required
              disabled={discounts.loading}
              label="Descuento"
              options={options()}
            />
          )}
        </Field>
        <Field name="amount">
          {(field, fieldProps) => (
            <MoneyInput
              {...fieldProps}
              value={field.value}
              error={field.error}
              label={`Monto (${props.reg.currencyCode}, opcional)`}
              hint={catalogHint(getValue(form, "discountId"))}
            />
          )}
        </Field>
      </Modal>
    </Form>
  );
};
