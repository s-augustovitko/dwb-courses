import { type Component, For, type JSX, splitProps } from "solid-js";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  options: SelectOption[];
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  value?: string;
  disabled?: boolean;
  name: string;
  ref?: (element: HTMLSelectElement) => void;
  onInput?: JSX.EventHandler<HTMLSelectElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLSelectElement, Event>;
  onBlur?: JSX.EventHandler<HTMLSelectElement, FocusEvent>;
};

export const Select: Component<Props> = (props) => {
  const [, selectProps] = splitProps(props, [
    "label",
    "hint",
    "error",
    "options",
  ]);

  return (
    <fieldset class="field">
      <label class="label" for={props.name}>
        {props.label} {props.required ? <span>*</span> : ""}
      </label>

      <div class="control">
        <div
          class="select is-fullwidth"
          classList={{ "is-danger": Boolean(props.error) }}
        >
          <select
            {...selectProps}
            id={props.name}
            value={props.value ?? ""}
            aria-invalid={Boolean(props.error)}
            aria-errormessage={props.error ? `${props.name}-error` : undefined}
            aria-describedby={
              props.hint && !props.error ? `${props.name}-hint` : undefined
            }
          >
            <For each={props.options}>
              {(option) => (
                <option
                  value={option.value}
                  disabled={option.disabled}
                  selected={option.value === (props.value ?? "")}
                >
                  {option.label}
                </option>
              )}
            </For>
          </select>
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
