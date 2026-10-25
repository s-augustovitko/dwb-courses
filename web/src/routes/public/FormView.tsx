import { useNavigate, useParams } from "@solidjs/router";
import { type Component, createResource, createSignal, Show } from "solid-js";
import { BackButton } from "~/components/layout";
import {
  AudiencePicker,
  audienceOptions,
  fetchCountries,
  fetchPublicForm,
  RegistrationFields,
} from "~/components/registration";
import type {
  Audience,
  CreateRegistrationResponse,
  PublicCountry,
  PublicForm,
} from "~/models";
import { useNotifications } from "~/stores";
import { Method, request, runAction, undefinedIfNotFound } from "~/utils";

const PublicFormView: Component = () => {
  const params = useParams<{ id: string }>();

  const [form] = createResource(
    () => params.id,
    (id) => fetchPublicForm(id).catch(undefinedIfNotFound),
  );
  const [countries] = createResource(fetchCountries);

  return (
    <Show when={form()} fallback={<p>No se encontró el formulario.</p>}>
      {(current) => (
        <FormContent form={current()} countries={countries() ?? []} />
      )}
    </Show>
  );
};

export default PublicFormView;

const FormContent: Component<{
  form: PublicForm;
  countries: PublicCountry[];
}> = (props) => {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [picked, setPicked] = createSignal<Audience | null>(null);
  const [reviewing, setReviewing] = createSignal(false);

  const audiences = () => audienceOptions(props.form);
  const audience = () =>
    picked() ?? (audiences().length === 1 ? audiences()[0] : null);

  async function handleSubmit(payload: Record<string, unknown>) {
    await runAction({
      action: () =>
        request<CreateRegistrationResponse>(
          "public/registration",
          Method.POST,
          undefined,
          payload,
        ),
      notify: notifications,
      onSuccess: (created) => navigate(`/registrations/${created.token}`),
      conflictMessage:
        "Ya existe una inscripción con este documento. Si es tuya, usa el enlace que te enviamos por correo o contacta al equipo organizador.",
    });
  }

  return (
    <div>
      <Show when={!reviewing()}>
        <BackButton
          href={picked() ? `/forms/${props.form.id}` : "/forms"}
          onSelect={picked() ? () => setPicked(null) : undefined}
          state={{ stay: true }}
        />
      </Show>

      <h1 class="title mb-2">{props.form.title}</h1>
      <Show when={props.form.description}>
        <p class="has-text-grey mb-5 wrap-anywhere keep-line-breaks">
          {props.form.description}
        </p>
      </Show>

      <Show
        when={audiences().length > 0}
        fallback={<p>Este formulario no está disponible por ahora.</p>}
      >
        <Show
          when={audience()}
          fallback={<AudiencePicker form={props.form} onPick={setPicked} />}
        >
          {(current) => (
            <RegistrationFields
              form={props.form}
              countries={props.countries}
              audience={current()}
              submitLabel="Confirmar y continuar"
              onSubmit={handleSubmit}
              onReviewChange={setReviewing}
            />
          )}
        </Show>
      </Show>
    </div>
  );
};
