import CarouselImg from "@/components/auth/carousel-img";
import Downtime from "@/components/downtime";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // return <Downtime />;

  return (
    <main className="min-h-dvh grid items-center bg-red-500/70 dark:bg-red-950/80">
      <div className="flex h-full max-h-dvh justify-end text-slate-700 dark:text-theme-fg">
        <CarouselImg />
        <section className="flex h-dvh basis-full flex-col overflow-y-auto border border-slate-200 bg-slate-200 py-8 dark:border-theme-border dark:bg-theme-card sm:basis-96">
          {children}
        </section>
      </div>
    </main>
  );
}
