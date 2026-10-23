import { A, useParams } from "@solidjs/router";
import { type Component, createResource, createSignal, Show } from "solid-js";
import { ConfirmModal } from "~/components/global";
import { IconEdit } from "~/components/icons";
import { AdminWrapper } from "~/components/layout";
import { OrderTable } from "~/components/registration";
import {
  CancelModal,
  DiscountModal,
  EditItemsModal,
  EditPersonModal,
  PaymentDetailsModal,
  PaymentModal,
  PaymentsTable,
  PersonDetails,
  RefundModal,
  registrationPath,
  StatusTag,
} from "~/components/registration-admin";
import type { CartLine, StaffPayment, StaffRegistration } from "~/models";
import { useNotifications, useSession } from "~/stores";
import {
  formatCents,
  formatShortDate,
  Method,
  request,
  runAction,
  undefinedIfNotFound,
} from "~/utils";

type ModalName =
  | "person"
  | "items"
  | "discount"
  | "payment"
  | "refund"
  | "cancel";

const Stat: Component<{ label: string; value: string; accent?: string }> = (
  props,
) => (
  <div class="level-item has-text-centered">
    <div>
      <p class="heading">{props.label}</p>
      <p class={`title is-4 ${props.accent ?? ""}`}>{props.value}</p>
    </div>
  </div>
);

const AdminRegistrationView: Component = () => {
  const params = useParams<{ id: string }>();

  const [registration, { mutate: setRegistration, refetch }] = createResource(
    () => params.id,
    (id) =>
      request<StaffRegistration>(registrationPath(id), Method.GET).catch(
        undefinedIfNotFound,
      ),
  );

  return (
    <AdminWrapper title="Inscripción" previous="/admin/registrations">
      <Show
        when={registration()}
        fallback={<p>No se encontró la inscripción.</p>}
      >
        {(current) => (
          <RegistrationContent
            reg={current()}
            onChange={setRegistration}
            onRefresh={refetch}
          />
        )}
      </Show>
    </AdminWrapper>
  );
};

export default AdminRegistrationView;

