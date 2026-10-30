import {
  createForm,
  Field,
  getValue,
  getValues,
  validate,
  valiForm,
} from "@modular-forms/solid";
import { type Component, createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import { Accordion, MoneyInput, Switch } from "~/components/global";
import type {
  Audience,
  PublicCountry,
  PublicForm,
  PublicOption,
} from "~/models";
import { PRIVACY_POLICY_URL } from "~/utils";
import { currenciesFor } from "./audience";
import { PersonFields } from "./PersonFields";
import { buildRegistrationPayload, toOverrides } from "./payload";
import { toSwitchOption } from "./pricing";
import { RegistrationReview } from "./RegistrationReview";
import { SelectionFields } from "./SelectionFields";
import { emptyPerson, emptySelection } from "./types";
import {
  type ConsentValues,
  consentSchema,
  type Person,
  type PersonValues,
  personSchema,
  type Selection,
  type SelectionValues,
  selectionSchema,
} from "./validation";

type Props = {
  form: PublicForm;
  countries: PublicCountry[];
  audience: Audience;
  submitLabel: string;
  /** Staff only: lets the user type a price for each selected session and meal. */
  showOverrides?: boolean;
  requirePrivacyConsent?: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onReviewChange?: (reviewing: boolean) => void;
};

export const RegistrationFields: Component<Props> = (props) => {
  const currencies = () => currenciesFor(props.form, props.audience);

  const [personForm] = createForm<PersonValues>({
    validate: (values) =>
      valiForm<PersonValues>(personSchema(props.form))(values),
    validateOn: "change",
    initialValues: emptyPerson(),
  });

  const [selectionForm] = createForm<SelectionValues>({
    validate: (values) =>
      valiForm<SelectionValues>(selectionSchema(props.form))(values),
    validateOn: "change",
    initialValues: emptySelection(currencies()[0]?.code ?? ""),
  });

  const [, { Form: ConsentForm, Field: ConsentField }] =
    createForm<ConsentValues>({
      validate: (values) =>
        valiForm<ConsentValues>(
          consentSchema(Boolean(props.requirePrivacyConsent)),
        )(values),
      validateOn: "change",
      initialValues: { privacyAccepted: false },
    });

  const [submitting, setSubmitting] = createSignal(false);
  const [review, setReview] = createSignal<{
    person: Person;
    selection: Selection;
  } | null>(null);

  const selectedItems = () => {
    const sessionIds = getValue(selectionForm, "sessionIds") ?? [];
    const mealIds = getValue(selectionForm, "mealIds") ?? [];
    return [
      ...props.form.sessions.filter(
        (s) => props.form.disableSessionSelection || sessionIds.includes(s.id),
      ),
      ...props.form.meals.filter(
        (m) => props.form.disableMealSelection || mealIds.includes(m.id),
      ),
    ];
  };

  const itemLabel = (item: PublicOption) =>
    toSwitchOption(
      item,
      getValue(selectionForm, "currencyCode") ?? "",
      props.form.sessions.includes(item),
    ).label;

  async function handleReview(event: SubmitEvent) {
    event.preventDefault();

    const personValid = await validate(personForm);
    const selectionValid = await validate(selectionForm, {
      shouldFocus: personValid,
    });
    if (!personValid || !selectionValid) return;

    setReview({
      person: v.parse(personSchema(props.form), getValues(personForm)),
      selection: v.parse(selectionSchema(props.form), getValues(selectionForm)),
    });
    props.onReviewChange?.(true);
    window.scrollTo({ top: 0 });
  }

  function handleEdit() {
    setReview(null);
    props.onReviewChange?.(false);
    window.scrollTo({ top: 0 });
  }

  async function handleConfirm(person: Person, selection: Selection) {
    setSubmitting(true);
    try {
      const payload = buildRegistrationPayload(
        props.form,
        props.audience,
        person,
        selection,
      );
      await props.onSubmit(
        props.showOverrides
          ? { ...payload, overrides: toOverrides(selection.overrides) }
          : payload,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Hidden, not unmounted, so the fields keep their values and selection modes. */}
      <form onSubmit={handleReview} novalidate hidden={review() !== null}>
        <PersonFields
          of={personForm}
          form={props.form}
          countries={props.countries}
        />

        <h2 class="title is-4 mt-5">Tu selección</h2>
        <SelectionFields
          of={selectionForm}
          form={props.form}
          currencies={currencies()}
        />

        <Show when={props.showOverrides && selectedItems().length > 0}>
          <Accordion title="Editar precio por sesión">
            <p class="help mb-2">Déjalo vacío para usar el precio actual.</p>
            <For each={selectedItems()}>
              {(item) => (
                <Field of={selectionForm} name={`overrides.${item.id}`}>
                  {(field, fieldProps) => (
                    <MoneyInput
                      {...fieldProps}
                      value={field.value}
                      error={field.error}
                      label={itemLabel(item)}
                    />
                  )}
                </Field>
              )}
            </For>
          </Accordion>
        </Show>

        <Show when={!props.form.disableDonation}>
          <Field of={selectionForm} name="donationText">
            {(field, fieldProps) => (
              <MoneyInput
                {...fieldProps}
                value={field.value}
                error={field.error}
                label="Donación (opcional)"
              />
            )}
          </Field>
        </Show>

        <Show when={personForm.invalid || selectionForm.invalid}>
          <p class="help is-danger mt-4">Revisa los campos marcados en rojo.</p>
        </Show>

        <button type="submit" class="button is-primary mt-4">
          Revisar inscripción
        </button>
      </form>

      <Show when={review()}>
        {(current) => (
          <>
            <RegistrationReview
              form={props.form}
              person={current().person}
              selection={current().selection}
            />
            <ConsentForm
              onSubmit={() =>
                handleConfirm(current().person, current().selection)
              }
            >
              <Show when={props.requirePrivacyConsent}>
                <ConsentField name="privacyAccepted" type="boolean">
                  {(field, fieldProps) => (
                    <Switch
                      {...fieldProps}
                      checked={field.value}
                      error={field.error}
                      required
                      label={
                        <>
                          Acepto la{" "}
                          <a
                            href={PRIVACY_POLICY_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            política de privacidad
                          </a>
                        </>
                      }
                    />
                  )}
                </ConsentField>
              </Show>
              <div class="buttons">
                <button
                  type="submit"
                  class="button is-primary"
                  classList={{ "is-loading": submitting() }}
                  disabled={submitting()}
                >
                  {props.submitLabel}
                </button>
                <button
                  type="button"
                  class="button"
                  disabled={submitting()}
                  onClick={handleEdit}
                >
                  Editar
                </button>
              </div>
            </ConsentForm>
          </>
        )}
      </Show>
    </>
  );
};
