import { useState, type FormEvent } from 'react'
import { login, type AuthUser } from '../services/authService'

const BRAND_LOGO = '/brand/unilog-logo-white-transparent.svg'

type Props = {
  onAuthenticated: (user: AuthUser) => void
}

export function LoginPage({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')

    try {
      const user = await login(email.trim(), password)
      onAuthenticated(user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-panel">
          <img src={BRAND_LOGO} alt="Unilog Express" />
          <div>
            <span>EXTRA COST CONTROL</span>
            <h1>Controle de custos extras</h1>
            <p>Acesso administrativo e operacional em um único ambiente.</p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-heading">
            <span className="ui-eyebrow">ACESSO À PLATAFORMA</span>
            <h2 id="auth-title">Entrar</h2>
            <p>Use o e-mail e a senha cadastrados para seu usuário.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com.br"
                required
                disabled={loading}
              />
            </label>

            <label>
              <span>Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
                disabled={loading}
              />
            </label>

            {error && (
              <div className="auth-error" role="alert">
                <span className="material-symbols-rounded" aria-hidden="true">error</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="button button-primary auth-submit" disabled={loading}>
              <span className="material-symbols-rounded" aria-hidden="true">login</span>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <small className="auth-help">O acesso depende de um usuário ativo cadastrado pela administração.</small>
        </div>
      </section>
    </main>
  )
}
