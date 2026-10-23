import type { CurrencyRef, Price } from "~/models";
import { MAX_CENTS } from "./constants";

export function formatCents(currency: string, cents: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    cents / 100,
  );
}

type WithPrices = {
  prices: Price[];
};
export function priceDisplay(
  withPrices: WithPrices,
  currencies: CurrencyRef[],
): string {
  return currencies
    .map((currency) => {
      const price = withPrices.prices.find(
        (p) => p.currencyCode === currency.code,
      );
      return price
        ? formatCents(currency.code, price.amountCents)
        : `${currency.code}: falta precio`;
    })
    .join(", ");
}

export function getPricesOrDefault(
  currencies: CurrencyRef[],
  withPrices: WithPrices | null,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const currency of currencies) {
    const existing = withPrices?.prices.find(
      (p) => p.currencyCode === currency.code,
    );
    out[currency.code] = centsToDecimal(existing?.amountCents ?? 0);
  }

  return out;
}

const DECIMAL_INPUT = /^\d{1,7}([.]\d{1,2})?$/;

export function parseMoneyToCents(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!DECIMAL_INPUT.test(trimmed)) return null;

  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= MAX_CENTS ? cents : null;
}

/** Strips what can't be part of a money amount as it is typed (max 2 decimals). */
export function sanitizeMoneyText(text: string): string {
  const [whole = "", ...rest] = text
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .split(".");
  const wholeDigits = whole.slice(0, 7);
  return rest.length > 0
    ? `${wholeDigits}.${rest.join("").slice(0, 2)}`
    : wholeDigits;
}

/** One price per form currency, since the API replaces the whole list. */
export function toPriceList(
  prices: Record<string, string>,
  currencies: CurrencyRef[],
): Price[] {
  return currencies.map((currency) => ({
    currencyCode: currency.code,
    amountCents: parseMoneyToCents(prices[currency.code] ?? "0") ?? 0,
  }));
}

export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
