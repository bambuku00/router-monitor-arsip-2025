"use client";

import type { InvoiceData } from "@/lib/invoice-data";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import { resolveInvoiceHtmlAssetsFromUrls } from "@/lib/invoice-preview-assets";
import { useEffect, useMemo, useState } from "react";
import InvoiceHtmlFrame from "./invoice-html-frame";

type Props = {
  data: InvoiceData;
};

export default function InvoiceTemplate({ data }: Props) {
  const [barcodeSrc, setBarcodeSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/settings/invoice/barcode?text=${encodeURIComponent(data.barcodeText)}`
    )
      .then((r) => r.json())
      .then((json: { dataUri?: string }) => {
        if (!cancelled && json.dataUri) setBarcodeSrc(json.dataUri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data.barcodeText]);

  const html = useMemo(() => {
    if (!barcodeSrc) return "";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const assets = resolveInvoiceHtmlAssetsFromUrls(
      origin,
      data.settings,
      barcodeSrc
    );
    return buildInvoiceHtml(data, assets);
  }, [data, barcodeSrc]);

  if (!html) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
        Memuat preview invoice...
      </div>
    );
  }

  return <InvoiceHtmlFrame html={html} />;
}
