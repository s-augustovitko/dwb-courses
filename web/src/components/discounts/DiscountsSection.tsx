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
import type { CurrencyRef, Discount, PricedItem } from "~/models";
import { useNotifications, useSession } from "~/stores";
import { Method, request, runOptimistic, toPriceList } from "~/utils";
import {
  CreateUpdateDiscountModal,
  type CreateUpdateDiscountSchema,
} from "./CreateUpdateDiscountModal";
import { DiscountTable } from "./DiscountTable";

type Props = {
  formId: string;
  currencies: CurrencyRef[];
  onItems?: (items: PricedItem[]) => void;
};

export const DiscountsSection: Component<Props> = (props) => {
  const notifications = useNotifications();
  const { canWrite } = useSession();

  const basePath = () => `form/${props.formId}/discount`;

  const toDiscountPayload = (values: CreateUpdateDiscountSchema) => ({
    discountType: values.discountType,
    name: values.name,
    hintText: values.hintText,
    cutoffDate:
      values.discountType === "EARLY_BIRD" ? values.cutoffDate : undefined,
    prices: toPriceList(values.prices, props.currencies),
  });

  const isActive = useActiveParam("discountsActive");
  const [discounts, { mutate: setDiscounts }] = createResource(
    () => String(isActive()),
    (active) => request<Discount[]>(basePath(), Method.GET, { active }),
  );

  createEffect(() => {
    props.onItems?.((discounts() ?? []).filter((d) => d.isActive));
  });

  const [createOpen, setCreateOpen] = createSignal(false);
  const [updateDiscount, setUpdateDiscount] = createSignal<Discount | null>(
    null,
  );
  const [activeConfirm, setActiveConfirm] = createSignal<{
    target: Discount;
    active: boolean;
  } | null>(null);

  function closeModal() {
    setCreateOpen(false);
    setUpdateDiscount(null);
  }

  async function handleCreateOptimistically(
    values: CreateUpdateDiscountSchema,
  ) {
    const payload = toDiscountPayload(values);
    const tempId = crypto.randomUUID();
    const previous = discounts() ?? [];
    setDiscounts([
      ...previous,
      {
        ...payload,
        id: tempId,
        sortOrder: previous.length + 1,
        isActive: true,
      },
    ]);
    closeModal();

    await runOptimistic({
      action: () =>
        request<Discount>(basePath(), Method.POST, undefined, payload),
      onSuccess: (created) =>
        setDiscounts((prev) =>
          (prev ?? []).map((item) => (item.id === tempId ? created : item)),
        ),
      rollback: () => setDiscounts(previous),
      successMessage: "Descuento creado",
      notify: notifications,
    });
  }

  async function handleUpdateOptimistically(
    values: CreateUpdateDiscountSchema,
  ) {
    const target = updateDiscount();
    if (!target) {
      return;
    }

    const payload = toDiscountPayload(values);
    const previous = discounts() ?? [];
    setDiscounts(
      previous.map((item) =>
        item.id === target.id ? { ...item, ...payload } : item,
      ),
    );
    closeModal();

    await runOptimistic({
      action: () =>
        request<null>(
          `${basePath()}/${target.id}`,
          Method.PUT,
          undefined,
          payload,
        ),
      rollback: () => setDiscounts(previous),
      successMessage: "Descuento actualizado",
      notify: notifications,
    });
  }

  async function handleReorderOptimistically(values: Discount[]) {
    const previous = discounts() ?? [];
    setDiscounts(values);

    await runOptimistic({
      action: () =>
        request<null>(`${basePath()}/order`, Method.PATCH, undefined, {
          items: values.map((item, idx) => ({ id: item.id, order: idx + 1 })),
        }),
      rollback: () => setDiscounts(previous),
      notify: notifications,
    });
  }

  async function handleSetActiveOptimistically() {
    const confirm = activeConfirm();
    if (!confirm) {
      return;
    }
    const { target, active } = confirm;

    const previous = discounts() ?? [];
    setDiscounts(previous.filter((d) => d.id !== target.id));
    setActiveConfirm(null);

    await runOptimistic({
      action: () =>
        request<null>(
          `${basePath()}/${target.id}/active`,
          Method.PATCH,
          undefined,
          { active },
        ),
      rollback: () => setDiscounts(previous),
      successMessage: `Descuento ${active ? "habilitado" : "deshabilitado"}`,
      notify: notifications,
    });
  }

  return (
    <Accordion title="Descuentos">
      <div class="level">
        <div class="level-left">
          <ActiveTabs param="discountsActive" />
        </div>

        <div class="level-right">
          <Show when={canWrite() && isActive()}>
            <button
              type="button"
              class="button is-primary"
              onClick={() => setCreateOpen(true)}
            >
              Agregar descuento
            </button>
          </Show>
        </div>
      </div>

      <DiscountTable
        discounts={discounts() ?? []}
        currencies={props.currencies}
        canWrite={canWrite()}
        isActive={isActive()}
        onReorder={handleReorderOptimistically}
        onUpdate={setUpdateDiscount}
        onSetActive={(target, active) => setActiveConfirm({ target, active })}
      />

      <CreateUpdateDiscountModal
        open={createOpen() || Boolean(updateDiscount())}
        discount={updateDiscount()}
        currencies={props.currencies}
        onClose={closeModal}
        onSubmit={
          updateDiscount()
            ? handleUpdateOptimistically
            : handleCreateOptimistically
        }
      />

      <ActiveConfirmModal
        noun="descuento"
        pending={activeConfirm()}
        name={activeConfirm()?.target.name ?? ""}
        onCancel={() => setActiveConfirm(null)}
        onConfirm={handleSetActiveOptimistically}
      />
    </Accordion>
  );
};
