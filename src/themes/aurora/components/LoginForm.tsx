import { useState, type CSSProperties, type FormEvent } from 'react'
import { loginRequestSchema, type LoginRequest } from '@/lib/api/auth'

/*
 *  기존 InputForm과 동일하게 zod safeParse로 클라이언트 검증만 수행한다.
 *  스키마는 API 레이어(@/lib/api/auth)에 두고, 실제 인증 호출은 상위(Login)에서 처리.
 */

interface LoginFormProps {
  onSubmit: (req: LoginRequest) => void
  isLoading: boolean
  /** 인증 실패 등 서버 측 오류 메시지 (없으면 표시 안 함) */
  serverError?: string | null
}

export function LoginForm({ onSubmit, isLoading, serverError }: LoginFormProps) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<{ userId?: string; password?: string }>({})

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = loginRequestSchema.safeParse({ user_id: userId, password })
    if (!parsed.success) {
      const next: { userId?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'user_id' && !next.userId) next.userId = issue.message
        if (key === 'password' && !next.password) next.password = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: '100%' }}>
      {/* ── 아이디 ─────────────────────────────────────────── */}
      <Field
        id="au-userid"
        label="아이디"
        error={errors.userId}
        icon={<UserIcon />}
      >
        <input
          id="au-userid"
          type="text"
          autoComplete="username"
          placeholder="아이디를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          aria-invalid={!!errors.userId}
          spellCheck={false}
          style={inputStyle}
        />
      </Field>

      {/* ── 비밀번호 ───────────────────────────────────────── */}
      <Field
        id="au-password"
        label="비밀번호"
        error={errors.password}
        icon={<LockIcon />}
        trailing={
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
            title={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
            style={eyeBtnStyle}
          >
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
        style={{ marginTop: 16 }}
      >
        <input
          id="au-password"
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
          spellCheck={false}
          style={inputStyle}
        />
      </Field>

      {/* ── 비밀번호 찾기 ──────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <a href="#forgot" style={{ fontSize: 13, fontWeight: 500 }}>
          비밀번호를 잊으셨나요?
        </a>
      </div>

      {/* ── 서버 오류 ──────────────────────────────────────── */}
      {serverError && (
        <p
          role="alert"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'var(--au-error-bg)',
            color: 'var(--au-error)',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 'var(--au-radius)',
            border: '1px solid rgba(251, 113, 133, 0.3)',
          }}
        >
          {serverError}
        </p>
      )}

      {/* ── 로그인 버튼 ────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isLoading}
        style={primaryBtnStyle(isLoading)}
        onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = 'var(--au-glow-violet)' }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
      >
        <SubmitContent isLoading={isLoading} label="로그인" />
      </button>
    </form>
  )
}

/* ───────────────────── sub-components ────────────────────── */

function Field({
  id,
  label,
  error,
  icon,
  trailing,
  children,
  style,
}: {
  id: string
  label: string
  error?: string
  icon: React.ReactNode
  trailing?: React.ReactNode
  children: React.ReactNode
  style?: CSSProperties
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={style}>
      <label htmlFor={id} className="au-overline" style={{ display: 'block', marginBottom: 10 }}>
        {label}
      </label>
      <div
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          background: 'var(--au-surface)',
          border: `1px solid ${error ? 'var(--au-error)' : 'var(--au-border)'}`,
          borderRadius: 'var(--au-radius-lg)',
          boxShadow: focused && !error ? '0 8px 32px rgba(139, 92, 246, 0.22)' : 'var(--au-shadow-card)',
          transition: 'box-shadow var(--au-duration) var(--au-ease), border-color var(--au-duration) var(--au-ease)',
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--au-text-muted)' }}>
          {icon}
        </span>
        {children}
        {trailing}
      </div>
      {error && (
        <p
          role="alert"
          aria-live="polite"
          style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: 'var(--au-error)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

function SubmitContent({ isLoading, label }: { isLoading: boolean; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {isLoading && (
        <span
          aria-hidden="true"
          style={{
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.55)',
            borderTopColor: '#fff',
            animation: 'au-spin 700ms linear infinite',
          }}
        />
      )}
      <span>{label}</span>
    </span>
  )
}

/* ───────────────────── icons (inline SVG, App과 동일 스타일) ────────────── */

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.6 5.9A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.4 3.1M6.4 8.1A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 2.6-.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ───────────────────── styles ────────────────────────────── */

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 48,
  padding: '0 2px',
  background: 'transparent',
  border: 0,
  outline: 'none',
  fontFamily: 'var(--au-font-body)',
  fontSize: 15,
  color: 'var(--au-text)',
}

const eyeBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  border: 0,
  background: 'transparent',
  color: 'var(--au-text-muted)',
  cursor: 'pointer',
  borderRadius: 'var(--au-radius-full)',
}

function primaryBtnStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    height: 48,
    marginTop: 24,
    fontFamily: 'var(--au-font-body)',
    fontSize: 15,
    fontWeight: 600,
    color: disabled ? 'var(--au-text-muted)' : 'var(--au-on-accent)',
    background: disabled ? 'var(--au-surface-2)' : 'var(--au-grad)',
    border: 0,
    borderRadius: 'var(--au-radius-full)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'box-shadow var(--au-duration) var(--au-ease)',
  }
}
