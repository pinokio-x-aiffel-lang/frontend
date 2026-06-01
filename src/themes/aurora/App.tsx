import { useEffect, useState } from 'react'
import { useVerifySSE } from '@/hooks/useVerifySSE'
import { useDebugMode } from '@/shared/useDebugMode'
import type { VerifyRequest } from '@/lib/api/schema'

import { InputForm } from './components/InputForm'
import { PipelineProgress } from './components/PipelineProgress'
import { ResultLayout } from './components/ResultLayout'

import './tokens.css'

type Mode = 'light' | 'dark'

const TOTAL_STEPS = 9

const MODE_STORAGE_KEY = 'aurora-mode'

function getInitialMode(): Mode {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(MODE_STORAGE_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

const STEPS = [
  { num: '01', title: '수치가 담긴 문장 찾기', desc: '기사에서 통계나 수치를 다루는 문장을 골라냅니다.' },
  { num: '02', title: '공식 자료와 맞추기', desc: '그 내용에 딱 맞는 통계청 자료를 찾아 같은 기준으로 정리합니다.' },
  { num: '03', title: '수치 나란히 비교', desc: '기사 속 수치와 공식 통계를 견줘 어디가 다른지 보여드립니다.' },
] as const

const VERDICT_LEGEND = [
  { code: 'T', label: '사실', desc: '공식 통계와 수치가 일치해요', color: 'var(--au-verdict-true)', bg: 'var(--au-verdict-true-bg)' },
  { code: 'F', label: '거짓', desc: '공식 통계와 분명히 달라요', color: 'var(--au-verdict-false)', bg: 'var(--au-verdict-false-bg)' },
  { code: 'M', label: '오해 소지', desc: '수치는 비슷해도 맥락이 오해를 부를 수 있어요', color: 'var(--au-verdict-mislead)', bg: 'var(--au-verdict-mislead-bg)' },
  { code: 'NEI', label: '확인 어려움', desc: '비교할 공식 통계를 찾지 못했어요', color: 'var(--au-verdict-nei)', bg: 'var(--au-verdict-nei-bg)' },
] as const

export default function AuroraApp() {
  const sse = useVerifySSE()
  const [mode, setMode] = useState<Mode>(getInitialMode)
  const showDebug = useDebugMode()

  const appState = sse.status === 'done' ? 'result' : sse.status === 'error' ? 'error' : sse.status

  const displaySteps = Array.from({ length: TOTAL_STEPS }, (_, i) =>
    sse.steps[i] ?? { step: i + 1, name: '', status: 'pending' as const, duration_ms: null },
  )
  const runningIdx = displaySteps.findIndex((s) => s.status === 'running')
  const currentStep = runningIdx >= 0 ? runningIdx : displaySteps.filter((s) => s.status === 'done').length

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

  function handleSubmit(req: VerifyRequest) {
    void sse.verify(req)
  }

  // 'Tip' 글자 클릭 → 동일한 SSE 파이프라인을 dummy 엔드포인트(/dummy)로 실행
  function handleTip(content: string) {
    void sse.verify({ content }, { path: 'dummy' })
  }

  function handleReset() {
    sse.reset()
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
            onClick={(e) => { if (appState !== 'idle') { e.preventDefault(); handleReset() } }}
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

          {showDebug && (
            <span
              style={{
                fontFamily: 'var(--au-font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                padding: '3px 9px',
                background: 'rgba(251,191,36,0.15)',
                color: 'var(--au-verdict-mislead)',
                borderRadius: 'var(--au-radius-full)',
                textTransform: 'uppercase',
              }}
            >
              Debug
            </span>
          )}

          <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ModeToggle mode={mode} onChange={setMode} />
            <a
              href="https://kosis.kr"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--au-font-mono)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--au-text)',
                padding: '6px 12px',
                border: '1px solid var(--au-border-strong)',
                borderRadius: 'var(--au-radius-full)',
              }}
            >
              KOSIS ↗
            </a>
            {appState !== 'idle' && (
              <button onClick={handleReset} style={navBtnStyle}>새 검증</button>
            )}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* ── IDLE ─────────────────────────────────────────── */}
        {appState === 'idle' && (
          <>
            {/* Hero */}
            <section style={{ position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden="true" className="au-aurora" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
              <div
                style={{
                  position: 'relative',
                  maxWidth: 'var(--au-max-width-narrow)',
                  margin: '0 auto',
                  padding: '96px 24px 56px',
                }}
              >
                <div
                  className="au-overline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 14px',
                    marginBottom: 28,
                    background: 'var(--au-surface)',
                    border: '1px solid var(--au-border)',
                    borderRadius: 'var(--au-radius-full)',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--au-cyan)', boxShadow: '0 0 8px var(--au-cyan)' }} />
                  뉴스 속 통계, 사실일까요?
                </div>

                <h1 style={{ fontSize: 'var(--au-text-display)', lineHeight: 1.0, letterSpacing: '-0.04em', margin: '0 0 28px' }}>
                  뉴스 속 수치,<br />
                  진짜인지<br />
                  <span className="au-grad-text">확인해 드려요.</span>
                </h1>

                <p style={{ maxWidth: 520, fontSize: 'var(--au-text-body-lg)', lineHeight: 1.65, color: 'var(--au-text-secondary)', margin: '0 0 44px' }}>
                  기사에 나온 통계 수치를 통계청 공식 자료와 하나씩 맞춰 봅니다.<br />
                  어떤 정보가 맞고 어디가 틀렸는지, 근거가 된 출처까지 함께 보여드려요.
                </p>

                <div style={{ maxWidth: 720 }}>
                  <InputForm onSubmit={handleSubmit} onTipClick={handleTip} isLoading={false} />
                </div>
              </div>
            </section>

            {/* How it works */}
            <section style={{ maxWidth: 'var(--au-max-width)', margin: '0 auto', padding: '64px 24px 40px' }} aria-labelledby="how-it-works">
              <div className="au-overline" style={{ marginBottom: 10 }}>이렇게 확인해요</div>
              <h2 id="how-it-works" style={{ fontSize: 'var(--au-text-section)', margin: '0 0 36px' }}>세 단계면 충분해요</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {STEPS.map(({ num, title, desc }) => (
                  <article key={num} className="au-card au-card-hoverable" style={{ padding: 24 }}>
                    <div className="au-num au-grad-text" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                      {num}
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{title}</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--au-text-secondary)', margin: 0 }}>{desc}</p>
                  </article>
                ))}
              </div>
            </section>

            {/* Verdict scale */}
            <section style={{ maxWidth: 'var(--au-max-width)', margin: '0 auto', padding: '40px 24px 96px' }} aria-labelledby="verdict-scale">
              <div className="au-overline" style={{ marginBottom: 10 }}>판정 결과</div>
              <h2 id="verdict-scale" style={{ fontSize: 'var(--au-text-section)', margin: '0 0 32px' }}>결과는 네 가지로 알려드려요</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {VERDICT_LEGEND.map((item) => (
                  <article key={item.code} className="au-card au-card-hoverable" style={{ overflow: 'hidden' }}>
                    <div style={{ height: 4, background: item.color, boxShadow: `0 0 16px ${item.color}` }} aria-hidden="true" />
                    <div style={{ padding: 22 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 13px',
                          marginBottom: 16,
                          background: item.bg,
                          color: item.color,
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 'var(--au-radius-full)',
                        }}
                      >
                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, boxShadow: `0 0 8px ${item.color}` }} />
                        {item.label}
                      </span>
                      <p style={{ fontSize: 14, color: 'var(--au-text-secondary)', margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── LOADING ──────────────────────────────────────── */}
        {appState === 'loading' && (
          <section style={{ maxWidth: 'var(--au-max-width-narrow)', margin: '0 auto', padding: '80px 24px' }} aria-live="polite">
            <div className="au-overline" style={{ marginBottom: 12 }}>확인 중</div>
            <h2 style={{ fontSize: 'var(--au-text-section)', margin: '0 0 8px' }}>코가 자라는지 확인하고 있어요…</h2>
            <p style={{ color: 'var(--au-text-muted)', fontSize: 14, margin: '0 0 40px' }}>
              통계 자료를 찾아 비교하는 데 보통 10~20초 정도 걸려요.
            </p>
            <PipelineProgress currentStep={currentStep} finalSteps={displaySteps} />
          </section>
        )}

        {/* ── RESULT ───────────────────────────────────────── */}
        {appState === 'result' && sse.result && (
          <div style={{ padding: '56px 0 0' }}>
            <ResultLayout result={sse.result} onReset={handleReset} showDebug={showDebug} />
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────── */}
        {appState === 'error' && (
          <section style={{ maxWidth: 'var(--au-max-width-narrow)', margin: '0 auto', padding: '80px 24px' }}>
            <div
              style={{
                padding: 24,
                background: 'var(--au-error-bg)',
                borderRadius: 'var(--au-radius-lg)',
                borderLeft: '3px solid var(--au-error)',
                marginBottom: 24,
              }}
            >
              <div className="au-overline" style={{ color: 'var(--au-error)', marginBottom: 8 }}>문제가 생겼어요</div>
              <h2 style={{ fontSize: 'var(--au-text-subhead)', margin: '0 0 6px', color: 'var(--au-error)' }}>확인하지 못했어요</h2>
              <p style={{ margin: 0, color: 'var(--au-text-secondary)', fontSize: 14 }}>
                {sse.errorMsg ?? '알 수 없는 문제가 생겼어요'} — 입력을 확인하거나 잠시 후 다시 시도해 주세요.
              </p>
            </div>
            <InputForm onSubmit={handleSubmit} onTipClick={handleTip} isLoading={false} />
          </section>
        )}
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
          <code className="au-num" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 11, color: 'var(--au-text-faint)' }}>
            VITE_USE_MOCK={import.meta.env.VITE_USE_MOCK}
          </code>
        </div>
      </footer>
    </div>
  )
}

/* ── Light / Dark mode toggle (sun / moon) ────────────────── */
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
      <ModeButton
        active={mode === 'light'}
        label="라이트 모드"
        onClick={() => onChange('light')}
        icon={<SunIcon />}
      />
      <ModeButton
        active={mode === 'dark'}
        label="다크 모드"
        onClick={() => onChange('dark')}
        icon={<MoonIcon />}
      />
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
        fill={'currentColor'}
        fillOpacity={0.15}
      />
    </svg>
  )
}

/* ── Logo mark — gradient rounded square ──────────────────── */
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

const navBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--au-font-body)',
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 16px',
  background: 'var(--au-grad)',
  color: 'var(--au-on-accent)',
  border: 0,
  borderRadius: 'var(--au-radius-full)',
  cursor: 'pointer',
}
