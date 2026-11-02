import {
  formatUpdateDate,
  WEBSITE_UPDATES,
  WEBSITE_UPDATE_TAG_LABELS,
  type WebsiteUpdateTag,
} from "@/lib/website-updates";
import { cn } from "@/lib/utils";

const TAG_CLASS: Record<WebsiteUpdateTag, string> = {
  menu: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  fitur:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  perbaikan:
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
};

export default function PembaruanPageContent() {
  return (
    <div className="w-full max-w-3xl mx-auto pb-16">
      <header className="mb-8 text-center md:text-left">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-theme-fg">
          Pembaruan Website
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-theme-fg-muted max-w-xl">
          Ringkasan fitur baru, perubahan menu, dan perbaikan sistem. Cek
          halaman ini setelah update agar tidak ketinggalan.
        </p>
      </header>

      {WEBSITE_UPDATES.length === 0 ? (
        <p className="text-center text-slate-500 py-12">
          Belum ada catatan pembaruan.
        </p>
      ) : (
        <ol className="relative space-y-6 before:absolute before:left-[0.65rem] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-theme-border">
          {WEBSITE_UPDATES.map((entry, index) => (
            <li key={entry.id} className="relative pl-8">
              <span
                className={cn(
                  "absolute left-0 top-1.5 size-[1.35rem] rounded-full border-2 border-white dark:border-theme-bg",
                  index === 0
                    ? "bg-red-500 ring-2 ring-red-200 dark:ring-red-900"
                    : "bg-slate-300 dark:bg-theme-muted"
                )}
                aria-hidden
              />
              <article className="rounded-xl border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-card shadow-sm overflow-hidden">
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-theme-border/80 bg-slate-50/80 dark:bg-theme-elevated/50">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {index === 0 ? (
                      <span className="inline-flex items-center rounded-full bg-red-600 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                        Terbaru
                      </span>
                    ) : null}
                    {entry.tags?.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          "inline-flex items-center rounded-full border text-[10px] font-medium px-2 py-0.5",
                          TAG_CLASS[tag]
                        )}
                      >
                        {WEBSITE_UPDATE_TAG_LABELS[tag]}
                      </span>
                    ))}
                    {entry.categories?.map((category) => (
                      <span
                        key={category}
                        className="inline-flex items-center rounded-full border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-elevated text-[10px] font-medium text-slate-700 dark:text-theme-fg-muted px-2 py-0.5"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                  <time
                    dateTime={entry.date}
                    className="text-xs text-slate-500 dark:text-theme-fg-muted"
                  >
                    {formatUpdateDate(entry.date)}
                  </time>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-theme-fg mt-0.5">
                    {entry.title}
                  </h2>
                  {entry.summary ? (
                    <p className="text-sm text-slate-600 dark:text-theme-fg-muted mt-1">
                      {entry.summary}
                    </p>
                  ) : null}
                </div>

                <div className="px-4 py-4 sm:px-5 space-y-4">
                  {entry.sections.map((section) => (
                    <section key={section.heading}>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-theme-fg mb-2">
                        {section.heading}
                      </h3>
                      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-theme-fg-muted list-disc pl-5">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
