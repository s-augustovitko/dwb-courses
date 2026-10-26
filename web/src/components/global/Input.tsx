import { type Component, type JSX, splitProps } from "solid-js";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  type?: "email" | "number" | "password" | "tel" | "text";
  inputmode?:
    | "decimal"
    | "email"
    | "none"
    | "numeric"
    | "search"
    | "tel"
    | "text"
    | "url";
  value?: string;
  min?: string;
  max?: string;
  step?: string;
  disabled?: boolean;
  required?: boolean;
  name: string;
  ref?: (element: HTMLInputElement) => void;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
};

export const Input: Component<Props> = (props) => {
  const [, inputProps] = splitProps(props, ["label", "error", "hint"]);

  return (
    <fieldset class="field">
      <label class="label" for={props.name}>
        {props.label} {props.required ? <span>*</span> : ""}
      </label>

      <div class="control">
        <input
          {...inputProps}
          class="input"
          classList={{ "is-danger": Boolean(props.error) }}
          id={props.name}
          value={props.value ?? ""}
          placeholder={props.label}
          aria-invalid={Boolean(props.error)}
          aria-errormessage={props.error ? `${props.name}-error` : undefined}
          aria-describedby={
            props.hint && !props.error ? `${props.name}-hint` : undefined
          }
        />
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
