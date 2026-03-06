import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { LangProvider } from "@/lib/LangContext";
import { AuthProvider } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import TopTickerBar from "@/components/TopTickerBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alphalab | AI-Powered Investment Community",
  description:
    "AI-powered investment community for alpha seekers. Chart analysis, predictions, portfolio tracking, and more.",
  openGraph: {
    title: "Alphalab | AI-Powered Investment Community",
    description:
      "AI-powered investment community for alpha seekers. Chart analysis, predictions, portfolio tracking, and more.",
    url: "https://alphalab-kappa.vercel.app",
    siteName: "Alphalab",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alphalab | AI-Powered Investment Community",
    description:
      "AI-powered investment community for alpha seekers. Chart analysis, predictions, portfolio tracking, and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <LangProvider>
            <TopTickerBar />
            {children}
            <AuthModal />
          </LangProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
