"use client";

import {
  formatRegulatoryPercent,
  DEFAULT_REGULATORY_SETTINGS,
} from "@/lib/regulatory-calc";

export type RegulatoryFormState = {
  bhpEnabled: boolean;
  bhpPercent: number;
  usoEnabled: boolean;
  usoPercent: number;
};

export const defaultRegulatoryFormState: RegulatoryFormState = {
  bhpEnabled: DEFAULT_REGULATORY_SETTINGS.bhpEnabled,
  bhpPercent: DEFAULT_REGULATORY_SETTINGS.bhpPercent,
  usoEnabled: DEFAULT_REGULATORY_SETTINGS.usoEnabled,
  usoPercent: DEFAULT_REGULATORY_SETTINGS.usoPercent,
};

type Props = {
  value: RegulatoryFormState;
  onChange: (next: RegulatoryFormState) => void;
  disabled?: boolean;
};

export default function RegulatorySettingsFields({
  value,
  onChange,
  disabled = false,
}: Props) {
  const totalPct =
    (value.bhpEnabled ? value.bhpPercent : 0) +
    (value.usoEnabled ? value.usoPercent : 0);

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-muted/30 p-3">
      <p className="text-sm font-medium">BHP / USO (setoran ISP)</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.bhpEnabled}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, bhpEnabled: e.target.checked })
            }
          />
          Aktifkan BHP
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.usoEnabled}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, usoEnabled: e.target.checked })
            }
          />
          Aktifkan USO
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Persentase BHP</label>
          <div className="flex items-center divide-x divide-slate-300">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              disabled={disabled || !value.bhpEnabled}
              value={value.bhpPercent}
              onChange={(e) =>
                onChange({
                  ...value,
                  bhpPercent: parseFloat(e.target.value) || 0,
                })
              }
              className="rounded-l-lg border border-slate-300 dark:border-theme-border px-2 py-1.5 text-sm flex-1 min-w-0 bg-white dark:bg-theme-bg"
            />
            <div className="rounded-r-lg text-xs px-1.5 flex items-center h-full bg-slate-200 dark:bg-theme-elevated">
              %
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Persentase USO</label>
          <div className="flex items-center divide-x divide-slate-300">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              disabled={disabled || !value.usoEnabled}
              value={value.usoPercent}
              onChange={(e) =>
                onChange({
                  ...value,
                  usoPercent: parseFloat(e.target.value) || 0,
                })
              }
              className="rounded-l-lg border border-slate-300 dark:border-theme-border px-2 py-1.5 text-sm flex-1 min-w-0 bg-white dark:bg-theme-bg"
            />
            <div className="rounded-r-lg text-xs px-1.5 flex items-center h-full bg-slate-200 dark:bg-theme-elevated">
              %
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
        Pendapatan kotor dihitung dari total tagihan bulanan mitra (sama halaman
        Pembayaran Mitra), terlepas sudah lunas atau belum tercatat.
      </p>

      <p className="text-xs text-slate-500 dark:text-theme-fg-muted">
        Tarif: BHP{" "}
        {value.bhpEnabled
          ? formatRegulatoryPercent(value.bhpPercent)
          : "nonaktif"}
        {" · "}
        USO{" "}
        {value.usoEnabled
          ? formatRegulatoryPercent(value.usoPercent)
          : "nonaktif"}
        {" · "}
        Total {formatRegulatoryPercent(totalPct)}
      </p>
    </div>
  );
}
