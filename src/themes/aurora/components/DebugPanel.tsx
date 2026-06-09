import { useEffect, useRef, type CSSProperties } from 'react'
import type { VerifyLog } from '@/hooks/useVerifySSE'
import type { PipelineStep } from '@/lib/api/schema'

/* ────────────────────────────────────────────────────────────────────────
 *  DebugPanel — 우측 고정 실시간 로그 콘솔.
 *  · 앱이 라이트 모드여도 패널은 항상 '다크 모드 색상'으로 고정한다(콘솔 가독성).
 *    → tokens.css의 기본 [data-theme='aurora'](dark) 팔레트 값을 그대로 하드코딩.
 *  · 메인 페이지와 독립적으로 스크롤(position:fixed + 내부 overflow-y:auto).
 *  · 서버 SSE의 step 이벤트(running→done/error 전이)를 시간순 로그로 보여준다.
 * ──────────────────────────────────────────────────────────────────────── */

const C = {
  bg: '#0b0b12',
  panel: '#101018',
  surface: '#14141d',
  surfaceSoft: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',
  text: '#f5f5fa',
  textSecondary: '#aeaec4',
  textMuted: '#7a7a92',
  textFaint: '#56566a',
  accent: '#a78bfa',
  running: '#fbbf24',
  done: '#34d399',
  error: '#fb7185',
  skipped: '#94a3b8',
  pending: '#56566a',
}

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

const STATUS_VIEW: Record<PipelineStep['status'], { color: string; label: string }> = {
  running: { color: C.running, label: '진행 중' },
  done: { color: C.done, label: '완료' },
  error: { color: C.error, label: '오류' },
  skipped: { color: C.skipped, label: '건너뜀' },
  pending: { color: C.pending, label: '대기' },
}

type RunStatus = 'idle' | 'loading' | 'done' | 'error'

interface DebugPanelProps {
  logs: VerifyLog[]
  status: RunStatus
  currentStep: number
  totalSteps: number
  errorMsg: string | null
  requestId?: string
  /** 접힘 상태(App이 소유 — 패널이 열리면 본문을 왼쪽으로 밀기 위해 끌어올림) */
  collapsed: boolean
  onToggleCollapsed: (next: boolean) => void
}

export function DebugPanel({
  logs,
  status,
  currentStep,
  totalSteps,
  errorMsg,
  requestId,
  collapsed,
  onToggleCollapsed,
}: DebugPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // 새 로그가 쌓이면 항상 바닥으로 자동 스크롤
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  const startT = logs.length > 0 ? logs[0].t : null
  const lastT = logs.length > 0 ? logs[logs.length - 1].t : null
  const elapsedSec = startT !== null && lastT !== null ? (lastT - startT) / 1000 : 0

  if (collapsed) {
    return (
      <button type="button" onClick={() => onToggleCollapsed(false)} style={tabStyle} title="디버그 패널 열기">
        <span style={{ writingMode: 'vertical-rl' }}>◂ DEBUG</span>
      </button>
    )
  }

  return (
    <aside style={panelStyle} aria-label="디버그 로그 패널">
      {/* ── Header (고정) ─────────────────────────────── */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: C.accent }}>DEBUG</span>
          <span style={{ fontSize: 11, color: C.textFaint }}>단계별 실시간 로그</span>
          <button type="button" onClick={() => onToggleCollapsed(true)} style={collapseBtnStyle} title="패널 접기" aria-label="패널 접기">
            ▸
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <RunChip status={status} />
          <span style={metaStyle}>
            <span style={{ color: C.textSecondary }}>{Math.min(currentStep, totalSteps)}</span>
            <span style={{ color: C.textFaint }}> / {totalSteps} step</span>
          </span>
          <span style={metaStyle}>{elapsedSec.toFixed(1)}s</span>
        </div>

        {requestId && (
          <div style={{ ...metaStyle, color: C.textFaint, wordBreak: 'break-all' }}>req · {requestId}</div>
        )}
      </header>

      {/* ── Body (독립 스크롤) ────────────────────────── */}
      <div ref={bodyRef} style={bodyStyle}>
        {logs.length === 0 ? (
          <div style={emptyStyle}>
            {status === 'loading'
              ? '서버 응답을 기다리는 중…'
              : '검증을 시작하면 각 단계 로그가\n여기에 실시간으로 표시됩니다.'}
          </div>
        ) : (
          logs.map((log) => <LogLine key={log.seq} log={log} startT={startT ?? log.t} />)
        )}

        {status === 'error' && errorMsg && logs.every((l) => l.status !== 'error') && (
          <div style={{ ...errorBoxStyle }}>✕ {errorMsg}</div>
        )}
      </div>
    </aside>
  )
}

