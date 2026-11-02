"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  html: string;
  className?: string;
};

/** Lebar kertas A4 @ 96dpi — selaras dengan PDF worker & watermark html::before. */
const INVOICE_PAGE_WIDTH_PX = Math.round((210 * 96) / 25.4);
const A4_HEIGHT_PX = Math.round((297 * 96) / 25.4);

/** Preview invoice terisolasi dari Tailwind — HTML apiwin penuh di iframe. */
export default function InvoiceHtmlFrame({ html, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const available = el.clientWidth;
      if (available <= 0) return;
      setScale(Math.min(1, available / INVOICE_PAGE_WIDTH_PX));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scaledWidth = INVOICE_PAGE_WIDTH_PX * scale;
  const scaledHeight = A4_HEIGHT_PX * scale;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", overflow: "hidden" }}
    >
      <div
        style={{
          width: scaledWidth,
          height: scaledHeight,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <iframe
          title="Invoice"
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{
            width: INVOICE_PAGE_WIDTH_PX,
            height: A4_HEIGHT_PX,
            border: "none",
            background: "white",
            display: "block",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
