import { type Component, createSignal } from "solid-js";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export const ConfirmModal: Component<Props> = (props) => {
  const [loading, setLoading] = createSignal<boolean>(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await props.onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={props.onCancel}
      loading={loading()}
      footer={
        <div class="buttons">
          <button
            type="button"
            class="button"
            onClick={props.onCancel}
            disabled={loading()}
          >
            Cancelar
          </button>

          <button
            type="button"
            class="button is-danger"
            classList={{ "is-loading": loading() }}
            onClick={handleConfirm}
            disabled={loading()}
          >
            {props.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      }
    >
      <p>{props.message}</p>
    </Modal>
  );
};

type ActiveConfirmProps = {
  /** Lowercase noun for the title, e.g. "moneda". */
  noun: string;

  /** Set while confirming: active false disables, active true enables. */
  pending: { active: boolean } | null;
  name: string;
  disableWarning?: string;

  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export const ActiveConfirmModal: Component<ActiveConfirmProps> = (props) => {
  const label = () => (props.pending?.active ? "Habilitar" : "Deshabilitar");
  const message = () => {
    const question = `¿Seguro que deseas ${label().toLowerCase()} ${props.name}?`;
    return !props.pending?.active && props.disableWarning
      ? `${question} ${props.disableWarning}`
      : question;
  };

  return (
    <ConfirmModal
      open={Boolean(props.pending)}
      title={`${label()} ${props.noun}`}
      message={message()}
      confirmLabel={label()}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    />
  );
};
