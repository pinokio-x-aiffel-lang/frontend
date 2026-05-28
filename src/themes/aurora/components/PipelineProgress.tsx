import type { PipelineStep } from '@/lib/api/schema'

const STEP_NAMES = [
  '기사 내용 확인',
  '주장 찾기',
  '주장 분류',
  '주장 정리',
  '통계 자료 추리기',
  '비슷한 자료 검색',
  '후보 추리기',
  '가장 알맞은 자료 선택',
  '수치 비교',
]

interface PipelineProgressProps {
  currentStep: number
  finalSteps?: PipelineStep[]
}

export function PipelineProgress({ currentStep, finalSteps }: PipelineProgressProps) {
  const getStatus = (idx: number): PipelineStep['status'] => {
    if (finalSteps) return finalSteps[idx]?.status ?? 'done'
    if (idx < currentStep) return 'done'
    if (idx === currentStep) return 'running'
    return 'pending'
  }

  const progressPct = Math.round((Math.min(currentStep, STEP_NAMES.length) / STEP_NAMES.length) * 100)

  return (
    <div role="status" aria-live="polite" aria-label={`${currentStep}/9 단계 진행 중`}>
      {/* progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="au-overline">진행 상황</span>
        <span className="au-num" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 12, color: 'var(--au-text-secondary)' }}>
          {Math.min(currentStep, STEP_NAMES.length)} / 9 · {progressPct}%
        </span>
      </div>

      <div
        style={{
          height: 6,
          background: 'var(--au-surface-2)',
          borderRadius: 'var(--au-radius-full)',
          overflow: 'hidden',
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: '100%',
            background: 'var(--au-grad)',
            borderRadius: 'var(--au-radius-full)',
            boxShadow: 'var(--au-accent-glow)',
            transition: 'width 300ms var(--au-ease)',
          }}
        />
      </div>

      {/* steps */}
      <ol className="au-card" style={{ listStyle: 'none', padding: 8, margin: 0, display: 'grid', gap: 4 }}>
        {STEP_NAMES.map((name, idx) => {
          const status = getStatus(idx)
          return (
            <li
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '30px 1fr auto',
                alignItems: 'center',
                gap: 14,
                padding: '10px 12px',
                borderRadius: 'var(--au-radius)',
                background: status === 'running' ? 'var(--au-surface-2)' : 'transparent',
                transition: 'background var(--au-duration) var(--au-ease)',
              }}
            >
              <StatusBadge status={status} index={idx + 1} />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: status === 'running' ? 600 : 400,
                  color: status === 'pending' ? 'var(--au-text-muted)' : 'var(--au-text)',
                }}
              >
                {name}
              </span>
              <StatusLabel status={status} />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */

function StatusBadge({ status, index }: { status: PipelineStep['status']; index: number }) {
  const base: React.CSSProperties = {
    width: 26,
    height: 26,
    borderRadius: 'var(--au-radius-full)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--au-font-mono)',
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  }

  if (status === 'done') {
    return (
      <span style={{ ...base, background: 'var(--au-grad)', color: 'var(--au-on-accent)' }} aria-hidden="true">
        <CheckIcon />
      </span>
    )
  }

  if (status === 'running') {
    return (
      <span
        style={{ ...base, background: 'var(--au-accent-tint)', color: 'var(--au-violet-bright)', boxShadow: 'inset 0 0 0 1.5px var(--au-violet)', position: 'relative' }}
        aria-hidden="true"
      >
        <span
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            border: '2px solid var(--au-violet)',
            opacity: 0.45,
            animation: 'au-pulse 1.4s var(--au-ease) infinite',
          }}
        />
        <span style={{ position: 'relative' }} className="au-num">{index}</span>
      </span>
    )
  }

  if (status === 'error') {
    return <span style={{ ...base, background: 'var(--au-error-bg)', color: 'var(--au-error)' }} aria-hidden="true">✕</span>
  }

  if (status === 'skipped') {
    return <span style={{ ...base, background: 'var(--au-surface-2)', color: 'var(--au-text-faint)' }} aria-hidden="true">−</span>
  }

  return (
    <span
      style={{ ...base, background: 'transparent', color: 'var(--au-text-faint)', boxShadow: 'inset 0 0 0 1px var(--au-border-strong)' }}
      aria-hidden="true"
      className="au-num"
    >
      {index}
    </span>
  )
}

function StatusLabel({ status }: { status: PipelineStep['status'] }) {
  const text =
    status === 'running' ? '진행 중'
      : status === 'done' ? '완료'
        : status === 'error' ? '오류'
          : status === 'skipped' ? '건너뜀'
            : '대기'

  const color =
    status === 'running' ? 'var(--au-violet-bright)'
      : status === 'done' ? 'var(--au-text-secondary)'
        : status === 'error' ? 'var(--au-error)'
          : 'var(--au-text-muted)'

  return <span style={{ fontFamily: 'var(--au-font-mono)', fontSize: 11, fontWeight: 500, color }}>{text}</span>
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
