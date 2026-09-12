import type { Metadata, Viewport } from 'next'
import 'primereact/resources/themes/lara-light-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import '../styles/tokens.css'
import '../styles/global.css'
import '../styles/shell.css'
import '../styles/ui-foundations.css'
import '../styles/modal.css'
import '../styles/admin.css'
import '../styles/cadastros.css'
import '../styles/dashboard.css'
import '../styles/analytics.css'
import '../styles/solicitation-workflow.css'
import '../styles/partial-shift.css'
import '../styles/accessibility.css'
import './next-shell.css'
import './prime-modernization.css'

export const metadata: Metadata = {
  title: 'Extra Cost Control | Unilog Express',
  description: 'Extra Cost Control — Unilog Express',
  icons: {
    icon: '/brand/unilog-favicon-red.svg',
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
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..700,0..1,0&display=block"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
