import type { Metadata, Viewport } from 'next'
import 'primereact/resources/themes/lara-light-indigo/theme.css'
import 'primereact/resources/primereact.min.css'
import 'primeicons/primeicons.css'
import '../styles/tokens.css'
import '../styles/global.css'
import '../styles/ui-foundations.css'
import '../styles/dashboard.css'
import '../styles/analytics.css'
import '../styles/solicitation-workflow.css'
import '../styles/partial-shift.css'
import '../styles/accessibility.css'
import './next-shell.css'
import './prime-modernization.css'
import './prime-refinement.css'
import './prime-analytics.css'
import './prime-workflow.css'
import './prime-cadastros.css'
import './prime-solicitations.css'
import './prime-dashboard.css'
import './prime-legacy-detox.css'
import './prime-responsive-records.css'
import './prime-request-filters.css'

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
      <body>{children}</body>
    </html>
  )
}
