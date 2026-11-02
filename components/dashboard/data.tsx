import PembayaranBulanChart from "@/components/dashboard/pembayaran-bulan-chart";
import { hasStaffMenuAccess } from "@/lib/staff-menu-access";
import { DashboardStats } from "@/lib/server-actions/dashboard/actions";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { cn, formatCurrency } from "@/lib/utils";
import { RoleName } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  TbAlertTriangle,
  TbArrowRight,
  TbChartPie,
  TbPackage,
  TbReceipt,
  TbReportMoney,
  TbRouter,
  TbServer,
  TbServer2,
  TbUsers,
  TbWallet,
} from "react-icons/tb";

type Props = {
  stats: DashboardStats;
  user: {
    id: number;
    role: RoleName;
    nama?: string;
    parentId?: number | null;
    staffMenuKeys?: unknown;
  };
};

type LabelColor = "primary" | "success" | "danger" | "info" | "warning" | "secondary";

/** Palet dashboard OLT — biru info, hijau online, oranye peringatan, merah alert */
const OLT = {
  header: "#343a40",
  primary: "#007bff",
  success: "#28a745",
  warning: "#fd7e14",
  danger: "#dc3545",
  secondary: "#6c757d",
} as const;

const OLT_SOLID: Record<LabelColor, string> = {
  primary: OLT.primary,
  success: OLT.success,
  danger: OLT.danger,
  info: OLT.primary,
  warning: OLT.warning,
  secondary: OLT.secondary,
};

const LABEL: Record<LabelColor, string> = {
  primary: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  success: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300",
  danger: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  info: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  warning: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  secondary: "bg-slate-100 text-slate-600 dark:bg-theme-elevated dark:text-slate-300",
};

const BADGE: Record<LabelColor, string> = {
  primary: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  warning: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  secondary: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-theme-elevated dark:text-slate-300 dark:border-theme-border",
};

const OLT_PANEL =
  "rounded-md overflow-hidden shadow-md border border-slate-200/60 dark:border-theme-border bg-white dark:bg-theme-card h-full flex flex-col";

function OltPanelHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 text-white px-4 py-2.5 shrink-0"
      style={{ backgroundColor: OLT.header }}
    >
      <h3 className="text-sm font-medium truncate">{title}</h3>
      {action}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  footerLeft,
  footerRight,
  href,
  hrefLabel,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  color: LabelColor;
  footerLeft?: string;
  footerRight?: string;
  href?: string;
  hrefLabel?: string;
}) {
  const solid = OLT_SOLID[color];
  const valueStr = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const valueLarge = valueStr.length <= 8;
  const rightFooter = footerRight ?? (href && hrefLabel ? hrefLabel : undefined);

  return (
    <div className="rounded-md overflow-hidden shadow-md border border-slate-200/60 dark:border-theme-border bg-white dark:bg-theme-card h-full">
      <div
        className="relative px-3.5 pt-3.5 pb-10 min-h-[112px]"
        style={{ backgroundColor: solid }}
      >
        <div className="text-white/90 [&_svg]:size-7">{icon}</div>
        <div
          className={cn(
            "absolute top-2.5 right-3 font-bold text-white tabular-nums leading-none tracking-tight",
            valueLarge ? "text-[2rem]" : "text-lg"
          )}
        >
          {value}
        </div>
        <p className="absolute bottom-3 right-3.5 text-[11px] font-medium text-white text-right leading-snug max-w-[70%]">
          {title}
        </p>
      </div>
      {(footerLeft || rightFooter) && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-theme-card">
          {footerLeft ? (
            <span
              className="text-[11px] font-medium truncate min-w-0"
              style={{ color: solid }}
            >
              {footerLeft}
            </span>
          ) : (
            <span />
          )}
          {rightFooter ? (
            href ? (
              <Link
                href={href}
                className="text-[11px] font-medium hover:underline shrink-0 inline-flex items-center gap-0.5"
                style={{ color: solid }}
              >
                {rightFooter}
                <TbArrowRight className="size-3" />
              </Link>
            ) : (
              <span
                className="text-[11px] font-medium shrink-0"
                style={{ color: solid }}
              >
                {rightFooter}
              </span>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}

function CardSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={OLT_PANEL}>
      <OltPanelHeader title={title} action={action} />
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

function SummaryRow({
  icon,
  color,
  title,
  badge,
  subtitle,
}: {
  icon: ReactNode;
  color: LabelColor;
  title: string;
  badge: ReactNode;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5 last:mb-0">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          LABEL[color]
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h6 className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</h6>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border",
              BADGE[color]
            )}
          >
            {badge}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function ListRow({
  initial,
  color,
  title,
  subtitle,
  badge,
  badgeColor = "primary",
}: {
  initial: string;
  color: LabelColor;
  title: string;
  subtitle?: string;
  badge: ReactNode;
  badgeColor?: LabelColor;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 last:mb-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            LABEL[color]
          )}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <h6 className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{title}</h6>
          {subtitle ? (
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border",
          BADGE[badgeColor]
        )}
      >
        {badge}
      </span>
    </div>
  );
}

const DASHBOARD_PREVIEW_LIMIT = 5;

export default function DashboardData({ stats, user }: Props) {
  const isSuperadmin = user.role === "Superadmin";
  const showTagihan =
    user.role === "Superadmin" ||
    user.role === "Admin" ||
    user.role === "Keuangan";
  const showPembayaranLink = hasStaffMenuAccess(user, "pembayaran");
  const showPembayaranMitraLink =
    isSuperadmin && hasStaffMenuAccess(user, "pembayaran_mitra");
  const showPaketLink = hasStaffMenuAccess(user, "paket");
  const showRoutersLink = hasStaffMenuAccess(user, "routers");
  const showPembukuanLink = hasStaffMenuAccess(user, "pembukuan");
  const showUsersLink = hasStaffMenuAccess(user, "users");

  const pembayaranUserId = getOwnedResourcesUserId({
    id: user.id,
    role: user.role,
    parentId: user.parentId ?? undefined,
  });

  const pembayaranHref = isSuperadmin
    ? "/pembayaran/mitra"
    : `/pembayaran/${pembayaranUserId}`;

  const bulanSingkat = stats.bulanLabel.split(" ")[0];
  const collectionPct =
    stats.tagihanTotal > 0
      ? Math.round((stats.tagihanTerbayar / stats.tagihanTotal) * 100)
      : 0;

  const mitraCollectionPct =
    stats.pembayaranMitra && stats.pembayaranMitra.total > 0
      ? Math.round(
          (stats.pembayaranMitra.terbayar / stats.pembayaranMitra.total) * 100
        )
      : 0;

  const avgPelangganPerRouter =
    stats.routerCount > 0
      ? (stats.pelangganAktif / stats.routerCount).toFixed(1)
      : "0";

  const routerPreviewLimit = isSuperadmin ? DASHBOARD_PREVIEW_LIMIT : 8;

  const routersByPelanggan = [...stats.routers]
    .sort((a, b) => b.pelanggan - a.pelanggan)
    .slice(0, routerPreviewLimit);

  const routersPppIssueAll = stats.routers
    .filter((r) => r.pppBelumInput > 0)
    .sort((a, b) => b.pppBelumInput - a.pppBelumInput);

  const routersPppIssue = routersPppIssueAll.slice(0, DASHBOARD_PREVIEW_LIMIT);

  const mitraBreakdownAll = stats.mitraBreakdown ?? [];
  const mitraPreview = isSuperadmin
    ? [...mitraBreakdownAll]
        .sort(
          (a, b) =>
            b.tagihanMitraBelum - a.tagihanMitraBelum ||
            b.tagihanMitraTotal - a.tagihanMitraTotal ||
            a.nama.localeCompare(b.nama)
        )
        .slice(0, DASHBOARD_PREVIEW_LIMIT)
    : [];

  const statCards: ReactNode[] = [];

  if (isSuperadmin && stats.mitraCount != null) {
    statCards.push(
      <StatCard
        key="mitra"
        title="Mitra Aktif"
        value={stats.mitraCount}
        footerLeft="Admin terverifikasi"
        icon={<TbServer className="size-6" />}
        color="secondary"
        href={showUsersLink ? "/users" : undefined}
        hrefLabel="Kelola mitra"
      />
    );
  }

  statCards.push(
    <StatCard
      key="router"
      title="Router"
      value={stats.routerCount}
      footerLeft={
        isSuperadmin ? "Semua router mitra" : "Perangkat terdaftar"
      }
      icon={<TbRouter className="size-6" />}
      color="primary"
      href={showRoutersLink ? "/routers" : undefined}
      hrefLabel="Kelola router"
    />,
    <StatCard
      key="pelanggan"
      title="Total PPPoE"
      value={stats.pelangganAktif}
      footerLeft={`Total terdaftar: ${stats.pelangganTotal}`}
      icon={<TbUsers className="size-6" />}
      color="success"
    />
  );

  if (showTagihan && !isSuperadmin) {
    statCards.push(
      <StatCard
        key="tagihan"
        title={`Tagihan ${bulanSingkat}`}
        value={formatCurrency(stats.tagihanTotal)}
        footerLeft="Total bulan ini"
        icon={<TbWallet className="size-6" />}
        color="info"
        href={showPembayaranLink ? pembayaranHref : undefined}
        hrefLabel="Lihat pembayaran"
      />,
      <StatCard
        key="belum"
        title="Belum Terbayar"
        value={formatCurrency(stats.tagihanBelum)}
        footerLeft={`Terbayar: ${formatCurrency(stats.tagihanTerbayar)}`}
        footerRight={stats.tagihanTotal > 0 ? `${collectionPct}%` : undefined}
        icon={<TbReceipt className="size-6" />}
        color={stats.tagihanBelum > 0 ? "warning" : "success"}
      />
    );
  }

  if (isSuperadmin && stats.tagihanTotal > 0) {
    statCards.push(
      <StatCard
        key="tagihan-pelanggan"
        title={`Tagihan Pelanggan ${bulanSingkat}`}
        value={formatCurrency(stats.tagihanTotal)}
        footerLeft={`Semua mitra · ${stats.pelangganAktif} pelanggan aktif`}
        icon={<TbWallet className="size-6" />}
        color="info"
        href={showPembayaranMitraLink ? "/pembayaran/mitra" : undefined}
        hrefLabel="Lihat per mitra"
      />,
      <StatCard
        key="belum-pelanggan"
        title="Belum Terbayar"
        value={formatCurrency(stats.tagihanBelum)}
        footerLeft={`Terbayar: ${formatCurrency(stats.tagihanTerbayar)}`}
        footerRight={stats.tagihanTotal > 0 ? `${collectionPct}%` : undefined}
        icon={<TbReceipt className="size-6" />}
        color={stats.tagihanBelum > 0 ? "warning" : "success"}
      />
    );
  }

  if (isSuperadmin && stats.pembayaranMitra) {
    statCards.push(
      <StatCard
        key="tagihan-mitra"
        title={`Kewajiban Kantor ${bulanSingkat}`}
        value={formatCurrency(stats.pembayaranMitra.total)}
        footerLeft={`${stats.pembayaranMitra.count} mitra · bagi hasil + PPN`}
        icon={<TbReportMoney className="size-6" />}
        color="secondary"
        href={showPembayaranMitraLink ? "/pembayaran/mitra" : undefined}
        hrefLabel="Pembayaran mitra"
      />
    );
  }

  if (stats.pppBelumInput > 0) {
    statCards.push(
      <StatCard
        key="ppp"
        title="PPP Belum Input"
        value={stats.pppBelumInput}
        footerLeft="Secret tanpa data pelanggan, segera update"
        icon={<TbAlertTriangle className="size-6" />}
        color="danger"
      />
    );
  }

  const quickLinks = (
    isSuperadmin
      ? [
          showPembayaranMitraLink
            ? {
                href: "/pembayaran/mitra",
                label: "Pembayaran Mitra",
                icon: TbReportMoney,
                color: "success" as LabelColor,
              }
            : null,
          showUsersLink
            ? {
                href: "/users",
                label: "Kelola Mitra & User",
                icon: TbUsers,
                color: "primary" as LabelColor,
              }
            : null,
          showPembukuanLink
            ? {
                href: "/pembukuan",
                label: "Pembukuan Global",
                icon: TbChartPie,
                color: "warning" as LabelColor,
              }
            : null,
          showRoutersLink
            ? {
                href: "/routers",
                label: "Semua Router",
                icon: TbRouter,
                color: "info" as LabelColor,
              }
            : null,
        ]
      : [
          showRoutersLink
            ? {
                href: "/routers",
                label: "Kelola Router",
                icon: TbRouter,
                color: "primary" as LabelColor,
              }
            : null,
          showPaketLink
            ? {
                href: "/paket",
                label: "Kelola Paket",
                icon: TbPackage,
                color: "info" as LabelColor,
              }
            : null,
          showPembayaranLink
            ? {
                href: pembayaranHref,
                label: "Pembayaran",
                icon: TbReceipt,
                color: "success" as LabelColor,
              }
            : null,
          showPembukuanLink
            ? {
                href: "/pembukuan",
                label: "Pembukuan",
                icon: TbChartPie,
                color: "warning" as LabelColor,
              }
            : null,
        ]
  ).filter(Boolean) as {
    href: string;
    label: string;
    icon: typeof TbRouter;
    color: LabelColor;
  }[];

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Kartu statistik — satu baris di layar lebar */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-nowrap">
        {statCards.map((card, i) => (
          <div key={i} className="xl:flex-1 xl:min-w-0">
            {card}
          </div>
        ))}
      </div>

      {/* Grafik + ringkasan / ringkasan + tabel mitra */}
      <div className="grid gap-6 lg:grid-cols-12">
        {!isSuperadmin && showTagihan ? (
          <div className="lg:col-span-8">
            <PembayaranBulanChart
              data={stats.pembayaranHarian}
              bulanLabel={stats.bulanLabel}
            />
          </div>
        ) : null}

        <div className={isSuperadmin ? "lg:col-span-4" : "lg:col-span-4"}>
          <CardSection title="Statistik Ringkasan">
            {isSuperadmin && stats.tagihanTotal > 0 ? (
              <SummaryRow
                icon={<TbWallet className="size-4" />}
                color="primary"
                title="Penagihan Pelanggan"
                badge={`${collectionPct}%`}
                subtitle={`${formatCurrency(stats.tagihanTerbayar)} terbayar dari ${formatCurrency(stats.tagihanTotal)}`}
              />
            ) : null}
            {isSuperadmin && stats.pembayaranMitra ? (
              <SummaryRow
                icon={<TbReportMoney className="size-4" />}
                color="success"
                title="Kewajiban Mitra ke Kantor"
                badge={`${mitraCollectionPct}%`}
                subtitle={`${formatCurrency(stats.pembayaranMitra.terbayar)} terbayar dari ${formatCurrency(stats.pembayaranMitra.total)}`}
              />
            ) : null}
            {showTagihan && !isSuperadmin && stats.tagihanTotal > 0 ? (
              <SummaryRow
                icon={<TbWallet className="size-4" />}
                color="primary"
                title="Tingkat Penagihan"
                badge={`${collectionPct}%`}
                subtitle={`${formatCurrency(stats.tagihanTerbayar)} terbayar dari ${formatCurrency(stats.tagihanTotal)}`}
              />
            ) : null}
            <SummaryRow
              icon={<TbUsers className="size-4" />}
              color="success"
              title={
                isSuperadmin
                  ? "Rata-rata Pelanggan/Mitra"
                  : "Rata-rata Pelanggan/Router"
              }
              badge={
                isSuperadmin && stats.mitraCount
                  ? (stats.pelangganAktif / stats.mitraCount).toFixed(1)
                  : avgPelangganPerRouter
              }
              subtitle={
                isSuperadmin
                  ? `${stats.pelangganAktif} pelanggan di ${stats.mitraCount ?? 0} mitra`
                  : `${stats.pelangganAktif} pelanggan di ${stats.routerCount} router`
              }
            />
            <SummaryRow
              icon={<TbAlertTriangle className="size-4" />}
              color={stats.pppBelumInput > 0 ? "danger" : "success"}
              title="PPP Belum Input"
              badge={stats.pppBelumInput}
              subtitle={
                stats.pppBelumInput > 0
                  ? "Secret PPP perlu diinput ke pelanggan"
                  : "Semua PPP sudah terinput"
              }
            />

            <div className="border-t border-slate-100 dark:border-theme-border pt-4 mt-2">
              <h6 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-3">
                {isSuperadmin ? "Distribusi Global" : "Distribusi Router"}
              </h6>
              <div className="grid grid-cols-2 gap-3">
                {isSuperadmin ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: OLT.secondary }}
                    />
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Mitra Aktif</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {stats.mitraCount ?? 0}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: OLT.primary }}
                  />
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Router</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{stats.routerCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: OLT.success }}
                  />
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Total PPPoE</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{stats.pelangganAktif}</p>
                  </div>
                </div>
                {isSuperadmin && stats.tagihanTotal > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: OLT.success }}
                      />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Terbayar</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                          {formatCurrency(stats.tagihanTerbayar)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: OLT.warning }}
                      />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Belum Bayar</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                          {formatCurrency(stats.tagihanBelum)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : showTagihan ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: OLT.success }}
                      />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Terbayar</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                          {formatCurrency(stats.tagihanTerbayar)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: OLT.warning }}
                      />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Belum Bayar</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                          {formatCurrency(stats.tagihanBelum)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </CardSection>
        </div>

        {isSuperadmin ? (
          <div className="lg:col-span-8">
            <div className={OLT_PANEL}>
              <OltPanelHeader
                title="Ringkasan per Mitra"
                action={
                  showPembayaranMitraLink ? (
                    <Link
                      href="/pembayaran/mitra"
                      className="text-xs text-white/80 hover:text-white hover:underline shrink-0"
                    >
                      Pembayaran mitra
                    </Link>
                  ) : undefined
                }
              />
              <div className="p-5 overflow-x-auto flex-1">
                {mitraPreview.length > 0 ? (
                  <>
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-theme-border text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          <th className="pb-3 pr-4">Mitra</th>
                          <th className="pb-3 pr-4 text-right">Router</th>
                          <th className="pb-3 pr-4 text-right">Pelanggan</th>
                          <th className="pb-3 pr-4 text-right">Tagihan Pelanggan</th>
                          <th className="pb-3 pr-4 text-right">Kewajiban Kantor</th>
                          <th className="pb-3 text-right">Saldo Tagihan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mitraPreview.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-slate-50 dark:border-theme-border/60 last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <div className="font-medium text-slate-800 dark:text-slate-100">
                                {m.nama}
                              </div>
                              <div className="text-xs text-slate-500">@{m.user}</div>
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                              {m.routerCount}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                              {m.pelangganAktif}
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                              <Link
                                href={`/pembayaran/${m.id}`}
                                className="hover:text-sky-600 hover:underline"
                              >
                                {formatCurrency(m.tagihanPelangganTotal)}
                              </Link>
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums text-slate-700 dark:text-slate-200">
                              {formatCurrency(m.tagihanMitraTotal)}
                            </td>
                            <td className="py-3 text-right tabular-nums">
                              <span
                                className={cn(
                                  "font-medium",
                                  m.tagihanMitraBelum > 0
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-green-600 dark:text-green-400"
                                )}
                              >
                                {formatCurrency(m.tagihanMitraBelum)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {mitraBreakdownAll.length > DASHBOARD_PREVIEW_LIMIT ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                        +{mitraBreakdownAll.length - DASHBOARD_PREVIEW_LIMIT} mitra
                        lainnya · urut saldo tagihan tertinggi
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Belum ada mitra
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Detail data — 3 kolom */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Router by pelanggan */}
        <div className={OLT_PANEL}>
          <OltPanelHeader
            title={isSuperadmin ? "Router Seluruh Mitra" : "Router & Secret"}
            action={
              showRoutersLink ? (
                <Link
                  href="/routers"
                  className="text-xs text-white/80 hover:text-white hover:underline shrink-0"
                >
                  Lihat semua
                </Link>
              ) : undefined
            }
          />
          <div className="mx-5 mt-4 px-4 py-2.5 border-y border-slate-100 dark:border-theme-border bg-slate-50/50 dark:bg-theme-muted/20">
            <div className="flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span>Router</span>
              <span>Secret</span>
            </div>
          </div>
          <div className="p-5 pt-4 flex-1">
            {routersByPelanggan.length > 0 ? (
              <>
                {routersByPelanggan.map((r) => (
                  <ListRow
                    key={r.id}
                    initial={r.nama.charAt(0).toUpperCase()}
                    color="primary"
                    title={r.nama}
                    subtitle={
                      isSuperadmin && r.mitraNama
                        ? `${r.mitraNama} · ${r.host}`
                        : r.host
                    }
                    badge={`${r.pelanggan} Secret`}
                    badgeColor="primary"
                  />
                ))}
                {stats.routers.length > routerPreviewLimit ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    +{stats.routers.length - routerPreviewLimit} router lainnya ·
                    urut Secret terbanyak
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">
                Belum ada router
              </p>
            )}
          </div>
        </div>

        {/* PPP belum input */}
        <div className={OLT_PANEL}>
          <OltPanelHeader title="PPP Belum Input" />
          <div className="mx-5 mt-4 px-4 py-2.5 border-y border-slate-100 dark:border-theme-border bg-slate-50/50 dark:bg-theme-muted/20">
            <div className="flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span>Router</span>
              <span>PPP</span>
            </div>
          </div>
          <div className="p-5 pt-4 flex-1">
            {routersPppIssue.length > 0 ? (
              <>
                {routersPppIssue.map((r) => (
                  <ListRow
                    key={r.id}
                    initial={r.nama.charAt(0).toUpperCase()}
                    color="danger"
                    title={r.nama}
                    subtitle={r.host}
                    badge={`${r.pppBelumInput} PPP`}
                    badgeColor="danger"
                  />
                ))}
                {routersPppIssueAll.length > DASHBOARD_PREVIEW_LIMIT ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    +{routersPppIssueAll.length - DASHBOARD_PREVIEW_LIMIT} router
                    lainnya · urut PPP belum input terbanyak
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">
                Tidak ada PPP belum input
              </p>
            )}
          </div>
        </div>

        {/* Akses cepat + router actions */}
        <div className={OLT_PANEL}>
          <OltPanelHeader title="Akses Cepat" />
          <div className="p-5 space-y-2 flex-1">
            {quickLinks.map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-md border border-slate-100 dark:border-theme-border px-4 py-3 hover:bg-slate-50 dark:hover:bg-theme-muted/50 transition-colors"
              >
                <span
                  className="flex size-9 items-center justify-center rounded-md text-white shrink-0"
                  style={{ backgroundColor: OLT_SOLID[color] }}
                >
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{label}</span>
                <TbArrowRight className="size-4 text-slate-400" />
              </Link>
            ))}

            {!isSuperadmin && stats.routers.length > 0 ? (
              <div className="border-t border-slate-100 dark:border-theme-border pt-4 mt-4">
                <h6 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-3">
                  Router Terbaru
                </h6>
                {stats.routers.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 mb-3 last:mb-0"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-theme-elevated text-slate-600 dark:text-slate-300">
                      <TbServer2 className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.nama}</p>
                      <div className="flex gap-2 mt-1">
                        <Link
                          href={`/router/${r.id}`}
                          className="text-[11px] font-medium hover:underline"
                          style={{ color: OLT.primary }}
                        >
                          Performa
                        </Link>
                        <Link
                          href={`/router/${r.id}/ppp`}
                          className="text-[11px] font-medium text-slate-500 hover:underline"
                        >
                          PPPoE
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
