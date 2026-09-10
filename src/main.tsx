import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { enableProjectionTooltip } from './services/projectionTooltip'
import './styles/tokens.css'
import './styles/global.css'
import './styles/shell.css'
import './styles/ui-foundations.css'
import './styles/modal.css'
import './styles/admin.css'
import './styles/cadastros.css'
import './styles/dashboard.css'
import './styles/analytics.css'
import './styles/solicitation-workflow.css'
import './styles/partial-shift.css'
import './styles/accessibility.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento raiz da aplicação não encontrado.')
}

enableProjectionTooltip()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
