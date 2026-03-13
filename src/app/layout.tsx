import type { Metadata } from "next";
import { Inter, Geist_Mono, Noto_Sans_KR, Rajdhani, JetBrains_Mono } from "next/font/google";
import { LangProvider } from "@/lib/LangContext";
import { AuthProvider } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import Script from "next/script";
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

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
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
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-QYC0DL6BE5" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-QYC0DL6BE5');
        `}</Script>
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} ${notoSansKR.variable} ${rajdhani.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AuthProvider>
          <LangProvider>
            <div className="md:ml-56">{children}</div>
            <AuthModal />
          </LangProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
