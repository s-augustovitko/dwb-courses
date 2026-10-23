import type {
  Cart,
  PublicCountry,
  PublicForm,
  PublicFormSummary,
} from "~/models";
import { Method, request } from "~/utils";

export const cartPath = (token: string, suffix = "") =>
  `public/registration/${encodeURIComponent(token)}${suffix}`;

export const fetchCart = (token: string) =>
  request<Cart>(cartPath(token), Method.GET);

export const fetchPublicForms = () =>
  request<PublicFormSummary[]>("public/form", Method.GET);

export const fetchPublicForm = (id: string) =>
  request<PublicForm>(`public/form/${encodeURIComponent(id)}`, Method.GET);

export const fetchCountries = () =>
  request<PublicCountry[]>("public/country", Method.GET);
