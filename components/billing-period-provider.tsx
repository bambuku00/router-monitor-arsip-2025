"use client";

import { createContext, useContext, useMemo } from "react";

const BillingPeriodContext = createContext<readonly string[] | null>(null);

export function BillingPeriodProvider({
  allowedMonths,
  children,
}: {
  allowedMonths: string[] | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => (allowedMonths?.length ? allowedMonths : null),
    [allowedMonths]
  );
  return (
    <BillingPeriodContext.Provider value={value}>
      {children}
    </BillingPeriodContext.Provider>
  );
}

/** null = tidak dibatasi; array = hanya YYYY-MM tersebut yang boleh dipilih. */
export function useBillingAllowedMonths(): readonly string[] | null {
  return useContext(BillingPeriodContext);
}
