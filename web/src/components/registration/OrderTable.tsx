import { type Component, For, Show } from "solid-js";
import { IconTrash } from "~/components/icons";
import type { Cart, CartLine } from "~/models";
import { formatCents } from "~/utils";
import { sumCents } from "./pricing";

/** A discount is a saving for the person (green), a refund is money given back (red). */
export type Minus = "discount" | "refund";

export const Amount: Component<{
  cents: number;
  currency: string;
  minus?: Minus;
}> = (props) => (
  <td
    class="has-text-right"
    classList={{
      "has-text-success": props.minus === "discount",
      "has-text-danger": props.minus === "refund",
    }}
  >
    {props.minus ? "- " : ""}
    {formatCents(props.currency, props.cents)}
  </td>
);

const LineRows: Component<{
  title: string;
  lines: CartLine[];
  currency: string;
  minus?: Minus;
  onRemove?: (line: CartLine) => void;
}> = (props) => (
  <Show when={props.lines.length > 0}>
    <tr>
      <th colSpan={3} class="has-background-light is-size-7">
        {props.title}
      </th>
    </tr>

    <For each={props.lines}>
      {(line) => (
        <tr>
          <td class="wrap-anywhere">{line.name}</td>
          <Amount
            cents={line.amountCents}
            currency={props.currency}
            minus={props.minus}
          />
          <td class="has-text-right">
            <Show when={props.onRemove && line.manual}>
              <button
                type="button"
                aria-label={`Quitar ${line.name}`}
                onClick={() => props.onRemove?.(line)}
              >
                <IconTrash title="Quitar" class="has-text-danger" />
              </button>
            </Show>
          </td>
        </tr>
      )}
    </For>
  </Show>
);

export type OrderLines = Pick<
  Cart,
  | "currencyCode"
  | "sessions"
  | "meals"
  | "discounts"
  | "donationCents"
  | "totalCents"
>;

const SubtotalRow: Component<{ order: OrderLines }> = (props) => (
  <tr>
    <td>Subtotal</td>
    <Amount
      cents={props.order.totalCents + sumCents(props.order.discounts)}
      currency={props.order.currencyCode}
    />
    <td />
  </tr>
);

export const OrderTable: Component<{
  order: OrderLines;
  totalLabel?: string;
  /** Collapses sessions, meals and the donation into a single subtotal row. */
  summary?: boolean;
  /** Adds paid and pending rows when something was paid. */
  paidCents?: number;
  onRemoveDiscount?: (line: CartLine) => void;
}> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth">
      <tbody>
        <Show
          when={!props.summary}
          fallback={<SubtotalRow order={props.order} />}
        >
          <LineRows
            title="Sesiones"
            lines={props.order.sessions}
            currency={props.order.currencyCode}
          />
          <LineRows
            title="Comidas"
            lines={props.order.meals}
            currency={props.order.currencyCode}
          />
          <Show when={props.order.donationCents > 0}>
            <tr>
              <th colSpan={3} class="has-background-light is-size-7">
                Donación
              </th>
            </tr>
            <tr>
              <td>Donación</td>
              <Amount
                cents={props.order.donationCents}
                currency={props.order.currencyCode}
              />
              <td />
            </tr>
          </Show>
        </Show>
        <LineRows
          title="Descuentos"
          lines={props.order.discounts}
          currency={props.order.currencyCode}
          minus="discount"
          onRemove={props.onRemoveDiscount}
        />
      </tbody>
      <tfoot>
        <tr>
          <th>{props.totalLabel ?? "Total"}</th>
          <th class="has-text-right">
            {formatCents(props.order.currencyCode, props.order.totalCents)}
          </th>
          <th />
        </tr>
        <Show when={props.paidCents}>
          {(paid) => (
            <>
              <tr>
                <td>Pagado</td>
                <Amount cents={paid()} currency={props.order.currencyCode} />
                <td />
              </tr>
              <tr>
                <th>Saldo pendiente</th>
                <th class="has-text-right">
                  {formatCents(
                    props.order.currencyCode,
                    props.order.totalCents - paid(),
                  )}
                </th>
                <th />
              </tr>
            </>
          )}
        </Show>
      </tfoot>
    </table>
  </div>
);
