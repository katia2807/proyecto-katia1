import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeByTime } from "@/components/theme-by-time";
import { ToastProvider } from "@/components/ui/toast";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { VisualPreviewControls } from "@/components/visual-preview-controls";
import "./globals.css";
import "./appearance.css";
import "./visual-preview.css";
import "./update-tour.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Katia Suite",
  description: "Sistema de gestión privado para ventas, inventario, caja, cotizaciones y reportes.",
  openGraph: {
    title: "Katia Suite",
    description: "Sistema de gestión privado para su negocio.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const visualPreview = process.env.NODE_ENV === "development"
    && process.env.KATIA_VISUAL_PREVIEW === "1"
    && process.env.KATIA_USE_DEMO_DB === "1";
  return (
    <html
      lang="es"
      suppressHydrationWarning
      data-appearance="propuesta"
      data-visual-preview={visualPreview ? "true" : undefined}
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {visualPreview ? <script dangerouslySetInnerHTML={{ __html: `(function(){try{var a=localStorage.getItem('katia_visual_preview_style');if(a==='actual'||a==='propuesta')document.documentElement.dataset.appearance=a;}catch(e){}})();` }} /> : null}
        {/* Inline script prevents flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme_override');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{var h=new Date().getHours();document.documentElement.setAttribute('data-theme',h>=7&&h<19?'light':'dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {visualPreview ? <VisualPreviewControls /> : null}
        <ThemeByTime />
        <ToastProvider>{children}</ToastProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
