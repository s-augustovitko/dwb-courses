import {
  type Component,
  createEffect,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import {
  Accordion,
  ActiveConfirmModal,
  ActiveTabs,
  useActiveParam,
} from "~/components/global";
import type { CurrencyRef, PricedItem } from "~/models";
import { useNotifications, useSession } from "~/stores";
import { Method, request, runOptimistic, toPriceList } from "~/utils";
import { capitalize, type DatedItem, type DatedItemConfig } from "./config";
import { DatedItemModal, type DatedItemSchema } from "./DatedItemModal";
import { DatedItemTable } from "./DatedItemTable";

type ItemResponse = Omit<DatedItem, "date"> &
  Partial<Record<DatedItemConfig["dateKey"], string>>;

type Props = {
  config: DatedItemConfig;
  formId: string;
  currencies: CurrencyRef[];
  onItems?: (items: PricedItem[]) => void;
};

export const DatedItemsSection: Component<Props> = (props) => {
  const notifications = useNotifications();
  const { canWrite } = useSession();

  const basePath = () => `form/${props.formId}/${props.config.path}`;
  const noun = () => capitalize(props.config.singular);
  const toDatedItem = (raw: ItemResponse): DatedItem => ({
    ...raw,
    date: raw[props.config.dateKey] ?? "",
  });
  const toPayload = (values: DatedItemSchema) => ({
    name: values.name,
    hintText: values.hintText,
    [props.config.dateKey]: values.date,
    prices: toPriceList(values.prices, props.currencies),
  });

  const isActive = useActiveParam(props.config.activeParam);
  const [items, { mutate: setItems }] = createResource(
    () => String(isActive()),
    async (active) => {
      const list = await request<ItemResponse[]>(basePath(), Method.GET, {
        active,
      });
      return list.map(toDatedItem);
    },
  );

  createEffect(() => {
    props.onItems?.((items() ?? []).filter((item) => item.isActive));
  });

  const [createOpen, setCreateOpen] = createSignal(false);
  const [updateItem, setUpdateItem] = createSignal<DatedItem | null>(null);
  const [activeConfirm, setActiveConfirm] = createSignal<{
    target: DatedItem;
    active: boolean;
  } | null>(null);

  function closeModal() {
    setCreateOpen(false);
    setUpdateItem(null);
  }

  async function handleCreateOptimistically(values: DatedItemSchema) {
    const tempId = crypto.randomUUID();
    const previous = items() ?? [];
    setItems([
      ...previous,
      {
        ...values,
        id: tempId,
        sortOrder: previous.length + 1,
        isActive: true,
        prices: toPriceList(values.prices, props.currencies),
      },
    ]);
    closeModal();

    await runOptimistic({
      action: () =>
        request<ItemResponse>(
          basePath(),
          Method.POST,
          undefined,
          toPayload(values),
        ),
      onSuccess: (created) =>
        setItems((prev) =>
          (prev ?? []).map((item) =>
            item.id === tempId ? toDatedItem(created) : item,
          ),
        ),
      rollback: () => setItems(previous),
      successMessage: `${noun()} creada`,
      notify: notifications,
    });
  }

  async function handleUpdateOptimistically(values: DatedItemSchema) {
    const target = updateItem();
    if (!target) {
      return;
    }

    const previous = items() ?? [];
    setItems(
      previous.map((item) =>
        item.id === target.id
          ? {
              ...item,
              ...values,
              prices: toPriceList(values.prices, props.currencies),
            }
          : item,
      ),
    );
    closeModal();

    await runOptimistic({
      action: () =>
        request<null>(
          `${basePath()}/${target.id}`,
          Method.PUT,
          undefined,
          toPayload(values),
        ),
      rollback: () => setItems(previous),
      successMessage: `${noun()} actualizada`,
      notify: notifications,
    });
  }

  async function handleReorderOptimistically(values: DatedItem[]) {
    const previous = items() ?? [];
    setItems(values);

    await runOptimistic({
      action: () =>
        request<null>(`${basePath()}/order`, Method.PATCH, undefined, {
          items: values.map((item, idx) => ({ id: item.id, order: idx + 1 })),
        }),
      rollback: () => setItems(previous),
      notify: notifications,
    });
  }

  async function handleSetActiveOptimistically() {
    const confirm = activeConfirm();
    if (!confirm) {
      return;
    }
    const { target, active } = confirm;

    const previous = items() ?? [];
    setItems(previous.filter((item) => item.id !== target.id));
    setActiveConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(
          `${basePath()}/${target.id}/active`,
          Method.PATCH,
          undefined,
          { active },
        ),
      rollback: () => setItems(previous),
      successMessage: `${noun()} ${active ? "habilitada" : "deshabilitada"}`,
      notify: notifications,
    });
  }

  return (
    <Accordion title={props.config.title}>
      <div class="level">
        <div class="level-left">
          <ActiveTabs param={props.config.activeParam} />
        </div>

        <div class="level-right">
          <Show when={canWrite() && isActive()}>
            <button
              type="button"
              class="button is-primary"
              onClick={() => setCreateOpen(true)}
            >
              Agregar {props.config.singular}
            </button>
          </Show>
        </div>
      </div>

      <DatedItemTable
        config={props.config}
        items={items() ?? []}
        currencies={props.currencies}
        canWrite={canWrite()}
        isActive={isActive()}
        onReorder={handleReorderOptimistically}
        onUpdate={setUpdateItem}
        onSetActive={(target, active) => setActiveConfirm({ target, active })}
      />

      <DatedItemModal
        config={props.config}
        open={createOpen() || Boolean(updateItem())}
        item={updateItem()}
        currencies={props.currencies}
        onClose={closeModal}
        onSubmit={
          updateItem() ? handleUpdateOptimistically : handleCreateOptimistically
        }
      />

      <ActiveConfirmModal
        noun={props.config.singular}
        pending={activeConfirm()}
        name={activeConfirm()?.target.name ?? ""}
        onCancel={() => setActiveConfirm(null)}
        onConfirm={handleSetActiveOptimistically}
      />
    </Accordion>
  );
};
