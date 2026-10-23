import { A, useSearchParams } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
  Show,
} from "solid-js";
import {
  Input,
  MultiSelect,
  Pagination,
  Select,
  type SelectOption,
} from "~/components/global";
import { AdminWrapper } from "~/components/layout";
import {
  RegistrationTable,
  STATUS_OPTIONS,
} from "~/components/registration-admin";
import type { FormListItem, RegistrationList } from "~/models";
import { useSession } from "~/stores";
import { Method, request, toggleValue } from "~/utils";

const PAGE_SIZE = 50;
/** The server caps `offset` at 1,000,000. */
const MAX_PAGE = Math.floor(1_000_000 / PAGE_SIZE);
const SEARCH_DEBOUNCE_MS = 300;
const ALL_FORMS: SelectOption = { value: "", label: "Todos los formularios" };

type Filters = { formId?: string; status?: string; q?: string; page?: string };

/** Zero-based; hand-edited values are clamped to what the server accepts. */
const toPage = (raw: string | undefined) =>
  Math.min(Math.max(Math.trunc(Number(raw ?? "0")) || 0, 0), MAX_PAGE);

const fetchForms = (enabled: "true" | "false") =>
  request<FormListItem[]>("form", Method.GET, { enabled });

// Registrations outlive their form being disabled, so offer both: active first.
const fetchAllForms = () =>
  Promise.all([fetchForms("true"), fetchForms("false")]).then((lists) =>
    lists.flat(),
  );

const fetchRegistrations = (filters: Filters) =>
  request<RegistrationList>("registration", Method.GET, {
    ...(filters.formId ? { formId: filters.formId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    limit: String(PAGE_SIZE),
    offset: String(toPage(filters.page) * PAGE_SIZE),
  });

const AdminRegistrationsView: Component = () => {
  const { canWrite } = useSession();
  const [params, setParams] = useSearchParams<Filters>();

  const [forms] = createResource(fetchAllForms);
  const [registrations] = createResource(
    () => ({ ...params }),
    fetchRegistrations,
  );

  const [search, setSearch] = createSignal(params.q ?? "");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(searchTimer));

  const page = () => toPage(params.page);
  const statuses = () => (params.status ? params.status.split(",") : []);
  const hasFilters = () => Boolean(params.formId || params.status || params.q);
  const formOptions = () => [
    ALL_FORMS,
    ...(forms() ?? []).map((form) => ({
      value: form.id,
      label: form.isEnabled ? form.title : `${form.title} (inactivo)`,
    })),
  ];

  // Follows back/forward; our own debounced writes are trimmed, so they already match.
  createEffect(
    on(
      () => params.q,
      (q) => {
        if ((q ?? "") === search().trim()) {
          return;
        }
        clearTimeout(searchTimer);
        setSearch(q ?? "");
      },
      { defer: true },
    ),
  );

  function handleFormChange(formId: string) {
    setParams({ formId: formId || undefined, page: undefined });
  }

  function handleStatusToggle(
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    const next = toggleValue(statuses(), event.currentTarget);
    setParams({ status: next.join(",") || undefined, page: undefined });
  }

  function handleSearchInput(text: string) {
    setSearch(text);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () =>
        setParams(
          { q: text.trim() || undefined, page: undefined },
          { replace: true },
        ),
      SEARCH_DEBOUNCE_MS,
    );
  }

  function handleClearFilters() {
    clearTimeout(searchTimer);
    setSearch("");
    setParams({
      formId: undefined,
      status: undefined,
      q: undefined,
      page: undefined,
    });
  }

  function handlePageChange(next: number) {
    setParams({ page: next > 1 ? String(next - 1) : undefined });
  }

  return (
    <AdminWrapper
      title="Inscripciones"
      right={
        <Show when={canWrite()}>
          <A class="button is-primary" href="/admin/registrations/new">
            Nueva inscripción
          </A>
        </Show>
      }
    >
      <div class="columns">
        <div class="column">
          <Select
            name="formFilter"
            label="Formulario"
            options={formOptions()}
            value={params.formId ?? ""}
            onChange={(e) => handleFormChange(e.currentTarget.value)}
          />
        </div>
        <div class="column">
          <MultiSelect
            name="statusFilter"
            label="Estado"
            hint="Sin elegir: todos, menos borradores"
            options={STATUS_OPTIONS}
            value={statuses()}
            onChange={handleStatusToggle}
          />
        </div>
        <div class="column">
          <Input
            name="registrationSearch"
            label="Buscar"
            hint="Nombre, documento o correo"
            type="text"
            value={search()}
            onInput={(e) => handleSearchInput(e.currentTarget.value)}
          />
        </div>
      </div>

      <Show when={hasFilters()}>
        <button
          type="button"
          class="button is-small is-text mb-3"
          onClick={handleClearFilters}
        >
          Limpiar filtros
        </button>
      </Show>

      <RegistrationTable
        items={registrations()?.items ?? []}
        loading={registrations.loading}
      />

      {/* The list has no total, only hasMore: offer pages up to the next one. */}
      <Pagination
        page={page() + 1}
        totalPages={page() + 1 + (registrations()?.hasMore ? 1 : 0)}
        onPageChange={handlePageChange}
      />
    </AdminWrapper>
  );
};

export default AdminRegistrationsView;
