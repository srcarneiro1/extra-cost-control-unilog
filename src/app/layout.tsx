import type { Metadata, Viewport } from 'next'
import './generated/primereact-unilog-theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import './styles.css'
import './unilog-design-system.css'
import './component-geometry.css'
import './mobile-polish.css'
import './responsive-shell.css'
import './mobile-records.css'

export const metadata: Metadata = {
  title: 'Retrabalho | Unilog Express',
  description: 'Retrabalho — Unilog Express',
  icons: {
    icon: {
      url: '/brand/unilog-favicon-red.svg?v=20261005-1',
      type: 'image/svg+xml',
    },
    apple: {
      url: '/apple-touch-icon.png?v=20261005-1',
      sizes: '180x180',
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#171b24',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
