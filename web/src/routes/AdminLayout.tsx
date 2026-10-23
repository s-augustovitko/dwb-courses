import { createMemo, type ParentComponent, Show } from "solid-js";
import { LoginForm } from "~/components/auth";
import { ErrorLoadingWrapper, Footer, NavBar } from "~/components/layout";
import { SessionProvider, useSession } from "~/stores";

const basePath = "/admin";
const initialRoutes = [
  { name: "Inicio", path: "/" },
  { name: "Formularios", path: "/forms" },
  { name: "Inscripciones", path: "/registrations" },
  {
    name: "Configuración",
    children: [
      { name: "Monedas", path: "/currencies" },
      { name: "Tipos de identificación", path: "/id-types" },
    ],
  },
];
const adminRoutes = [{ name: "Usuarios", path: "/users" }];

const AdminLayout: ParentComponent = (props) => (
  <SessionProvider>
    <AdminShell>{props.children}</AdminShell>
  </SessionProvider>
);

const AdminShell: ParentComponent = (props) => {
  const { isLoggedIn, refetch, canAdmin } = useSession();

  const routes = createMemo(() =>
    canAdmin() ? [...initialRoutes, ...adminRoutes] : initialRoutes,
  );

  return (
    <>
      <NavBar basePath={basePath} routes={isLoggedIn() ? routes() : []} />

      <section class="section section-content">
        <Show when={isLoggedIn()} fallback={<LoginForm onSuccess={refetch} />}>
          <ErrorLoadingWrapper>{props.children}</ErrorLoadingWrapper>
        </Show>
      </section>

      <Footer />
    </>
  );
};

export default AdminLayout;
