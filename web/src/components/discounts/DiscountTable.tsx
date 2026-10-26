import { type Component, Show } from "solid-js";
import {
  ActiveToggleButton,
  EditButton,
  SortableRows,
} from "~/components/global";
import { type CurrencyRef, type Discount, discountTypeMap } from "~/models";
import { formatDateTime, priceDisplay } from "~/utils";

type Props = {
  discounts: Discount[];
  currencies: CurrencyRef[];
  canWrite: boolean;
  isActive: boolean;

  onReorder: (values: Discount[]) => void;
  onUpdate: (discount: Discount) => void;
  onSetActive: (discount: Discount, active: boolean) => void;
};

export const DiscountTable: Component<Props> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth is-hoverable">
      <thead>
        <tr>
          <Show when={props.canWrite && props.isActive}>
            <th>Ordenar</th>
          </Show>
          <th>Nombre</th>
          <th>Tipo</th>
          <th>Fecha límite</th>
          <th>Precios</th>
          <Show when={props.canWrite}>
            <th>Acciones</th>
          </Show>
        </tr>
      </thead>

      <tbody>
        <SortableRows
          items={props.discounts}
          getId={(discount) => discount.id}
          canSort={props.canWrite && props.isActive}
          colSpan={props.canWrite ? 5 : 4}
          emptyText="No hay descuentos configurados"
          onReorder={props.onReorder}
        >
          {(discount) => (
            <>
              <td>{discount.name}</td>
              <td>{discountTypeMap[discount.discountType]}</td>
              <td>{formatDateTime(discount.cutoffDate) || "-"}</td>
              <td class="no-wrap">
                {discount.discountType === "MEALS_INCLUDED"
                  ? "Total de comidas"
                  : priceDisplay(discount, props.currencies)}
              </td>
              <Show when={props.canWrite}>
                <td>
                  <div class="buttons">
                    <EditButton
                      name={discount.name}
                      onClick={() => props.onUpdate(discount)}
                    />
                    <ActiveToggleButton
                      name={discount.name}
                      isActive={props.isActive}
                      onClick={() =>
                        props.onSetActive(discount, !props.isActive)
                      }
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
