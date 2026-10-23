export type Price = {
  currencyCode: string;
  amountCents: number;
};

export type PricedItem = {
  name: string;
  prices: Price[];
};
