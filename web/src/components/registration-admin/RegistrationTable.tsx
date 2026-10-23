import { A, useNavigate } from "@solidjs/router";
import dayjs from "dayjs";
import { type Component, For, Show } from "solid-js";
import { LinesSkeleton } from "~/components/layout";
import type { RegistrationListItem } from "~/models";
import { formatCents } from "~/utils";
import { StatusTag } from "./StatusTag";

const TABLE_COLUMNS = 7;

const detailPath = (item: RegistrationListItem) =>
  `/admin/registrations/${item.orderId}`;

function balanceCents(item: RegistrationListItem): number {
  return item.totalCents - item.paidCents;
}

export const RegistrationTable: Component<{
  items: RegistrationListItem[];
  loading?: boolean;
}> = (props) => {
  const navigate = useNavigate();

  return (
    <div class="table-container">
      <table class="table is-fullwidth is-hoverable">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Formulario</th>
            <th>Estado</th>
            <th class="has-text-right">Total</th>
            <th class="has-text-right">Saldo</th>
            <th>Creada</th>
          </tr>
        </thead>
        <tbody>
          <For
            each={props.items}
            fallback={
              <tr>
                <td colSpan={TABLE_COLUMNS}>
                  {props.loading ? (
                    <LinesSkeleton lines={1} />
                  ) : (
                    "No hay inscripciones con estos filtros"
                  )}
                </td>
              </tr>
            }
          >
            {(item) => (
              <tr
                class="is-clickable"
                onClick={() => navigate(detailPath(item))}
              >
                <td class="wrap-anywhere">
                  <A
                    href={detailPath(item)}
                    class="has-text-weight-bold"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.firstName} {item.lastName}
                  </A>
                  <br />
                  <small class="has-text-grey">{item.email}</small>
                </td>
                <td>{item.documentNumber}</td>
                <td class="wrap-anywhere">{item.formTitle}</td>
                <td>
                  <StatusTag status={item.status} />
                </td>
                <td class="has-text-right">
                  {formatCents(item.currencyCode, item.totalCents)}
                </td>
                <td class="has-text-right">
                  <Show
                    when={balanceCents(item) > 0 && item.status !== "CANCELLED"}
                    fallback={<span class="has-text-grey">—</span>}
                  >
                    <span class="has-text-weight-semibold">
                      {formatCents(item.currencyCode, balanceCents(item))}
                    </span>
                  </Show>
                </td>
                <td>{dayjs(item.createdAt).format("L")}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
