import { A, useLocation } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";
import { IconPower } from "~/components/icons";
import { useSession } from "~/stores";

type Route =
  | { name: string; path: string }
  | { name: string; children: { path: string; name: string }[] };

type Props = {
  basePath: string;
  routes: Route[];
};

export const NavBar: Component<Props> = (props) => {
  const [navbarActive, setNavbarActive] = createSignal(false);
  const { logOut, isLoggedIn } = useSession();
  const location = useLocation();

  createEffect(
    on(
      () => location.pathname,
      () => setNavbarActive(false),
    ),
  );

  const joinPaths = (base: string, path: string) => {
    const fullPath = `${base}/${path}`.replace(/\/+/g, "/");
    return fullPath.length > 1 && fullPath.endsWith("/")
      ? fullPath.slice(0, -1)
      : fullPath;
  };

  return (
    <nav class="navbar is-light" aria-label="Navegación principal">
      <div class="navbar-brand">
        <A class="navbar-item" href={joinPaths(props.basePath, "")}>
          <img src="/dwb-logo.webp" alt="Logo de Budismo Camino del Diamante" />
        </A>

        <button
          type="button"
          class="navbar-burger"
          classList={{ "is-active": navbarActive() }}
          aria-label="Menú"
          aria-expanded={navbarActive()}
          data-target="navbarBasic"
          onClick={() => setNavbarActive((v) => !v)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div
        id="navbarBasic"
        class="navbar-menu"
        classList={{ "is-active": navbarActive() }}
      >
        <div class="navbar-end">
          <For each={props.routes}>
            {(item) =>
              "children" in item ? (
                <div class="navbar-item has-dropdown is-hoverable">
                  <button
                    type="button"
                    class="navbar-link"
                    aria-haspopup="true"
                    classList={{
                      "is-selected": item.children.some(
                        (child) =>
                          location.pathname ===
                          joinPaths(props.basePath, child.path),
                      ),
                    }}
                  >
                    {item.name}
                  </button>

                  <div class="navbar-dropdown">
                    <For each={item.children}>
                      {(child) => (
                        <A
                          class="navbar-item"
                          classList={{
                            "is-selected":
                              location.pathname ===
                              joinPaths(props.basePath, child.path),
                          }}
                          href={joinPaths(props.basePath, child.path)}
                        >
                          {child.name}
                        </A>
                      )}
                    </For>
                  </div>
                </div>
              ) : (
                <A
                  class="navbar-item"
                  classList={{
                    "is-selected":
                      location.pathname ===
                      joinPaths(props.basePath, item.path),
                  }}
                  href={joinPaths(props.basePath, item.path)}
                >
                  {item.name}
                </A>
              )
            }
          </For>

          <Show when={isLoggedIn()}>
            <button
              type="button"
              class="navbar-item"
              aria-label="Cerrar sesión"
              onClick={logOut}
            >
              <IconPower title="Cerrar sesión" class="has-text-danger" />
            </button>
          </Show>
        </div>
      </div>
    </nav>
  );
};
