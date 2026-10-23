import { A, useParams } from "@solidjs/router";
import QRCode from "qrcode";
import {
  type Component,
  createEffect,
  createResource,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";
import { BackButton } from "~/components/layout";
import {
  cartBalance,
  cartPath,
  cartSettled,
  fetchCart,
  PaymentPendingNotice,
} from "~/components/registration";
import type { SubmitRegistrationResponse } from "~/models";
import { formatCents, Method, request, undefinedIfNotFound } from "~/utils";

const QR_SIZE_PX = 256;
const LOGO_URL = "/dwb-logo.webp";
const LOGO_RATIO = 0.2; // level H recovers 30% of the code, so a 20% wide logo stays scannable
const LOGO_PAD_PX = 6;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function drawQr(canvas: HTMLCanvasElement, content: string) {
  const scale = window.devicePixelRatio || 1;
  await QRCode.toCanvas(canvas, content, {
    width: QR_SIZE_PX * scale,
    errorCorrectionLevel: "H",
  });
  canvas.style.width = `${QR_SIZE_PX}px`;
  canvas.style.height = `${QR_SIZE_PX}px`;

  const context = canvas.getContext("2d");
  const logo = await loadImage(LOGO_URL).catch(() => null);
  if (!context || !logo) {
    return; // the QR code stays valid without the logo
  }

  const center = canvas.width / 2;
  const size = Math.round(canvas.width * LOGO_RATIO);
  const offset = center - size / 2;

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(center, center, size / 2 + LOGO_PAD_PX * scale, 0, 2 * Math.PI);
  context.fill();
  context.drawImage(logo, offset, offset, size, size);
}

const PublicQrView: Component = () => {
  const params = useParams<{ token: string }>();

  const [qr] = createResource(
    () => params.token,
    (token) =>
      request<SubmitRegistrationResponse>(
        cartPath(token, "/qr"),
        Method.GET,
      ).catch(undefinedIfNotFound),
  );
  const [cart] = createResource(
    () => params.token,
    (token) => fetchCart(token).catch(undefinedIfNotFound),
  );

  const [canvas, setCanvas] = createSignal<HTMLCanvasElement>();
  createEffect(() => {
    const element = canvas();
    const url = qr()?.qrUrl;
    if (element && url) {
      drawQr(element, url).catch(() => undefined);
    }
  });

  return (
    <div>
      <BackButton href={`/registrations/${params.token}`} />

      <div class="has-text-centered">
        <Show
          when={qr()}
          fallback={
            <p>
              No encontramos tu inscripción confirmada. Revisa el enlace o abre{" "}
              <A href={`/registrations/${params.token}`}>tu carrito</A>.
            </p>
          }
        >
          <h1 class="title">Tu inscripción está confirmada</h1>
          <p class="subtitle">Aquí está tu código QR</p>
          <canvas
            ref={setCanvas}
            role="img"
            aria-label="Código QR de tu inscripción"
          />

          <Show when={cart()}>
            {(current) => (
              <Switch
                fallback={
                  <>
                    <p class="mt-4">Muestra este código al pagar en persona.</p>
                    <p class="title is-4 mt-2">
                      Saldo:{" "}
                      {formatCents(
                        current().currencyCode,
                        cartBalance(current()),
                      )}
                    </p>
                  </>
                }
              >
                <Match when={cartSettled(current())}>
                  <p class="mt-4">
                    Pago recibido. Muestra este código en el ingreso para
                    validar tu inscripción.
                  </p>
                </Match>
                <Match when={current().paymentPending}>
                  <PaymentPendingNotice cart={current()} />
                </Match>
              </Switch>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default PublicQrView;
