import { type Component, For, Show } from "solid-js";
import { SortHeader } from "~/components/global";
import { IconEdit, IconTrash } from "~/components/icons";
import { roleMap, type User } from "~/models";
import { formatDate, type SortDir } from "~/utils";

type SortKey = keyof User;

type Props = {
  users: User[];
  currentUserId?: string;

  sortKey: SortKey | "";
  sortDir: SortDir;
  onSort: (key: SortKey) => void;

  onUpdateRole: (user: User) => void;
  onDelete: (user: User) => void;
};

const columns: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nombre" },
  { key: "email", label: "Correo" },
  { key: "role", label: "Rol" },
  { key: "createdAt", label: "Creado" },
];

export const UserTable: Component<Props> = (props) => (
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
          <th>Acciones</th>
        </tr>
      </thead>

      <tbody>
        <For
          each={props.users}
          fallback={
            <tr>
              <td colSpan={5}>No hay usuarios</td>
            </tr>
          }
        >
          {(user) => (
            <tr>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span
                  class="tag is-info"
                  classList={{
                    "is-light": user.role !== "ADMIN",
                  }}
                >
                  {roleMap[user.role]}
                </span>
              </td>
              <td>{formatDate(user.createdAt)}</td>
              <td>
                <Show when={user.id !== props.currentUserId}>
                  <div class="buttons">
                    <button
                      type="button"
                      aria-label={`Editar rol de ${user.name}`}
                      onClick={() => props.onUpdateRole(user)}
                    >
                      <IconEdit
                        title="Editar rol"
                        class="is-size-5 has-text-info"
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${user.name}`}
                      onClick={() => props.onDelete(user)}
                    >
                      <IconTrash
                        title="Eliminar"
                        class="is-size-5 has-text-danger"
                      />
                    </button>
                  </div>
                </Show>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
);
