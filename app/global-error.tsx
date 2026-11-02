"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { push } = useRouter();
  useEffect(() => {
    // Expected 404 (resource not found or out of scope): do not log as error to avoid noisy dev output.
    if (error?.digest === "NEXT_NOT_FOUND") {
      if (process.env.NODE_ENV === "development") {
        console.debug("Resource not found or out of scope (404).");
      }
      return;
    }
    console.error(error);
  }, [error]);

  return (
    <div className="rounded shadow-md border">
      <h2>Oops! Terjadi kesalahan saat mengambil data.</h2>
      <p>
        Coba untuk{" "}
        <span
          onClick={() => reset()}
          className="hover:underline hover:text-blue-500"
        >
          refresh
        </span>{" "}
        atau{" "}
        <span
          onClick={() => push("/routers")}
          className="hover:underline hover:text-blue-500"
        >
          kembali ke menu utama.
        </span>
      </p>
    </div>
  );
}
