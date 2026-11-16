export type AccessRole = 'OWNER' | 'ADMIN' | 'VISUALIZADOR'
export type AccessProfile = { email: string; name?: string; role: AccessRole; modules: string[] }
/** Registro da aba Cadastros com problema (linha da planilha para correção na origem). */
export type QualityIssue = { row: number; id: string; name: string; module: string; type: 'DUPLICADO' | 'INVALIDO'; reason: string }
export interface Employee {
  id: string
  name: string
  role: string
  area: string
  admission: string
  costCenter: string
  status: string
  client: string
  shift: string
  supervisorId: string
  supervisor: string
  /** ID do encarregado (coluna S da aba Cadastros). Vazio em fontes antigas. */
  leadId?: string
  lead: string
  module: string
  process: string
}
export interface HubPayload {
  updatedAt: string
  source: 'google-sheets' | 'demo'
  employees: Employee[]
  profile: AccessProfile
  quality: { duplicateIds: number; invalidRows: number; issues?: QualityIssue[] }
}
/**
 * Filtros globais do quadro (valem em todas as telas e ficam visíveis na barra de filtros de cada uma).
 * Cada filtro aceita vários valores; lista vazia = todos. A busca por texto NÃO é global: é local da tela de
 * Colaboradores (antes, uma busca digitada lá continuava filtrando a Visão geral sem aparecer em lugar nenhum).
 */
export interface Filters {
  status: string[]
  module: string[]
  supervisor: string[]
  client: string[]
  costCenter: string[]
  shift: string[]
  role: string[]
}
export const filterKeys = ['status', 'module', 'supervisor', 'client', 'costCenter', 'shift', 'role'] as const
export const emptyFilters: Filters = {status:[],module:[],supervisor:[],client:[],costCenter:[],shift:[],role:[]}
