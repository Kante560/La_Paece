import type { Metadata, Viewport } from "next";
import { Caveat, Inter } from "next/font/google";
import Book from "@/components/Book";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", weight: ["500", "600", "700"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "La Paece — Discipline",
  description: "A behavioural and progress tracker.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "La Paece" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hand.variable} ${sans.variable}`}>
      <body>
        <ServiceWorker />
        <Book>{children}</Book>
        <InstallPrompt />
      </body>
    </html>
  );
}
