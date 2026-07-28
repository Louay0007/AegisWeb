import React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthSessionProvider } from "@/lib/auth/auth-session";
import { DataLayerProvider } from "@/lib/data-layer";
import { Toaster } from "@/components/ui/sonner";
import { ConsentAnalytics } from "@/components/consent-analytics";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AegisWeb",
  description:
    "AegisWeb is the identity, permission, approval, credential, and audit layer for AI agents acting on the web.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/images%20(2)/aegisweb_standalone_icon.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/images%20(2)/aegisweb_square_icon.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/images%20(2)/aegisweb_ios_app_icon.png",
        type: "image/png",
      },
    ],
    apple: "/images%20(2)/aegisweb_ios_app_icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading headers forces dynamic rendering so Next.js can stamp the per-request CSP nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <AuthSessionProvider>
            <DataLayerProvider>{children}</DataLayerProvider>
          </AuthSessionProvider>
        </ThemeProvider>
        <Toaster richColors closeButton />
        <ConsentAnalytics />
      </body>
    </html>
  );
}
