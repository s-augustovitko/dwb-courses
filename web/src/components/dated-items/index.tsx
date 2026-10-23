import type { Component } from "solid-js";
import type { CurrencyRef, PricedItem } from "~/models";
import { mealConfig, sessionConfig } from "./config";
import { DatedItemsSection } from "./DatedItemsSection";

type Props = {
  formId: string;
  currencies: CurrencyRef[];
  onItems?: (items: PricedItem[]) => void;
};

export const SessionsSection: Component<Props> = (props) => (
  <DatedItemsSection config={sessionConfig} {...props} />
);

export const MealsSection: Component<Props> = (props) => (
  <DatedItemsSection config={mealConfig} {...props} />
);
