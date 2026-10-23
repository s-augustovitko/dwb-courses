import type { Price } from "~/models";

export type DatedItemConfig = {
  path: "session" | "meal";
  dateKey: "sessionDate" | "mealDate";
  withTime: boolean;
  activeParam: string;
  title: string;

  // labels
  singular: string;
  plural: string;
};

export const sessionConfig: DatedItemConfig = {
  path: "session",
  dateKey: "sessionDate",
  withTime: true,
  activeParam: "sessionsActive",
  title: "Sesiones",
  singular: "sesión",
  plural: "sesiones",
};

export const mealConfig: DatedItemConfig = {
  path: "meal",
  dateKey: "mealDate",
  withTime: false,
  activeParam: "mealsActive",
  title: "Comidas",
  singular: "comida",
  plural: "comidas",
};

export type DatedItem = {
  id: string;
  name: string;
  hintText: string;
  sortOrder: number;
  isActive: boolean;
  prices: Price[];
  date: string;
};

export const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
