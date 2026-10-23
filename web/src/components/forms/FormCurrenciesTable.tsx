import { type Component, For, Show } from "solid-js";
import { IconTrash } from "~/components/icons";
import type { CurrencyRef } from "~/models";

type Props = {
  currencies: CurrencyRef[];
  canAdmin: boolean;
  onRemove: (currency: CurrencyRef) => void;
};

export const FormCurrenciesTable: Component<Props> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth is-hoverable">
      <thead>
        <tr>
          <th>Código</th>
          <th>Nombre</th>
          <Show when={props.canAdmin}>
            <th>Acciones</th>
          </Show>
        </tr>
      </thead>

      <tbody>
        <For
          each={props.currencies}
          fallback={
            <tr>
              <td colSpan={props.canAdmin ? 3 : 2}>
                Este formulario no tiene monedas configuradas
              </td>
            </tr>
          }
        >
          {(currency) => (
            <tr>
              <td>{currency.code}</td>
              <td>{currency.displayName}</td>
              <Show when={props.canAdmin}>
                <td>
                  <Show
                    when={props.currencies.length > 1}
                    fallback={
                      <span class="has-text-grey is-size-7">
                        Un formulario necesita al menos una moneda
                      </span>
                    }
                  >
                    <button
                      type="button"
                      aria-label={`Quitar ${currency.displayName}`}
                      onClick={() => props.onRemove(currency)}
                    >
                      <IconTrash
                        title="Quitar moneda"
                        class="is-size-5 has-text-danger"
                      />
                    </button>
                  </Show>
                </td>
              </Show>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);
