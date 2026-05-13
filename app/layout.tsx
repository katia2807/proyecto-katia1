import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { ThemeByTime } from "@/components/theme-by-time";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP Proyecto Katia",
  description: "ERP privado para ventas, alquiler, caja, personal y reportes inmutables.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeByTime />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
