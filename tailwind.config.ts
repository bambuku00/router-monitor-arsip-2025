import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        theme: {
          bg: "rgb(var(--background) / <alpha-value>)",
          fg: "rgb(var(--foreground) / <alpha-value>)",
          "fg-muted": "rgb(var(--foreground-muted) / <alpha-value>)",
          card: "rgb(var(--card) / <alpha-value>)",
          elevated: "rgb(var(--elevated) / <alpha-value>)",
          border: "rgb(var(--border) / <alpha-value>)",
          muted: "rgb(var(--muted) / <alpha-value>)",
        },
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(.5, .85, .25, 1.8)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config