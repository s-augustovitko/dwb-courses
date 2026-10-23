import { type Component, Show } from "solid-js";
import { Modal } from "~/components/global";
import { paymentMethodLabels, type StaffPayment } from "~/models";
import { formatDateTime } from "~/utils";

type Props = {
  /** The payment to show; the modal is closed while null. */
  payment: StaffPayment | null;
  onClose: () => void;
};

export const PaymentDetailsModal: Component<Props> = (props) => (
  <Modal
    open={props.payment !== null}
    title="Detalles del pago"
    onClose={props.onClose}
    footer={
      <button type="button" class="button" onClick={props.onClose}>
        Cerrar
      </button>
    }
  >
    <Show when={props.payment}>
      {(payment) => (
        <table class="table is-fullwidth">
          <tbody>
            <tr>
              <th class="has-text-weight-semibold">Fecha</th>
              <td>{formatDateTime(payment().createdAt)}</td>
            </tr>
            <tr>
              <th class="has-text-weight-semibold">Método</th>
              <td>{paymentMethodLabels[payment().method]}</td>
            </tr>
            <Show when={payment().providerReference}>
              <tr>
                <th class="has-text-weight-semibold">Referencia</th>
                <td class="wrap-anywhere">{payment().providerReference}</td>
              </tr>
            </Show>
            <Show when={payment().note}>
              <tr>
                <th class="has-text-weight-semibold">Nota</th>
                <td class="wrap-anywhere">{payment().note}</td>
              </tr>
            </Show>
          </tbody>
        </table>
      )}
    </Show>
  </Modal>
);
