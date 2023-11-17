import type { Metadata, Viewport } from "next";

import { Roboto } from "next/font/google";

import AppBar from "@/components/AppBar";

import "./globals.scss";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PixelBin",
};

export const viewport: Viewport = {
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  width: "device-width",
  height: "device-height",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <AppBar />
        {children}
      </body>
    </html>
  );
}
