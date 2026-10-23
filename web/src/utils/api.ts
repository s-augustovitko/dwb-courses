import { BASE_URL } from "./constants";

export enum Method {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

type ApiRes<T> = {
  data: T;
  success: boolean;
  message: string;
};

export type PagedResponse<T> = {
  total: number;
  items: T[];
};

export const errorMessageMapping: Record<string, string> = {
  INVALID_LOGIN: "Correo o contraseña inválidos",
  BAD_REQUEST: "Datos del formulario inválidos, por favor revisa los campos",
  UNEXPECTED:
    "Ocurrió un error inesperado, por favor inténtalo de nuevo más tarde",
  UNAUTHORIZED: "Por favor inicia sesión para realizar esa acción",
  PERMISSION: "No tienes permisos para realizar esa acción",
  DUPLICATE: "Ya existe un elemento con esos datos",
  EMAIL_SEND:
    "No se pudo enviar el correo, por favor intenta enviarlo de nuevo",
  LAST_ADMIN: "No se puede modificar o eliminar al último administrador",
  NOT_FOUND: "El elemento solicitado no existe",
  CONFLICT:
    "No se puede realizar la acción en el estado actual. Actualiza la página e inténtalo de nuevo.",
  RATE_LIMIT:
    "Se excedió el límite de intentos, espera e inténtalo de nuevo más tarde",
};

/** An error answered by the API: `type` is its error code, `message` the Spanish copy. */
export class ApiError extends Error {
  constructor(
    readonly type: string,
    message = errorMessageMapping[type] ?? errorMessageMapping.UNEXPECTED,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isApiError = (err: unknown, type: string): boolean =>
  err instanceof ApiError && err.type === type;

/** For `.catch` on a lookup by URL id or token: a malformed one is a 400, an unknown one a 404. */
export function undefinedIfNotFound(err: unknown): undefined {
  if (isApiError(err, "NOT_FOUND") || isApiError(err, "BAD_REQUEST")) {
    return undefined;
  }
  throw err;
}

/** Spanish text for a failed request; anything that is not an ApiError gets the generic copy. */
export const errorText = (err: unknown): string =>
  err instanceof ApiError ? err.message : errorMessageMapping.UNEXPECTED;

let onUnauthorized: (() => void) | undefined;

export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

export async function request<T>(
  path: string,
  method: Method,
  query?: Record<string, string>,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && [Method.POST, Method.PUT, Method.PATCH].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const queryString = query ? new URLSearchParams(query).toString() : "";
  const url = `${BASE_URL}/${path}?${queryString}`;

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError("UNEXPECTED");
  }
  if (response.status === 401) onUnauthorized?.();

  let data: ApiRes<T>;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("UNEXPECTED");
  }

  if (!data.success || !response.ok) {
    throw new ApiError(data.message);
  }

  return data.data;
}
