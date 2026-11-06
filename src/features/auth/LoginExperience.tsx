'use client'

import { useState, type FormEvent } from 'react'
import { BrandBackdrop } from '@/components/brand/BrandBackdrop'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import {
  AuthServiceError,
  completeFirstAccess,
  login,
  type AuthUser,
} from '@/features/auth/services/authService'

type LoginExperienceProps = {
  onAuthenticated: (user: AuthUser) => void
}

export function LoginExperience({ onAuthenticated }: LoginExperienceProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    if (firstAccess) {
      if (newPassword.length < 8) {
        setError('A nova senha deve possuir pelo menos 8 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('A confirmação da nova senha não confere.')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      const user = firstAccess
        ? await completeFirstAccess(email.trim(), password, newPassword)
        : await login(email.trim(), password)
      onAuthenticated(user)
    } catch (requestError) {
      if (requestError instanceof AuthServiceError && requestError.code === 'PASSWORD_CHANGE_REQUIRED') {
        setFirstAccess(true)
        setNewPassword('')
        setConfirmPassword('')
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="nx-login-page nx-login-brand-v2">
      <BrandBackdrop />
      <section className="nx-login-card" aria-labelledby="login-title">
        <aside className="nx-login-brand">
          <div className="nx-brand-topline">
            <img src="/brand/unilog_express_logo_branco.svg" alt="Unilog Express" />
            <span className="nx-product-chip">GESTÃO</span>
          </div>

          <div className="nx-brand-copy">
            <span className="nx-overline nx-overline-light nx-overline-dash">EXTRA COST CONTROL</span>
            <h1>Custos extras <span className="nx-accent">sob controle</span>, do pedido ao fechamento.</h1>
            <p>
              Um ambiente único para operação, administrativo e gestão acompanharem solicitações,
              custos e capacidade de atendimento.
            </p>
          </div>

          <div className="nx-login-proof">
            <span><i className="pi pi-shield" /> Acesso protegido</span>
            <span><i className="pi pi-lock" /> Credenciais seguras</span>
          </div>
        </aside>

        <div className="nx-login-form-panel">
          <div className="nx-login-heading">
            <span className="nx-overline nx-overline-dash">{firstAccess ? 'PRIMEIRO ACESSO' : 'ACESSO'}</span>
            <h2 id="login-title">{firstAccess ? 'Crie sua própria senha' : 'Bem-vindo de volta'}</h2>
            <p>
              {firstAccess
                ? 'A senha recebida é temporária. Defina uma nova senha para liberar seu acesso.'
                : 'Entre com o usuário cadastrado pela administração.'}
            </p>
          </div>

          <form className="nx-login-form" onSubmit={submit}>
            <label htmlFor="login-email">E-mail</label>
            <span className="p-input-icon-left nx-field-icon">
              <i className="pi pi-envelope" />
              <InputText
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com.br"
                autoComplete="username"
                required
                disabled={loading || firstAccess}
              />
            </span>

            <label htmlFor="login-password">{firstAccess ? 'Senha temporária' : 'Senha'}</label>
            <Password
              inputId="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              feedback={false}
              toggleMask
              required
              disabled={loading || firstAccess}
              className="nx-password"
              inputClassName="nx-password-input"
            />

            {firstAccess && (
              <>
                <label htmlFor="new-password">Nova senha</label>
                <Password
                  inputId="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  autoComplete="new-password"
                  feedback={false}
                  toggleMask
                  required
                  disabled={loading}
                  className="nx-password"
                  inputClassName="nx-password-input"
                />

                <label htmlFor="confirm-password">Confirmar nova senha</label>
                <Password
                  inputId="confirm-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  feedback={false}
                  toggleMask
                  required
                  disabled={loading}
                  className="nx-password"
                  inputClassName="nx-password-input"
                />
              </>
            )}

            {error && (
              <div className="nx-login-error" role="alert">
                <i className="pi pi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              label={loading ? 'Salvando…' : firstAccess ? 'Definir minha senha' : 'Entrar'}
              icon={loading ? 'pi pi-spin pi-spinner' : firstAccess ? 'pi pi-check' : 'pi pi-arrow-right'}
              iconPos="right"
              disabled={loading}
              className="nx-primary-button"
            />
          </form>

          {/* Tela aberta de solicitação (sem login) para quem só precisa pedir. */}
          <a className="nx-login-request-link" href="/">
            <i className="pi pi-send" aria-hidden="true" /> Só quer fazer uma solicitação? Acesse o formulário
          </a>

          <div className="nx-login-footnote">
            <i className="pi pi-info-circle" />
            <span>
              {firstAccess
                ? 'A nova senha substitui a senha temporária e não é armazenada em texto puro.'
                : 'O acesso depende de uma conta ativa com perfil e operação definidos.'}
            </span>
          </div>
        </div>
      </section>
      <footer className="nx-login-legal">© {new Date().getFullYear()} Unilog Express. Todos os direitos reservados.</footer>
    </main>
  )
}
