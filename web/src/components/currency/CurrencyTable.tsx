import { type Component, Show } from "solid-js";
import {
  ActiveToggleButton,
  EditButton,
  SortableRows,
} from "~/components/global";
import { IconStar, IconStarFilled } from "~/components/icons";
import type { Currency } from "~/models";

type Props = {
  currencies: Currency[];
  canWrite: boolean;
  canAdmin: boolean;
  isActive: boolean;

  onReorder: (currencies: Currency[]) => void;
  onUpdate: (currency: Currency) => void;
  onSetActive: (currency: Currency, active: boolean) => void;
  onSetDefault: (currency: Currency) => void;
};

export const CurrencyTable: Component<Props> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth is-hoverable">
      <thead>
        <tr>
          <Show when={props.canWrite && props.isActive}>
            <th>Ordenar</th>
          </Show>
          <th class="has-text-centered">Predeterminada</th>
          <th>Código</th>
          <th>Nombre</th>
          <Show when={props.canWrite}>
            <th>Acciones</th>
          </Show>
        </tr>
      </thead>

      <tbody>
        <SortableRows
          items={props.currencies}
          getId={(currency) => currency.code}
          canSort={props.canWrite && props.isActive}
          colSpan={props.canWrite ? 4 : 3}
          emptyText="No hay monedas configuradas"
          onReorder={props.onReorder}
        >
          {(currency) => (
            <>
              <td class="has-text-centered">
                <Show
                  when={currency.isDefault}
                  fallback={
                    <Show
                      when={props.canAdmin && props.isActive}
                      fallback={
                        <IconStar title="No predeterminada" class="is-size-5" />
                      }
                    >
                      <button
                        type="button"
                        aria-label={`Hacer ${currency.displayName} la moneda predeterminada`}
                        onClick={() => props.onSetDefault(currency)}
                      >
                        <IconStar
                          title="Hacer predeterminada"
                          class="is-size-5 has-text-grey-light"
                        />
                      </button>
                    </Show>
                  }
                >
                  <IconStarFilled
                    title="Moneda predeterminada"
                    class="is-size-5 has-text-warning"
                  />
                </Show>
              </td>
              <td>
                <span class="tag">{currency.code}</span>
              </td>
              <td>{currency.displayName}</td>
              <Show when={props.canWrite}>
                <td>
                  <div class="buttons">
                    <EditButton
                      name={currency.displayName}
                      onClick={() => props.onUpdate(currency)}
                    />
                    <Show when={props.canAdmin && !currency.isDefault}>
                      <ActiveToggleButton
                        name={currency.displayName}
                        isActive={props.isActive}
                        onClick={() =>
                          props.onSetActive(currency, !props.isActive)
                        }
                      />
                    </Show>
                  </div>
                </td>
              </Show>
            </>
          )}
        </SortableRows>
      </tbody>
    </table>
  </div>
);
