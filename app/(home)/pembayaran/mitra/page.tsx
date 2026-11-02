import PageData from "@/components/pembayaran/page-data-mitra";
import { validateRequest } from "@/lib/auth";
import { requirePageAccess } from "@/lib/route-access";
import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Router Monitoring | Pembayaran Mitra",
  description: "List pembayaran mitra",
};

export default async function Mitra() {
  const { user } = await validateRequest();
  if (!user) return redirect("/login");
  requirePageAccess(user, "/pembayaran/mitra");

  return <PageData />;
}
