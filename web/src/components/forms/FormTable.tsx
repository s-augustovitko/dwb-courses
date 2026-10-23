import { A } from "@solidjs/router";
import { type Component, For, Show } from "solid-js";
import { SortHeader } from "~/components/global";
import { IconEdit } from "~/components/icons";
import type { FormListItem } from "~/models";
import { formatDate, type SortDir } from "~/utils";

type SortKey = keyof FormListItem;

type Props = {
  forms: FormListItem[];
  canWrite: boolean;

  sortKey: SortKey | "";
  sortDir: SortDir;
  onSort: (key: SortKey) => void;

  onSetEnabled: (form: FormListItem, enabled: boolean) => void;
};

const columns: { key: SortKey; label: string }[] = [
  { key: "title", label: "Título" },
  { key: "sessionCount", label: "# Sesiones" },
  { key: "mealCount", label: "# Comidas" },
  { key: "mainCurrency", label: "Moneda (#)" },
  { key: "updatedAt", label: "Última actualización" },
];

export const FormTable: Component<Props> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth is-hoverable">
      <thead>
        <tr>
          <For each={columns}>
            {(column) => (
              <SortHeader
                label={column.label}
                column={column.key}
                sortKey={props.sortKey}
                sortDir={props.sortDir}
                onSort={props.onSort}
              />
            )}
          </For>
          <th>{props.canWrite ? "Cambiar estado" : "Estado"}</th>
          <th>Acciones</th>
        </tr>
      </thead>

      <tbody>
        <For
          each={props.forms}
          fallback={
            <tr>
              <td colSpan={7}>No hay formularios</td>
            </tr>
          }
        >
          {(form) => (
            <tr>
              <td>{form.title}</td>
              <td>
                {form.sessionCount}
                {form.sessionCount === 1 ? " sesión" : " sesiones"}
              </td>
              <td>
                {form.mealCount}
                {` comida${form.mealCount === 1 ? "" : "s"}`}
              </td>
              <td>
                {form.mainCurrency} ({form.currenciesCount}
                {` moneda${form.currenciesCount === 1 ? "" : "s"}`})
              </td>
              <td>{formatDate(form.updatedAt)}</td>
              <td>
                <Show
                  when={props.canWrite}
                  fallback={
                    <span
                      class="tag is-info"
                      classList={{ "is-light": !form.isEnabled }}
                    >
                      {form.isEnabled ? "Habilitado" : "Deshabilitado"}
                    </span>
                  }
                >
                  <button
                    type="button"
                    class="tag is-info"
                    classList={{ "is-light": !form.isEnabled }}
                    onClick={() => props.onSetEnabled(form, !form.isEnabled)}
                  >
                    {form.isEnabled ? "Deshabilitar" : "Habilitar"}
                  </button>
                </Show>
              </td>
              <td>
                <A
                  href={`/admin/forms/${form.id}`}
                  aria-label={`${props.canWrite ? "Editar" : "Ver"} ${form.title}`}
                >
                  <IconEdit
                    title={props.canWrite ? "Editar" : "Ver"}
                    class="is-size-5 has-text-info"
                  />
                </A>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);
