import type { Accessor } from "solid-js";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { Accordion, ConfirmModal } from "~/components/global";
import type { Currency, CurrencyRef, Form } from "~/models";
import { useNotifications, useSession } from "~/stores";
import { errorText, Method, request, runOptimistic } from "~/utils";
import { AddCurrencyModal, type AddCurrencySchema } from "./AddCurrencyModal";
import {
  CreateUpdateFormModal,
  type UpdateFormSchema,
} from "./CreateUpdateFormModal";
import { FormCurrenciesTable } from "./FormCurrenciesTable";

type Props = {
  formId: string;
  form: Accessor<Form | undefined>;
  setForm: (value: Form) => void;
};

export const FormDetailsSection: Component<Props> = (props) => {
  const notifications = useNotifications();
  const { canWrite, canAdmin } = useSession();

  const [updateFormOpen, setUpdateFormOpen] = createSignal(false);
  const [addCurrencyOpen, setAddCurrencyOpen] = createSignal(false);
  const [removeCurrencyConfirm, setRemoveCurrencyConfirm] =
    createSignal<CurrencyRef | null>(null);
  const [enabledConfirm, setEnabledConfirm] = createSignal<{
    enabled: boolean;
  } | null>(null);

  async function fetchCurrencies(): Promise<Currency[]> {
    try {
      return await request<Currency[]>("currency", Method.GET, {
        active: "true",
      });
    } catch (err) {
      notifications.error(errorText(err));
      return [];
    }
  }
  const [globalCurrencies] = createResource(fetchCurrencies);
  const currencyOptions = createMemo(() =>
    (globalCurrencies() ?? []).map((currency) => ({
      value: currency.code,
      label: currency.displayName,
    })),
  );
  const availableCurrencyOptions = createMemo(() => {
    const existing = new Set(
      (props.form()?.currencies ?? []).map((c) => c.code),
    );
    return currencyOptions().filter((option) => !existing.has(option.value));
  });

  async function handleUpdateFormOptimistically(values: UpdateFormSchema) {
    const previous = props.form();
    if (!previous) {
      return;
    }

    props.setForm({ ...previous, ...values });
    setUpdateFormOpen(false);

    await runOptimistic({
      action: () =>
        request<null>(`form/${props.formId}`, Method.PUT, undefined, values),
      rollback: () => props.setForm(previous),
      successMessage: "Formulario actualizado",
      notify: notifications,
    });
  }

  async function handleSetEnabledOptimistically() {
    const confirm = enabledConfirm();
    const previous = props.form();
    if (!confirm || !previous) {
      return;
    }
    const { enabled } = confirm;

    props.setForm({ ...previous, isEnabled: enabled });
    setEnabledConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(`form/${props.formId}/enabled`, Method.PATCH, undefined, {
          enabled,
        }),
      rollback: () => props.setForm(previous),
      successMessage: `Formulario ${enabled ? "habilitado" : "deshabilitado"}`,
      notify: notifications,
    });
  }

  async function handleAddCurrencyOptimistically(values: AddCurrencySchema) {
    const previous = props.form();
    if (!previous) {
      return;
    }

    const match = (globalCurrencies() ?? []).find(
      (c) => c.code === values.code,
    );
    const nextCurrencies = [
      ...previous.currencies,
      { code: values.code, displayName: match?.displayName ?? values.code },
    ];
    props.setForm({ ...previous, currencies: nextCurrencies });
    setAddCurrencyOpen(false);

    await runOptimistic({
      action: () =>
        request<null>(
          `form/${props.formId}/currencies/${values.code}`,
          Method.PUT,
        ),
      rollback: () => props.setForm(previous),
      successMessage: "Moneda agregada",
      notify: notifications,
    });
  }

  async function handleRemoveCurrencyOptimistically() {
    const target = removeCurrencyConfirm();
    const previous = props.form();
    if (!target || !previous) {
      return;
    }

    const nextCurrencies = previous.currencies.filter(
      (c) => c.code !== target.code,
    );
    props.setForm({ ...previous, currencies: nextCurrencies });
    setRemoveCurrencyConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(
          `form/${props.formId}/currencies/${target.code}`,
          Method.DELETE,
        ),
      rollback: () => props.setForm(previous),
      successMessage: "Moneda quitada",
      notify: notifications,
    });
  }

  return (
    <>
      <Accordion title="Datos del formulario" initialOpen>
        <div class="level block">
          <div class="level-left">
            <div>
              <p>
                <strong>Título:</strong> {props.form()?.title}
              </p>
              <p>
                <strong>Descripción:</strong> {props.form()?.description || "-"}
              </p>

              <div class="tags mt-4">
                <Show when={props.form()?.showArrivalAndDeparture}>
                  <span class="tag">Llegada/partida</span>
                </Show>
                <Show when={props.form()?.showInsurance}>
                  <span class="tag">Seguro</span>
                </Show>
                <Show when={props.form()?.showEmergencyContact}>
                  <span class="tag">Contacto de emergencia</span>
                </Show>
                <Show when={props.form()?.disableSessionSelection}>
                  <span class="tag is-danger">Sesiones deshabilitadas</span>
                </Show>
                <Show when={props.form()?.disableMealSelection}>
                  <span class="tag is-danger">Comidas deshabilitadas</span>
                </Show>
                <Show when={props.form()?.disableDonation}>
                  <span class="tag is-danger">Donaciones deshabilitadas</span>
                </Show>
              </div>
            </div>
          </div>

          <div class="level-right">
            <div class="buttons">
              <Show when={canWrite()}>
                <button
                  type="button"
                  class="button is-info"
                  classList={{ "is-light": !props.form()?.isEnabled }}
                  onClick={() =>
                    setEnabledConfirm({ enabled: !props.form()?.isEnabled })
                  }
                >
                  {props.form()?.isEnabled ? "Deshabilitar" : "Habilitar"}
                </button>

                <button
                  type="button"
                  class="button is-primary"
                  onClick={() => setUpdateFormOpen(true)}
                >
                  Editar
                </button>
              </Show>
            </div>
          </div>
        </div>

        <div class="level">
          <div class="level-left">
            <h2 class="subtitle">Monedas</h2>
          </div>

          <Show when={canAdmin()}>
            <div class="level-right">
              <div class="buttons">
                <button
                  type="button"
                  class="button is-primary"
                  disabled={availableCurrencyOptions().length === 0}
                  onClick={() => setAddCurrencyOpen(true)}
                >
                  Agregar moneda
                </button>
              </div>
            </div>
          </Show>
        </div>

        <FormCurrenciesTable
          currencies={props.form()?.currencies ?? []}
          canAdmin={canAdmin()}
          onRemove={setRemoveCurrencyConfirm}
        />
      </Accordion>

      <Show when={props.form()}>
        {(form) => (
          <CreateUpdateFormModal
            open={updateFormOpen()}
            form={form()}
            currencyOptions={[]}
            onClose={() => setUpdateFormOpen(false)}
            onSubmit={handleUpdateFormOptimistically}
          />
        )}
      </Show>

      <AddCurrencyModal
        open={addCurrencyOpen()}
        currencyOptions={availableCurrencyOptions()}
        onClose={() => setAddCurrencyOpen(false)}
        onSubmit={handleAddCurrencyOptimistically}
      />

      <ConfirmModal
        open={Boolean(removeCurrencyConfirm())}
        title="Quitar moneda"
        message={`¿Seguro que deseas quitar ${removeCurrencyConfirm()?.displayName ?? ""}? Se eliminarán los precios asociados en sesiones, comidas y descuentos.`}
        confirmLabel="Quitar"
        onCancel={() => setRemoveCurrencyConfirm(null)}
        onConfirm={handleRemoveCurrencyOptimistically}
      />

      <ConfirmModal
        open={Boolean(enabledConfirm())}
        title={
          enabledConfirm()?.enabled
            ? "Habilitar formulario"
            : "Deshabilitar formulario"
        }
        message={
          enabledConfirm()?.enabled
            ? `¿Seguro que deseas habilitar ${props.form()?.title ?? ""}?`
            : `¿Seguro que deseas deshabilitar ${props.form()?.title ?? ""}?`
        }
        confirmLabel={enabledConfirm()?.enabled ? "Habilitar" : "Deshabilitar"}
        onCancel={() => setEnabledConfirm(null)}
        onConfirm={handleSetEnabledOptimistically}
      />
    </>
  );
};
