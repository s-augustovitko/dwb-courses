import { type Component, For, type JSX, splitProps } from "solid-js";
import type { SelectOption } from "./Select";

type Props = {
  options: SelectOption[];
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  value?: string;
  disabled?: boolean;
  name: string;
  ref?: (element: HTMLInputElement) => void;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
};

export const RadioGroup: Component<Props> = (props) => {
  const [, inputProps] = splitProps(props, [
    "options",
    "label",
    "hint",
    "error",
    "value",
    "required",
  ]);

  return (
    <fieldset
      class="field"
      aria-invalid={Boolean(props.error)}
      aria-errormessage={props.error ? `${props.name}-error` : undefined}
      aria-describedby={
        props.hint && !props.error ? `${props.name}-hint` : undefined
      }
    >
      <legend class="label">
        {props.label} {props.required ? <span>*</span> : ""}
      </legend>

      <div class="control">
        <For each={props.options}>
          {(option) => (
            <label class="radio mr-4">
              <input
                {...inputProps}
                type="radio"
                value={option.value}
                checked={props.value === option.value}
              />{" "}
              {option.label}
            </label>
          )}
        </For>
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
