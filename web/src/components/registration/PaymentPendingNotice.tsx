import { type Component, Show } from "solid-js";
import type { Cart } from "~/models";

export const PaymentPendingNotice: Component<{ cart: Cart }> = (props) => (
  <Show when={props.cart.paymentPending}>
    <p class="notification is-info is-light">
      Estamos confirmando tu pago. Te enviaremos un correo.
    </p>
  </Show>
);
