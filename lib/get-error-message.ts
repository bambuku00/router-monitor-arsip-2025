const OBJECT_STRING = "[object Object]";

export function getErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan"
): string {
  if (typeof error === "string") return error;

  if (error instanceof Error && error.message) {
    if (error.message !== OBJECT_STRING) {
      return error.message;
    }
  } else if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;

    if (
      typeof value.message === "string" &&
      value.message !== OBJECT_STRING
    ) {
      return value.message;
    }
    if (typeof value.error === "string") return value.error;

    if (
      value.error &&
      typeof value.error === "object" &&
      typeof (value.error as Record<string, unknown>).message === "string"
    ) {
      return (value.error as Record<string, unknown>).message as string;
    }
  }

  return fallback;
}

/** Pesan error dari body JSON respons fetch API. */
export function getApiResponseErrorMessage(
  json: unknown,
  response: Pick<Response, "status">,
  fallback?: string
): string {
  return getErrorMessage(json, fallback ?? `Permintaan gagal (${response.status})`);
}

/** Lempar Error dengan pesan aman jika respons API pelanggan PPP gagal. */
export function throwIfPelangganApiFailed(
  response: Response,
  json: unknown,
  fallback?: string
): void {
  const body = json as { data?: { id?: number } } | null;
  if (response.ok && body?.data?.id != null) return;
  throw new Error(getApiResponseErrorMessage(json, response, fallback));
}
