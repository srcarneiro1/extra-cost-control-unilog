'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { MultiSelect } from 'primereact/multiselect'
import { Password } from 'primereact/password'
import { Tag } from 'primereact/tag'

type Profile = 'OPERACIONAL' | 'SUPERVISOR' | 'ADMIN' | 'CLIENTE'
type Section = 'lancamentos' | 'processos' | 'maoDeObra' | 'auditoria' | 'precos' | 'usuarios'

const PROFILE_OPTIONS = [
  { label: 'OPERACIONAL', value: 'OPERACIONAL' },
  { label: 'SUPERVISOR', value: 'SUPERVISOR' },
  { label: 'ADMIN', value: 'ADMIN' },
  { label: 'CLIENTE', value: 'CLIENTE' },
]

type ChargeStatus = 'ATIVOS' | 'CANCELADOS' | 'TODOS'

const CHARGE_STATUS_OPTIONS = [
  { label: 'Ativos', value: 'ATIVOS' },
  { label: 'Cancelados', value: 'CANCELADOS' },
  { label: 'Todos os status', value: 'TODOS' },
]

type LaborStatus = 'ATIVOS' | 'INATIVOS' | 'TODOS'

const LABOR_STATUS_OPTIONS = [
  { label: 'Ativos', value: 'ATIVOS' },
  { label: 'Inativados', value: 'INATIVOS' },
  { label: 'Todos os status', value: 'TODOS' },
]

function laborInactive(row: LaborRow) {
  return row.ativo === 'NAO'
}

const USER_STATUS_OPTIONS = [
  { label: 'Ativo', value: 'SIM' },
  { label: 'Inativo', value: 'NAO' },
]

type User = {
  matricula: string
  nome: string
  perfil: Profile
  trocaSenhaObrigatoria?: boolean
}

type Branch = {
  cnpj: string
  nomeCliente: string
  filial: string
  ativo: string
}

type Rework = {
  id: string
  requestId?: string
  dataEfetivacao: string
  sku: string
  descricao: string
  quantidade: number
  dataValidade: string
  nacionalizacao: number
  rfid: number
  validade: number
  tester?: number
  confeccao?: number
  numeroProcesso?: string
  idProcesso?: string
  idLote?: string
  precoTesterUnit?: number
  precoConfeccaoUnit?: number
  valorTester?: number
  valorConfeccao?: number
  totalEtiquetas: number
  idPreco: string
  precoNacionalizacaoUnit: number
  precoRfidAdicionalUnit: number
  precoValidadeUnit: number
  valorNacionalizacao: number
  valorRfidAdicional: number
  valorValidade: number
  valorTotalCobranca: number
  valorCobrancaEfetiva: number
  cobrancaCancelada: boolean
  canceladoEm: string
  canceladoPor: string
  motivoCancelamento: string
  cnpjCliente: string
  nomeCliente: string
  filial: string
  matriculaCriacao: string
  criadoEm: string
  matriculaAtualizacao?: string
  atualizadoEm?: string
  versao: number
}

type ProcessRow = {
  id: string
  requestId?: string
  numero: string
  cnpjCliente: string
  nomeCliente: string
  filial: string
  arquivoNome: string
  arquivoUrl: string
  qtdSkus: number
  qtdIgnorados: number
  matriculaCriacao: string
  criadoEm: string
}

type SkuOption = { sku: string; descricao: string }

type BatchLine = {
  sku: string
  descricao: string
  quantidade: number | null
  nacionalizacao: number | null
  rfid: number | null
  tester: number | null
  confeccao: number | null
}

const MAX_BATCH_SKUS = 100
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Regras por SKU (espelham o backend).
function lineError(line: { quantidade: number | null; nacionalizacao: number | null; rfid: number | null; tester: number | null; confeccao: number | null }) {
  const qtd = Number(line.quantidade || 0)
  const nat = Number(line.nacionalizacao || 0)
  const rfid = Number(line.rfid || 0)
  const tester = Number(line.tester || 0)
  const conf = Number(line.confeccao || 0)
  if (qtd < 1) return 'informe a quantidade retrabalhada'
  if (nat > qtd) return 'nacionalização maior que a quantidade retrabalhada'
  if (rfid > qtd) return 'RFID/ADIPAC maior que a quantidade retrabalhada'
  if (tester > qtd) return 'tester maior que a quantidade retrabalhada'
  if (nat + rfid + tester + conf <= 0) return 'informe ao menos um serviço'
  return null
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

type LaborRow = {
  id: string
  requestId?: string
  data: string
  cnpjCliente: string
  nomeCliente: string
  filial: string
  qtdCasa: number
  qtdTerceiros: number
  qtdTotal: number
  observacao: string
  matriculaCriacao: string
  criadoEm: string
  matriculaAtualizacao?: string
  atualizadoEm?: string
  versao: number
  ativo?: 'SIM' | 'NAO'
  inativadoEm?: string
  inativadoPor?: string
  motivoInativacao?: string
}

type ManagedUser = {
  matricula: string
  nome: string
  perfil: Profile
  ativo: 'SIM' | 'NAO'
  trocaSenhaObrigatoria: 'SIM' | 'NAO'
  versao: number
  cnpjs: string[]
}

type PriceRow = {
  id: string
  vigenciaInicio: string
  vigenciaFim: string
  valorNacionalizacao: number
  valorRfidAdicional: number
  valorValidade: number
  valorTester?: number
  valorConfeccao?: number
  ativo: string
  criadoEm: string
  criadoPor: string
  observacao: string
  versao: number
  requestId?: string
}

type AuditRow = {
  idAuditoria: string
  entidade: string
  idRegistro: string
  acao: string
  matriculaAutor: string
  dataHora: string
  versaoAnterior: string | number
  versaoNova: string | number
  dadosAntes: string
  dadosDepois: string
  origem: string
}

function createForm() {
  return {
    id: '',
    requestId: crypto.randomUUID(),
    dataEfetivacao: new Date(),
    sku: '',
    descricao: '',
    cnpjCliente: '',
    // Vazios por padrão: o usuário digita sem precisar apagar um 0.
    quantidade: null as number | null,
    nacionalizacao: null as number | null,
    rfid: null as number | null,
    tester: null as number | null,
    confeccao: null as number | null,
    numeroProcesso: '',
    versao: 0,
  }
}

function createBatchForm() {
  return {
    requestId: crypto.randomUUID(),
    dataEfetivacao: new Date(),
    idProcesso: '',
    skus: [] as string[],
    lines: [] as BatchLine[],
  }
}

function createUploadForm() {
  return {
    requestId: crypto.randomUUID(),
    numero: '',
    cnpjCliente: '',
    file: null as File | null,
  }
}

function createLaborForm() {
  return {
    id: '',
    requestId: crypto.randomUUID(),
    data: new Date(),
    cnpjCliente: '',
    qtdCasa: null as number | null,
    qtdTerceiros: null as number | null,
    observacao: '',
    versao: 0,
  }
}

function createPriceForm() {
  return {
    requestId: crypto.randomUUID(),
    vigenciaInicio: new Date(),
    valorNacionalizacao: 0.4100,
    valorRfidAdicional: 0.1900,
    // Transformação em tester: tarifa ainda não definida.
    valorTester: 0,
    valorConfeccao: 0.1500,
    observacao: '',
  }
}

function isoDate(value: Date | null) {
  if (!value) return ''
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromIso(value: string) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value
  const [y, m] = value.split('-').map(Number)
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
    .format(new Date(y, m - 1, 1))
  return month.charAt(0).toUpperCase() + month.slice(1) + ' ' + y
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function rateMoney(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })
}

// Atributos da célula para o modo cartão no celular (≤ 820 px):
// o rótulo vem da coluna, então incluir/remover colunas nunca desalinha os nomes.
type CellRole = 'title' | 'actions' | 'wide'
function cell(label: string, role?: CellRole) {
  const className = role === 'title' ? 'card-title' : role === 'actions' ? 'card-actions' : role === 'wide' ? 'card-wide' : undefined
  return { bodyCell: { 'data-label': label, className } as unknown as React.HTMLAttributes<HTMLTableCellElement> }
}

function intLabel(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return value || '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function cnpjLabel(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 14) return value
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

function branchLabel(branch: Branch) {
  return `${branch.nomeCliente} · ${branch.filial} · ${cnpjLabel(branch.cnpj)}`
}

const SIDEBAR_PREF_KEY = 'retrabalho-unilog:sidebar'
// ≤ 1100 px: drawer. 1101–1279 px: menu recolhido automaticamente. ≥ 1280 px: preferência do usuário.
const DRAWER_QUERY = '(max-width: 1100px)'
const COMPACT_QUERY = '(min-width: 1101px) and (max-width: 1279px)'

function readSidebarPref() {
  try { return localStorage.getItem(SIDEBAR_PREF_KEY) === 'collapsed' } catch { return false }
}

function writeSidebarPref(collapsed: boolean) {
  try { localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? 'collapsed' : 'expanded') } catch { /* sem storage */ }
}

// Meses (AAAA-MM) presentes nos registros, do mais recente para o mais antigo.
function monthsOf(values: string[]) {
  const seen: Record<string, true> = {}
  values.forEach(value => {
    const month = String(value || '').slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(month)) seen[month] = true
  })
  return Object.keys(seen).sort().reverse()
}

