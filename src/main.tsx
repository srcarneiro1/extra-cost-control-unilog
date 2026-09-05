import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { setupRegistrationDateFilterLabels } from './utils/registrationDateFilterLabels'
import './styles/tokens.css'
import './styles/global.css'
import './styles/shell.css'
import './styles/ui-foundations.css'
import './styles/admin.css'
import './styles/responsive-tuning.css'
import './styles/partial-shift.css'
import './styles/accessibility.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento raiz da aplicação não encontrado.')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

setupRegistrationDateFilterLabels()
