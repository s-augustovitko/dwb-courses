import { type Component, createResource, createSignal, Show } from "solid-js";
import {
  CreateUpdateCurrencyModal,
  type CreateUpdateCurrencySchema,
  CurrencyTable,
} from "~/components/currency";
import {
  ActiveConfirmModal,
  ActiveTabs,
  useActiveParam,
} from "~/components/global";
import { AdminWrapper } from "~/components/layout";
import type { Currency } from "~/models";
import { useNotifications, useSession } from "~/stores";
import { ApiError, Method, request, runOptimistic } from "~/utils";

const fetchCurrencies = (active: string) =>
  request<Currency[]>("currency", Method.GET, { active });

const AdminCurrenciesView: Component = () => {
  const { canWrite, canAdmin } = useSession();
  const notifications = useNotifications();

  const isActive = useActiveParam("active");
  const [currencies, { mutate: setCurrencies }] = createResource(
    () => String(isActive()),
    fetchCurrencies,
  );

  const [createOpen, setCreateOpen] = createSignal(false);
  const [updateCurrency, setUpdateCurrency] = createSignal<Currency | null>(
    null,
  );
  const [activeConfirm, setActiveConfirm] = createSignal<{
    target: Currency;
    active: boolean;
  } | null>(null);

  function closeModal() {
    setCreateOpen(false);
    setUpdateCurrency(null);
  }

  // POST currency upserts by code, so creating an existing code would silently
  // rename it (or a deleted one); check both tabs first.
  async function createIfNew(values: CreateUpdateCurrencySchema) {
    const [active, inactive] = await Promise.all([
      fetchCurrencies("true"),
      fetchCurrencies("false"),
    ]);
    if (inactive.some((c) => c.code === values.code)) {
      throw new ApiError(
        "DUPLICATE",
        `La moneda ${values.code} está deshabilitada, habilítala desde Deshabilitados`,
      );
    }
    if (active.some((c) => c.code === values.code)) {
      throw new ApiError("DUPLICATE", `Ya existe la moneda ${values.code}`);
    }
    return request<Currency>("currency", Method.POST, undefined, values);
  }

  async function handleCreateOptimistically(
    values: CreateUpdateCurrencySchema,
  ) {
    const previous = currencies() ?? [];
    if (isActive()) {
      setCurrencies([
        ...previous,
        { ...values, sortOrder: previous.length + 1, isDefault: false },
      ]);
    }
    closeModal();

    await runOptimistic({
      action: () => createIfNew(values),
      onSuccess: (created) =>
        setCurrencies((prev) =>
          (prev ?? []).map((item) =>
            item.code === created.code ? created : item,
          ),
        ),
      rollback: () => setCurrencies(previous),
      successMessage: "Moneda creada",
      notify: notifications,
    });
  }

  async function handleUpdateOptimistically(
    values: CreateUpdateCurrencySchema,
  ) {
    const previous = currencies() ?? [];
    setCurrencies(
      previous.map((item) =>
        item.code === values.code ? { ...item, ...values } : item,
      ),
    );
    closeModal();

    await runOptimistic({
      action: () =>
        request<Currency>("currency", Method.POST, undefined, values),
      rollback: () => setCurrencies(previous),
      successMessage: "Moneda actualizada",
      notify: notifications,
    });
  }

  async function handleReorderOptimistically(values: Currency[]) {
    const previous = currencies() ?? [];
    setCurrencies(values);

    await runOptimistic({
      action: () =>
        request<null>("currency/order", Method.PATCH, undefined, {
          items: values.map((item, idx) => ({
            code: item.code,
            order: idx + 1,
          })),
        }),
      rollback: () => setCurrencies(previous),
      notify: notifications,
    });
  }

  async function handleSetDefault(target: Currency) {
    const previous = currencies() ?? [];
    setCurrencies(
      previous.map((item) => ({
        ...item,
        isDefault: item.code === target.code,
      })),
    );

    await runOptimistic({
      action: () =>
        request<null>(`currency/${target.code}/default`, Method.PATCH),
      rollback: () => setCurrencies(previous),
      successMessage: `${target.displayName} es ahora la moneda predeterminada`,
      notify: notifications,
    });
  }

  async function handleSetActiveOptimistically() {
    const confirm = activeConfirm();
    if (!confirm) {
      return;
    }
    const { target, active } = confirm;

    const previous = currencies() ?? [];
    setCurrencies(previous.filter((t) => t.code !== target.code));
    setActiveConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(
          `currency/${target.code}/active`,
          Method.PATCH,
          undefined,
          { active },
        ),
      rollback: () => setCurrencies(previous),
      successMessage: `Moneda ${active ? "habilitada" : "deshabilitada"}`,
      notify: notifications,
    });
  }

  return (
    <AdminWrapper
      title="Monedas"
      right={
        <Show when={canWrite()}>
          <button
            type="button"
            class="button is-primary"
            onClick={() => setCreateOpen(true)}
          >
            Agregar moneda
          </button>
        </Show>
      }
    >
      <ActiveTabs param="active" />

      <CurrencyTable
        currencies={currencies() ?? []}
        canWrite={canWrite()}
        canAdmin={canAdmin()}
        isActive={isActive()}
        onUpdate={setUpdateCurrency}
        onSetActive={(target, active) => setActiveConfirm({ target, active })}
        onReorder={handleReorderOptimistically}
        onSetDefault={handleSetDefault}
      />

      <CreateUpdateCurrencyModal
        open={createOpen() || Boolean(updateCurrency())}
        currency={updateCurrency()}
        onClose={closeModal}
        onSubmit={
          updateCurrency()
            ? handleUpdateOptimistically
            : handleCreateOptimistically
        }
      />

      <ActiveConfirmModal
        noun="moneda"
        pending={activeConfirm()}
        name={activeConfirm()?.target.displayName ?? ""}
        disableWarning="Se quitará de todos los formularios que la usan."
        onCancel={() => setActiveConfirm(null)}
        onConfirm={handleSetActiveOptimistically}
      />
    </AdminWrapper>
  );
};

export default AdminCurrenciesView;