function csvCell(value: unknown) {
  let text = String(value == null ? '' : value)
  if (/^[=+\-@]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [
    headers.map(csvCell).join(';'),
    ...rows.map(row => row.map(csvCell).join(';')),
  ].join('\r\n')

  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [matricula, setMatricula] = useState('')
  const [senha, setSenha] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [section, setSection] = useState<Section>('lancamentos')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [items, setItems] = useState<Rework[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [allBranches, setAllBranches] = useState<Branch[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [clientBranchFilter, setClientBranchFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  // Filtro de mês dos perfis internos ('' = todos os meses).
  const [reworkMonth, setReworkMonth] = useState('')
  // Padrão: só cobranças ativas. Cancelados ficam acessíveis pelo filtro de status.
  const [chargeStatus, setChargeStatus] = useState<ChargeStatus>('ATIVOS')
  const [loading, setLoading] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [workspaceSlow, setWorkspaceSlow] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [baseConnected, setBaseConnected] = useState(false)
  const [apiVersion, setApiVersion] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(createForm)
  const [dialog, setDialog] = useState(false)
  const [formError, setFormError] = useState('')

  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [processSkus, setProcessSkus] = useState<Record<string, SkuOption[]>>({})
  const [skusLoading, setSkusLoading] = useState(false)
  const [batch, setBatch] = useState(createBatchForm)
  const [batchDialog, setBatchDialog] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [uploadForm, setUploadForm] = useState(createUploadForm)
  const [uploadInputKey, setUploadInputKey] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [uploadResult, setUploadResult] = useState('')
  const [processesLoading, setProcessesLoading] = useState(false)

  const [labor, setLabor] = useState<LaborRow[]>([])
  const [laborLoading, setLaborLoading] = useState(false)
  const [laborMonth, setLaborMonth] = useState('')
  const [laborStatus, setLaborStatus] = useState<LaborStatus>('ATIVOS')
  const [laborForm, setLaborForm] = useState(createLaborForm)
  const [laborDialog, setLaborDialog] = useState(false)
  const [laborError, setLaborError] = useState('')
  const [laborDeactivateTarget, setLaborDeactivateTarget] = useState<LaborRow | null>(null)
  const [laborDeactivateReason, setLaborDeactivateReason] = useState('')
  const [laborDeactivateError, setLaborDeactivateError] = useState('')

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [userError, setUserError] = useState('')
  const [newUser, setNewUser] = useState({
    matricula: '',
    nome: '',
    perfil: 'OPERACIONAL' as Profile,
    senhaTemporaria: '',
    cnpjs: [] as string[],
  })
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)

  const [audits, setAudits] = useState<AuditRow[]>([])
  const [selectedAudit, setSelectedAudit] = useState<AuditRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Rework | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  const [prices, setPrices] = useState<PriceRow[]>([])
  const [priceForm, setPriceForm] = useState(createPriceForm)

  const [passwordDialog, setPasswordDialog] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const isClient = user?.perfil === 'CLIENTE'
  const canCreate = Boolean(user && user.perfil !== 'CLIENTE')
  const canEdit = user?.perfil === 'SUPERVISOR' || user?.perfil === 'ADMIN'
  const canAudit = user?.perfil === 'SUPERVISOR' || user?.perfil === 'ADMIN' || user?.perfil === 'CLIENTE'
  const canUsers = user?.perfil === 'ADMIN'
  const canManagePrices = user?.perfil === 'ADMIN'
  // Tabela de preços é interna: CLIENTE não visualiza.
  const canViewPrices = user?.perfil === 'SUPERVISOR' || user?.perfil === 'ADMIN'
  const canExport = user?.perfil === 'SUPERVISOR' || user?.perfil === 'ADMIN' || user?.perfil === 'CLIENTE'
  const canLabor = Boolean(user && user.perfil !== 'CLIENTE')

  async function api(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      credentials: 'include',
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.ok === false) {
      throw new Error(data?.error?.message || 'Falha na operação.')
    }
    return data
  }

  async function loadBranches() {
    try {
      const data = await api('/api/filiais')
      setBranches(data.data || [])
      return data.data || []
    } catch {
      setBranches([])
      return []
    }
  }

  async function loadAllBranches() {
    try {
      const data = await api('/api/filiais?all=1')
      setAllBranches(data.data || [])
      return data.data || []
    } catch {
      setAllBranches([])
      return []
    }
  }

  async function loadPrices() {
    try {
      const data = await api('/api/precos')
      setPrices(data.data || [])
      return data.data || []
    } catch {
      setPrices([])
      return []
    }
  }

  async function loadItems(mes?: string) {
    setLoading(true)
    try {
      const query = mes ? `?mes=${encodeURIComponent(mes)}` : ''
      const data = await api('/api/retrabalhos' + query)
      setItems(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function loadClientDashboard() {
    setLoading(true)
    try {
      const result = await api('/api/retrabalhos?months=1')
      const available: string[] = result.data || []
      setMonths(available)
      const chosen = available[0] || currentMonth()
      setSelectedMonth(chosen)
      const data = await api('/api/retrabalhos?mes=' + encodeURIComponent(chosen))
      setItems(data.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function changeMonth(value: string) {
    setSelectedMonth(value)
    setLoading(true)
    try {
      if (isClient) {
        const data = await api('/api/bootstrap?period=1&mes=' + encodeURIComponent(value))
        setItems(data.items || [])
        setAudits(data.audits || [])
        setBaseConnected(data.connected === true)
        setApiVersion(String(data.apiVersion || ''))
      } else {
        await loadItems(value)
      }
    } catch (error) {
      setBaseConnected(false)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Sidebar responsiva: reage à mudança de largura da janela, não só ao carregamento.
  useEffect(() => {
    const drawer = window.matchMedia(DRAWER_QUERY)
    const compact = window.matchMedia(COMPACT_QUERY)
    const sync = () => {
      if (!drawer.matches) setMobileOpen(false)
      if (compact.matches) setCollapsed(true)
      else if (!drawer.matches) setCollapsed(readSidebarPref())
    }
    sync()
    drawer.addEventListener('change', sync)
    compact.addEventListener('change', sync)
    return () => {
      drawer.removeEventListener('change', sync)
      compact.removeEventListener('change', sync)
    }
  }, [])

  // Drawer móvel: ESC fecha e o fundo não rola enquanto estiver aberto.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false) }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  useEffect(() => {
    api('/api/auth/me')
      .then(r => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoadingSession(false))
  }, [])

  useEffect(() => {
    if (!user || user.trocaSenhaObrigatoria) return
    void initializeWorkspace(user)
  }, [user])

  async function initializeWorkspace(currentUser: User) {
    if (currentUser.trocaSenhaObrigatoria) return

    setWorkspaceLoading(true)
    setWorkspaceReady(false)
    setWorkspaceSlow(false)
    setWorkspaceError('')
    setBaseConnected(false)

    const slowTimer = window.setTimeout(() => setWorkspaceSlow(true), 2500)

    try {
      const data = await api('/api/bootstrap')

      setPrices(data.prices || [])
      setBranches(data.branches || [])
      setItems(data.items || [])
      setAudits(data.audits || [])
      setMonths(data.months || [])
      setAllBranches(data.allBranches || [])
      setUsers(data.users || [])
      setLabor(data.labor || [])
      setProcesses(data.processes || [])
      // Abre no mês mais recente com dados; sem dados, no mês corrente.
      setReworkMonth(
        monthsOf((data.items || []).map((x: Rework) => x.dataEfetivacao))[0] || currentMonth()
      )
      setLaborMonth(
        monthsOf((data.labor || []).map((x: LaborRow) => x.data))[0] || currentMonth()
      )

      if (currentUser.perfil === 'CLIENTE') {
        setSelectedMonth(data.selectedMonth || currentMonth())
      }

      setApiVersion(String(data.apiVersion || ''))
      setBaseConnected(data.connected === true)
      setWorkspaceReady(true)
    } catch (error) {
      setBaseConnected(false)
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os dados iniciais.'
      )
    } finally {
      window.clearTimeout(slowTimer)
      setWorkspaceLoading(false)
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault()
    if (authLoading) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ matricula, senha }),
      })
      setUser(data.user)
      setSenha('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Falha no login.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => null)
    setUser(null)
    setPasswordDialog(false)
    setItems([])
    setBranches([])
    setAllBranches([])
    setLabor([])
    setWorkspaceReady(false)
    setWorkspaceError('')
    setBaseConnected(false)
    setApiVersion('')
  }

  function openNew() {
    if (!canCreate) return
    const next = createBatchForm()
    if (processes.length === 1) next.idProcesso = processes[0].id
    setBatch(next)
    setBatchError('')
    setBatchDialog(true)
    if (next.idProcesso) void loadProcessSkus(next.idProcesso)
  }

  async function loadProcessSkus(idProcesso: string) {
    if (!idProcesso || processSkus[idProcesso]) return
    setSkusLoading(true)
    try {
      const data = await api('/api/processos?id=' + encodeURIComponent(idProcesso))
      setProcessSkus(current => ({ ...current, [idProcesso]: data.data || [] }))
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : 'Falha ao carregar os SKUs do processo.')
    } finally {
      setSkusLoading(false)
    }
  }

  function selectBatchProcess(idProcesso: string) {
    setBatch(current => ({ ...current, idProcesso, skus: [], lines: [] }))
    setBatchError('')
    void loadProcessSkus(idProcesso)
  }

  function changeBatchSkus(selected: string[]) {
    const limited = selected.slice(0, MAX_BATCH_SKUS)
    const catalog = processSkus[batch.idProcesso] || []
    setBatch(current => {
      const existing: Record<string, BatchLine> = {}
      current.lines.forEach(line => { existing[line.sku] = line })
      const lines = limited.map(sku => existing[sku] || {
        sku,
        descricao: catalog.find(item => item.sku === sku)?.descricao || '',
        quantidade: null,
        nacionalizacao: null,
        rfid: null,
        tester: null,
        confeccao: null,
      })
      return { ...current, skus: limited, lines }
    })
  }

  function updateBatchLine(sku: string, field: keyof BatchLine, value: number | null) {
    setBatch(current => ({
      ...current,
      lines: current.lines.map(line => line.sku === sku ? { ...line, [field]: value } : line),
    }))
  }

  function removeBatchLine(sku: string) {
    setBatch(current => ({
      ...current,
      skus: current.skus.filter(item => item !== sku),
      lines: current.lines.filter(line => line.sku !== sku),
    }))
  }

  async function saveBatch() {
    if (saving || !canCreate) return
    setBatchError('')
    if (!batch.idProcesso) return setBatchError('Selecione o número do processo.')
    if (!batch.lines.length) return setBatchError('Selecione ao menos um SKU.')
    const problems = batch.lines
      .map((line, index) => {
        const problem = lineError(line)
        return problem ? `Linha ${index + 1} (${line.sku}): ${problem}` : ''
      })
      .filter(Boolean)
    if (problems.length) {
      return setBatchError(problems.slice(0, 5).join(' • ') + (problems.length > 5 ? ` • e mais ${problems.length - 5} linha(s).` : ''))
    }

    setSaving(true)
    try {
      await api('/api/retrabalhos', {
        method: 'POST',
        body: JSON.stringify({
          requestId: batch.requestId,
          idProcesso: batch.idProcesso,
          dataEfetivacao: isoDate(batch.dataEfetivacao),
          linhas: batch.lines.map(line => ({
            sku: line.sku,
            quantidade: line.quantidade ?? 0,
            nacionalizacao: line.nacionalizacao ?? 0,
            rfid: line.rfid ?? 0,
            tester: line.tester ?? 0,
            confeccao: line.confeccao ?? 0,
          })),
        }),
      })
      setBatchDialog(false)
      if (!isClient && reworkMonth) setReworkMonth(isoDate(batch.dataEfetivacao).slice(0, 7))
      await loadItems(isClient ? selectedMonth : undefined)
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : 'Falha ao salvar o lançamento.')
    } finally {
      setSaving(false)
    }
  }

  // ---------- Processos (planilha do cliente) ----------
  function openProcesses() {
    if (!canLabor) return
    setSection('processos')
    setMobileOpen(false)
  }

  async function loadProcesses() {
    setProcessesLoading(true)
    try {
      const data = await api('/api/processos')
      setProcesses(data.data || [])
    } finally {
      setProcessesLoading(false)
    }
  }

  async function uploadProcess() {
    if (saving) return
    setUploadError('')
    setUploadResult('')
    const file = uploadForm.file
    try {
      if (!uploadForm.numero.trim()) throw new Error('Informe o número do processo.')
      if (!uploadForm.cnpjCliente) throw new Error('Selecione a filial.')
      if (!file) throw new Error('Selecione a planilha do cliente.')
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Envie a planilha em Excel (.xlsx ou .xls) ou CSV.')
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('Arquivo acima de 10 MB.')

      setSaving(true)
      const arquivoBase64 = await fileToBase64(file)
      const result = await api('/api/processos', {
        method: 'POST',
        body: JSON.stringify({
          requestId: uploadForm.requestId,
          numeroProcesso: uploadForm.numero.trim(),
          cnpjCliente: uploadForm.cnpjCliente,
          arquivoNome: file.name,
          arquivoBase64,
        }),
      })
      const created = result.data as ProcessRow
      setUploadResult(
        `Processo ${created.numero}: ${intLabel(created.qtdSkus)} SKU(s) importado(s)`
        + (created.qtdIgnorados ? ` · ${intLabel(created.qtdIgnorados)} linha(s) ignorada(s) por falta de código/descrição ou duplicidade.` : '.')
      )
      setUploadForm(createUploadForm())
      setUploadInputKey(key => key + 1)
      await loadProcesses()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Falha ao enviar a planilha.')
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row: Rework) {
    if (!canEdit || row.cobrancaCancelada) return
    setForm({
      id: row.id,
      requestId: row.requestId || '',
      dataEfetivacao: fromIso(row.dataEfetivacao) || new Date(),
      sku: row.sku,
      descricao: row.descricao,
      cnpjCliente: row.cnpjCliente,
      quantidade: row.quantidade || null,
      nacionalizacao: row.nacionalizacao || null,
      rfid: row.rfid || null,
      tester: row.tester || null,
      confeccao: row.confeccao || null,
      numeroProcesso: row.numeroProcesso || '',
      versao: row.versao,
    })
    setFormError('')
    setDialog(true)
  }

  async function save() {
    if (saving || !canCreate) return
    setSaving(true)
    setFormError('')
    try {
      if (!form.cnpjCliente) throw new Error('Selecione a filial.')
      if (!form.sku.trim()) throw new Error('Informe o SKU.')
      if (!form.descricao.trim()) throw new Error('Informe a descrição.')
      const problem = lineError(form)
      if (problem) throw new Error(problem.charAt(0).toUpperCase() + problem.slice(1) + '.')

      const payload = {
        id: form.id || undefined,
        requestId: form.requestId,
        dataEfetivacao: isoDate(form.dataEfetivacao),
        sku: form.sku.trim(),
        descricao: form.descricao.trim(),
        cnpjCliente: form.cnpjCliente,
        quantidade: form.quantidade ?? 0,
        nacionalizacao: form.nacionalizacao ?? 0,
        rfid: form.rfid ?? 0,
        tester: form.tester ?? 0,
        confeccao: form.confeccao ?? 0,
        versao: form.versao,
      }

      await api('/api/retrabalhos', {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })

      setDialog(false)
      if (!isClient && reworkMonth) setReworkMonth(isoDate(form.dataEfetivacao).slice(0, 7))
      await loadItems(isClient ? selectedMonth : undefined)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function openLabor() {
    if (!canLabor) return
    setSection('maoDeObra')
    setMobileOpen(false)
  }

  async function loadLabor() {
    if (!canLabor) return
    setLaborLoading(true)
    try {
      const data = await api('/api/mao-de-obra')
      setLabor(data.data || [])
    } finally {
      setLaborLoading(false)
    }
  }

  function openNewLabor() {
    if (!canLabor) return
    const next = createLaborForm()
    if (branches.length === 1) next.cnpjCliente = branches[0].cnpj
    setLaborForm(next)
    setLaborError('')
    setLaborDialog(true)
  }

  function openEditLabor(row: LaborRow) {
    if (!canEdit || laborInactive(row)) return
    setLaborForm({
      id: row.id,
      requestId: row.requestId || '',
      data: fromIso(row.data) || new Date(),
      cnpjCliente: row.cnpjCliente,
      qtdCasa: row.qtdCasa || null,
      qtdTerceiros: row.qtdTerceiros || null,
      observacao: row.observacao || '',
      versao: row.versao,
    })
    setLaborError('')
    setLaborDialog(true)
  }

  async function saveLabor() {
    if (saving || !canLabor) return
    setSaving(true)
    setLaborError('')
    try {
      if (!laborForm.cnpjCliente) throw new Error('Selecione a filial.')
      if (Number(laborForm.qtdCasa || 0) + Number(laborForm.qtdTerceiros || 0) <= 0) {
        throw new Error('Informe ao menos uma pessoa (casa ou terceiros).')
      }
      await api('/api/mao-de-obra', {
        method: laborForm.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          id: laborForm.id || undefined,
          requestId: laborForm.requestId,
          data: isoDate(laborForm.data),
          cnpjCliente: laborForm.cnpjCliente,
          qtdCasa: laborForm.qtdCasa ?? 0,
          qtdTerceiros: laborForm.qtdTerceiros ?? 0,
          observacao: laborForm.observacao.trim(),
          versao: laborForm.versao,
        }),
      })
      setLaborDialog(false)
      if (laborMonth) setLaborMonth(isoDate(laborForm.data).slice(0, 7))
      await loadLabor()
    } catch (error) {
      setLaborError(error instanceof Error ? error.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function openDeactivateLabor(row: LaborRow) {
    if (!canEdit) return
    setLaborDeactivateReason('')
    setLaborDeactivateError('')
    setLaborDeactivateTarget(row)
  }

  async function deactivateLabor() {
    if (!laborDeactivateTarget || saving) return
    const motivo = laborDeactivateReason.trim()
    if (!motivo) {
      setLaborDeactivateError('Informe o motivo da inativação.')
      return
    }
    setSaving(true)
    setLaborDeactivateError('')
    try {
      await api('/api/mao-de-obra', {
        method: 'PATCH',
        body: JSON.stringify({
          id: laborDeactivateTarget.id,
          versao: laborDeactivateTarget.versao,
          motivo,
        }),
      })
      // Recarrega para trazer o registro com status INATIVO.
      await loadLabor()
      setLaborDeactivateTarget(null)
      setLaborDeactivateReason('')
      if (canAudit) await reloadAudit().catch(() => null)
    } catch (error) {
      setLaborDeactivateError(error instanceof Error ? error.message : 'Falha ao inativar lançamento.')
    } finally {
      setSaving(false)
    }
  }

  function exportLabor() {
    downloadCsv(
      `mao-de-obra-unilog-${laborMonth || 'completo'}.csv`,
      [
        'Data',
        'Cliente',
        'Filial',
        'CNPJ',
        'Mão de obra da casa',
        'Terceiros',
        'Total',
        'Observação',
        'Status',
        'Inativado em',
        'Inativado por',
        'Motivo inativação',
        'Criado por',
        'Criado em',
        'Atualizado por',
        'Atualizado em',
        'Versão',
      ],
      visibleLabor.map(row => [
        row.data,
        row.nomeCliente,
        row.filial,
        cnpjLabel(row.cnpjCliente),
        row.qtdCasa,
        row.qtdTerceiros,
        row.qtdTotal,
        row.observacao,
        laborInactive(row) ? 'INATIVO' : 'ATIVO',
        row.inativadoEm || '',
        row.inativadoPor || '',
        row.motivoInativacao || '',
        row.matriculaCriacao,
        row.criadoEm,
        row.matriculaAtualizacao || '',
        row.atualizadoEm || '',
        row.versao,
      ])
    )
  }

  function openUsers() {
    setSection('usuarios')
    setMobileOpen(false)
  }

  async function reloadUsers() {
    const data = await api('/api/usuarios')
    setUsers(data.data || [])
  }

  async function createUser() {
    if (saving) return
    setUserError('')
    setSaving(true)
    try {
      await api('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify(newUser),
      })
      await reloadUsers()
      setNewUser({
        matricula: '',
        nome: '',
        perfil: 'OPERACIONAL',
        senhaTemporaria: '',
        cnpjs: [],
      })
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Falha ao criar usuário.')
    } finally {
      setSaving(false)
    }
  }

  async function updateUser() {
    if (!editingUser || saving) return
    setUserError('')
    setSaving(true)
    try {
      await api('/api/usuarios', {
        method: 'PUT',
        body: JSON.stringify({
          matricula: editingUser.matricula,
          perfil: editingUser.perfil,
          ativo: editingUser.ativo,
          cnpjs: editingUser.cnpjs || [],
          versao: editingUser.versao,
        }),
      })
      setEditingUser(null)
      await reloadUsers()
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Falha ao atualizar usuário.')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    setPasswordError('')
    if (newPassword.length < 8) {
      return setPasswordError('A senha deve possuir pelo menos 8 caracteres.')
    }
    if (newPassword !== confirmPassword) {
      return setPasswordError('As senhas não conferem.')
    }
    if (saving) return

    setSaving(true)
    try {
      await api('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ novaSenha: newPassword }),
      })

      const refreshed = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          matricula: user?.matricula || matricula,
          senha: newPassword,
        }),
      })

      setNewPassword('')
      setConfirmPassword('')
      setPasswordDialog(false)
      setUser(refreshed.user)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Falha ao trocar senha.')
    } finally {
      setSaving(false)
    }
  }

  function openAudit() {
    if (!canAudit) return
    setSection('auditoria')
    setMobileOpen(false)
  }

  async function reloadAudit() {
    if (!canAudit) return
    const query = isClient
      ? '?audit=1&mes=' + encodeURIComponent(selectedMonth)
      : '?audit=1'
    const data = await api('/api/retrabalhos' + query)
    setAudits(data.data || [])
  }

  function openPrices() {
    if (!canViewPrices) return
    setSection('precos')
    setMobileOpen(false)
  }

  function openReworks() {
    setSection('lancamentos')
    setMobileOpen(false)
  }

  function toggleSidebar() {
    setCollapsed(current => {
      const next = !current
      // Na faixa compacta a expansão é temporária e não sobrescreve a preferência de desktop.
      if (!window.matchMedia(COMPACT_QUERY).matches) writeSidebarPref(next)
      return next
    })
  }

  async function createPrice() {
    if (!canManagePrices || saving) return
    setSaving(true)
    try {
      await api('/api/precos', {
        method: 'POST',
        body: JSON.stringify({
          requestId: priceForm.requestId,
          vigenciaInicio: isoDate(priceForm.vigenciaInicio),
          valorNacionalizacao: priceForm.valorNacionalizacao,
          valorRfidAdicional: priceForm.valorRfidAdicional,
          valorTester: priceForm.valorTester,
          valorConfeccao: priceForm.valorConfeccao,
          observacao: priceForm.observacao.trim(),
        }),
      })
      await loadPrices()
      setPriceForm(createPriceForm())
    } finally {
      setSaving(false)
    }
  }

  async function cancelCharge() {
    if (!cancelTarget || saving) return
    const motivo = cancelReason.trim()
    if (!motivo) {
      setCancelError('Informe o motivo do cancelamento da cobrança.')
      return
    }

    setSaving(true)
    setCancelError('')
    try {
      const result = await api('/api/retrabalhos', {
        method: 'PATCH',
        body: JSON.stringify({
          id: cancelTarget.id,
          versao: cancelTarget.versao,
          motivo,
        }),
      })

      const updated = result.data as Rework
      setItems(current => current.map(item => item.id === updated.id ? updated : item))
      setCancelTarget(null)
      setCancelReason('')
      await reloadAudit()
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Falha ao cancelar cobrança.')
    } finally {
      setSaving(false)
    }
  }

  function exportReworks() {
    const label = isClient ? selectedMonth : (reworkMonth || 'completo')
    downloadCsv(
      `retrabalho-unilog-${label}.csv`,
      [
        'Data efetivação',
        'SKU',
        'Descrição',
        'Cliente',
        'Filial',
        'CNPJ',
        'Processo',
        'Lote',
        'Qtd retrabalhada',
        'Etiquetas Nacionalização',
        'Etiquetas RFID/ADIPAC',
        'Transformação em tester',
        'Etiquetas confeccionadas',
        'Tarifa Nacionalização',
        'Tarifa RFID/ADIPAC',
        'Tarifa tester',
        'Tarifa etiqueta confeccionada',
        'Valor Nacionalização',
        'Valor RFID/ADIPAC',
        'Valor tester',
        'Valor etiquetas confeccionadas',
        'Valor original cobrança',
        'Valor efetivo cobrança',
        'Cobrança cancelada',
        'Cancelado em',
        'Cancelado por',
        'Motivo cancelamento',
        'ID preço',
        'Criado por',
        'Criado em',
        'Atualizado por',
        'Atualizado em',
        'Versão',
      ],
      visibleItems.map(item => [
        item.dataEfetivacao,
        item.sku,
        item.descricao,
        item.nomeCliente,
        item.filial,
        cnpjLabel(item.cnpjCliente),
        item.numeroProcesso || '',
        item.idLote || '',
        item.quantidade,
        item.nacionalizacao,
        item.rfid,
        item.tester || 0,
        item.confeccao || 0,
        item.precoNacionalizacaoUnit.toFixed(4).replace('.', ','),
        item.precoRfidAdicionalUnit.toFixed(4).replace('.', ','),
        Number(item.precoTesterUnit || 0).toFixed(4).replace('.', ','),
        Number(item.precoConfeccaoUnit || 0).toFixed(4).replace('.', ','),
        item.valorNacionalizacao.toFixed(4).replace('.', ','),
        item.valorRfidAdicional.toFixed(4).replace('.', ','),
        Number(item.valorTester || 0).toFixed(4).replace('.', ','),
        Number(item.valorConfeccao || 0).toFixed(4).replace('.', ','),
        item.valorTotalCobranca.toFixed(4).replace('.', ','),
        item.valorCobrancaEfetiva.toFixed(4).replace('.', ','),
        item.cobrancaCancelada ? 'SIM' : 'NAO',
        item.canceladoEm || '',
        item.canceladoPor || '',
        item.motivoCancelamento || '',
        item.idPreco,
        item.matriculaCriacao,
        item.criadoEm,
        item.matriculaAtualizacao || '',
        item.atualizadoEm || '',
        item.versao,
      ])
    )
  }

  function exportAudits() {
    const label = isClient ? selectedMonth : 'completo'
    downloadCsv(
      `auditoria-retrabalho-unilog-${label}.csv`,
      [
        'Data/hora',
        'Entidade',
        'Registro',
        'Ação',
        'Autor',
        'Versão anterior',
        'Versão nova',
        'Dados antes',
        'Dados depois',
      ],
      audits.map(item => [
        item.dataHora,
        item.entidade,
        item.idRegistro,
        item.acao,
        item.matriculaAutor,
        item.versaoAnterior,
        item.versaoNova,
        item.dadosAntes,
        item.dadosDepois,
      ])
    )
  }

  const effectiveClientBranchFilter = isClient && branches.length === 1
    ? branches[0].cnpj
    : clientBranchFilter

  const reworkMonths = useMemo(
    () => monthsOf(items.map(item => item.dataEfetivacao)),
    [items],
  )

  const visibleItems = useMemo(() => {
    const byStatus = items.filter(item =>
      chargeStatus === 'TODOS'
        || (chargeStatus === 'CANCELADOS' ? item.cobrancaCancelada : !item.cobrancaCancelada)
    )
    if (!isClient) {
      return reworkMonth
        ? byStatus.filter(item => item.dataEfetivacao.slice(0, 7) === reworkMonth)
        : byStatus
    }
    const query = clientSearch.trim().toLowerCase()
    return byStatus.filter(item => {
      if (effectiveClientBranchFilter && item.cnpjCliente !== effectiveClientBranchFilter) return false
      if (!query) return true
      return [
        item.sku,
        item.descricao,
        item.nomeCliente,
        item.filial,
        item.cnpjCliente,
      ].some(value => String(value || '').toLowerCase().includes(query))
    })
  }, [items, isClient, reworkMonth, chargeStatus, effectiveClientBranchFilter, clientSearch])

  const totals = useMemo(() => {
    // Em "Todos os status", cancelados aparecem na tabela mas não entram nos cards
    // (mesma regra da Mão de obra). Em "Cancelados", os cards mostram o que foi cancelado.
    const counted = chargeStatus === 'TODOS' ? visibleItems.filter(item => !item.cobrancaCancelada) : visibleItems
    return {
    registros: counted.length,
    unidades: counted.reduce((a, b) => a + Number(b.quantidade || 0), 0),
    etiquetas: counted.reduce((a, b) => a + Number(b.totalEtiquetas || 0), 0),
    // Em "Cancelados" o valor efetivo é sempre 0; mostra o valor original que deixou de ser cobrado.
    valor: counted.reduce((a, b) => a + Number(
      chargeStatus === 'CANCELADOS' ? b.valorTotalCobranca || 0 : b.valorCobrancaEfetiva || 0
    ), 0),
    }
  }, [visibleItems, chargeStatus])

  const previewPrice = useMemo(() => {
    const date = isoDate(form.dataEfetivacao)
    const price = prices.find(p =>
      p.vigenciaInicio <= date && (!p.vigenciaFim || p.vigenciaFim >= date)
    )
    if (!price) return null

    const nat = Number(form.nacionalizacao || 0) * Number(price.valorNacionalizacao || 0)
    const rfid = Number(form.rfid || 0) * Number(price.valorRfidAdicional || 0)
    const tester = Number(form.tester || 0) * Number(price.valorTester || 0)
    const confeccao = Number(form.confeccao || 0) * Number(price.valorConfeccao || 0)
    return {
      price,
      nat,
      rfid,
      tester,
      confeccao,
      total: nat + rfid + tester + confeccao,
    }
  }, [form.dataEfetivacao, form.nacionalizacao, form.rfid, form.tester, form.confeccao, prices])

  const batchSkuOptions = useMemo(
    () => (processSkus[batch.idProcesso] || []).map(item => ({ label: `${item.sku} — ${item.descricao}`, value: item.sku })),
    [processSkus, batch.idProcesso],
  )

  const batchPreview = useMemo(() => {
    const date = isoDate(batch.dataEfetivacao)
    const price = prices.find(p => p.vigenciaInicio <= date && (!p.vigenciaFim || p.vigenciaFim >= date))
    const sum = (field: keyof BatchLine) => batch.lines.reduce((a, b) => a + Number(b[field] || 0), 0)
    const qty = {
      quantidade: sum('quantidade'),
      nacionalizacao: sum('nacionalizacao'),
      rfid: sum('rfid'),
      tester: sum('tester'),
      confeccao: sum('confeccao'),
    }
    const total = price
      ? qty.nacionalizacao * Number(price.valorNacionalizacao || 0)
        + qty.rfid * Number(price.valorRfidAdicional || 0)
        + qty.tester * Number(price.valorTester || 0)
        + qty.confeccao * Number(price.valorConfeccao || 0)
      : null
    return { price, qty, total }
  }, [batch.dataEfetivacao, batch.lines, prices])

  const laborMonths = useMemo(() => monthsOf(labor.map(row => row.data)), [labor])

  function monthOptions(available: string[], selected: string) {
    const list = selected && !available.includes(selected) ? [selected, ...available] : available
    return [
      { label: 'Todos os meses', value: '' },
      ...list.map(month => ({ label: monthLabel(month), value: month })),
    ]
  }

  const visibleLabor = useMemo(() => labor.filter(row => {
    if (laborMonth && row.data.slice(0, 7) !== laborMonth) return false
    if (laborStatus === 'ATIVOS') return !laborInactive(row)
    if (laborStatus === 'INATIVOS') return laborInactive(row)
    return true
  }), [labor, laborMonth, laborStatus])

  const laborTotals = useMemo(() => {
    // Em "Todos os status", inativados aparecem na tabela mas não entram nos cards.
    // Em "Inativados", os cards mostram exatamente o que foi inativado.
    const counted = laborStatus === 'TODOS' ? visibleLabor.filter(row => !laborInactive(row)) : visibleLabor
    const dias: Record<string, true> = {}
    counted.forEach(row => { dias[row.data] = true })
    return {
      dias: Object.keys(dias).length,
      casa: counted.reduce((a, b) => a + Number(b.qtdCasa || 0), 0),
      terceiros: counted.reduce((a, b) => a + Number(b.qtdTerceiros || 0), 0),
      total: counted.reduce((a, b) => a + Number(b.qtdTotal || 0), 0),
    }
  }, [visibleLabor, laborStatus])

  if (loadingSession) {
    return (
      <div className="session-loading">
        <i className="pi pi-spin pi-spinner" /> Validando sessão...
      </div>
    )
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <aside className="login-brand" aria-label="Retrabalho Controle Unilog">
            <div className="login-brand-topline">
              <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
              <span className="product-chip">Retrabalho</span>
            </div>
            <div className="login-brand-copy">
              <span className="overline">GESTÃO OPERACIONAL</span>
              <h1>Retrabalho com rastreabilidade e cobrança controlada.</h1>
              <p>Execução, etiquetagem, vigências de preço e auditoria reunidas em um único ambiente operacional.</p>
            </div>
            <div className="proof">
              <span><i className="pi pi-shield" /> Acesso protegido</span>
              <span><i className="pi pi-history" /> Histórico auditável</span>
            </div>
          </aside>

          <form className="login-form" onSubmit={login}>
            <span className="login-overline">ACESSO À PLATAFORMA</span>
            <h2>Bem-vindo de volta</h2>
            <p>Entre com a matrícula cadastrada pela administração.</p>

            <label htmlFor="login-matricula">Matrícula</label>
            <span className="p-input-icon-left login-field-icon">
              <i className="pi pi-user" />
              <InputText
                id="login-matricula"
                value={matricula}
                onChange={e => setMatricula(e.target.value)}
                autoComplete="username"
                placeholder="Digite sua matrícula"
                required
                disabled={authLoading}
              />
            </span>

            <label htmlFor="login-senha">Senha</label>
            <Password
              inputId="login-senha"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              feedback={false}
              toggleMask
              autoComplete="current-password"
              placeholder="Digite sua senha"
              required
              disabled={authLoading}
              className="login-password"
              inputClassName="login-password-input"
            />

            {authError && (
              <div className="error">
                <i className="pi pi-exclamation-circle" />{authError}
              </div>
            )}

            <Button
              label={authLoading ? 'Entrando…' : 'Entrar'}
              icon={authLoading ? 'pi pi-spin pi-spinner' : 'pi pi-arrow-right'}
              iconPos="right"
              className="primary"
              disabled={authLoading}
            />

            <div className="login-security-note">
              <i className="pi pi-info-circle" />
              <span>O acesso respeita o perfil cadastrado e todas as alterações relevantes permanecem auditáveis.</span>
            </div>
          </form>
        </section>
      </main>
    )
  }

  if (user.trocaSenhaObrigatoria) {
    return (
      <main className="login-page">
        <section className="login-card" aria-labelledby="first-access-title">
          <aside className="login-brand" aria-label="Retrabalho Controle Unilog">
            <div className="login-brand-topline">
              <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
              <span className="product-chip">Retrabalho</span>
            </div>
            <div className="login-brand-copy">
              <span className="overline">PRIMEIRO ACESSO</span>
              <h1>Segurança desde o primeiro acesso.</h1>
              <p>A senha recebida é temporária. Defina sua própria senha antes de acessar os dados operacionais.</p>
            </div>
            <div className="proof">
              <span><i className="pi pi-shield" /> Credenciais protegidas</span>
              <span><i className="pi pi-lock" /> Senha não armazenada em texto puro</span>
            </div>
          </aside>

          <section className="login-form first-access-form">
            <span className="login-overline">PRIMEIRO ACESSO</span>
            <h2 id="first-access-title">Crie sua própria senha</h2>
            <p>A nova senha substitui a senha temporária e libera sua sessão sem exigir outro login.</p>

            <label>Matrícula</label>
            <InputText value={user.matricula} disabled />

            <label htmlFor="first-new-password">Nova senha</label>
            <Password
              inputId="first-new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              toggleMask
              feedback={false}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              required
              className="login-password"
              inputClassName="login-password-input"
            />

            <label htmlFor="first-confirm-password">Confirmar nova senha</label>
            <Password
              inputId="first-confirm-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              toggleMask
              feedback={false}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              required
              className="login-password"
              inputClassName="login-password-input"
            />

            <div className="password-rules" aria-live="polite">
              <span className={newPassword.length >= 8 ? 'is-valid' : ''}>
                <i className={newPassword.length >= 8 ? 'pi pi-check-circle' : 'pi pi-circle'} />
                Pelo menos 8 caracteres
              </span>
              <span className={newPassword.length > 0 && newPassword === confirmPassword ? 'is-valid' : ''}>
                <i className={newPassword.length > 0 && newPassword === confirmPassword ? 'pi pi-check-circle' : 'pi pi-circle'} />
                As duas senhas devem coincidir
              </span>
            </div>

            {passwordError && (
              <div className="error">
                <i className="pi pi-exclamation-circle" />{passwordError}
              </div>
            )}

            <Button
              label={saving ? 'Salvando…' : 'Definir minha senha'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              iconPos="right"
              className="primary"
              loading={false}
              disabled={saving}
              onClick={changePassword}
            />

            <div className="login-security-note">
              <i className="pi pi-info-circle" />
              <span>Depois da alteração, você seguirá diretamente para o sistema com a mesma sessão autenticada.</span>
            </div>
          </section>
        </section>
      </main>
    )
  }

  if (workspaceLoading || !workspaceReady) {
    return (
      <main className="workspace-gate">
        <section className="workspace-gate-card" aria-live="polite">
          <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
          {workspaceError ? (
            <>
              <i className="pi pi-exclamation-triangle workspace-gate-error-icon" />
              <h2>Não foi possível carregar o ambiente</h2>
              <p>{workspaceError}</p>
              <Button
                label="Tentar novamente"
                icon="pi pi-refresh"
                className="primary"
                onClick={() => void initializeWorkspace(user)}
              />
            </>
          ) : (
            <>
              <i className="pi pi-spin pi-spinner workspace-gate-spinner" />
              <h2>Preparando seu ambiente</h2>
              <p>Conectando à base e organizando os dados do seu escopo.</p>
              {workspaceSlow && (
                <small>A conexão com a base está levando mais tempo que o normal. Aguarde mais alguns segundos.</small>
              )}
            </>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-brand">
          <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
          <button
            type="button"
            className="sidebar-collapse"
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            <i className={collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'} />
          </button>
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <i className="pi pi-times" />
          </button>
        </div>

        <nav>
          <button className={`nav ${section === 'lancamentos' ? 'active' : ''}`} onClick={openReworks} title={collapsed ? (isClient ? 'Acompanhamento' : 'Lançamentos') : undefined}>
            <i className="pi pi-clipboard" />
            <span className="nav-label">{isClient ? 'Acompanhamento' : 'Lançamentos'}</span>
          </button>
          {canLabor && (
            <button className={`nav ${section === 'processos' ? 'active' : ''}`} onClick={openProcesses} title={collapsed ? 'Processos' : undefined}>
              <i className="pi pi-folder-open" />
              <span className="nav-label">Processos</span>
            </button>
          )}
          {canLabor && (
            <button className={`nav ${section === 'maoDeObra' ? 'active' : ''}`} onClick={openLabor} title={collapsed ? 'Mão de obra' : undefined}>
              <i className="pi pi-id-card" />
              <span className="nav-label">Mão de obra</span>
            </button>
          )}
          {canAudit && (
            <button className={`nav ${section === 'auditoria' ? 'active' : ''}`} onClick={openAudit} title={collapsed ? 'Auditoria' : undefined}>
              <i className="pi pi-history" />
              <span className="nav-label">Auditoria</span>
            </button>
          )}
          {canViewPrices && (
            <button className={`nav ${section === 'precos' ? 'active' : ''}`} onClick={openPrices} title={collapsed ? 'Preços' : undefined}>
              <i className="pi pi-dollar" />
              <span className="nav-label">Preços</span>
            </button>
          )}
          {canUsers && (
            <div className="nav-section">
              <span className="nav-caption">ADMINISTRAÇÃO</span>
              <button className={`nav ${section === 'usuarios' ? 'active' : ''}`} onClick={openUsers} title={collapsed ? 'Usuários' : undefined}>
                <i className="pi pi-users" />
                <span className="nav-label">Usuários</span>
              </button>
            </div>
          )}
        </nav>

        <div className="user-card">
          <div className="avatar">{user.nome.slice(0, 1).toUpperCase()}</div>
          <div className="user-copy">
            <strong>{user.nome}</strong>
            <span>{user.matricula} · {user.perfil}</span>
          </div>
          <div className="user-actions">
            <button title="Alterar senha" onClick={() => setPasswordDialog(true)}>
              <i className="pi pi-key" />
            </button>
            <button title="Sair" onClick={logout}>
              <i className="pi pi-sign-out" />
            </button>
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="topbar-title">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <i className="pi pi-bars" />
            </button>
            <div>
              <small>RETRABALHO CONTROLE</small>
              <h1>
                {section === 'auditoria'
                  ? 'Auditoria'
                  : section === 'maoDeObra'
                    ? 'Controle de mão de obra'
                  : section === 'processos'
                    ? 'Processos do cliente'
                  : section === 'precos'
                    ? 'Tabela de preços'
                    : section === 'usuarios'
                      ? 'Usuários'
                      : isClient
                        ? 'Acompanhamento mensal'
                        : 'Retrabalho'}
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            <span
              className={`base-sync ${baseConnected ? 'connected' : 'disconnected'}`}
              title={apiVersion ? `API ${apiVersion}` : undefined}
            >
              <span className="sync-dot" />
              <span>{baseConnected ? 'Base conectada' : 'Base indisponível'}</span>
            </span>
            <div className="topbar-actions">
            {isClient && (section === 'lancamentos' || section === 'auditoria') && (
              <label className="month-control">
                <span>Competência</span>
                <Dropdown
                  aria-label="Competência"
                  value={selectedMonth}
                  options={(months.length ? months : [selectedMonth]).map(month => ({
                    label: monthLabel(month),
                    value: month,
                  }))}
                  optionLabel="label"
                  optionValue="value"
                  onChange={e => void changeMonth(String(e.value ?? ''))}
                  disabled={loading}
                />
              </label>
            )}
            {section === 'lancamentos' && canExport && (
              <Button
                label={isClient ? 'Baixar CSV' : 'Exportar'}
                icon={isClient ? 'pi pi-file-export' : 'pi pi-download'}
                outlined
                className={isClient ? 'compact client-export' : 'compact'}
                onClick={exportReworks}
                disabled={!visibleItems.length}
              />
            )}
            {section === 'lancamentos' && canCreate && (
              <Button label="Novo lançamento" icon="pi pi-plus" className="primary compact" onClick={openNew} disabled={!branches.length || !processes.length} title={!processes.length ? 'Envie a planilha de um processo antes de lançar.' : undefined} />
            )}
            {section === 'maoDeObra' && canExport && (
              <Button label="Exportar" icon="pi pi-download" outlined className="compact" onClick={exportLabor} disabled={!visibleLabor.length} />
            )}
            {section === 'maoDeObra' && canLabor && (
              <Button label="Novo lançamento" icon="pi pi-plus" className="primary compact" onClick={openNewLabor} disabled={!branches.length} />
            )}
            {section === 'auditoria' && canExport && (
              <Button label="Exportar auditoria" icon="pi pi-download" outlined className="compact" onClick={exportAudits} disabled={!audits.length} />
            )}
            </div>
          </div>
        </header>

        <div className="workspace-body">
        {section === 'lancamentos' && (
          <>
            {isClient && (
              <div className={`client-dashboard-filters ${branches.length <= 1 ? 'single-filter' : ''}`}>
                {branches.length > 1 && (
                  <label>
                    <span>Filial / CNPJ</span>
                    <Dropdown
                      aria-label="Filial / CNPJ"
                      value={clientBranchFilter}
                      options={[
                        { label: 'Todas as filiais', value: '' },
                        ...branches.map(branch => ({ label: branchLabel(branch), value: branch.cnpj })),
                      ]}
                      optionLabel="label"
                      optionValue="value"
                      onChange={e => setClientBranchFilter(String(e.value ?? ''))}
                    />
                  </label>
                )}
                <label className="client-search">
                  <span>Buscar lançamento</span>
                  <InputText
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder={branches.length === 1 ? 'SKU ou descrição' : 'SKU, descrição, filial ou CNPJ'}
                  />
                </label>
              </div>
            )}
            {workspaceReady && canCreate && !branches.length && (
              <div className="branch-warning">
                <i className="pi pi-info-circle" />
                <span>Nenhuma filial ativa está disponível para o seu usuário. Cadastre/vincule uma filial antes de criar lançamentos.</span>
              </div>
            )}
            <div className="metrics metrics-4">
              <article><i className="pi pi-list" /><div><span>Registros</span><strong>{totals.registros}</strong></div></article>
              <article><i className="pi pi-box" /><div><span>Unidades retrabalhadas</span><strong>{totals.unidades.toLocaleString('pt-BR')}</strong></div></article>
              <article><i className="pi pi-tags" /><div><span>Etiquetas aplicadas</span><strong>{totals.etiquetas.toLocaleString('pt-BR')}</strong></div></article>
              <article><i className="pi pi-wallet" /><div><span>{chargeStatus === 'CANCELADOS' ? 'Valor cancelado' : 'Valor a cobrar'}</span><strong>{money(totals.valor)}</strong></div></article>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <small className="panel-eyebrow">CONTROLE OPERACIONAL</small>
                  <h2>{isClient ? 'Detalhamento da competência' : 'Histórico de retrabalho'}</h2>
                  <p>{isClient
                    ? `Consulta somente leitura · ${monthLabel(selectedMonth)}`
                    : reworkMonth
                      ? `Registros, etiquetas e cobrança · ${monthLabel(reworkMonth)}`
                      : 'Registros, quantidades, etiquetas aplicadas e cobrança histórica.'}</p>
                </div>
                <div className="labor-head-actions">
                  <Dropdown
                    aria-label="Status da cobrança"
                    value={chargeStatus}
                    options={CHARGE_STATUS_OPTIONS}
                    optionLabel="label"
                    optionValue="value"
                    onChange={e => setChargeStatus((e.value || 'ATIVOS') as ChargeStatus)}
                  />
                  {!isClient && (
                    <Dropdown
                      aria-label="Mês"
                      value={reworkMonth}
                      options={monthOptions(reworkMonths, reworkMonth)}
                      optionLabel="label"
                      optionValue="value"
                      onChange={e => setReworkMonth(String(e.value ?? ''))}
                    />
                  )}
                  <Button icon="pi pi-refresh" text rounded onClick={() => void loadItems(isClient ? selectedMonth : undefined)} loading={loading} />
                </div>
              </div>
              <DataTable className="mobile-record-table rework-record-table" value={visibleItems} loading={loading} paginator rows={15} dataKey="id" emptyMessage={chargeStatus === 'CANCELADOS' ? 'Nenhuma cobrança cancelada no período.' : 'Nenhum retrabalho registrado para o período.'} onRowDoubleClick={e => openEdit(e.data as Rework)} stripedRows scrollable>
                <Column pt={cell('Data')} field="dataEfetivacao" header="Data" body={(row: Rework) => dateLabel(row.dataEfetivacao)} />
                <Column pt={cell('Processo')} field="numeroProcesso" header="Processo" body={(row: Rework) => row.numeroProcesso || '—'} />
                <Column pt={cell('SKU', 'wide')} field="sku" header="SKU" />
                <Column pt={cell('Descrição', 'title')} field="descricao" header="Descrição" />
                <Column pt={cell('Cliente')} field="nomeCliente" header="Cliente" />
                <Column pt={cell('Filial')} field="filial" header="Filial" />
                <Column pt={cell('CNPJ')} field="cnpjCliente" header="CNPJ" body={(row: Rework) => cnpjLabel(row.cnpjCliente)} />
                <Column pt={cell('Qtd.')} field="quantidade" header="Qtd." body={(row: Rework) => intLabel(row.quantidade)} />
                <Column pt={cell('Nacionalização')} field="nacionalizacao" header="Nacionalização" body={(row: Rework) => intLabel(row.nacionalizacao)} />
                <Column pt={cell('RFID/ADIPAC')} field="rfid" header="RFID/ADIPAC" body={(row: Rework) => intLabel(row.rfid)} />
                <Column pt={cell('Tester')} field="tester" header="Tester" body={(row: Rework) => intLabel(row.tester)} />
                <Column pt={cell('Confecc.')} field="confeccao" header="Confecc." body={(row: Rework) => intLabel(row.confeccao)} />
                <Column pt={cell('Cobrança')}
                  field="valorCobrancaEfetiva"
                  header="Cobrança"
                  body={(row: Rework) => row.cobrancaCancelada
                    ? <Tag severity="danger" value="CANCELADA" />
                    : money(row.valorCobrancaEfetiva)}
                />
                <Column pt={cell('Criado por')} field="matriculaCriacao" header="Criado por" />
                <Column pt={cell('Ações', 'actions')}
                  header=""
                  body={(row: Rework) => canEdit ? (
                    <div className="row-actions">
                      <Button icon="pi pi-pencil" text rounded className="table-action" disabled={row.cobrancaCancelada} onClick={() => openEdit(row)} />
                      <Button
                        icon="pi pi-ban"
                        text
                        rounded
                        className="table-action danger-action"
                        disabled={row.cobrancaCancelada}
                        title={row.cobrancaCancelada ? 'Cobrança já cancelada' : 'Cancelar cobrança'}
                        onClick={() => { setCancelError(''); setCancelReason(''); setCancelTarget(row) }}
                      />
                    </div>
                  ) : null}
                />
              </DataTable>
            </section>
          </>
        )}

        {section === 'processos' && canLabor && (
          <section className="panel workspace-page">
            <div className="panel-head">
              <div>
                <small className="panel-eyebrow">PLANILHAS DO CLIENTE</small>
                <h2>Processos</h2>
                <p>Envie a planilha do cliente com as colunas CÓD DE BARRAS e DESCRICAO ANVISA. Os SKUs ficam disponíveis para seleção no lançamento.</p>
              </div>
              <Button icon="pi pi-refresh" text rounded onClick={() => void loadProcesses()} loading={processesLoading} />
            </div>
            <div className="page-body">
              <div className="process-upload">
                <label>
                  Número do processo *
                  <InputText value={uploadForm.numero} onChange={e => setUploadForm({ ...uploadForm, numero: e.target.value })} placeholder="Ex.: 2026-0458" />
                </label>
                <label>
                  Cliente / filial *
                  <Dropdown
                    aria-label="Cliente / filial"
                    value={uploadForm.cnpjCliente}
                    options={branches.map(branch => ({ label: branchLabel(branch), value: branch.cnpj }))}
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Selecione a filial"
                    onChange={e => setUploadForm({ ...uploadForm, cnpjCliente: String(e.value ?? '') })}
                    filter
                  />
                </label>
                <label>
                  Planilha do cliente (.xlsx, .xls ou .csv) *
                  <input
                    key={uploadInputKey}
                    className="file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={e => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  />
                </label>
                <Button label="Enviar planilha" icon="pi pi-upload" className="primary" loading={saving} onClick={uploadProcess} />
              </div>
              {uploadError && <div className="error"><i className="pi pi-exclamation-circle" />{uploadError}</div>}
              {uploadResult && <div className="success-note"><i className="pi pi-check-circle" />{uploadResult}</div>}
              <DataTable className="mobile-record-table process-record-table" value={processes} loading={processesLoading} paginator rows={15} dataKey="id" emptyMessage="Nenhum processo enviado." stripedRows scrollable>
                <Column pt={cell('Processo', 'title')} field="numero" header="Processo" />
                <Column pt={cell('Cliente')} field="nomeCliente" header="Cliente" />
                <Column pt={cell('Filial')} field="filial" header="Filial" />
                <Column pt={cell('SKUs')} field="qtdSkus" header="SKUs" body={(row: ProcessRow) => intLabel(row.qtdSkus)} />
                <Column pt={cell('Planilha', 'wide')}
                  field="arquivoNome"
                  header="Planilha"
                  body={(row: ProcessRow) => row.arquivoUrl
                    ? <a className="drive-link" href={row.arquivoUrl} target="_blank" rel="noopener noreferrer"><i className="pi pi-external-link" /> {row.arquivoNome}</a>
                    : row.arquivoNome}
                />
                <Column pt={cell('Enviado por')} field="matriculaCriacao" header="Enviado por" />
                <Column pt={cell('Enviado em')} field="criadoEm" header="Enviado em" />
              </DataTable>
            </div>
          </section>
        )}

        {section === 'maoDeObra' && canLabor && (
          <>
            <div className="metrics metrics-4">
              <article><i className="pi pi-calendar" /><div><span>Dias lançados</span><strong>{laborTotals.dias}</strong></div></article>
              <article><i className="pi pi-user" /><div><span>Mão de obra da casa</span><strong>{laborTotals.casa.toLocaleString('pt-BR')}</strong></div></article>
              <article><i className="pi pi-users" /><div><span>Terceiros</span><strong>{laborTotals.terceiros.toLocaleString('pt-BR')}</strong></div></article>
              <article><i className="pi pi-chart-bar" /><div><span>Total de pessoas</span><strong>{laborTotals.total.toLocaleString('pt-BR')}</strong></div></article>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <small className="panel-eyebrow">CONTROLE OPERACIONAL</small>
                  <h2>Mão de obra por dia</h2>
                  <p>Quantidade diária de mão de obra da casa e de terceiros, por filial.</p>
                </div>
                <div className="labor-head-actions">
                  <Dropdown
                    aria-label="Status do lançamento"
                    value={laborStatus}
                    options={LABOR_STATUS_OPTIONS}
                    optionLabel="label"
                    optionValue="value"
                    onChange={e => setLaborStatus((e.value || 'ATIVOS') as LaborStatus)}
                  />
                  <Dropdown
                    aria-label="Mês"
                    value={laborMonth}
                    options={monthOptions(laborMonths, laborMonth)}
                    optionLabel="label"
                    optionValue="value"
                    onChange={e => setLaborMonth(String(e.value ?? ''))}
                  />
                  <Button icon="pi pi-refresh" text rounded onClick={() => void loadLabor()} loading={laborLoading} />
                </div>
              </div>
              <DataTable className="mobile-record-table labor-record-table" value={visibleLabor} loading={laborLoading} paginator rows={15} dataKey="id" emptyMessage={laborStatus === 'INATIVOS' ? 'Nenhum lançamento inativado no período.' : 'Nenhum lançamento de mão de obra para o período.'} onRowDoubleClick={e => openEditLabor(e.data as LaborRow)} stripedRows scrollable>
                <Column pt={cell('Data', 'title')} field="data" header="Data" body={(row: LaborRow) => dateLabel(row.data)} />
                <Column pt={cell('Cliente')} field="nomeCliente" header="Cliente" />
                <Column pt={cell('Filial')} field="filial" header="Filial" />
                <Column pt={cell('Casa')} field="qtdCasa" header="Casa" body={(row: LaborRow) => intLabel(row.qtdCasa)} />
                <Column pt={cell('Terceiros')} field="qtdTerceiros" header="Terceiros" body={(row: LaborRow) => intLabel(row.qtdTerceiros)} />
                <Column pt={cell('Total')} field="qtdTotal" header="Total" body={(row: LaborRow) => intLabel(row.qtdTotal)} />
                <Column pt={cell('Observação', 'wide')}
                  field="observacao"
                  header="Observação"
                  body={(row: LaborRow) => laborInactive(row)
                    ? <span title={`Inativado por ${row.inativadoPor || '—'} em ${row.inativadoEm || '—'}`}>
                        <Tag severity="danger" value="INATIVO" /> {row.motivoInativacao || ''}
                      </span>
                    : row.observacao}
                />
                <Column pt={cell('Criado por')} field="matriculaCriacao" header="Criado por" />
                <Column pt={cell('Ações', 'actions')}
                  header=""
                  body={(row: LaborRow) => canEdit && !laborInactive(row) ? (
                    <div className="row-actions">
                      <Button icon="pi pi-pencil" text rounded className="table-action" title="Editar" onClick={() => openEditLabor(row)} />
                      <Button
                        icon="pi pi-ban"
                        text
                        rounded
                        className="table-action danger-action"
                        title="Inativar lançamento"
                        onClick={() => openDeactivateLabor(row)}
                      />
                    </div>
                  ) : null}
                />
              </DataTable>
            </section>
          </>
        )}

        {section === 'auditoria' && (
          <section className="panel workspace-page">
            <div className="panel-head">
              <div>
                <small className="panel-eyebrow">GOVERNANÇA</small>
                <h2>Histórico de auditoria</h2>
                <p>{isClient ? `Eventos vinculados à competência ${monthLabel(selectedMonth)}.` : 'Alterações relevantes registradas com autor, versão e estado anterior/posterior.'}</p>
              </div>
              <Button icon="pi pi-refresh" text rounded onClick={() => void reloadAudit()} />
            </div>
            <div className="page-table">
              <DataTable className="mobile-record-table audit-record-table" value={audits} paginator rows={20} scrollable dataKey="idAuditoria" emptyMessage="Nenhum evento de auditoria encontrado.">
                <Column pt={cell('Data/hora', 'title')} field="dataHora" header="Data/hora" />
                <Column pt={cell('Entidade')} field="entidade" header="Entidade" />
                <Column pt={cell('Registro', 'wide')} field="idRegistro" header="Registro" />
                <Column pt={cell('Ação')} field="acao" header="Ação" />
                <Column pt={cell('Autor')} field="matriculaAutor" header="Autor" />
                <Column pt={cell('Versão anterior')} field="versaoAnterior" header="Versão anterior" />
                <Column pt={cell('Versão nova')} field="versaoNova" header="Versão nova" />
                <Column pt={cell('Ações', 'actions')} header="" body={(r: AuditRow) => <Button icon="pi pi-search" text rounded title="Ver detalhes" onClick={() => setSelectedAudit(r)} />} />
              </DataTable>
            </div>
          </section>
        )}

        {section === 'precos' && (
          <section className="panel workspace-page">
            <div className="panel-head">
              <div>
                <small className="panel-eyebrow">PRECIFICAÇÃO</small>
                <h2>Tabela de preços</h2>
                <p>Vigências preservam o histórico financeiro dos lançamentos já efetivados.</p>
              </div>
              <Button icon="pi pi-refresh" text rounded onClick={() => void loadPrices()} />
            </div>
            <div className="page-body">
              {canManagePrices && (
                <div className="price-create">
                  <label>Nova vigência<Calendar value={priceForm.vigenciaInicio} onChange={e => setPriceForm({ ...priceForm, vigenciaInicio: e.value as Date })} dateFormat="dd/mm/yy" /></label>
                  <label>Nacionalização<InputNumber value={priceForm.valorNacionalizacao} onValueChange={e => setPriceForm({ ...priceForm, valorNacionalizacao: e.value || 0 })} mode="currency" currency="BRL" locale="pt-BR" min={0} minFractionDigits={4} maxFractionDigits={4} /></label>
                  <label>RFID/ADIPAC<InputNumber value={priceForm.valorRfidAdicional} onValueChange={e => setPriceForm({ ...priceForm, valorRfidAdicional: e.value || 0 })} mode="currency" currency="BRL" locale="pt-BR" min={0} minFractionDigits={4} maxFractionDigits={4} /></label>
                  <label>Transformação em tester<InputNumber value={priceForm.valorTester} onValueChange={e => setPriceForm({ ...priceForm, valorTester: e.value || 0 })} mode="currency" currency="BRL" locale="pt-BR" min={0} minFractionDigits={4} maxFractionDigits={4} /></label>
                  <label>Etiqueta confeccionada<InputNumber value={priceForm.valorConfeccao} onValueChange={e => setPriceForm({ ...priceForm, valorConfeccao: e.value || 0 })} mode="currency" currency="BRL" locale="pt-BR" min={0} minFractionDigits={4} maxFractionDigits={4} /></label>
                  <label className="price-observation">Observação<InputText value={priceForm.observacao} onChange={e => setPriceForm({ ...priceForm, observacao: e.target.value })} placeholder="Motivo ou referência da alteração" /></label>
                  <Button label="Criar vigência" icon="pi pi-plus" className="primary" loading={saving} onClick={createPrice} />
                </div>
              )}
              <div className="price-rule"><strong>Regra de cobrança:</strong> Nacionalização = R$ 0,4100; RFID/ADIPAC = R$ 0,1900 por unidade (RFID, ADIPAC ou os dois); Nacionalização + RFID/ADIPAC = R$ 0,6000; Etiqueta confeccionada = R$ 0,1500; Transformação em tester = tarifa a definir. Nacionalização, RFID/ADIPAC e tester não podem passar da quantidade retrabalhada. As tarifas são mantidas com 4 casas decimais.</div>
              <DataTable className="mobile-record-table price-record-table" value={prices} paginator rows={10} dataKey="id" emptyMessage="Nenhuma vigência cadastrada.">
                <Column pt={cell('Início', 'title')} field="vigenciaInicio" header="Início" body={(r: PriceRow) => dateLabel(r.vigenciaInicio)} />
                <Column pt={cell('Fim')} field="vigenciaFim" header="Fim" body={(r: PriceRow) => r.vigenciaFim ? dateLabel(r.vigenciaFim) : 'Vigente'} />
                <Column pt={cell('Nacionalização')} field="valorNacionalizacao" header="Nacionalização" body={(r: PriceRow) => rateMoney(r.valorNacionalizacao)} />
                <Column pt={cell('RFID/ADIPAC')} field="valorRfidAdicional" header="RFID/ADIPAC" body={(r: PriceRow) => rateMoney(r.valorRfidAdicional)} />
                <Column pt={cell('Tester')} field="valorTester" header="Tester" body={(r: PriceRow) => rateMoney(Number(r.valorTester || 0))} />
                <Column pt={cell('Etq. confeccionada')} field="valorConfeccao" header="Etq. confeccionada" body={(r: PriceRow) => rateMoney(Number(r.valorConfeccao || 0))} />
                <Column pt={cell('Observação', 'wide')} field="observacao" header="Observação" />
                <Column pt={cell('Criado por')} field="criadoPor" header="Criado por" />
              </DataTable>
            </div>
          </section>
        )}

        {section === 'usuarios' && canUsers && (
          <section className="panel workspace-page">
            <div className="panel-head">
              <div>
                <small className="panel-eyebrow">ADMINISTRAÇÃO</small>
                <h2>Controle de usuários</h2>
                <p>Criação, perfil, status e primeiro acesso por matrícula.</p>
              </div>
              <Button icon="pi pi-refresh" text rounded onClick={() => void reloadUsers()} />
            </div>
            <div className="page-body">
              <div className="user-form">
                <label>
                  Matrícula
                  <InputText
                    placeholder="Ex.: 358038"
                    value={newUser.matricula}
                    onChange={e => setNewUser({ ...newUser, matricula: e.target.value })}
                  />
                </label>
                <label>
                  Nome
                  <InputText
                    placeholder="Nome do usuário"
                    value={newUser.nome}
                    onChange={e => setNewUser({ ...newUser, nome: e.target.value })}
                  />
                </label>
                <label>
                  Perfil
                  <Dropdown
                    aria-label="Perfil"
                    value={newUser.perfil}
                    options={PROFILE_OPTIONS}
                    optionLabel="label"
                    optionValue="value"
                    onChange={e => setNewUser({ ...newUser, perfil: e.value as Profile })}
                  />
                </label>
                <label>
                  Senha temporária
                  <InputText
                    placeholder="Mínimo de 8 caracteres"
                    type="password"
                    value={newUser.senhaTemporaria}
                    onChange={e => setNewUser({ ...newUser, senhaTemporaria: e.target.value })}
                  />
                </label>
                <label className="user-branches-field">
                  Filiais / CNPJs
                  <MultiSelect
                    value={newUser.cnpjs}
                    options={allBranches.map(branch => ({ label: branchLabel(branch), value: branch.cnpj }))}
                    onChange={e => setNewUser({ ...newUser, cnpjs: e.value || [] })}
                    placeholder={newUser.perfil === 'ADMIN' ? 'Vazio = todas as filiais' : 'Selecione uma ou mais filiais'}
                    display="chip"
                    filter
                  />
                </label>
                <Button label="Criar usuário" icon="pi pi-plus" onClick={createUser} loading={saving} className="primary form-submit user-submit" />
              </div>
              {userError && (
                <div className="error user-error">
                  <i className="pi pi-exclamation-circle" />{userError}
                </div>
              )}
              <DataTable className="mobile-record-table users-record-table" value={users} rows={15} paginator dataKey="matricula">
                <Column pt={cell('Matrícula')} field="matricula" header="Matrícula" />
                <Column pt={cell('Nome', 'title')} field="nome" header="Nome" />
                <Column pt={cell('Perfil')} field="perfil" header="Perfil" body={(r: ManagedUser) => <Tag value={r.perfil} />} />
                <Column pt={cell('Ativo')} field="ativo" header="Ativo" body={(r: ManagedUser) => <Tag severity={r.ativo === 'SIM' ? 'success' : 'secondary'} value={r.ativo} />} />
                <Column pt={cell('Troca pendente')} field="trocaSenhaObrigatoria" header="Troca pendente" />
                <Column pt={cell('Filiais')}
                  header="Filiais"
                  body={(r: ManagedUser) => r.cnpjs?.length ? `${r.cnpjs.length} vinculada(s)` : r.perfil === 'ADMIN' ? 'Todas' : 'Nenhuma'}
                />
                <Column pt={cell('Ações', 'actions')} header="" body={(r: ManagedUser) => <Button icon="pi pi-pencil" text rounded onClick={() => { setUserError(''); setEditingUser({ ...r }) }} />} />
              </DataTable>
            </div>
          </section>
        )}
        </div>
      </section>

      <Dialog
        header="Editar retrabalho"
        visible={dialog}
        onHide={() => !saving && setDialog(false)}
        style={{ width: 'min(760px, 96vw)' }}
      >
        <div className="form-grid">
          <label>
            Data de efetivação *
            <Calendar
              value={form.dataEfetivacao}
              onChange={e => setForm({ ...form, dataEfetivacao: e.value as Date })}
              dateFormat="dd/mm/yy"
            />
          </label>
          <label className="span-2">
            Cliente / filial *
            <Dropdown
              aria-label="Cliente / filial"
              value={form.cnpjCliente}
              options={branches.map(branch => ({ label: branchLabel(branch), value: branch.cnpj }))}
              optionLabel="label"
              optionValue="value"
              placeholder="Selecione a filial"
              onChange={e => setForm({ ...form, cnpjCliente: String(e.value ?? '') })}
              disabled={Boolean(form.numeroProcesso)}
              required
            />
          </label>
          {form.numeroProcesso && (
            <label className="span-2">
              Processo
              <InputText value={form.numeroProcesso} disabled />
            </label>
          )}
          <label>
            SKU *
            <InputText value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} disabled={Boolean(form.numeroProcesso)} />
          </label>
          <label className="span-2">
            Descrição *
            <InputText value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} disabled={Boolean(form.numeroProcesso)} />
          </label>
          <label>
            Quantidade retrabalhada *
            <InputNumber
              value={form.quantidade}
              onValueChange={e => setForm({ ...form, quantidade: e.value ?? null })}
              placeholder="0"
              min={1}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <label>
            Etiquetas nacionalização
            <InputNumber
              value={form.nacionalizacao}
              onValueChange={e => setForm({ ...form, nacionalizacao: e.value ?? null })}
              placeholder="0"
              min={0}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <label>
            Etiquetas RFID/ADIPAC
            <InputNumber
              value={form.rfid}
              onValueChange={e => setForm({ ...form, rfid: e.value ?? null })}
              placeholder="0"
              min={0}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <label>
            Transformação em tester
            <InputNumber
              value={form.tester}
              onValueChange={e => setForm({ ...form, tester: e.value ?? null })}
              placeholder="0"
              min={0}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <label>
            Etiquetas confeccionadas
            <InputNumber
              value={form.confeccao}
              onValueChange={e => setForm({ ...form, confeccao: e.value ?? null })}
              placeholder="0"
              min={0}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <p className="form-hint span-2">
            * Obrigatórios. Nacionalização, RFID/ADIPAC e tester não podem passar da quantidade retrabalhada.
            RFID, ADIPAC ou ambos na mesma unidade são cobrados uma única vez.
          </p>
        </div>

        <div className="billing-preview billing-preview-5">
          <div>
            <span>Nacionalização</span>
            <strong>{previewPrice ? money(previewPrice.nat) : 'Sem vigência'}</strong>
            <small>
              {previewPrice
                ? `${intLabel(form.nacionalizacao)} × ${rateMoney(previewPrice.price.valorNacionalizacao)}`
                : 'Cadastre uma tabela válida para a data.'}
            </small>
          </div>
          <div>
            <span>RFID/ADIPAC</span>
            <strong>{previewPrice ? money(previewPrice.rfid) : '—'}</strong>
            <small>
              {previewPrice
                ? `${intLabel(form.rfid)} × ${rateMoney(previewPrice.price.valorRfidAdicional)}`
                : '—'}
            </small>
          </div>
          <div>
            <span>Tester</span>
            <strong>{previewPrice ? money(previewPrice.tester) : '—'}</strong>
            <small>{previewPrice ? `${intLabel(form.tester)} × ${rateMoney(Number(previewPrice.price.valorTester || 0))}` : '—'}</small>
          </div>
          <div>
            <span>Confeccionadas</span>
            <strong>{previewPrice ? money(previewPrice.confeccao) : '—'}</strong>
            <small>{previewPrice ? `${intLabel(form.confeccao)} × ${rateMoney(Number(previewPrice.price.valorConfeccao || 0))}` : '—'}</small>
          </div>
          <div className="billing-total">
            <span>Total previsto</span>
            <strong>{previewPrice ? money(previewPrice.total) : '—'}</strong>
            <small>O valor definitivo é calculado pelo backend ao salvar.</small>
          </div>
        </div>

        <div className="dialog-actions">
          <Button label="Cancelar" text disabled={saving} onClick={() => setDialog(false)} />
          <Button label="Salvar" icon="pi pi-check" className="primary" loading={saving} onClick={save} />
        </div>
        {formError && <div className="error"><i className="pi pi-exclamation-circle" />{formError}</div>}
      </Dialog>

      <Dialog
        header={laborForm.id ? 'Editar mão de obra' : 'Lançar mão de obra'}
        visible={laborDialog}
        onHide={() => !saving && setLaborDialog(false)}
        style={{ width: 'min(620px, 96vw)' }}
      >
        <div className="form-grid">
          <label>
            Data
            <Calendar
              value={laborForm.data}
              onChange={e => setLaborForm({ ...laborForm, data: e.value as Date })}
              dateFormat="dd/mm/yy"
            />
          </label>
          <label>
            Cliente / filial
            <Dropdown
              aria-label="Cliente / filial"
              value={laborForm.cnpjCliente}
              options={branches.map(branch => ({ label: branchLabel(branch), value: branch.cnpj }))}
              optionLabel="label"
              optionValue="value"
              placeholder="Selecione a filial"
              onChange={e => setLaborForm({ ...laborForm, cnpjCliente: String(e.value ?? '') })}
            />
          </label>
          <label>
            Mão de obra da casa
            <InputNumber
              value={laborForm.qtdCasa}
              onValueChange={e => setLaborForm({ ...laborForm, qtdCasa: e.value ?? null })}
              placeholder="0"
              min={0}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <label>
            Terceiros
            <InputNumber
              value={laborForm.qtdTerceiros}
              onValueChange={e => setLaborForm({ ...laborForm, qtdTerceiros: e.value ?? null })}
              placeholder="0"
              min={0}
              locale="pt-BR"
              maxFractionDigits={0}
            />
          </label>
          <label className="span-2">
            Observação (opcional)
            <InputText
              value={laborForm.observacao}
              onChange={e => setLaborForm({ ...laborForm, observacao: e.target.value })}
              placeholder="Ex.: reforço para inventário"
            />
          </label>
        </div>

        <div className="labor-preview">
          <span>Total do dia</span>
          <strong>{(Number(laborForm.qtdCasa || 0) + Number(laborForm.qtdTerceiros || 0)).toLocaleString('pt-BR')} pessoa(s)</strong>
        </div>

        <div className="dialog-actions">
          <Button label="Cancelar" text disabled={saving} onClick={() => setLaborDialog(false)} />
          <Button label="Salvar" icon="pi pi-check" className="primary" loading={saving} onClick={saveLabor} />
        </div>
        {laborError && <div className="error"><i className="pi pi-exclamation-circle" />{laborError}</div>}
      </Dialog>

      <Dialog
        header="Novo lançamento"
        visible={batchDialog}
        onHide={() => !saving && setBatchDialog(false)}
        style={{ width: 'min(1180px, 98vw)' }}
      >
        <div className="batch-head">
          <label>
            Data de efetivação *
            <Calendar
              value={batch.dataEfetivacao}
              onChange={e => setBatch({ ...batch, dataEfetivacao: e.value as Date })}
              dateFormat="dd/mm/yy"
            />
          </label>
          <label>
            Número do processo *
            <Dropdown
              aria-label="Número do processo"
              value={batch.idProcesso}
              options={processes.map(item => ({ label: `${item.numero} · ${item.nomeCliente} · ${item.filial}`, value: item.id }))}
              optionLabel="label"
              optionValue="value"
              placeholder="Selecione o processo"
              onChange={e => selectBatchProcess(String(e.value ?? ''))}
              filter
            />
          </label>
          <label className="batch-skus">
            SKUs do processo (1 a {MAX_BATCH_SKUS}) *
            <MultiSelect
              value={batch.skus}
              options={batchSkuOptions}
              onChange={e => changeBatchSkus((e.value || []) as string[])}
              placeholder={batch.idProcesso ? 'Pesquise por código de barras ou descrição' : 'Selecione o processo primeiro'}
              disabled={!batch.idProcesso || skusLoading}
              filter
              filterPlaceholder="Código de barras ou descrição"
              selectionLimit={MAX_BATCH_SKUS}
              display="comma"
              maxSelectedLabels={2}
              selectedItemsLabel="{0} SKUs selecionados"
              virtualScrollerOptions={{ itemSize: 38 }}
              showSelectAll={false}
              emptyFilterMessage="Nenhum SKU encontrado"
            />
          </label>
        </div>

        {batch.lines.length > 0 ? (
          <div className="batch-lines">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SKU</th>
                  <th>Descrição</th>
                  <th>Qtd. retrabalhada *</th>
                  <th>Nacionalização</th>
                  <th>RFID/ADIPAC</th>
                  <th>Tester</th>
                  <th>Confeccionadas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batch.lines.map((line, index) => {
                  const problem = lineError(line)
                  return (
                    <tr key={line.sku} className={problem && line.quantidade != null ? 'has-error' : ''} title={problem || undefined}>
                      <td className="batch-index" data-label="#">{index + 1}</td>
                      <td className="batch-sku" data-label="SKU">{line.sku}</td>
                      <td className="batch-desc" data-label="Descrição">{line.descricao}</td>
                      <td data-label="Qtd. retrabalhada *"><InputNumber value={line.quantidade} onValueChange={e => updateBatchLine(line.sku, 'quantidade', e.value ?? null)} placeholder="0" min={0} locale="pt-BR" maxFractionDigits={0} inputClassName="batch-input" /></td>
                      <td data-label="Nacionalização"><InputNumber value={line.nacionalizacao} onValueChange={e => updateBatchLine(line.sku, 'nacionalizacao', e.value ?? null)} placeholder="0" min={0} locale="pt-BR" maxFractionDigits={0} inputClassName="batch-input" /></td>
                      <td data-label="RFID/ADIPAC"><InputNumber value={line.rfid} onValueChange={e => updateBatchLine(line.sku, 'rfid', e.value ?? null)} placeholder="0" min={0} locale="pt-BR" maxFractionDigits={0} inputClassName="batch-input" /></td>
                      <td data-label="Tester"><InputNumber value={line.tester} onValueChange={e => updateBatchLine(line.sku, 'tester', e.value ?? null)} placeholder="0" min={0} locale="pt-BR" maxFractionDigits={0} inputClassName="batch-input" /></td>
                      <td data-label="Confeccionadas"><InputNumber value={line.confeccao} onValueChange={e => updateBatchLine(line.sku, 'confeccao', e.value ?? null)} placeholder="0" min={0} locale="pt-BR" maxFractionDigits={0} inputClassName="batch-input" /></td>
                      <td className="batch-remove"><Button icon="pi pi-times" text rounded className="table-action" title="Remover SKU" aria-label={`Remover SKU ${line.sku}`} onClick={() => removeBatchLine(line.sku)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="form-hint batch-empty">Selecione o processo e os SKUs que serão lançados. Cada SKU vira uma linha para preencher as quantidades.</p>
        )}

        <div className="batch-summary">
          <span><strong>{batch.lines.length}</strong> SKU(s)</span>
          <span>Retrabalhadas <strong>{intLabel(batchPreview.qty.quantidade)}</strong></span>
          <span>Nacionalização <strong>{intLabel(batchPreview.qty.nacionalizacao)}</strong></span>
          <span>RFID/ADIPAC <strong>{intLabel(batchPreview.qty.rfid)}</strong></span>
          <span>Tester <strong>{intLabel(batchPreview.qty.tester)}</strong></span>
          <span>Confeccionadas <strong>{intLabel(batchPreview.qty.confeccao)}</strong></span>
          <span className="batch-total">Total previsto <strong>{batchPreview.total == null ? 'Sem vigência' : money(batchPreview.total)}</strong></span>
        </div>
        <p className="form-hint">
          Nacionalização, RFID/ADIPAC e tester não podem passar da quantidade retrabalhada. Cada SKU precisa de ao menos um serviço.
          O valor definitivo é calculado pelo backend com a tabela de preços vigente na data.
        </p>

        <div className="dialog-actions">
          <Button label="Cancelar" text disabled={saving} onClick={() => setBatchDialog(false)} />
          <Button label={batch.lines.length > 1 ? `Salvar ${batch.lines.length} lançamentos` : 'Salvar lançamento'} icon="pi pi-check" className="primary" loading={saving} onClick={saveBatch} disabled={!batch.lines.length} />
        </div>
        {batchError && <div className="error"><i className="pi pi-exclamation-circle" />{batchError}</div>}
      </Dialog>

      <Dialog
        header="Cancelar cobrança"
        visible={Boolean(cancelTarget)}
        onHide={() => !saving && setCancelTarget(null)}
        style={{ width: 'min(520px, 94vw)' }}
      >
        {cancelTarget && (
          <div className="cancel-charge">
            <div className="cancel-summary">
              <span>Registro</span>
              <strong>{cancelTarget.id}</strong>
              <span>Valor original</span>
              <strong>{money(cancelTarget.valorTotalCobranca)}</strong>
            </div>
            <p>O retrabalho continuará no histórico. Apenas a cobrança deixará de compor os totais financeiros.</p>
            <label>
              Motivo do cancelamento
              <InputText
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Ex.: lançamento duplicado"
                autoFocus
              />
            </label>
            {cancelError && <div className="error"><i className="pi pi-exclamation-circle" />{cancelError}</div>}
          </div>
        )}
        <div className="dialog-actions">
          <Button label="Voltar" text disabled={saving} onClick={() => setCancelTarget(null)} />
          <Button label="Cancelar cobrança" icon="pi pi-ban" severity="danger" loading={saving} onClick={cancelCharge} />
        </div>
      </Dialog>

      <Dialog
        header="Inativar lançamento de mão de obra"
        visible={Boolean(laborDeactivateTarget)}
        onHide={() => !saving && setLaborDeactivateTarget(null)}
        style={{ width: 'min(520px, 94vw)' }}
      >
        {laborDeactivateTarget && (
          <div className="cancel-charge">
            <div className="cancel-summary">
              <span>Data</span>
              <strong>{dateLabel(laborDeactivateTarget.data)}</strong>
              <span>Filial</span>
              <strong>{laborDeactivateTarget.nomeCliente} · {laborDeactivateTarget.filial}</strong>
              <span>Casa / Terceiros</span>
              <strong>{intLabel(laborDeactivateTarget.qtdCasa)} / {intLabel(laborDeactivateTarget.qtdTerceiros)}</strong>
            </div>
            <p>O lançamento sai da lista e dos totais, mas permanece registrado na planilha e na auditoria. A data fica liberada para um novo lançamento desta filial.</p>
            <label>
              Motivo da inativação
              <InputText
                value={laborDeactivateReason}
                onChange={e => setLaborDeactivateReason(e.target.value)}
                placeholder="Ex.: lançado na filial errada"
                autoFocus
              />
            </label>
            {laborDeactivateError && <div className="error"><i className="pi pi-exclamation-circle" />{laborDeactivateError}</div>}
          </div>
        )}
        <div className="dialog-actions">
          <Button label="Voltar" text disabled={saving} onClick={() => setLaborDeactivateTarget(null)} />
          <Button label="Inativar lançamento" icon="pi pi-ban" severity="danger" loading={saving} onClick={deactivateLabor} />
        </div>
      </Dialog>

      <Dialog
        header="Editar usuário"
        visible={Boolean(editingUser)}
        onHide={() => !saving && setEditingUser(null)}
        style={{ width: 'min(520px, 94vw)' }}
      >
        {editingUser && (
          <div className="form-grid single">
            <label>Matrícula<InputText value={editingUser.matricula} disabled /></label>
            <label>Nome<InputText value={editingUser.nome} disabled /></label>
            <label>
              Perfil
              <Dropdown
                aria-label="Perfil"
                value={editingUser.perfil}
                options={PROFILE_OPTIONS}
                optionLabel="label"
                optionValue="value"
                onChange={e => setEditingUser({ ...editingUser, perfil: e.value as Profile })}
              />
            </label>
            <label>
              Status
              <Dropdown
                aria-label="Status"
                value={editingUser.ativo}
                options={USER_STATUS_OPTIONS}
                optionLabel="label"
                optionValue="value"
                onChange={e => setEditingUser({
                  ...editingUser,
                  ativo: e.value as 'SIM' | 'NAO',
                })}
              />
            </label>
            <label>
              Filiais / CNPJs
              <MultiSelect
                value={editingUser.cnpjs || []}
                options={allBranches.map(branch => ({ label: branchLabel(branch), value: branch.cnpj }))}
                onChange={e => setEditingUser({ ...editingUser, cnpjs: e.value || [] })}
                placeholder={editingUser.perfil === 'ADMIN' ? 'Vazio = todas as filiais' : 'Selecione uma ou mais filiais'}
                display="chip"
                filter
              />
            </label>
          </div>
        )}

        {userError && (
          <div className="error user-error">
            <i className="pi pi-exclamation-circle" />{userError}
          </div>
        )}

        <div className="dialog-actions">
          <Button label="Cancelar" text disabled={saving} onClick={() => { setEditingUser(null); setUserError('') }} />
          <Button label="Salvar" className="primary" loading={saving} onClick={updateUser} />
        </div>
      </Dialog>

      <Dialog
        header="Detalhes da auditoria"
        visible={Boolean(selectedAudit)}
        onHide={() => setSelectedAudit(null)}
        style={{ width: 'min(900px, 96vw)' }}
      >
        {selectedAudit && (
          <div className="audit-details">
            <div>
              <span>Registro</span>
              <strong>{selectedAudit.idRegistro}</strong>
            </div>
            <div>
              <span>Ação</span>
              <strong>{selectedAudit.acao}</strong>
            </div>
            <section>
              <h3>Antes</h3>
              <pre>{selectedAudit.dadosAntes || 'Sem estado anterior.'}</pre>
            </section>
            <section>
              <h3>Depois</h3>
              <pre>{selectedAudit.dadosDepois || 'Sem estado posterior.'}</pre>
            </section>
          </div>
        )}
      </Dialog>

      <Dialog
        header={user.trocaSenhaObrigatoria ? 'Defina sua nova senha' : 'Alterar senha'}
        visible={passwordDialog}
        closable={!user.trocaSenhaObrigatoria}
        closeOnEscape={!user.trocaSenhaObrigatoria}
        onHide={() => {
          if (!user.trocaSenhaObrigatoria) setPasswordDialog(false)
        }}
        style={{ width: 'min(480px, 94vw)' }}
      >
        {user.trocaSenhaObrigatoria && (
          <p className="dialog-note">
            Este é seu primeiro acesso. Troque a senha temporária para continuar utilizando o sistema.
          </p>
        )}

        <div className="password-form">
          <label>
            Nova senha
            <Password
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              toggleMask
              feedback={false}
            />
          </label>
          <label>
            Confirmar nova senha
            <Password
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              toggleMask
              feedback={false}
            />
          </label>
          <div className="password-rules" aria-live="polite">
            <span className={newPassword.length >= 8 ? 'is-valid' : ''}>
              <i className={newPassword.length >= 8 ? 'pi pi-check-circle' : 'pi pi-circle'} />
              Pelo menos 8 caracteres
            </span>
            <span className={newPassword.length > 0 && newPassword === confirmPassword ? 'is-valid' : ''}>
              <i className={newPassword.length > 0 && newPassword === confirmPassword ? 'pi pi-check-circle' : 'pi pi-circle'} />
              As duas senhas devem coincidir
            </span>
          </div>

          {passwordError && (
            <div className="error">
              <i className="pi pi-exclamation-circle" />{passwordError}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          {!user.trocaSenhaObrigatoria && (
            <Button label="Cancelar" text disabled={saving} onClick={() => setPasswordDialog(false)} />
          )}
          <Button
            label="Alterar senha"
            icon="pi pi-key"
            className="primary"
            loading={saving}
            onClick={changePassword}
          />
        </div>
      </Dialog>
    </main>
  )
}
