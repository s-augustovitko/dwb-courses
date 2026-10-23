import { type Component, Show } from "solid-js";
import {
  ActiveToggleButton,
  EditButton,
  SortableRows,
} from "~/components/global";
import type { IdType } from "~/models";

type Props = {
  idTypes: IdType[];
  canWrite: boolean;
  canAdmin: boolean;
  isActive: boolean;

  onReorder: (values: IdType[]) => void;
  onUpdate: (idType: IdType) => void;
  onSetActive: (idType: IdType, active: boolean) => void;
};

export const IdTypeTable: Component<Props> = (props) => (
  <div class="table-container">
    <table class="table is-fullwidth is-hoverable">
      <thead>
        <tr>
          <Show when={props.canWrite && props.isActive}>
            <th>Ordenar</th>
          </Show>
          <th>Nombre</th>
          <th>Longitud</th>
          <th>Permite letras</th>
          <Show when={props.canWrite}>
            <th>Acciones</th>
          </Show>
        </tr>
      </thead>

      <tbody>
        <SortableRows
          items={props.idTypes}
          getId={(idType) => idType.id}
          canSort={props.canWrite && props.isActive}
          colSpan={props.canWrite ? 4 : 3}
          emptyText="No hay tipos de identificación configurados"
          onReorder={props.onReorder}
        >
          {(idType) => (
            <>
              <td>{idType.label}</td>
              <td>
                {idType.allowLetters
                  ? `Máximo ${idType.maxLen}`
                  : `Exactamente ${idType.maxLen}`}
              </td>
              <td>
                <span
                  class="tag"
                  classList={{
                    "is-info": idType.allowLetters,
                    "is-danger": !idType.allowLetters,
                  }}
                >
                  {idType.allowLetters ? "Sí" : "No"}
                </span>
              </td>
              <Show when={props.canWrite}>
                <td>
                  <div class="buttons">
                    <EditButton
                      name={idType.label}
                      onClick={() => props.onUpdate(idType)}
                    />
                    <Show when={props.canAdmin}>
                      <ActiveToggleButton
                        name={idType.label}
                        isActive={props.isActive}
                        onClick={() =>
                          props.onSetActive(idType, !props.isActive)
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
