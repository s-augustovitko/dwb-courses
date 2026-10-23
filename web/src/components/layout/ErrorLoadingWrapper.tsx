import { useLocation } from "@solidjs/router";
import {
  createEffect,
  ErrorBoundary,
  on,
  type ParentComponent,
  Suspense,
} from "solid-js";
import { errorText } from "~/utils";
import { PageSkeleton } from "./Skeleton";

export const ErrorLoadingWrapper: ParentComponent = (props) => {
  const location = useLocation();

  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        createEffect(on(() => location.pathname, reset, { defer: true }));

        return (
          <div class="container is-widescreen">
            <h1 class="title">No se pudo cargar la página</h1>
            <h2 class="subtitle">{errorText(err)}</h2>
            <button type="button" class="button" onClick={reset}>
              Reintentar
            </button>
          </div>
        );
      }}
    >
      <Suspense fallback={<PageSkeleton />}>{props.children}</Suspense>
    </ErrorBoundary>
  );
};
