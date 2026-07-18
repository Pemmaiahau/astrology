import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jyotisha Studio — Professional Vedic Astrology",
  description:
    "High-precision Vedic astrology: South Indian charts, Vimshottari dasha, Bhava Chalit, Ashtakavarga, Panchang and professional-grade interpretation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
