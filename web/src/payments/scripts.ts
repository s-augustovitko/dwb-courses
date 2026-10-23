import { PaymentError } from "./types";

const pending = new Map<string, Promise<void>>();

/** Loads a script once; the URL must be a fixed, trusted constant (never user input). */
export function loadScript(url: string): Promise<void> {
  const existing = pending.get(url);
  if (existing) return existing;

  const loading = new Promise<void>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = url;
    element.async = true;
    element.onload = () => resolve();
    element.onerror = () => {
      pending.delete(url);
      element.remove();
      reject(new PaymentError("No se pudo cargar el servicio de pagos"));
    };
    document.head.appendChild(element);
  });

  pending.set(url, loading);
  return loading;
}
