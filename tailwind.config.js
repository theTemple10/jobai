/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware token: resolves to white in dark mode, near-black in
        // light mode, and still supports Tailwind's opacity modifiers
        // (text-ink/50, bg-ink/5, border-ink/10, ...) via the CSS variable.
        ink: "rgb(var(--ink) / <alpha-value>)",
      },
    },
  },
  plugins: [],
}

