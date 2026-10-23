import { type Component, For, Show } from "solid-js";
import { IconInfo } from "~/components/icons";
import { Amount } from "~/components/registration";
import { paymentMethodLabels, type StaffPayment } from "~/models";
import { formatDateTime } from "~/utils";

/** Payments and refunds recorded for a registration, oldest first. */
export const PaymentsTable: Component<{
  payments: StaffPayment[];
  currency: string;
  onViewDetails: (payment: StaffPayment) => void;
}> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Método</th>
          <th class="has-text-right">Monto</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <For
          each={props.payments}
          fallback={
            <tr>
              <td colSpan={4}>Aún no hay pagos</td>
            </tr>
          }
        >
          {(payment) => (
            <tr>
              <td>{formatDateTime(payment.createdAt)}</td>
              <td>{paymentMethodLabels[payment.method]}</td>
              <Amount
                cents={payment.amountCents}
                currency={props.currency}
                minus={payment.method === "REFUND" ? "refund" : undefined}
              />
              <td class="has-text-right">
                <Show when={payment.providerReference || payment.note}>
                  <button
                    type="button"
                    aria-label="Ver detalles del pago"
                    onClick={() => props.onViewDetails(payment)}
                  >
                    <IconInfo title="Ver detalles" class="has-text-info" />
                  </button>
                </Show>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);
