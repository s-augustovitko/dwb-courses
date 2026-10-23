import { createForm, getValue, reset, valiForm } from "@modular-forms/solid";
import { A, useNavigate, useParams } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  Show,
  untrack,
} from "solid-js";
import * as v from "valibot";
import { MoneyInput, Select } from "~/components/global";
import { BackButton } from "~/components/layout";
import {
  CartSummary,
  cartBalance,
  cartPath,
  cartSettled,
  currenciesFor,
  fetchCart,
  fetchPublicForm,
  PaymentPendingNotice,
} from "~/components/registration";
import type {
  Cart,
  PaymentConfig,
  PayResponse,
  SubmitRegistrationResponse,
} from "~/models";
import {
  type CardPayment,
  chargeCard,
  createPaymentProvider,
  hideLocation,
} from "~/payments";
import { useNotifications } from "~/stores";
import {
  centsToDecimal,
  formatCents,
  loadedValue,
  MAX_DONATION_CENTS,
  Method,
  optionalMoneyField,
  parseMoneyToCents,
  request,
  runAction,
  undefinedIfNotFound,
} from "~/utils";

const PENDING_POLL_MS = 5000;

function parseDonation(text: string): number | null {
  const trimmed = text.trim();
  return trimmed ? parseMoneyToCents(trimmed) : 0;
}

const cartEditSchema = v.object({
  currencyCode: v.string(),
  donation: optionalMoneyField(MAX_DONATION_CENTS),
});

type CartEditSchema = v.InferInput<typeof cartEditSchema>;

const PublicCartView: Component = () => {
  const params = useParams<{ token: string }>();

  const [cart, { mutate: setCart }] = createResource(
    () => params.token,
    (token) => fetchCart(token).catch(undefinedIfNotFound),
  );

  return (
    <div>
      <BackButton
        href={cart()?.formId ? `/forms/${cart()?.formId}` : "/forms"}
      />

      <h1 class="title">Tu inscripción</h1>

      <Show
        when={cart()}
        fallback={<p>Este enlace no es válido o ya venció.</p>}
      >
        {(current) => (
          <CartContent
            token={params.token}
            cart={current()}
            onChange={setCart}
          />
        )}
      </Show>
    </div>
  );
};

export default PublicCartView;

