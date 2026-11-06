'use client'

// Tela aberta de solicitação de custo extra (05/11/2026) — substitui o Google Forms.
// Sem login. Mão de obra e alimentação/bebidas podem ir no mesmo envio (uma solicitação para cada).
// As opções vêm dos cadastros do Extra; o servidor valida tudo de novo e é a autoridade.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from 'primereact/button'
import { BrandBackdrop } from '@/components/brand/BrandBackdrop'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import {
  PublicRequestError,
  fetchPublicOptions,
  newSendId,
  sendPublicRequest,
  type PublicOptions,
  type PublicProtocol,
} from '@/features/public-request/publicRequestService'

type Form = {
  nomeSolicitante: string
  supervisor: string
  operacao: string
  dataOperacional: string
  justificativa: string
  querMaoDeObra: boolean
  querAlimentacao: boolean
  atividade: string
  funcao: string
  turno: string
  quantidade: string
  volumeReferencia: string
  unidadeVolume: string
  produtoAlimentacao: string
  qtdAlimentacao: string
  produtoBebida: string
  qtdBebida: string
  responsavelCusto: string
  centroCusto: string
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyForm = (keep?: Partial<Form>): Form => ({
  nomeSolicitante: keep?.nomeSolicitante || '',
  supervisor: keep?.supervisor || '',
  operacao: keep?.operacao || '',
  dataOperacional: today(),
  justificativa: '',
  querMaoDeObra: false,
  querAlimentacao: false,
  atividade: '',
  funcao: '',
  turno: '',
  quantidade: '',
  volumeReferencia: '',
  unidadeVolume: '',
  produtoAlimentacao: '',
  qtdAlimentacao: '',
  produtoBebida: '',
  qtdBebida: '',
  responsavelCusto: '',
  centroCusto: '',
})

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 5)
const toOptions = (items: string[]) => items.map((item) => ({ label: item, value: item }))

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`pr-field${error ? ' has-error' : ''}`}>
      <span className="pr-label">{label}{required && <em aria-hidden="true"> *</em>}</span>
      {children}
      {error ? <small className="pr-error" role="alert">{error}</small> : hint ? <small className="pr-hint">{hint}</small> : null}
    </label>
  )
}

// Código e referência do erro, discretos, com botão para copiar (para o suporte achar no log).
function ErrorReference({ error }: { error: PublicRequestError | null }) {
  const [copied, setCopied] = useState(false)
  if (!error || (!error.code && !error.requestId)) return null
  const time = error.at.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const reference = [error.code && `Código: ${error.code}`, error.requestId && `Ref.: ${error.requestId}`, time].filter(Boolean).join(' · ')
  return (
    <span className="pr-error-ref">
      {reference}
      <button
        type="button"
        onClick={() => { void navigator.clipboard?.writeText(`${error.message} — ${reference}`).then(() => setCopied(true)).catch(() => undefined) }}
        aria-label="Copiar detalhes do erro"
      >
        <i className={`pi ${copied ? 'pi-check' : 'pi-copy'}`} aria-hidden="true" /> {copied ? 'Copiado' : 'Copiar'}
      </button>
    </span>
  )
}

function Section({ step, title, description, children }: { step: number; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="pr-section">
      <header className="pr-section-head">
        <span className="pr-step">{step}</span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="pr-section-body">{children}</div>
    </section>
  )
}

