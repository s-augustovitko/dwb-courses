import {
  type Component,
  createUniqueId,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** While true (e.g. submitting) the modal ignores Escape, the backdrop and the close button. */
  loading?: boolean;
  footer?: JSX.Element;
  children: JSX.Element;
};

export const Modal: Component<Props> = (props) => (
  <Show when={props.open}>
    <OpenModal {...props} />
  </Show>
);

const OpenModal: Component<Props> = (props) => {
  const titleId = createUniqueId();
  let card: HTMLDivElement | undefined;

  const close = () => {
    if (!props.loading) props.onClose();
  };

  onMount(() => {
    document.documentElement.classList.add("is-clipped");

    // Skip an Escape that an open picker already handled (defaultPrevented).
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    document.addEventListener("keydown", handleKeydown);

    onCleanup(() => {
      document.removeEventListener("keydown", handleKeydown);
      document.documentElement.classList.remove("is-clipped");
    });

    card?.focus();
  });

  return (
    <div class="modal is-active">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape and the close button cover keyboard users. */}
      <div class="modal-background" onClick={close} />

      <div
        ref={card}
        class="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header class="modal-card-head">
          <p class="modal-card-title" id={titleId}>
            {props.title}
          </p>
          <button
            type="button"
            class="delete"
            aria-label="Cerrar"
            disabled={props.loading}
            onClick={close}
          />
        </header>

        <section class="modal-card-body">{props.children}</section>

        <Show when={props.footer}>
          <footer class="modal-card-foot">{props.footer}</footer>
        </Show>
      </div>
    </div>
  );
};
