import { useNavigate } from "@solidjs/router";
import {
  type Component,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import {
  type CreateFormSchema,
  CreateUpdateFormModal,
  FormTable,
} from "~/components/forms";
import {
  ActiveTabs,
  ConfirmModal,
  Input,
  Pagination,
  useActiveParam,
} from "~/components/global";
import { AdminWrapper } from "~/components/layout";
import type { Currency, Form, FormListItem } from "~/models";
import { useNotifications, useSession } from "~/stores";
import {
  createLocalTable,
  Method,
  request,
  runAction,
  runOptimistic,
} from "~/utils";

const AdminFormsView: Component = () => {
  const { canWrite } = useSession();
  const notifications = useNotifications();
  const navigate = useNavigate();

  const isEnabled = useActiveParam("enabled");

  // The source is a string because a `false` source would skip the fetch.
  const [forms, { mutate: setForms }] = createResource(
    () => String(isEnabled()),
    (enabled) => request<FormListItem[]>("form", Method.GET, { enabled }),
  );
  const table = createLocalTable(forms, ["title"]);

  const [currencies] = createResource(() =>
    request<Currency[]>("currency", Method.GET, { active: "true" }),
  );
  const currencyOptions = createMemo(() =>
    (currencies() ?? []).map((currency) => ({
      value: currency.code,
      label: currency.displayName,
    })),
  );

  const [createOpen, setCreateOpen] = createSignal(false);
  const [enabledFormConfirm, setEnabledFormConfirm] = createSignal<{
    target: FormListItem;
    enabled: boolean;
  } | null>(null);

  async function handleCreateForm(values: CreateFormSchema) {
    await runAction({
      action: () => request<Form>("form", Method.POST, undefined, values),
      onSuccess: (created) => {
        notifications.info("Formulario creado");
        navigate(`/admin/forms/${created.id}`);
      },
      notify: notifications,
    });
  }

  async function handleSetEnabledOptimistically() {
    const confirm = enabledFormConfirm();
    if (!confirm?.target) {
      return;
    }
    const { target, enabled } = confirm;

    const previous = forms() ?? [];
    setForms(previous.filter((t) => t.id !== target.id));
    setEnabledFormConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(`form/${target.id}/enabled`, Method.PATCH, undefined, {
          enabled,
        }),
      rollback: () => setForms(previous),
      successMessage: `Formulario ${enabled ? "habilitado" : "deshabilitado"}`,
      notify: notifications,
    });
  }

  return (
    <AdminWrapper
      title="Formularios"
      left={
        <Input
          name="search"
          label="Buscar"
          type="text"
          value={table.search()}
          onInput={(e) => table.setSearch(e.currentTarget.value)}
        />
      }
      right={
        <Show when={canWrite()}>
          <button
            type="button"
            class="button is-primary"
            onClick={() => setCreateOpen(true)}
          >
            Crear formulario
          </button>
        </Show>
      }
    >
      <ActiveTabs param="enabled" />

      <FormTable
        forms={table.paged()}
        canWrite={canWrite()}
        sortKey={table.sortKey()}
        sortDir={table.sortDir()}
        onSort={table.sortBy}
        onSetEnabled={(target, enabled) =>
          setEnabledFormConfirm({ target, enabled })
        }
      />

      <Pagination
        page={table.page()}
        totalPages={table.totalPages()}
        onPageChange={table.setPage}
      />

      <CreateUpdateFormModal
        open={createOpen()}
        form={null}
        currencyOptions={currencyOptions()}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateForm}
      />

      <ConfirmModal
        open={Boolean(enabledFormConfirm())}
        title={
          enabledFormConfirm()?.enabled
            ? "Habilitar formulario"
            : "Deshabilitar formulario"
        }
        message={
          enabledFormConfirm()?.enabled
            ? `¿Seguro que deseas habilitar ${enabledFormConfirm()?.target.title ?? ""}?`
            : `¿Seguro que deseas deshabilitar ${enabledFormConfirm()?.target.title ?? ""}?`
        }
        confirmLabel={
          enabledFormConfirm()?.enabled ? "Habilitar" : "Deshabilitar"
        }
        onCancel={() => setEnabledFormConfirm(null)}
        onConfirm={handleSetEnabledOptimistically}
      />
    </AdminWrapper>
  );
};

export default AdminFormsView;
