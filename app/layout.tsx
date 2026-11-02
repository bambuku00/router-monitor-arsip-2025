import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import DevConsoleNotFoundGuard from "@/components/dev-console-not-found-guard";
import MuiAppTheme from "@/components/mui-app-theme";
import { ThemeProvider } from "@/components/theme-provider";

// const roboto = Roboto({
//   weight: ["100", "300", "400", "500", "700", "900"],
//   subsets: ["latin"],
//   display: "swap",
//   adjustFontFallback: false,
// });
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Router Monitoring",
  description: "Mikrotik router network monitoring application",
  icons: { icon: "/favicon.ico" },
};

/** Speed Insights memakai `/_vercel/speed-insights/script.js` — hanya ada di hosting Vercel. Di VPS tanpa itu browser dapat HTML 404 (MIME mismatch). */
const showSpeedInsights = process.env.VERCEL === "1";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.className} min-h-dvh bg-white dark:bg-theme-bg`}>
        <DevConsoleNotFoundGuard />
        <AppRouterCacheProvider options={{ enableCssLayer: true, nonce }}>
          <ThemeProvider nonce={nonce}>
            <MuiAppTheme>
              {children}
              <Toaster
                toastOptions={{
                  className: "dark:!bg-theme-card dark:!text-theme-fg dark:!border-theme-border",
                }}
              />
              {showSpeedInsights ? <SpeedInsights /> : null}
            </MuiAppTheme>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
