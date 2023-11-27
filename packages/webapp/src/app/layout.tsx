import type { Metadata, Viewport } from "next";

import { Roboto } from "next/font/google";

import AppBar from "@/components/AppBar";
import ConfigProvider from "@/components/Config";
import { config } from "@/modules/api";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={roboto.className}>
        <ConfigProvider config={await config()}>
          <AppBar />
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
