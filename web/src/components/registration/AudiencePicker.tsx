import { type Component, For } from "solid-js";
import type { Audience, PublicForm } from "~/models";
import { audienceOptions } from "./audience";

type Props = {
  form: PublicForm;
  onPick: (audience: Audience) => void;
};

const COPY: Record<
  Audience,
  { title: string; description: (c: string) => string }
> = {
  LOCAL: {
    title: "Local",
    description: (currency) => `Vivo en el país. Pagaré en ${currency}.`,
  },
  FOREIGNER: {
    title: "Extranjero",
    description: () => "Vivo fuera del país. Pagaré en otra moneda disponible.",
  },
};

export const audienceLabel = (audience: Audience) => COPY[audience].title;

export const AudiencePicker: Component<Props> = (props) => {
  const defaultCurrencyName = () =>
    props.form.currencies.find((c) => c.isDefault)?.displayName ?? "";

  return (
    <div class="columns is-centered">
      <For each={audienceOptions(props.form)}>
        {(audience) => (
          <div class="column is-4 is-flex">
            <button
              type="button"
              class="box button is-fullwidth is-flex-direction-column p-5"
              style={{ height: "auto", "white-space": "normal" }}
              onClick={() => props.onPick(audience)}
            >
              <span class="title is-4">{audienceLabel(audience)}</span>
              <span>{COPY[audience].description(defaultCurrencyName())}</span>
            </button>
          </div>
        )}
      </For>
    </div>
  );
};
