export function banksVisibleOnUnpaidInvoice<
  T extends { hideFromUnpaidInvoice?: boolean | null },
>(banks: T[]): T[] {
  return banks.filter((bank) => bank.hideFromUnpaidInvoice !== true);
}
