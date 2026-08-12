import type { Metadata, Viewport } from "next";
import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";
import { MobileEnvironment } from "@/components/kolibri-shell/mobile-environment";
import {
  KOLIBRI_THEME_STORAGE_KEY,
  KolibriThemeProvider,
} from "@/components/theme/kolibri-theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IdentityProvider } from "@/lib/identity/provider";
import { ModelCatalogProvider } from "@/lib/models/provider";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Колибри — AI-решение задач",
  description:
    "AI-помощник для решения задач: математика, объяснения по шагам, изображения, формулы, таблицы и документы.",
  applicationName: "Kolibri",
  keywords: [
    "Колибри",
    "AI решатель",
    "решение задач",
    "математика",
    "ИИ помощник",
    "решение по фото",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    title: "Колибри — AI-решение задач",
    description:
      "Решайте задачи обычным языком или по фото. Пошаговые объяснения, формулы, таблицы и история решений.",
    siteName: "Kolibri",
  },
  twitter: {
    card: "summary_large_image",
    title: "Колибри — AI-решение задач",
    description:
      "AI-помощник для решения задач, объяснений по шагам и работы с изображениями.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kolibri",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const dynamic = "force-dynamic";

const themeBootScript = `
(() => {
  try {
    const stored = localStorage.getItem(${JSON.stringify(KOLIBRI_THEME_STORAGE_KEY)});
    const preference =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    const resolved =
      preference === "system"
        ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-dvh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="h-dvh overflow-hidden font-sans">
        <MobileEnvironment />
        <KolibriThemeProvider>
          <IdentityProvider>
            <ModelCatalogProvider>
              <MyRuntimeProvider>
                <TooltipProvider delayDuration={350}>
                  {children}
                </TooltipProvider>
              </MyRuntimeProvider>
            </ModelCatalogProvider>
          </IdentityProvider>
        </KolibriThemeProvider>
      </body>
    </html>
  );
}
