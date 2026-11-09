import type { Metadata } from "next";
import { Overpass, Overpass_Mono, Public_Sans } from "next/font/google";
import { Suspense, type ReactElement } from "react";
import { DocumentLang } from "@/i18n/DocumentLang";
import { INTL_TAGS } from "@/i18n/locales";
import { getLocale } from "@/i18n/server";
import "./globals.css";

// "Toll ticket" (docs/DESIGN.md): Overpass comes from US highway signage and sets headings, labels and buttons;
// Overpass Mono sets ticket numbers, amounts and dates; Public Sans keeps the long text (messages, help) easy to read.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
});

const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tollgate",
  description:
    "Catch scope creep in client messages and bill it with PayPal before you do the extra work.",
};

// The static shell says English; DocumentLang corrects it to the request's language (the visitor's choice, else English).
// suppressHydrationWarning: the attribute it changes before React hydrates.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${overpass.variable} ${overpassMono.variable} ${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <RequestLang />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

async function RequestLang(): Promise<ReactElement> {
  const locale = await getLocale();
  return <DocumentLang lang={INTL_TAGS[locale]} />;
}