const RegistrationContent: Component<{
  reg: StaffRegistration;
  onChange: (reg: StaffRegistration) => void;
  onRefresh: () => void;
}> = (props) => {
  const { canWrite, canAdmin } = useSession();
  const notifications = useNotifications();

  const [modal, setModal] = createSignal<ModalName | null>(null);
  const [discountToRemove, setDiscountToRemove] = createSignal<CartLine | null>(
    null,
  );
  const [paymentToView, setPaymentToView] = createSignal<StaffPayment | null>(
    null,
  );

  const isCancelled = () => props.reg.status === "CANCELLED";

  // The server refuses staff changes on drafts and while an online payment is pending;
  // refunds are also allowed on cancelled orders that still hold money.
  const canChange = () =>
    props.reg.status !== "DRAFT" && !props.reg.paymentPending;
  const canEdit = () => canChange() && !isCancelled();
  const refundable = () => canChange() && props.reg.paidCents > 0;
  const isOpen = (name: ModalName) => modal() === name;

  function handleClose() {
    setModal(null);
  }

  function handleConflict() {
    setModal(null);
    setDiscountToRemove(null);
    props.onRefresh();
  }

  async function handleRemoveDiscount() {
    const line = discountToRemove();
    if (!line) {
      return;
    }

    await runAction({
      action: () =>
        request<StaffRegistration>(
          registrationPath(
            props.reg.orderId,
            `/discounts/${encodeURIComponent(line.lineId)}`,
          ),
          Method.DELETE,
        ),
      notify: notifications,
      onSuccess: props.onChange,
      onConflict: handleConflict,
    });
    setDiscountToRemove(null);
  }

  const modalProps = () => ({
    reg: props.reg,
    onClose: handleClose,
    onDone: props.onChange,
    onConflict: handleConflict,
  });

  const money = (cents: number) => formatCents(props.reg.currencyCode, cents);

  return (
    <>
      <div class="box">
        <div class="is-flex is-justify-content-space-between is-align-items-center is-flex-wrap-wrap is-gap-2 mb-2">
          <h2 class="title is-4 wrap-anywhere mb-0">
            {props.reg.firstName} {props.reg.lastName}
          </h2>
          <StatusTag status={props.reg.status} />
        </div>
        <p class="subtitle is-6 wrap-anywhere">
          Formulario:{" "}
          <A href={`/admin/forms/${props.reg.formId}`}>{props.reg.formTitle}</A>
        </p>

        <Show when={props.reg.paymentPending}>
          <div class="notification is-warning is-light">
            Hay un pago en línea sin confirmar. Antes de registrar pagos o
            cambiar la inscripción, revisa el cargo en el panel de Culqi: el
            sistema lo registrará solo cuando Culqi lo confirme.
            <button
              type="button"
              class="button is-small is-warning mt-2 is-block"
              onClick={() => props.onRefresh()}
            >
              Actualizar estado
            </button>
          </div>
        </Show>

        <Show when={isCancelled()}>
          <div class="notification is-danger is-light">
            Cancelada
            <Show when={props.reg.cancelledAt}>
              {(at) => <> el {formatShortDate(at())}</>}
            </Show>
            . Solo admite registrar reembolsos.
          </div>
        </Show>

        <nav class="level box has-background-light">
          <Stat label="Total" value={money(props.reg.totalCents)} />
          <Stat label="Pagado" value={money(props.reg.paidCents)} />
          <Show when={!isCancelled()}>
            <Stat
              label="Saldo"
              value={money(props.reg.balanceCents)}
              accent={
                props.reg.balanceCents > 0
                  ? "has-text-danger"
                  : "has-text-success"
              }
            />
          </Show>
        </nav>

        <Show when={(canEdit() && canWrite()) || (canAdmin() && refundable())}>
          <div class="buttons">
            <Show when={canEdit() && canWrite()}>
              <button
                type="button"
                class="button is-primary"
                disabled={props.reg.balanceCents <= 0}
                onClick={() => setModal("payment")}
              >
                Registrar pago
              </button>
              <button
                type="button"
                class="button"
                onClick={() => setModal("discount")}
              >
                Agregar descuento
              </button>
              <button
                type="button"
                class="button"
                onClick={() => setModal("items")}
              >
                <IconEdit title="Editar" class="mr-1" decorative />
                Sesiones y comidas
              </button>
              <button
                type="button"
                class="button"
                onClick={() => setModal("person")}
              >
                <IconEdit title="Editar" class="mr-1" decorative />
                Datos personales
              </button>
            </Show>
            <Show when={canAdmin() && refundable()}>
              <button
                type="button"
                class="button is-warning is-light"
                onClick={() => setModal("refund")}
              >
                Reembolso
              </button>
            </Show>
            <Show when={canAdmin() && canEdit()}>
              <button
                type="button"
                class="button is-danger is-light"
                onClick={() => setModal("cancel")}
              >
                Cancelar inscripción
              </button>
            </Show>
          </div>
        </Show>
      </div>

      <div class="columns">
        <div class="column">
          <div class="box">
            <h3 class="title is-5">Datos</h3>
            <PersonDetails reg={props.reg} />
          </div>
        </div>
        <div class="column">
          <div class="box">
            <h3 class="title is-5">Resumen</h3>
            <OrderTable
              order={props.reg}
              onRemoveDiscount={
                canWrite() && canEdit() ? setDiscountToRemove : undefined
              }
            />
          </div>
          <div class="box">
            <h3 class="title is-5">Pagos</h3>
            <PaymentsTable
              payments={props.reg.payments}
              currency={props.reg.currencyCode}
              onViewDetails={setPaymentToView}
            />
          </div>
        </div>
      </div>

      <EditPersonModal {...modalProps()} open={isOpen("person")} />
      <EditItemsModal {...modalProps()} open={isOpen("items")} />
      <DiscountModal {...modalProps()} open={isOpen("discount")} />
      <PaymentModal {...modalProps()} open={isOpen("payment")} />
      <RefundModal {...modalProps()} open={isOpen("refund")} />
      <CancelModal {...modalProps()} open={isOpen("cancel")} />
      <PaymentDetailsModal
        payment={paymentToView()}
        onClose={() => setPaymentToView(null)}
      />
      <ConfirmModal
        open={Boolean(discountToRemove())}
        title="Quitar descuento"
        message={`¿Quitar el descuento "${discountToRemove()?.name ?? ""}" de esta inscripción? El total aumentará.`}
        confirmLabel="Quitar"
        onCancel={() => setDiscountToRemove(null)}
        onConfirm={handleRemoveDiscount}
      />
    </>
  );
};
