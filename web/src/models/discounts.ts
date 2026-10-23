import type { Price } from "./prices";

export type DiscountType =
  | "OTHER"
  | "ALL_SESSIONS"
  | "EARLY_BIRD"
  | "MEALS_INCLUDED";

export const discountTypeMap: Record<DiscountType, string> = {
  ALL_SESSIONS: "Todas las sesiones",
  EARLY_BIRD: "Preventa",
  MEALS_INCLUDED: "Comidas incluidas",
  OTHER: "Manual",
};

export const discountTypeOptions = (
  Object.keys(discountTypeMap) as DiscountType[]
).map((item) => ({
  value: item,
  label: discountTypeMap[item],
}));

export type Discount = {
  id: string;
  discountType: DiscountType;
  name: string;
  hintText: string;
  sortOrder: number;
  cutoffDate?: string;
  isActive: boolean;
  prices: Price[];
};
