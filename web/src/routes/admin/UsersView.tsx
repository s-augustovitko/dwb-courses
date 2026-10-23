import { type Component, createResource, createSignal, Show } from "solid-js";
import { ConfirmModal, Input, Pagination } from "~/components/global";
import { AccessDenied, AdminWrapper } from "~/components/layout";
import {
  CreateUserModal,
  type CreateUserSchema,
  UpdateRoleModal,
  type UpdateUserRoleSchema,
  UserTable,
} from "~/components/users";
import { roleMap, type User } from "~/models";
import { useNotifications, useSession } from "~/stores";
import {
  createLocalTable,
  Method,
  request,
  runAction,
  runOptimistic,
} from "~/utils";

const AdminUsersView: Component = () => {
  const { canAdmin } = useSession();

  return (
    <Show when={canAdmin()} fallback={<AccessDenied title="Usuarios" />}>
      <AdminUsersContent />
    </Show>
  );
};

const AdminUsersContent: Component = () => {
  const notifications = useNotifications();
  const { userId } = useSession();

  const [users, { mutate: setUsers }] = createResource(() =>
    request<User[]>("user", Method.GET),
  );
  const table = createLocalTable(users, [
    "name",
    "email",
    (user) => roleMap[user.role],
  ]);

  const [createOpen, setCreateOpen] = createSignal(false);
  const [updateUser, setUpdateUser] = createSignal<User | null>(null);
  const [deleteUser, setDeleteUser] = createSignal<User | null>(null);

  async function handleCreateUserSubmit(values: CreateUserSchema) {
    await runAction({
      action: () =>
        request<User>("auth/create-user", Method.POST, undefined, values),
      onSuccess: (created) => {
        setUsers((prev) => [...(prev ?? []), created]);
        setCreateOpen(false);
        notifications.info(
          "Usuario creado, se envió un correo con sus credenciales",
        );
      },
      notify: notifications,
    });
  }

  async function handleUpdateRoleOptimistically(values: UpdateUserRoleSchema) {
    const target = updateUser();
    if (!target) {
      return;
    }

    const previous = users() ?? [];
    setUsers(
      previous.map((item) =>
        item.id === target.id ? { ...item, ...values } : item,
      ),
    );
    setUpdateUser(null);

    await runOptimistic({
      action: () =>
        request<null>(`user/${target.id}/role`, Method.PATCH, undefined, {
          role: values.role,
        }),
      rollback: () => setUsers(previous),
      successMessage: "Rol actualizado",
      notify: notifications,
    });
  }

  async function handleDeleteOptimistically() {
    const target = deleteUser();
    if (!target) {
      return;
    }

    const previous = users() ?? [];
    setUsers(previous.filter((u) => u.id !== target.id));
    setDeleteUser(null);

    await runOptimistic({
      action: () => request<null>(`user/${target.id}`, Method.DELETE),
      rollback: () => setUsers(previous),
      successMessage: "Usuario eliminado",
      notify: notifications,
    });
  }

  return (
    <AdminWrapper
      title="Usuarios"
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
        <button
          type="button"
          class="button is-primary"
          onClick={() => setCreateOpen(true)}
        >
          Crear usuario
        </button>
      }
    >
      <UserTable
        users={table.paged()}
        currentUserId={userId()}
        sortKey={table.sortKey()}
        sortDir={table.sortDir()}
        onSort={table.sortBy}
        onUpdateRole={setUpdateUser}
        onDelete={setDeleteUser}
      />

      <Pagination
        page={table.page()}
        totalPages={table.totalPages()}
        onPageChange={table.setPage}
      />

      <CreateUserModal
        open={createOpen()}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateUserSubmit}
      />

      <UpdateRoleModal
        open={Boolean(updateUser())}
        user={updateUser()}
        onClose={() => setUpdateUser(null)}
        onSubmit={handleUpdateRoleOptimistically}
      />

      <ConfirmModal
        open={Boolean(deleteUser())}
        title="Eliminar usuario"
        message={`¿Seguro que deseas eliminar a ${deleteUser()?.name ?? ""}?`}
        confirmLabel="Eliminar"
        onCancel={() => setDeleteUser(null)}
        onConfirm={handleDeleteOptimistically}
      />
    </AdminWrapper>
  );
};

export default AdminUsersView;
