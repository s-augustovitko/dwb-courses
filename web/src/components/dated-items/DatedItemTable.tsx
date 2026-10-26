import { type Component, Show } from "solid-js";
import {
  ActiveToggleButton,
  EditButton,
  SortableRows,
} from "~/components/global";
import type { CurrencyRef } from "~/models";
import { formatCalendarDate, formatDateTime, priceDisplay } from "~/utils";
import type { DatedItem, DatedItemConfig } from "./config";

type Props = {
  config: DatedItemConfig;
  items: DatedItem[];
  currencies: CurrencyRef[];
  canWrite: boolean;
  isActive: boolean;

  onReorder: (items: DatedItem[]) => void;
  onUpdate: (item: DatedItem) => void;
  onSetActive: (item: DatedItem, active: boolean) => void;
};

export const DatedItemTable: Component<Props> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth is-hoverable">
      <thead>
        <tr>
          <Show when={props.canWrite && props.isActive}>
            <th>Ordenar</th>
          </Show>
          <th>Nombre</th>
          <th>Fecha</th>
          <th>Precios</th>
          <Show when={props.canWrite}>
            <th>Acciones</th>
          </Show>
        </tr>
      </thead>

      <tbody>
        <SortableRows
          items={props.items}
          getId={(item) => item.id}
          canSort={props.canWrite && props.isActive}
          colSpan={props.canWrite ? 4 : 3}
          emptyText={`No hay ${props.config.plural} configuradas`}
          onReorder={props.onReorder}
        >
          {(item) => (
            <>
              <td>{item.name}</td>
              <td>
                {props.config.withTime
                  ? formatDateTime(item.date)
                  : formatCalendarDate(item.date)}
              </td>
              <td class="no-wrap">{priceDisplay(item, props.currencies)}</td>
              <Show when={props.canWrite}>
                <td>
                  <div class="buttons">
                    <EditButton
                      name={item.name}
                      onClick={() => props.onUpdate(item)}
                    />
                    <ActiveToggleButton
                      name={item.name}
                      isActive={props.isActive}
                      onClick={() => props.onSetActive(item, !props.isActive)}
                    />
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
