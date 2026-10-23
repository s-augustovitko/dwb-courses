import { useNavigate } from "@solidjs/router";
import { type Component, createResource, createSignal, Show } from "solid-js";
import { Select } from "~/components/global";
import { AccessDenied, AdminWrapper, LinesSkeleton } from "~/components/layout";
import {
  AudiencePicker,
  audienceOptions,
  fetchCountries,
  fetchPublicForm,
  fetchPublicForms,
  RegistrationFields,
} from "~/components/registration";
import type { Audience, StaffRegistration } from "~/models";
import { useNotifications, useSession } from "~/stores";
import { loadedValue, Method, request, runAction } from "~/utils";

const AdminNewRegistrationView: Component = () => {
  const { canWrite } = useSession();

  return (
    <Show
      when={canWrite()}
      fallback={<AccessDenied title="Nueva inscripción" />}
    >
      <NewRegistrationContent />
    </Show>
  );
};

export default AdminNewRegistrationView;

const NewRegistrationContent: Component = () => {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [forms] = createResource(fetchPublicForms);
  const [countries] = createResource(fetchCountries);

  const [formId, setFormId] = createSignal("");
  const [form] = createResource(formId, fetchPublicForm);
  const loadedForm = () => (formId() ? loadedValue(form) : undefined);

  const [picked, setPicked] = createSignal<Audience | null>(null);

  const audiences = () => {
    const current = loadedForm();
    return current ? audienceOptions(current) : [];
  };
  const audience = () =>
    picked() ?? (audiences().length === 1 ? audiences()[0] : null);

  function handleFormChange(id: string) {
    setPicked(null);
    setFormId(id);
  }

  async function handleSubmit(payload: Record<string, unknown>) {
    await runAction({
      action: () =>
        request<StaffRegistration>(
          "registration",
          Method.POST,
          undefined,
          payload,
        ),
      notify: notifications,
      onSuccess: (created) =>
        navigate(`/admin/registrations/${created.orderId}`),
      conflictMessage: "Ya existe una inscripción activa con este documento.",
    });
  }

  return (
    <AdminWrapper title="Nueva inscripción" previous="/admin/registrations">
      <Select
        name="newRegistrationForm"
        label="Formulario"
        options={[
          { value: "", label: "Selecciona un formulario" },
          ...(forms() ?? []).map((item) => ({
            value: item.id,
            label: item.title,
          })),
        ]}
        value={formId()}
        onChange={(e) => handleFormChange(e.currentTarget.value)}
      />

      <Show when={form.loading}>
        <LinesSkeleton lines={6} />
      </Show>

      <Show when={formId() && form.error}>
        <p class="has-text-danger">
          No se pudo cargar el formulario. Intenta elegirlo de nuevo.
        </p>
      </Show>

      <Show when={loadedForm()} keyed>
        {(current) => (
          <Show
            when={audiences().length > 0}
            fallback={<p>Este formulario no tiene monedas configuradas.</p>}
          >
            <Show
              when={audience()}
              fallback={<AudiencePicker form={current} onPick={setPicked} />}
            >
              {(chosen) => (
                <RegistrationFields
                  form={current}
                  countries={countries() ?? []}
                  audience={chosen()}
                  submitLabel="Crear inscripción"
                  showOverrides
                  onSubmit={handleSubmit}
                />
              )}
            </Show>
          </Show>
        )}
      </Show>
    </AdminWrapper>
  );
};
