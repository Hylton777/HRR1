import type { Metadata, Viewport } from "next";
import { Libre_Baskerville, Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

const libreBaskerville = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Princess Elizabeth Challenge Cup 2026 | Henley Royal Regatta",
  description:
    "Live bracket dashboard for the Princess Elizabeth Challenge Cup at Henley Royal Regatta 2026.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002147",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${libreBaskerville.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
