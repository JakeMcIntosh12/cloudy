import React from 'react'

export const metadata = {
  title: {
    absolute: "About Cloudhaus | Adelaide Visual Studio",
  },

  description:
    "Meet Cloudhaus, an Adelaide visual studio creating cinematic films and high-end photography for architecture, construction and design.",

  alternates: {
    canonical: "/About",
  },

  openGraph: {
    title: "About Cloudhaus | Adelaide Visual Studio",
    description:
      "Meet Cloudhaus, an Adelaide visual studio creating cinematic films and high-end photography for architecture, construction and design.",
    url: "/About",
    siteName: "Cloudhaus",
    images: [
      {
        url: "/Images/horizontal.png",
        width: 1200,
        height: 630,
        alt: "Cloudhaus — Adelaide Architectural & Construction Visual Studio",
      },
    ],
    locale: "en_AU",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "About Cloudhaus | Adelaide Visual Studio",
    description:
      "Meet Cloudhaus, an Adelaide visual studio creating cinematic films and high-end photography for architecture, construction and design.",
    images: ["/Images/horizontal.png"],
  },
};

export default function Layout({ children }) {
  return (
    <>
      {children}
    </>
  )
}