import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react'

type Mode = 'login' | 'register'

type User = {
  id: number
  email: string
}

type AuthResult = {
  access_token: string
  user: User
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'hearth-auth-token'

export default function App() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        setUser((await response.json()) as User)
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await response.json()) as AuthResult | { detail?: string }
      if (!response.ok) throw new Error('detail' in data ? data.detail : 'Could not complete your request')

      const auth = data as AuthResult
      localStorage.setItem(TOKEN_KEY, auth.access_token)
      setUser(auth.user)
      setPassword('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not reach the server')
    } finally {
      setIsLoading(false)
    }
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setMessage('')
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setEmail('')
  }

  if (user) {
    return (
      <main className="app-shell">
        <section className="account-panel" aria-labelledby="welcome-title">
          <div className="brand"><ShieldCheck size={25} /> Hearth</div>
          <div className="success-icon"><CheckCircle2 size={42} /></div>
          <p className="eyebrow">Signed in</p>
          <h1 id="welcome-title">Welcome back.</h1>
          <p className="account-email">{user.email}</p>
          <button className="secondary-button" type="button" onClick={logout}>
            <LogOut size={18} /> Sign out
          </button>
        </section>
      </main>
    )
  }

  const isRegistering = mode === 'register'
  return (
    <main className="app-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand"><ShieldCheck size={25} /> Hearth</div>
        <p className="eyebrow">Your private space</p>
        <h1 id="auth-title">{isRegistering ? 'Create your account.' : 'Good to see you.'}</h1>
        <p className="intro">{isRegistering ? 'Set up your secure account in a moment.' : 'Sign in to continue where you left off.'}</p>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} role="tab" aria-selected={mode === 'login'}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} role="tab" aria-selected={mode === 'register'}>Register</button>
        </div>

        <form onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />

          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            <button className="icon-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message && <p className="error-message" role="alert">{message}</p>}
          <button className="primary-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Please wait...' : isRegistering ? 'Create account' : 'Sign in'} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  )
}
