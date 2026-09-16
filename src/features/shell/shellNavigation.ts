import { type AuthUser } from '@/services/authService'

export type Section = 'dashboard' | 'solicitacoes' | 'fechamentos' | 'cadastros' | 'usuarios'

export type NavItem = {
  key: Section
  label: string
  icon: string
  administrative?: boolean
  ownerOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Visão geral', icon: 'pi pi-chart-bar' },
  { key: 'solicitacoes', label: 'Solicitações', icon: 'pi pi-receipt' },
  { key: 'fechamentos', label: 'Fechamentos', icon: 'pi pi-wallet', administrative: true },
  { key: 'cadastros', label: 'Cadastros', icon: 'pi pi-sliders-h', administrative: true },
  { key: 'usuarios', label: 'Usuários', icon: 'pi pi-users', administrative: true, ownerOnly: true },
]

export const SECTION_COPY: Record<Section, { title: string; scope: string }> = {
  dashboard: { title: 'Visão geral', scope: 'Executivo · Custos extras' },
  solicitacoes: { title: 'Solicitações', scope: 'Custos extras' },
  fechamentos: { title: 'Fechamentos', scope: 'Administrativo · Financeiro' },
  cadastros: { title: 'Cadastros', scope: 'Administrativo · Catálogos' },
  usuarios: { title: 'Usuários', scope: 'Owner · Gestão de acessos' },
}

export function canAccess(user: AuthUser, item: NavItem) {
  if (item.ownerOnly) return user.profile === 'OWNER'
  if (item.administrative) return user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
  return true
}

export function canNavigate(user: AuthUser, section: Section) {
  const item = NAV_ITEMS.find((candidate) => candidate.key === section)
  return item ? canAccess(user, item) : false
}

export function profileLabel(profile: string) {
  if (profile === 'OWNER') return 'Owner'
  if (profile === 'ADMINISTRATIVO') return 'Administrativo'
  return 'Operacional'
}