const CartContent: Component<{
  token: string;
  cart: Cart;
  onChange: (cart: Cart | undefined) => void;
}> = (props) => {
  const navigate = useNavigate();
  const notifications = useNotifications();

  const [paymentConfig] = createResource(() =>
    request<PaymentConfig>("public/payment/config", Method.GET),
  );
  const [form] = createResource(() => props.cart.formId, fetchPublicForm);

  const provider = createMemo(() => {
    const config = loadedValue(paymentConfig);
    return config ? createPaymentProvider(config) : null;
  });
  const currencies = () => {
    const loaded = loadedValue(form);
    return loaded ? currenciesFor(loaded, props.cart.audience) : [];
  };
  const showDonation = () => loadedValue(form)?.disableDonation === false;

  const [editForm, { Form, Field }] = createForm<CartEditSchema>({
    validate: valiForm(cartEditSchema),
    validateOn: "change",
  });
  const edited = (name: keyof CartEditSchema) =>
    getValue(editForm, name, { shouldActive: false }) ?? "";

  const [busy, setBusy] = createSignal(false);
  const [paying, setPaying] = createSignal(false);
  const [cancellable, setCancellable] = createSignal(false);
  let cardCancel: AbortController | undefined;
  let restoreLocation: (() => void) | undefined;

  const isDraft = () => props.cart.status === "DRAFT";
  const balance = () => cartBalance(props.cart);

  const dirty = () =>
    isDraft() &&
    (parseDonation(edited("donation")) !== props.cart.donationCents ||
      edited("currencyCode") !== props.cart.currencyCode);

  const hasUnsavedEdits = () => editForm.dirty && dirty();

  const onlineAvailable = () =>
    Boolean(provider()) && props.cart.onlinePayable && !dirty();

  const onlineUnavailable = () =>
    Boolean(provider()) &&
    !props.cart.onlinePayable &&
    !props.cart.paymentPending &&
    !cartSettled(props.cart) &&
    balance() > 0;

  createEffect(() => {
    const initialValues: CartEditSchema = {
      currencyCode: props.cart.currencyCode,
      donation:
        props.cart.donationCents > 0
          ? centsToDecimal(props.cart.donationCents)
          : "",
    };

    if (!untrack(hasUnsavedEdits)) {
      reset(editForm, { initialValues });
    }
  });

  createEffect(() => {
    if (!props.cart.paymentPending) {
      return;
    }

    const timer = setInterval(refreshCart, PENDING_POLL_MS);
    onCleanup(() => clearInterval(timer));
  });

  // Restores the page URL once; a second call after navigating away would put the stale URL back.
  function restoreUrl() {
    restoreLocation?.();
    restoreLocation = undefined;
  }

  onCleanup(() => {
    cardCancel?.abort();
    restoreUrl();
  });

  async function refreshCart() {
    try {
      props.onChange(await fetchCart(props.token).catch(undefinedIfNotFound));
    } catch {
      // Keep the current cart; the next refresh tries again.
    }
  }

  async function handleUpdate(values: CartEditSchema) {
    const parsed = v.parse(cartEditSchema, values);

    setBusy(true);
    await runAction({
      action: () =>
        request<Cart>(cartPath(props.token), Method.PUT, undefined, {
          currencyCode: parsed.currencyCode,
          sessionIds: props.cart.sessions.map((line) => line.itemId),
          mealIds: props.cart.meals.map((line) => line.itemId),
          dietaryPreference: props.cart.dietaryPreference,
          donationCents: parseDonation(parsed.donation),
        }),
      notify: notifications,
      onSuccess: (updated) => {
        props.onChange(updated);
        notifications.info("Inscripción actualizada");
      },
      onConflict: refreshCart,
    });
    setBusy(false);
  }

  async function handlePayInPerson() {
    setBusy(true);
    await runAction({
      action: () =>
        request<SubmitRegistrationResponse>(
          cartPath(props.token, "/submit"),
          Method.POST,
        ),
      notify: notifications,
      onSuccess: () => navigate(`/registrations/${props.token}/qr`),
      onConflict: refreshCart,
    });
    setBusy(false);
  }

  const submitCardPayment = (payment: CardPayment) =>
    request<PayResponse>(
      cartPath(props.token, "/pay"),
      Method.POST,
      undefined,
      payment,
    );

  function handlePaymentResult(result: PayResponse) {
    if (result.status === "PAID") {
      navigate(`/registrations/${props.token}/qr`);
      return;
    }
    if (result.status === "PROCESSING") {
      notifications.info(result.message);
      refreshCart();
      return;
    }
    notifications.error(result.message);
  }

  async function handlePayOnline() {
    const active = provider();
    if (!active) {
      return;
    }

    const cancel = new AbortController();
    cardCancel = cancel;
    restoreLocation = hideLocation();
    setPaying(true);
    await runAction({
      action: () =>
        chargeCard(
          active,
          {
            title: "Inscripción",
            amountCents: balance(),
            currencyCode: props.cart.currencyCode,
          },
          submitCardPayment,
          { signal: cancel.signal, onCancellable: setCancellable },
        ).finally(restoreUrl),
      notify: notifications,
      onSuccess: handlePaymentResult,
      onConflict: refreshCart,
    });
    setPaying(false);
  }

  return (
    <>
      <CartSummary cart={props.cart} />

      <Show when={isDraft()}>
        <Form class="box" onSubmit={handleUpdate}>
          <Field name="currencyCode">
            {(field, fieldProps) => (
              <Show when={currencies().length > 1}>
                <Select
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Moneda"
                  options={currencies().map((c) => ({
                    value: c.code,
                    label: c.displayName,
                  }))}
                />
              </Show>
            )}
          </Field>

          <Field name="donation">
            {(field, fieldProps) => (
              <Show when={showDonation()}>
                <MoneyInput
                  {...fieldProps}
                  value={field.value}
                  error={field.error}
                  label="Donación (opcional)"
                />
              </Show>
            )}
          </Field>

          <button
            type="submit"
            class="button"
            disabled={busy() || paying() || props.cart.paymentPending}
          >
            Actualizar
          </button>
        </Form>
      </Show>

      <div class="buttons">
        <Show
          when={isDraft()}
          fallback={
            <A
              class="button is-primary"
              href={`/registrations/${props.token}/qr`}
            >
              Ver mi código QR
            </A>
          }
        >
          <button
            type="button"
            class="button is-primary"
            classList={{ "is-loading": busy() }}
            disabled={
              busy() || paying() || props.cart.paymentPending || dirty()
            }
            onClick={handlePayInPerson}
          >
            Pagar en persona
          </button>
        </Show>

        <Show when={onlineAvailable()}>
          <button
            type="button"
            class="button is-link"
            classList={{ "is-loading": paying() }}
            disabled={busy() || paying()}
            onClick={handlePayOnline}
          >
            Pagar en línea ({formatCents(props.cart.currencyCode, balance())})
          </button>
          <Show when={cancellable()}>
            <button
              type="button"
              class="button is-light"
              onClick={() => cardCancel?.abort()}
            >
              Cancelar pago
            </button>
          </Show>
        </Show>
      </div>

      <Show when={dirty()}>
        <p class="help">
          Pulsa "Actualizar" para guardar tus cambios antes de continuar.
        </p>
      </Show>
      <Show when={onlineUnavailable()}>
        <p class="help">
          El pago en línea no está disponible para esta inscripción. Puedes
          pagar en persona.
        </p>
      </Show>
      <PaymentPendingNotice cart={props.cart} />
    </>
  );
};
