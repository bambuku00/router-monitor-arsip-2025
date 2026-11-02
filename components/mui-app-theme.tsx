"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useTheme } from "next-themes";
import { useMemo } from "react";

const DARK = {
  bg: "#2b2c40",
  card: "#323249",
  elevated: "#3a3b55",
  border: "#444564",
  text: "#dbdfea",
  textMuted: "#a5a8b8",
};

export default function MuiAppTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const theme = useMemo(
    () =>
      createTheme({
        palette: isDark
          ? {
              mode: "dark",
              background: {
                default: DARK.bg,
                paper: DARK.card,
              },
              text: {
                primary: DARK.text,
                secondary: DARK.textMuted,
              },
              divider: DARK.border,
            }
          : {
              mode: "light",
              background: {
                default: "#ffffff",
                paper: "#ffffff",
              },
            },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              html: {
                backgroundColor: isDark ? DARK.bg : "#ffffff",
              },
              body: {
                backgroundColor: isDark ? DARK.bg : "#ffffff",
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                backgroundColor: isDark ? DARK.elevated : undefined,
                color: isDark ? DARK.text : undefined,
                border: isDark ? `1px solid ${DARK.border}` : undefined,
              },
            },
          },
          MuiPopover: {
            styleOverrides: {
              paper: {
                backgroundColor: isDark ? DARK.card : undefined,
                color: isDark ? DARK.text : undefined,
                border: isDark ? `1px solid ${DARK.border}` : undefined,
              },
            },
          },
        },
      }),
    [isDark]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
