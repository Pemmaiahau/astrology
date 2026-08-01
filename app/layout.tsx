import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jyotisha Studio — Professional Vedic Astrology",
  description:
    "High-precision Vedic astrology: South Indian charts, Vimshottari dasha, Bhava Chalit, Ashtakavarga, Panchang and professional-grade interpretation.",
};

/**
 * Applies the stored theme before first paint (no flash). Light is the
 * default; the dark toggle preserves the app's original indigo/amber look.
 * Falls back to the OS preference when nothing is stored.
 */
const themeScript = `
try {
  var t = localStorage.getItem("jyotisha.theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
