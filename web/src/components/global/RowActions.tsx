import type { Component } from "solid-js";
import { Show } from "solid-js";
import { IconEdit, IconTrash, IconTrashRestore } from "~/components/icons";

export const EditButton: Component<{ name: string; onClick: () => void }> = (
  props,
) => (
  <button
    type="button"
    aria-label={`Editar ${props.name}`}
    onClick={props.onClick}
  >
    <IconEdit title="Editar" class="is-size-5 has-text-info" />
  </button>
);

export const ActiveToggleButton: Component<{
  name: string;
  isActive: boolean;
  onClick: () => void;
}> = (props) => (
  <button
    type="button"
    aria-label={`${props.isActive ? "Deshabilitar" : "Habilitar"} ${props.name}`}
    onClick={props.onClick}
  >
    <Show
      when={props.isActive}
      fallback={
        <IconTrashRestore
          title="Habilitar"
          class="is-size-5 has-text-success"
        />
      }
    >
      <IconTrash title="Deshabilitar" class="is-size-5 has-text-danger" />
    </Show>
  </button>
);
