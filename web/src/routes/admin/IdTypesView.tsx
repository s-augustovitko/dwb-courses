import { type Component, createResource, createSignal, Show } from "solid-js";
import {
  ActiveConfirmModal,
  ActiveTabs,
  useActiveParam,
} from "~/components/global";
import {
  CreateUpdateIdTypeModal,
  type CreateUpdateIdTypeSchema,
  IdTypeTable,
} from "~/components/idtypes";
import { AdminWrapper } from "~/components/layout";
import type { IdType } from "~/models";
import { useNotifications, useSession } from "~/stores";
import { Method, request, runOptimistic } from "~/utils";

const AdminIdTypesView: Component = () => {
  const { canAdmin, canWrite } = useSession();
  const notifications = useNotifications();

  const isActive = useActiveParam("active");
  const [idTypes, { mutate: setIdTypes }] = createResource(
    () => String(isActive()),
    (active) => request<IdType[]>("id-type", Method.GET, { active }),
  );

  const [createOpen, setCreateOpen] = createSignal(false);
  const [updateIdType, setUpdateIdType] = createSignal<IdType | null>(null);
  const [activeConfirm, setActiveConfirm] = createSignal<{
    target: IdType;
    active: boolean;
  } | null>(null);

  function closeModal() {
    setCreateOpen(false);
    setUpdateIdType(null);
  }

  async function handleCreateOptimistically(values: CreateUpdateIdTypeSchema) {
    const tempId = crypto.randomUUID();
    const previous = idTypes() ?? [];
    if (isActive()) {
      setIdTypes([
        ...previous,
        { ...values, id: tempId, sortOrder: previous.length + 1 },
      ]);
    }
    closeModal();

    await runOptimistic({
      action: () => request<IdType>("id-type", Method.POST, undefined, values),
      onSuccess: (created) =>
        setIdTypes((prev) =>
          (prev ?? []).map((item) => (item.id === tempId ? created : item)),
        ),
      rollback: () => setIdTypes(previous),
      successMessage: "Tipo de identificación creado",
      notify: notifications,
    });
  }

  async function handleUpdateOptimistically(values: CreateUpdateIdTypeSchema) {
    const target = updateIdType();
    if (!target) {
      return;
    }

    const previous = idTypes() ?? [];
    setIdTypes(
      previous.map((item) =>
        item.id === target.id ? { ...item, ...values } : item,
      ),
    );
    closeModal();

    await runOptimistic({
      action: () =>
        request<null>(`id-type/${target.id}`, Method.PUT, undefined, values),
      rollback: () => setIdTypes(previous),
      successMessage: "Tipo de identificación actualizado",
      notify: notifications,
    });
  }

  async function handleReorderOptimistically(values: IdType[]) {
    const previous = idTypes() ?? [];
    setIdTypes(values);

    await runOptimistic({
      action: () =>
        request<null>("id-type/order", Method.PATCH, undefined, {
          items: values.map((item, idx) => ({ id: item.id, order: idx + 1 })),
        }),
      rollback: () => setIdTypes(previous),
      notify: notifications,
    });
  }

  async function handleSetActiveOptimistically() {
    const confirm = activeConfirm();
    if (!confirm) {
      return;
    }
    const { target, active } = confirm;

    const previous = idTypes() ?? [];
    setIdTypes(previous.filter((t) => t.id !== target.id));
    setActiveConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(`id-type/${target.id}/active`, Method.PATCH, undefined, {
          active,
        }),
      rollback: () => setIdTypes(previous),
      successMessage: `Tipo de identificación ${active ? "restaurado" : "eliminado"}`,
      notify: notifications,
    });
  }

  return (
    <AdminWrapper
      title="Tipos de identificación"
      right={
        <Show when={canWrite()}>
          <button
            type="button"
            class="button is-primary"
            onClick={() => setCreateOpen(true)}
          >
            Agregar tipo de identificación
          </button>
        </Show>
      }
    >
      <ActiveTabs param="active" />

      <IdTypeTable
        idTypes={idTypes() ?? []}
        canAdmin={canAdmin()}
        canWrite={canWrite()}
        isActive={isActive()}
        onUpdate={setUpdateIdType}
        onSetActive={(target, active) => setActiveConfirm({ target, active })}
        onReorder={handleReorderOptimistically}
      />

      <CreateUpdateIdTypeModal
        open={createOpen() || Boolean(updateIdType())}
        idType={updateIdType()}
        onClose={closeModal}
        onSubmit={
          updateIdType()
            ? handleUpdateOptimistically
            : handleCreateOptimistically
        }
      />

      <ActiveConfirmModal
        noun="tipo de identificación"
        pending={activeConfirm()}
        name={activeConfirm()?.target.label ?? ""}
        onCancel={() => setActiveConfirm(null)}
        onConfirm={handleSetActiveOptimistically}
      />
    </AdminWrapper>
  );
};

export default AdminIdTypesView;
