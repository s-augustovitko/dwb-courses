import { type Component, For, Show } from "solid-js";
import type { DashboardEarning } from "~/models";
import { formatCents } from "~/utils";

type Props = {
  earnings: DashboardEarning[];
};

/** Full width for one currency, halves for two, thirds from three on. */
const columnClass = (count: number) => {
  if (count === 1) return "is-full";
  if (count === 2) return "is-half";
  return "is-one-third";
};

export const EarningsBoxes: Component<Props> = (props) => (
  <Show
    when={props.earnings.length > 0}
    fallback={<p class="box has-text-grey">Sin ingresos registrados</p>}
  >
    <div class="columns is-multiline">
      <For each={props.earnings}>
        {(earning) => (
          <div class={`column ${columnClass(props.earnings.length)}`}>
            <div class="box">
              <nav class="level">
                <div class="level-item has-text-centered">
                  <div>
                    <p class="is-size-7 is-uppercase has-text-grey">
                      Ingresos totales
                    </p>
                    <p class="title">
                      {formatCents(earning.currencyCode, earning.totalCents)}
                    </p>
                  </div>
                </div>
                <div class="level-item has-text-centered">
                  <div>
                    <p class="is-size-7 is-uppercase has-text-grey">
                      Ingresos actuales
                    </p>
                    <p class="title has-text-success">
                      {formatCents(earning.currencyCode, earning.paidCents)}
                    </p>
                  </div>
                </div>
              </nav>
            </div>
          </div>
        )}
      </For>
    </div>
  </Show>
);
