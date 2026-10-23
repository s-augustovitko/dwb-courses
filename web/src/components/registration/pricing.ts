import type { SwitchGroupOption } from "~/components/global";
import type {
  Cart,
  CartLine,
  PricedItem,
  PublicDiscount,
  PublicForm,
  PublicOption,
} from "~/models";
import {
  formatCalendarDate,
  formatCents,
  formatDateTime,
  parseMoneyToCents,
} from "~/utils";
import type { OrderLines } from "./OrderTable";

type Priced = Pick<PricedItem, "prices">;

export function priceIn(item: Priced, currencyCode: string): number {
  return (
    item.prices.find((p) => p.currencyCode === currencyCode)?.amountCents ?? 0
  );
}

function chosenOptions(
  options: PublicOption[],
  ids: string[],
  all: boolean,
): PublicOption[] {
  return all ? options : options.filter((o) => ids.includes(o.id));
}

/** Options that have no price in the currency cannot be ordered, discounts are not offered. */
export function isPriced(item: Priced, currencyCode: string): boolean {
  return item.prices.some((p) => p.currencyCode === currencyCode);
}

export const sumCents = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + line.amountCents, 0);

export const cartBalance = (cart: Cart) => cart.totalCents - cart.paidCents;

export const cartSettled = (cart: Cart) =>
  cart.status === "PAID" || cart.status === "PARTIALLY_REFUNDED";

export type Chosen = {
  currencyCode: string;
  sessionIds: string[];
  mealIds: string[];
  donationText: string;
  /** Staff price per item id: empty keeps the catalog price. */
  overrides?: Record<string, string | undefined>;
};

export type MissedDiscount = {
  discount: PublicDiscount;
  needsSessions: boolean;
  needsMeals: boolean;
};

function toLines(
  options: PublicOption[],
  ids: string[],
  all: boolean,
  chosen: Chosen,
  withTime: boolean,
): CartLine[] {
  return chosenOptions(options, ids, all).map((option) => {
    const override = chosen.overrides?.[option.id];
    return {
      manual: false,
      lineId: option.id,
      itemId: option.id,
      name: toSwitchOption(option, chosen.currencyCode, withTime).label,
      amountCents: override
        ? (parseMoneyToCents(override) ?? 0)
        : priceIn(option, chosen.currencyCode),
    };
  });
}

/**
 * The order the server will build. Mirrors internal/registration/autodiscounts.go:
 * discounts need every session (MEALS_INCLUDED also a meal, and is worth the meals)
 * and, in order, are capped so they never exceed the sessions and meals.
 */
export function estimateOrder(
  form: PublicForm,
  chosen: Chosen,
): { order: OrderLines; missed: MissedDiscount[] } {
  const { currencyCode } = chosen;
  const sessions = toLines(
    form.sessions,
    chosen.sessionIds,
    form.disableSessionSelection,
    chosen,
    true,
  );
  const meals = toLines(
    form.meals,
    chosen.mealIds,
    form.disableMealSelection,
    chosen,
    false,
  );
  const allSessions =
    sessions.length > 0 && sessions.length === form.sessions.length;

  const discounts: CartLine[] = [];
  const missed: MissedDiscount[] = [];
  // Sessions and meals not yet discounted; the donation never is.
  let remaining = sumCents(sessions) + sumCents(meals);

  for (const discount of form.discounts) {
    if (!isPriced(discount, currencyCode)) continue;

    const includesMeals = discount.discountType === "MEALS_INCLUDED";
    const needsMeals = includesMeals && meals.length === 0;
    if (!allSessions || needsMeals) {
      missed.push({ discount, needsSessions: !allSessions, needsMeals });
      continue;
    }

    const amountCents = Math.min(
      includesMeals ? sumCents(meals) : priceIn(discount, currencyCode),
      remaining,
    );
    remaining -= amountCents;
    if (amountCents > 0) {
      discounts.push({
        manual: false,
        lineId: discount.id,
        itemId: discount.id,
        name: discount.name,
        amountCents,
      });
    }
  }

  const donationCents = parseMoneyToCents(chosen.donationText) ?? 0;

  return {
    order: {
      currencyCode,
      sessions,
      meals,
      discounts,
      donationCents,
      totalCents: remaining + donationCents,
    },
    missed,
  };
}

/** e.g. "Elige todas las sesiones para obtener Preventa (- S/ 50.00, hasta el ...)". */
export function discountHint(missed: MissedDiscount, currencyCode: string) {
  const { discount } = missed;
  const needs = [
    missed.needsSessions && "todas las sesiones",
    missed.needsMeals && "al menos una comida",
  ]
    .filter(Boolean)
    .join(" y ");
  const details = [
    discount.discountType === "MEALS_INCLUDED"
      ? "tus comidas sin costo"
      : `- ${formatCents(currencyCode, priceIn(discount, currencyCode))}`,
    discount.cutoffDate &&
      `hasta el ${formatDateTime(discount.cutoffDate, "D [de] MMM [a las] HH:mm")}`,
  ]
    .filter(Boolean)
    .join(", ");

  return joinParts(
    `Elige ${needs} para obtener ${discount.name} (${details})`,
    discount.hintText,
  );
}

const joinParts = (...parts: string[]) => parts.filter(Boolean).join(" | ");

export function toSwitchOption(
  option: PublicOption,
  currencyCode: string,
  withTime: boolean,
): SwitchGroupOption {
  const priced = isPriced(option, currencyCode);

  return {
    value: option.id,
    label: joinParts(
      option.name,
      withTime
        ? formatDateTime(option.date, "ddd D [de] MMM | HH:mm")
        : formatCalendarDate(option.date, "ddd D [de] MMM"),
    ),
    subtitle: joinParts(
      priced
        ? formatCents(currencyCode, priceIn(option, currencyCode))
        : "Sin precio en esta moneda",
      option.hintText,
    ),
    disabled: !priced,
  };
}