/* ───────────────────── 로그 한 줄 ───────────────────── */

function LogLine({ log, startT }: { log: VerifyLog; startT: number }) {
  const view = STATUS_VIEW[log.status]
  const rel = ((log.t - startT) / 1000).toFixed(1)
  const isSystem = log.step === 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 8,
        borderLeft: `2px solid ${view.color}`,
        background: log.status === 'running' ? C.surfaceSoft : 'transparent',
      }}
    >
      <span style={{ fontSize: 10.5, color: C.textFaint, minWidth: 38, fontVariantNumeric: 'tabular-nums' }}>+{rel}s</span>

      {!isSystem && (
        <span
          style={{
            minWidth: 22,
            textAlign: 'center',
            fontSize: 10.5,
            fontWeight: 600,
            color: view.color,
            background: `${view.color}1f`,
            borderRadius: 5,
            padding: '1px 0',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(log.step).padStart(2, '0')}
        </span>
      )}

      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: isSystem ? C.error : C.text }}>
        {log.name || `단계 ${log.step}`}
        {log.error && (
          <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: C.error, lineHeight: 1.4, wordBreak: 'break-word' }}>
            ↳ {log.error}
          </span>
        )}
      </span>

      <span style={{ fontSize: 10.5, fontWeight: 500, color: view.color, whiteSpace: 'nowrap' }}>
        {log.status === 'running' ? `${view.label}…` : view.label}
        {log.status === 'done' && log.duration_ms != null && (
          <span style={{ color: C.textFaint }}> · {log.duration_ms}ms</span>
        )}
      </span>
    </div>
  )
}

/* ───────────────────── 실행 상태 칩 ───────────────────── */

function RunChip({ status }: { status: RunStatus }) {
  const view =
    status === 'loading'
      ? { color: C.running, label: '실행 중' }
      : status === 'done'
        ? { color: C.done, label: '완료' }
        : status === 'error'
          ? { color: C.error, label: '오류' }
          : { color: C.textMuted, label: '대기' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: view.color,
        background: `${view.color}1f`,
        padding: '2px 9px',
        borderRadius: 999,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: view.color,
          boxShadow: `0 0 6px ${view.color}`,
          animation: status === 'loading' ? 'au-pulse 1.4s var(--au-ease) infinite' : 'none',
        }}
      />
      {view.label}
    </span>
  )
}

/* ───────────────────── styles ───────────────────── */

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  zIndex: 50,
  height: '100dvh',
  width: 408,
  maxWidth: '92vw',
  display: 'flex',
  flexDirection: 'column',
  background: C.panel,
  color: C.text,
  borderLeft: `1px solid ${C.borderStrong}`,
  boxShadow: '-10px 0 36px rgba(0,0,0,0.5)',
  fontFamily: MONO,
}

const headerStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  padding: '13px 14px',
  borderBottom: `1px solid ${C.border}`,
  background: C.surface,
}

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '10px 10px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  background: C.bg,
}

const metaStyle: CSSProperties = {
  fontSize: 11,
  color: C.textSecondary,
  fontVariantNumeric: 'tabular-nums',
}

const collapseBtnStyle: CSSProperties = {
  marginLeft: 'auto',
  width: 22,
  height: 22,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  background: 'transparent',
  color: C.textMuted,
  cursor: 'pointer',
  fontSize: 12,
}

const tabStyle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  right: 0,
  transform: 'translateY(-50%)',
  zIndex: 50,
  padding: '14px 6px',
  border: `1px solid ${C.borderStrong}`,
  borderRight: 0,
  borderRadius: '8px 0 0 8px',
  background: C.panel,
  color: C.accent,
  cursor: 'pointer',
  fontFamily: MONO,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  boxShadow: '-6px 0 20px rgba(0,0,0,0.4)',
}

const emptyStyle: CSSProperties = {
  margin: 'auto',
  padding: '40px 16px',
  textAlign: 'center',
  fontSize: 12,
  lineHeight: 1.7,
  color: C.textFaint,
  whiteSpace: 'pre-line',
}

const errorBoxStyle: CSSProperties = {
  marginTop: 6,
  padding: '8px 10px',
  borderRadius: 8,
  background: `${C.error}1a`,
  border: `1px solid ${C.error}55`,
  color: C.error,
  fontSize: 11.5,
  lineHeight: 1.5,
  wordBreak: 'break-word',
}
