import {
  type Component,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import { IconChevronDown } from "~/components/icons";
import { type Color, colorClass } from "~/utils";
import "./MultiSelect.css";
import type { SelectOption } from "./Select";

type Props = {
  options: SelectOption[];
  label?: string;
  hint?: string;
  error?: string;
  color?: Color;
  required?: boolean;
  value?: string[];
  disabled?: boolean;
  name: string;
  ref?: (element: HTMLInputElement) => void;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
};

export const MultiSelect: Component<Props> = (props) => {
  const [, inputProps] = splitProps(props, [
    "options",
    "label",
    "hint",
    "error",
    "color",
    "value",
    "required",
  ]);

  const [open, setOpen] = createSignal(false);
  let container: HTMLDivElement | undefined;

  onMount(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (container && !e.composedPath().includes(container)) {
        setOpen(false);
      }
    };
    // Capture phase, so an enclosing Modal sees the Escape as handled.
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !open()) return;
      e.preventDefault();
      setOpen(false);
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeydown, true);

    onCleanup(() => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeydown, true);
    });
  });

  const selectedOptions = () =>
    props.options.filter((option) => props.value?.includes(option.value));

  return (
    <fieldset class="field">
      <label class="label" for={props.name} id={`${props.name}-label`}>
        {props.label} {props.required ? <span>*</span> : ""}
      </label>

      <div class="control">
        <div
          class="dropdown multi-select"
          classList={{ "is-active": open(), [colorClass(props)]: true }}
          ref={container}
        >
          <div class="dropdown-trigger">
            <button
              type="button"
              class={`input ${colorClass(props)}`}
              id={props.name}
              disabled={props.disabled}
              aria-haspopup="true"
              aria-controls={`${props.name}-menu`}
              aria-expanded={open()}
              aria-invalid={Boolean(props.error)}
              aria-errormessage={`${props.name}-error`}
              aria-describedby={
                props.hint && !props.error ? `${props.name}-hint` : undefined
              }
              onClick={() => setOpen((v) => !v)}
            >
              <span class="tags multi-select-tags">
                {selectedOptions().length > 0 ? (
                  <For each={selectedOptions()}>
                    {(option) => (
                      <span class={`tag is-light ${colorClass(props)}`}>
                        {option.label}
                      </span>
                    )}
                  </For>
                ) : (
                  <span class="has-text-grey has-text-weight-normal">
                    Seleccionar
                  </span>
                )}
              </span>

              <IconChevronDown title="Abrir opciones" class="is-small" />
            </button>
          </div>

          <div id={`${props.name}-menu`} class="dropdown-menu">
            <div class="dropdown-content multi-select-options">
              <For each={props.options}>
                {(option) => {
                  const checked = () =>
                    props.value?.includes(option.value) ?? false;

                  return (
                    <label
                      class="dropdown-item multi-select-option"
                      classList={{ "is-selected": checked() }}
                    >
                      <input
                        {...inputProps}
                        type="checkbox"
                        value={option.value}
                        checked={checked()}
                      />

                      <span>{option.label}</span>
                    </label>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </div>

      {props.error && (
        <small class="help is-danger" id={`${props.name}-error`}>
          {props.error}
        </small>
      )}
      {props.hint && !props.error && (
        <small class="help" id={`${props.name}-hint`}>
          {props.hint}
        </small>
      )}
    </fieldset>
  );
};
