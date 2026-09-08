import {
  Geist,
  Geist_Mono,
  Plus_Jakarta_Sans,
  Fragment_Mono,
} from "next/font/google";
import "./globals.css";

import ClientFogWrapper from "@/components/react-three/ClientFogWrapper";
import TransitionOverlay from "@/components/PageTransitions/TransitionOverlay";
import FilmGrain from "@/components/react-three/FilmGrain";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const fragmentMono = Fragment_Mono({
  variable: "--font-fragment-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  metadataBase: new URL("https://steamhaus.vercel.app"),

  title: {
    default: "Cloudhaus | Architectural & Construction Photography & Film",
    template: "%s | Cloudhaus",
  },

  description:
    "Cloudhaus is an Adelaide visual studio creating high-end photography and cinematic films for architecture, construction and design.",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },

  openGraph: {
    title: "Cloudhaus | Architectural & Construction Photography & Film",
    description:
      "High-end photography and cinematic films for architecture, construction and design.",
    url: "https://steamhaus.vercel.app",
    siteName: "Cloudhaus",
    locale: "en_AU",
    type: "website",
    images: [
    {
      url: "/Images/horizontal.png",
      width: 1200,
      height: 630,
      alt: "Cloudhaus — Architectural & Construction Photography & Film",
    },
  ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Cloudhaus | Architectural & Construction Photography & Film",
    description:
      "High-end photography and cinematic films for architecture, construction and design.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} ${fragmentMono.variable} antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TransitionOverlay />
        <FilmGrain />

        <ClientFogWrapper />

        <div className="relative">
          {children}
        </div>
      </body>
    </html>
  );
}