import { A } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { AdminWrapper } from "~/components/layout";
import { useSession } from "~/stores";

const AdminHomeView: Component = () => {
  const { canAdmin } = useSession();

  return (
    <AdminWrapper title="Panel de control">
      <div class="buttons">
        <A class="button is-primary" href="/admin/forms">
          Formularios
        </A>

        <A class="button is-primary" href="/admin/registrations">
          Inscripciones
        </A>

        <Show when={canAdmin()}>
          <A class="button is-primary" href="/admin/users">
            Usuarios
          </A>
        </Show>

        <A class="button is-primary" href="/admin/currencies">
          Monedas
        </A>

        <A class="button is-primary" href="/admin/id-types">
          Tipos de identificación
        </A>
      </div>
    </AdminWrapper>
  );
};

export default AdminHomeView;
