import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createResource,
  For,
  Show,
} from "solid-js";
import { fetchPublicForms } from "~/components/registration";

const PublicFormsView: Component = () => {
  const navigate = useNavigate();
  const location = useLocation<{ stay?: boolean }>();

  const [forms] = createResource(fetchPublicForms);

  createEffect(() => {
    const list = forms();
    if (list?.length === 1 && !location.state?.stay) {
      navigate(`/forms/${list[0].id}`, { replace: true });
    }
  });

  return (
    <div>
      <h1 class="title">Inscripciones</h1>

      <Show
        when={(forms() ?? []).length > 0}
        fallback={<p>No hay formularios disponibles por ahora.</p>}
      >
        <For each={forms()}>
          {(form) => (
            <A class="box is-block" href={`/forms/${form.id}`}>
              {form.title}
            </A>
          )}
        </For>
      </Show>
    </div>
  );
};

export default PublicFormsView;
