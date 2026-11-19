import { useSearchParams } from "@solidjs/router";
import { type Component, createResource, Show } from "solid-js";
import {
  DIETARY_SERIES,
  EarningsBoxes,
  itemLabel,
  PieChart,
  pivot,
  STATUS_SERIES,
  StackedBarChart,
} from "~/components/dashboard";
import { fetchAllForms, toFormOption } from "~/components/forms";
import { MultiSelect } from "~/components/global";
import { AdminWrapper } from "~/components/layout";
import { type Dashboard, paymentMethodLabels } from "~/models";
import {
  formatCalendarDate,
  formatCents,
  formatDateTime,
  Method,
  request,
  toggleValue,
} from "~/utils";

type Filters = { formIds?: string };

const fetchDashboard = (formIds: string) =>
  request<Dashboard>("dashboard", Method.GET, formIds ? { formIds } : {});

const AdminHomeView: Component = () => {
  const [params, setParams] = useSearchParams<Filters>();

  const [forms] = createResource(fetchAllForms);

  const formIds = () => (params.formIds ? params.formIds.split(",") : []);

  const [dashboard] = createResource(
    () => {
      const ids = formIds();
      return forms() && ids.length > 0 ? { formIds: ids.join(",") } : undefined;
    },
    ({ formIds }) => fetchDashboard(formIds),
  );

  const dashboardData = () => (formIds().length > 0 ? dashboard() : undefined);

  function handleFormToggle(
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    const next = toggleValue(formIds(), event.currentTarget);
    setParams({ formIds: next.join(",") || undefined });
  }

  const peopleByStatus = () => {
    const rows = dashboard()?.statuses ?? [];
    return STATUS_SERIES.map((status) => ({
      name: status.name,
      color: status.color,
      value: rows.find((row) => row.status === status.key)?.people ?? 0,
    }));
  };

  const sessionsByStatus = () => {
    const rows = dashboard()?.sessions ?? [];
    return pivot(rows, {
      labelKey: (row) => row.sessionId,
      label: itemLabel(rows, (row) => formatDateTime(row.sessionDate, "ddd D")),
      seriesKey: (row) => row.status,
      value: (row) => row.people,
      categories: STATUS_SERIES,
    });
  };

  const mealsBy = (by: "status" | "dietaryPreference") => {
    const rows = dashboard()?.meals ?? [];
    return pivot(rows, {
      labelKey: (row) => row.mealId,
      label: itemLabel(rows, (row) =>
        formatCalendarDate(row.mealDate, "ddd D"),
      ),
      seriesKey: (row) => row[by],
      value: (row) => row.people,
      categories: by === "status" ? STATUS_SERIES : DIETARY_SERIES,
    });
  };

  // One column per currency under each method, in that currency's money.
  const paymentsByMethod = () => {
    const data = pivot(dashboard()?.payments ?? [], {
      labelKey: (row) => row.method,
      label: (row) => paymentMethodLabels[row.method],
      groupKey: (row) => row.currencyCode,
      groupName: (row) => row.currencyName,
      seriesKey: (row) => row.status,
      value: (row) => row.amountCents / 100,
      categories: STATUS_SERIES,
    });

    return {
      ...data,
      groups: data.groups.map((group) => ({
        ...group,
        formatValue: (value: number) =>
          formatCents(group.key, Math.round(value * 100)),
      })),
    };
  };

  return (
    <AdminWrapper title="Panel de control">
      <div class="columns">
        <div class="column is-half">
          <MultiSelect
            name="formFilter"
            label="Formularios"
            placeholder="Selecciona formularios"
            options={(forms() ?? []).map(toFormOption)}
            value={formIds()}
            onChange={handleFormToggle}
          />
        </div>
      </div>

      <Show when={dashboardData()}>
        {(data) => (
          <>
            <EarningsBoxes earnings={data().earnings} />

            <div class="columns is-multiline">
              <div class="column is-half">
                <PieChart
                  title="Personas por estado"
                  slices={peopleByStatus()}
                />
              </div>
              <div class="column is-half">
                <StackedBarChart
                  title="Ingresos por tipo de pago y estado"
                  data={paymentsByMethod()}
                />
              </div>
              <div class="column is-full">
                <StackedBarChart
                  title="Personas por sesión y estado"
                  data={sessionsByStatus()}
                />
              </div>
              <div class="column is-half">
                <StackedBarChart
                  title="Personas por comida y preferencia alimentaria"
                  data={mealsBy("dietaryPreference")}
                />
              </div>
              <div class="column is-half">
                <StackedBarChart
                  title="Personas por comida y estado"
                  data={mealsBy("status")}
                />
              </div>
            </div>
          </>
        )}
      </Show>
    </AdminWrapper>
  );
};

export default AdminHomeView;
