import { AppShell } from './components/AppShell'

const foundations = [
  {
    title: 'Frontend',
    value: 'React + TypeScript + Vite',
    detail: 'Base preparada para deploy automático no Cloudflare Pages.',
  },
  {
    title: 'API',
    value: 'Google Apps Script',
    detail: 'Integração ainda não iniciada; seguirá o contrato funcional do projeto.',
  },
  {
    title: 'Persistência',
    value: 'Google Planilhas',
    detail: 'Controle de Custos Extras - UNILOG permanece como base oficial.',
  },
]

export function App() {
  return (
    <AppShell>
      <section className="page-header">
        <div>
          <p className="page-eyebrow">UNILOG · CUSTOS EXTRAS</p>
          <h1>Base técnica do frontend</h1>
          <p>
            Scaffold inicial concluído. As regras de negócio continuam sendo implementadas de forma incremental,
            conforme a memória oficial do projeto.
          </p>
        </div>
      </section>

      <section className="foundation-grid" aria-label="Arquitetura vigente">
        {foundations.map((item) => (
          <article className="foundation-card" key={item.title}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="page-eyebrow">STATUS</p>
            <h2>Próxima etapa funcional</h2>
          </div>
          <span className="badge badge-warning">Pendente de validação</span>
        </div>
        <p>
          Validar as regras e vigências de preços antes de implementar a resolução financeira definitiva na API.
        </p>
      </section>
    </AppShell>
  )
}
