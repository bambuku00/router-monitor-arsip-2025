export type PembukuanRouterIncome = {
  id: number;
  nama: string;
  diterima: number;
  belum: number;
};

export function summarizeRouterIncome(
  bills: {
    routerId: number;
    routerNama: string;
    status: string;
    nominal: number;
  }[],
  routers: { id: number; nama: string }[]
): PembukuanRouterIncome[] {
  const byId = new Map<number, PembukuanRouterIncome>();
  for (const router of routers) {
    byId.set(router.id, {
      id: router.id,
      nama: router.nama,
      diterima: 0,
      belum: 0,
    });
  }
  for (const bill of bills) {
    const current = byId.get(bill.routerId) ?? {
      id: bill.routerId,
      nama: bill.routerNama,
      diterima: 0,
      belum: 0,
    };
    if (bill.status === "Terbayar") current.diterima += bill.nominal;
    else if (bill.status === "Belum") current.belum += bill.nominal;
    byId.set(bill.routerId, current);
  }
  return [...byId.values()].sort((a, b) => {
    const kotor = b.diterima + b.belum - (a.diterima + a.belum);
    return kotor || a.nama.localeCompare(b.nama, "id");
  });
}
