import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p>Router Monitoring</p>
      </div>
    </main>
  );
}
