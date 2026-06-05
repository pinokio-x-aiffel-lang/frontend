import { useEffect, useState } from 'react'

import { login, type LoginRequest } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { LoginForm } from './components/LoginForm'

import './tokens.css'

type Mode = 'light' | 'dark'

const MODE_STORAGE_KEY = 'aurora-mode'

function getInitialMode(): Mode {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(MODE_STORAGE_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

export default function Login() {
  const [mode, setMode] = useState<Mode>(getInitialMode)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'aurora')
    return () => {
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.removeAttribute('data-mode')
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
    window.localStorage.setItem(MODE_STORAGE_KEY, mode)
  }, [mode])

  async function handleSubmit(req: LoginRequest) {
    setServerError(null)
    setIsLoading(true)
    try {
      await login(req)
      // 토큰은 httpOnly 쿠키로 내려오므로 프론트가 따로 저장하지 않는다. (auth.ts 참고)
      window.location.hash = '' // 메인 화면으로
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 401
          ? '아이디 또는 비밀번호가 올바르지 않아요.'
          : err instanceof Error
            ? err.message
            : '로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
      setServerError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="theme-root"
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--au-bg)' }}
    >
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 60,
          background: 'var(--au-nav-bg)',
          backdropFilter: 'saturate(160%) blur(14px)',
          WebkitBackdropFilter: 'saturate(160%) blur(14px)',
          borderBottom: '1px solid var(--au-border)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--au-max-width)',
            margin: '0 auto',
            height: '100%',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <a
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--au-text)' }}
            translate="no"
          >
            <LogoMark />
            <span style={{ fontFamily: 'var(--au-font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
              pinokio<span className="au-grad-text">·</span>x
            </span>
          </a>
          <span
            style={{
              marginLeft: 4,
              paddingLeft: 12,
              borderLeft: '1px solid var(--au-border-strong)',
              fontFamily: 'var(--au-font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--au-text)',
            }}
          >
            AI 기반 뉴스 사실 검증 서비스
          </span>

          <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ModeToggle mode={mode} onChange={setMode} />
          </nav>
        </div>
      </header>

      {/* ── Main — 중앙 정렬 글래스 카드 ─────────────────────── */}
      <main style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <div aria-hidden="true" className="au-aurora" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 460,
            margin: 'auto',
            padding: '56px 24px',
          }}
        >
          {/* heading */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              className="au-overline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                marginBottom: 22,
                background: 'var(--au-surface)',
                border: '1px solid var(--au-border)',
                borderRadius: 'var(--au-radius-full)',
              }}
            >
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--au-cyan)', boxShadow: '0 0 8px var(--au-cyan)' }} />
              다시 만나서 반가워요
            </div>
            <h1 style={{ fontSize: 'var(--au-text-headline)', lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 12px' }}>
              <span className="au-grad-text">로그인</span>
            </h1>
            <p style={{ fontSize: 'var(--au-text-body-lg)', color: 'var(--au-text-secondary)', margin: 0, lineHeight: 1.6 }}>
              계정에 로그인하고 뉴스 속 통계를 바로 검증해 보세요.
            </p>
          </div>

          {/* card */}
          <div className="au-card" style={{ padding: 32 }}>
            <LoginForm onSubmit={handleSubmit} isLoading={isLoading} serverError={serverError} />
          </div>

          {/* sign-up */}
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--au-text-muted)' }}>
            아직 계정이 없으신가요?{' '}
            <a href="#signup" style={{ fontWeight: 600 }}>회원가입</a>
          </p>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ marginTop: 'auto', padding: '32px 24px 40px', borderTop: '1px solid var(--au-border)' }}>
        <div
          style={{
            maxWidth: 'var(--au-max-width)',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--au-text-muted)' }}>
            <LogoMark size={16} />
            <span style={{ fontFamily: 'var(--au-font-body)' }}>pinokio·x — AIFFEL 1기 기업 프로젝트 PoC</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── Light / Dark mode toggle (sun / moon) — App.tsx와 동일 ─── */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      role="group"
      aria-label="화면 모드 전환"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        background: 'var(--au-surface)',
        border: '1px solid var(--au-border)',
        borderRadius: 'var(--au-radius-full)',
      }}
    >
      <ModeButton active={mode === 'light'} label="라이트 모드" onClick={() => onChange('light')} icon={<SunIcon />} />
      <ModeButton active={mode === 'dark'} label="다크 모드" onClick={() => onChange('dark')} icon={<MoonIcon />} />
    </div>
  )
}

function ModeButton({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean
  label: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        border: 0,
        borderRadius: 'var(--au-radius-full)',
        cursor: 'pointer',
        background: active ? 'var(--au-grad)' : 'transparent',
        color: active ? 'var(--au-on-accent)' : 'var(--au-text-muted)',
        boxShadow: active ? 'var(--au-accent-glow)' : 'none',
        transition: 'background var(--au-duration) var(--au-ease), color var(--au-duration) var(--au-ease)',
      }}
    >
      {icon}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.1 5.1l1.8 1.8M17.1 17.1l1.8 1.8M18.9 5.1l-1.8 1.8M6.9 17.1l-1.8 1.8" />
      </g>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={0.15}
      />
    </svg>
  )
}

/* ── Logo mark — gradient rounded square — App.tsx와 동일 ───── */
function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: 'var(--au-grad)',
        color: 'var(--au-on-accent)',
        borderRadius: Math.round(size / 3.2),
        fontFamily: 'var(--au-font-display)',
        fontWeight: 700,
        fontSize: Math.round(size * 0.55),
        boxShadow: 'var(--au-accent-glow)',
      }}
    >
      x
    </span>
  )
}
