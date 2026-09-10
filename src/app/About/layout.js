import React from 'react'

export const metadata = {
  title: 'About Cloudhaus',
  description:
    'Cloudhaus is a visual studio creating cinematic films and photography for high-end architecture and construction.',
    openGraph: {
    title: 'About Cloudhaus',
    description:
      'Cloudhaus is a visual studio creating cinematic films and photography for high-end architecture and construction.',
    url: 'https://cloudhausmedia.com/About',
    siteName: 'Cloudhaus',
    images: [
      {
        url: 'https://cloudhausmedia.com/Assets/Logo/vertical-white-png.png',
        width: 1200,
        height: 630,
        alt: 'Jake McIntosh — Founder and Director of Cloudhaus',
      },
    ],
    locale: 'en_AU',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'About | Cloudhaus',
    description:
      'Cloudhaus is a visual studio creating cinematic films and photography for high-end architecture and construction.',
    images: ['https://cloudhausmedia.com/Assets/Logo/vertical-white-png.png'],
  },
}

export default function Layout({ children }) {
  return (
    <>
      {children}
    </>
  )
}