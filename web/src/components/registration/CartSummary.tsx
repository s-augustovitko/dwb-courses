import { type Component, Show } from "solid-js";
import { type Cart, dietaryLabels } from "~/models";
import { OrderTable } from "./OrderTable";

export const CartSummary: Component<{ cart: Cart }> = (props) => {
  const dietary = () =>
    props.cart.meals.length > 0 && props.cart.dietaryPreference
      ? dietaryLabels[props.cart.dietaryPreference]
      : "";

  return (
    <div class="box">
      <p class="title is-5 mb-1 wrap-anywhere">{props.cart.firstName}</p>

      <p class="has-text-grey mb-4 wrap-anywhere">
        {props.cart.maskedEmail} | {props.cart.maskedDocument}
      </p>

      <OrderTable order={props.cart} paidCents={props.cart.paidCents} />

      <Show when={dietary()}>
        <p>
          Preferencia de comida: <strong>{dietary()}</strong>
        </p>
      </Show>
    </div>
  );
};
