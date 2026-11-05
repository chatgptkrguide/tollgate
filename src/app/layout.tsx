import type { Metadata } from "next";
import { Literata, Public_Sans } from "next/font/google";
import { Suspense, type ReactElement } from "react";
import { DocumentLang } from "@/i18n/DocumentLang";
import { INTL_TAGS } from "@/i18n/locales";
import { getLocale } from "@/i18n/server";
import "./globals.css";

// Literata sets what the client wrote and the scope itself; Public Sans runs the interface.
const literata = Literata({
  variable: "--font-literata",
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

// The static shell says English; DocumentLang corrects it to the request's language (cookie, then Accept-Language).
// suppressHydrationWarning: the attribute it changes before React hydrates.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${literata.variable} ${publicSans.variable} h-full antialiased`}>
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
