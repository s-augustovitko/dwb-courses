import { type Component, createSignal, type JSX, Show } from "solid-js";
import { IconChevronDown, IconChevronUp } from "~/components/icons";

type Props = {
  title: string;
  children: JSX.Element;
  initialOpen?: boolean;
  onToggle?: (val: boolean) => void;
};

export const Accordion: Component<Props> = (props) => {
  const [open, setOpen] = createSignal<boolean>(props.initialOpen ?? false);

  const toggle = () => {
    const val = !open();
    setOpen(val);
    props.onToggle?.(val);
  };

  return (
    <div class="block box">
      <h2 class="subtitle mb-0">
        <button
          type="button"
          class="is-flex is-justify-content-space-between is-align-items-center is-clickable w-full"
          aria-expanded={open()}
          onClick={toggle}
        >
          {props.title}

          <Show when={open()} fallback={<IconChevronDown title="Expandir" />}>
            <IconChevronUp title="Contraer" />
          </Show>
        </button>
      </h2>

      <div class="mt-4" hidden={!open()}>
        {props.children}
      </div>
    </div>
  );
};
