export default function PppoePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#e6e9ee] text-slate-900 dark:bg-[#0e0e10] dark:text-slate-100">
      {children}
    </main>
  );
}
