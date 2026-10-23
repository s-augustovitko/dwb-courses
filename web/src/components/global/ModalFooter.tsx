import type { Component } from "solid-js";

type Props = {
  submitLabel: string;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onCancel: () => void;
};

export const ModalFooter: Component<Props> = (props) => (
  <div class="buttons">
    <button
      type="button"
      class="button"
      onClick={props.onCancel}
      disabled={props.loading}
    >
      Cancelar
    </button>

    <button
      type="submit"
      class="button"
      classList={{
        "is-success": !props.danger,
        "is-danger": props.danger,
        "is-loading": props.loading,
      }}
      disabled={props.loading || props.disabled}
    >
      {props.submitLabel}
    </button>
  </div>
);
