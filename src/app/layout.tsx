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
  title: {
    default: "AlphaLab | 한국 주식·부동산·매크로 투자 플랫폼",
    template: "%s | AlphaLab",
  },
  description: "실시간 한국 주식 히트맵, 서울 아파트 실거래가, 매크로 지표, 배당주 스크리너, 텔레그램 투자 피드를 한 곳에서. 블룸버그 스타일 한국 투자 플랫폼.",
  keywords: ["한국주식", "서울아파트", "실거래가", "배당주", "매크로지표", "주식스크리너", "투자플랫폼", "AlphaLab", "알파랩"],
  authors: [{ name: "AlphaLab" }],
  creator: "AlphaLab",
  metadataBase: new URL("https://thealphalabs.net"),
  alternates: {
    canonical: "https://thealphalabs.net",
  },
  openGraph: {
    title: "AlphaLab | 한국 주식·부동산·매크로 투자 플랫폼",
    description: "실시간 한국 주식 히트맵, 서울 아파트 실거래가, 매크로 지표, 배당주 스크리너, 텔레그램 투자 피드를 한 곳에서.",
    url: "https://thealphalabs.net",
    siteName: "AlphaLab",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AlphaLab - 한국 투자 플랫폼",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaLab | 한국 주식·부동산·매크로 투자 플랫폼",
    description: "실시간 한국 주식 히트맵, 서울 아파트 실거래가, 매크로 지표, 배당주 스크리너.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "G-QYC0DL6BE5",
    other: {
      "naver-site-verification": "276edcf0046e393815d75b118e52aa61548ab19c",
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head />
      <body
        className={`${inter.variable} ${geistMono.variable} ${notoSansKR.variable} ${rajdhani.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-QYC0DL6BE5" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-QYC0DL6BE5');
        `}</Script>
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