export function PublicRequestPage() {
  const [options, setOptions] = useState<PublicOptions | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadErrorInfo, setLoadErrorInfo] = useState<PublicRequestError | null>(null)
  const [submitErrorInfo, setSubmitErrorInfo] = useState<PublicRequestError | null>(null)
  const [form, setForm] = useState<Form>(() => emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof Form | 'tipo' | 'itens', string>>>({})
  const [submitError, setSubmitError] = useState('')
  const [sending, setSending] = useState(false)
  const [protocols, setProtocols] = useState<PublicProtocol[] | null>(null)
  const [honeypot, setHoneypot] = useState('')
  // Quem já tem sessão de gestão vê "Ir para a gestão" em vez de "Acesso à gestão".
  const [loggedIn, setLoggedIn] = useState(false)
  const sendId = useRef(newSendId())
  const openedAt = useRef(Date.now())

  async function load() {
    setLoadError('')
    setLoadErrorInfo(null)
    try {
      setOptions(await fetchPublicOptions())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o formulário.')
      setLoadErrorInfo(error instanceof PublicRequestError ? error : null)
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    fetch('/api/auth/me', { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) return
        const payload = await response.json().catch(() => null) as { ok?: boolean } | null
        if (payload?.ok) setLoggedIn(true)
      })
      .catch(() => undefined)
  }, [])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === 'querMaoDeObra' || key === 'querAlimentacao' ? { tipo: undefined } : {}) }))
  }

  const responsible = options?.responsaveis.find((item) => item.nome === form.responsavelCusto)
  const needsCostCenter = Boolean(responsible?.exigeCentroCusto)

  // Centros do supervisor primeiro; depois os demais.
  const costCenterOptions = useMemo(() => {
    if (!options) return []
    const linked = new Set(options.vinculos[form.supervisor.toUpperCase()] || [])
    const label = (c: { codigo: string; descricao: string }) => (c.descricao ? `${c.codigo} — ${c.descricao}` : c.codigo)
    const mine = options.centros.filter((c) => linked.has(c.codigo)).map((c) => ({ label: label(c), value: c.codigo, group: 'Do supervisor' }))
    const others = options.centros.filter((c) => !linked.has(c.codigo)).map((c) => ({ label: label(c), value: c.codigo, group: 'Outros' }))
    return mine.length
      ? [{ label: `Centros de ${form.supervisor}`, items: mine }, { label: 'Outros centros de custo', items: others }]
      : [{ label: 'Centros de custo', items: others }]
  }, [options, form.supervisor])

  // Sugere o centro de custo quando o supervisor tem exatamente um vinculado.
  useEffect(() => {
    if (!options || !needsCostCenter || form.centroCusto) return
    const linked = options.vinculos[form.supervisor.toUpperCase()] || []
    if (linked.length === 1) setForm((current) => ({ ...current, centroCusto: linked[0] }))
  }, [options, needsCostCenter, form.supervisor, form.centroCusto])

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.nomeSolicitante.trim()) e.nomeSolicitante = 'Informe seu nome.'
    if (!form.supervisor) e.supervisor = 'Selecione o supervisor.'
    if (!form.operacao) e.operacao = 'Selecione a operação.'
    if (!form.dataOperacional) e.dataOperacional = 'Informe a data em que o serviço vai acontecer.'
    if (!form.justificativa.trim()) e.justificativa = 'Explique o motivo da solicitação.'
    if (!form.querMaoDeObra && !form.querAlimentacao) e.tipo = 'Escolha mão de obra, alimentação/bebidas ou os dois.'
    if (form.querMaoDeObra) {
      if (!form.atividade) e.atividade = 'Selecione a atividade.'
      if (!form.funcao) e.funcao = 'Selecione a função.'
      if (!form.turno) e.turno = 'Selecione o turno.'
      if (!Number(form.quantidade)) e.quantidade = 'Informe quantas pessoas (número inteiro).'
    }
    if (form.querAlimentacao) {
      if (!form.produtoAlimentacao && !form.produtoBebida) e.itens = 'Escolha ao menos uma alimentação ou uma bebida.'
      if (form.produtoAlimentacao && !Number(form.qtdAlimentacao)) e.qtdAlimentacao = 'Informe a quantidade.'
      if (!form.produtoAlimentacao && form.qtdAlimentacao) e.produtoAlimentacao = 'Escolha a alimentação ou apague a quantidade.'
      if (form.produtoBebida && !Number(form.qtdBebida)) e.qtdBebida = 'Informe a quantidade.'
      if (!form.produtoBebida && form.qtdBebida) e.produtoBebida = 'Escolha a bebida ou apague a quantidade.'
    }
    if (!form.responsavelCusto) e.responsavelCusto = 'Selecione quem é responsável pelo custo.'
    if (needsCostCenter && !form.centroCusto) e.centroCusto = 'Selecione o centro de custo.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    setSubmitError('')
    setSubmitErrorInfo(null)
    if (!validate()) {
      setSubmitError('Confira os campos destacados.')
      return
    }
    setSending(true)
    try {
      const result = await sendPublicRequest({
        idEnvio: sendId.current,
        abertoEm: openedAt.current,
        site: honeypot,
        nomeSolicitante: form.nomeSolicitante.trim(),
        supervisor: form.supervisor,
        operacao: form.operacao,
        dataOperacional: form.dataOperacional,
        justificativa: form.justificativa.trim(),
        responsavelCusto: form.responsavelCusto,
        centroCusto: needsCostCenter ? form.centroCusto : '',
        maoDeObra: form.querMaoDeObra ? {
          atividade: form.atividade, funcao: form.funcao, turno: form.turno, quantidade: form.quantidade,
          volumeReferencia: form.volumeReferencia.trim(), unidadeVolume: form.unidadeVolume.trim(),
        } : null,
        alimentacao: form.querAlimentacao ? {
          produtoAlimentacao: form.produtoAlimentacao, qtdAlimentacao: form.produtoAlimentacao ? form.qtdAlimentacao : '',
          produtoBebida: form.produtoBebida, qtdBebida: form.produtoBebida ? form.qtdBebida : '',
        } : null,
      })
      setProtocols(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      // Mesmo idEnvio na nova tentativa: se o primeiro envio tiver sido gravado, não duplica.
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.')
      setSubmitErrorInfo(error instanceof PublicRequestError ? error : null)
    } finally {
      setSending(false)
    }
  }

  function startNew() {
    setForm((current) => emptyForm({ nomeSolicitante: current.nomeSolicitante, supervisor: current.supervisor, operacao: current.operacao }))
    setErrors({})
    setSubmitError('')
    setProtocols(null)
    sendId.current = newSendId()
    openedAt.current = Date.now()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="pr-page">
      <header className="pr-hero">
        <BrandBackdrop />
        <div className="pr-topbar">
          <div className="pr-brand">
            <img src="/brand/unilog_express_logo_branco_sem_registro.svg" alt="Unilog Express" />
            <span>Extra Cost Control</span>
          </div>
          <a className="pr-admin-link" href="/gestao/">
            <i className={`pi ${loggedIn ? 'pi-arrow-right' : 'pi-lock'}`} aria-hidden="true" /> {loggedIn ? 'Ir para a gestão' : 'Acesso à gestão'}
          </a>
        </div>
        <div className="pr-intro">
          <span className="pr-overline">SOLICITAÇÃO DE CUSTO EXTRA</span>
          <h1>Nova <span className="pr-accent">solicitação</span></h1>
          <p>Registre a necessidade de mão de obra terceirizada ou de alimentação/bebidas. Os valores são calculados depois pelo Administrativo, conforme fornecedores e tabelas vigentes.</p>
        </div>
      </header>

      <main className="pr-main">

        {protocols ? (
          <section className="pr-success" aria-live="polite">
            <i className="pi pi-check-circle" aria-hidden="true" />
            <h2>Solicitação enviada</h2>
            <p>Guarde o número do protocolo para acompanhar com o Administrativo.</p>
            <ul>
              {protocols.map((p) => (
                <li key={p.idSolicitacao}>
                  <span>{p.tipoSolicitacao === 'MAO_DE_OBRA' ? 'Mão de obra terceirizada' : 'Alimentação / bebidas'}</span>
                  <strong>{p.idSolicitacao}</strong>
                </li>
              ))}
            </ul>
            <Button label="Fazer outra solicitação" icon="pi pi-plus" onClick={startNew} className="pr-primary" />
          </section>
        ) : !options ? (
          loadError ? (
            <section className="pr-state pr-state-error">
              <i className="pi pi-exclamation-circle" aria-hidden="true" />
              <p>{loadError}</p>
              <ErrorReference error={loadErrorInfo} />
              <Button label="Tentar novamente" icon="pi pi-refresh" onClick={() => void load()} outlined />
            </section>
          ) : (
            <section className="pr-state"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando formulário…</section>
          )
        ) : (
          <form className="pr-form" onSubmit={(event) => { event.preventDefault(); void submit() }} noValidate>
            {/* Campo-isca do anti-robô: invisível para pessoas. */}
            <div className="pr-hp" aria-hidden="true">
              <label>Site<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
            </div>

            <Section step={1} title="Dados gerais" description="Quem está pedindo, para qual operação e quando.">
              <div className="pr-grid">
                <Field label="Nome do solicitante" required error={errors.nomeSolicitante}>
                  <InputText value={form.nomeSolicitante} onChange={(e) => set('nomeSolicitante', e.target.value)} autoComplete="name" maxLength={120} />
                </Field>
                <Field label="Supervisor responsável" required error={errors.supervisor}>
                  <Dropdown value={form.supervisor} options={toOptions(options.supervisores)} onChange={(e) => { set('supervisor', e.value || ''); set('centroCusto', '') }} filter placeholder="Selecione" />
                </Field>
                <Field label="Operação" required error={errors.operacao}>
                  <Dropdown value={form.operacao} options={toOptions(options.operacoes)} onChange={(e) => set('operacao', e.value || '')} filter placeholder="Selecione" />
                </Field>
                <Field label="Data operacional" required error={errors.dataOperacional} hint="Dia em que o serviço vai acontecer (não a data de hoje, se for diferente).">
                  <InputText type="date" value={form.dataOperacional} onChange={(e) => set('dataOperacional', e.target.value)} />
                </Field>
              </div>
              <Field label="Justificativa" required error={errors.justificativa} hint="Ex.: aumento de volume, carga e descarga, atraso operacional, reforço.">
                <InputTextarea value={form.justificativa} onChange={(e) => set('justificativa', e.target.value)} rows={3} autoResize maxLength={1000} />
              </Field>
            </Section>

            <Section step={2} title="O que você precisa?" description="Pode marcar os dois: cada um vira uma solicitação, com seu protocolo.">
              <div className="pr-choice-row" role="group" aria-label="Tipo de solicitação">
                <button type="button" className={`pr-choice${form.querMaoDeObra ? ' is-on' : ''}`} aria-pressed={form.querMaoDeObra} onClick={() => set('querMaoDeObra', !form.querMaoDeObra)}>
                  <i className="pi pi-users" aria-hidden="true" />
                  <span><strong>Mão de obra terceirizada</strong><small>Pessoas para um serviço</small></span>
                  <i className={`pi ${form.querMaoDeObra ? 'pi-check-square' : 'pi-stop'}`} aria-hidden="true" />
                </button>
                <button type="button" className={`pr-choice${form.querAlimentacao ? ' is-on' : ''}`} aria-pressed={form.querAlimentacao} onClick={() => set('querAlimentacao', !form.querAlimentacao)}>
                  <i className="pi pi-shopping-bag" aria-hidden="true" />
                  <span><strong>Alimentação / bebidas</strong><small>Lanches e bebidas</small></span>
                  <i className={`pi ${form.querAlimentacao ? 'pi-check-square' : 'pi-stop'}`} aria-hidden="true" />
                </button>
              </div>
              {errors.tipo && <small className="pr-error" role="alert">{errors.tipo}</small>}
            </Section>

            {form.querMaoDeObra && (
              <Section step={3} title="Mão de obra terceirizada">
                <div className="pr-grid">
                  <Field label="Atividade" required error={errors.atividade}>
                    <Dropdown value={form.atividade} options={toOptions(options.atividades)} onChange={(e) => set('atividade', e.value || '')} filter placeholder="Selecione" />
                  </Field>
                  <Field label="Função" required error={errors.funcao}>
                    <Dropdown value={form.funcao} options={toOptions(options.funcoes)} onChange={(e) => set('funcao', e.value || '')} placeholder="Selecione" />
                  </Field>
                  <Field label="Turno" required error={errors.turno}>
                    <Dropdown value={form.turno} options={options.turnos.map((t) => ({ label: t === 'DIURNO' ? 'Diurno' : 'Noturno', value: t }))} onChange={(e) => set('turno', e.value || '')} placeholder="Selecione" />
                  </Field>
                  <Field label="Quantidade de pessoas" required error={errors.quantidade}>
                    <InputText value={form.quantidade} onChange={(e) => set('quantidade', onlyDigits(e.target.value))} inputMode="numeric" placeholder="Ex.: 5" />
                  </Field>
                  <Field label="Volume de referência" hint="Opcional. Ex.: 1200">
                    <InputText value={form.volumeReferencia} onChange={(e) => set('volumeReferencia', e.target.value.slice(0, 20))} inputMode="numeric" />
                  </Field>
                  <Field label="Unidade do volume" hint="Opcional. Ex.: pedidos, caixas">
                    <InputText value={form.unidadeVolume} onChange={(e) => set('unidadeVolume', e.target.value.slice(0, 40))} />
                  </Field>
                </div>
              </Section>
            )}

            {form.querAlimentacao && (
              <Section step={form.querMaoDeObra ? 4 : 3} title="Alimentação / bebidas" description="O fornecedor é definido depois pelo Administrativo.">
                <div className="pr-grid">
                  <Field label="Alimentação" error={errors.produtoAlimentacao}>
                    <Dropdown value={form.produtoAlimentacao} options={toOptions(options.alimentacao)} onChange={(e) => set('produtoAlimentacao', e.value || '')} placeholder="Nenhuma" showClear />
                  </Field>
                  <Field label="Quantidade de alimentação" required={Boolean(form.produtoAlimentacao)} error={errors.qtdAlimentacao}>
                    <InputText value={form.qtdAlimentacao} onChange={(e) => set('qtdAlimentacao', onlyDigits(e.target.value))} inputMode="numeric" disabled={!form.produtoAlimentacao} />
                  </Field>
                  <Field label="Bebida" error={errors.produtoBebida}>
                    <Dropdown value={form.produtoBebida} options={toOptions(options.bebidas)} onChange={(e) => set('produtoBebida', e.value || '')} placeholder="Nenhuma" showClear />
                  </Field>
                  <Field label="Quantidade de bebida" required={Boolean(form.produtoBebida)} error={errors.qtdBebida}>
                    <InputText value={form.qtdBebida} onChange={(e) => set('qtdBebida', onlyDigits(e.target.value))} inputMode="numeric" disabled={!form.produtoBebida} />
                  </Field>
                </div>
                {errors.itens && <small className="pr-error" role="alert">{errors.itens}</small>}
              </Section>
            )}

            <Section step={(form.querMaoDeObra ? 1 : 0) + (form.querAlimentacao ? 1 : 0) + 3} title="Responsável pelo custo">
              <div className="pr-grid">
                <Field label="Quem assume o custo" required error={errors.responsavelCusto}>
                  <Dropdown value={form.responsavelCusto} options={options.responsaveis.map((r) => ({ label: r.nome, value: r.nome }))} onChange={(e) => { set('responsavelCusto', e.value || ''); set('centroCusto', '') }} placeholder="Selecione" />
                </Field>
                {needsCostCenter && (
                  <Field label="Centro de custo" required error={errors.centroCusto} hint="Conforme aparece no Bitrix.">
                    {options.centros.length ? (
                      <Dropdown value={form.centroCusto} options={costCenterOptions} optionGroupLabel="label" optionGroupChildren="items" onChange={(e) => set('centroCusto', e.value || '')} filter placeholder="Selecione" />
                    ) : (
                      <InputText value={form.centroCusto} onChange={(e) => set('centroCusto', onlyDigits(e.target.value))} inputMode="numeric" placeholder="Ex.: 2309" />
                    )}
                  </Field>
                )}
              </div>
            </Section>

            {submitError && (
              <div className="pr-submit-error" role="alert">
                <i className="pi pi-exclamation-circle" aria-hidden="true" />
                <span className="pr-submit-error-text">{submitError}<ErrorReference error={submitErrorInfo} /></span>
              </div>
            )}
            <div className="pr-actions">
              <Button type="submit" label={sending ? 'Enviando…' : 'Enviar solicitação'} icon="pi pi-send" loading={sending} className="pr-primary" />
            </div>
          </form>
        )}
      </main>
      <footer className="pr-footer">© {new Date().getFullYear()} Unilog Express. Todos os direitos reservados.</footer>
    </div>
  )
}
