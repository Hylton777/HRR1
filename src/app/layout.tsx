import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Princess Elizabeth Challenge Cup 2026 | Henley Royal Regatta",
  description:
    "Live bracket dashboard for the Princess Elizabeth Challenge Cup at Henley Royal Regatta 2026.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1419",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.className} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
