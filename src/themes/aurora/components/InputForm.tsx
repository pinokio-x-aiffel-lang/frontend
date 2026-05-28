import { useState, type CSSProperties, type FormEvent } from 'react'
import { verifyRequestSchema, type VerifyRequest } from '@/lib/api/schema'

interface InputFormProps {
  onSubmit: (req: VerifyRequest) => void
  isLoading: boolean
}

export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = verifyRequestSchema.safeParse({ content })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력값을 확인해주세요')
      return
    }
    setError(null)
    onSubmit(parsed.data)
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: '100%' }}>
      <label htmlFor="au-content" className="au-overline" style={{ display: 'block', marginBottom: 10 }}>
        기사 주소 또는 본문
      </label>
      <div
        style={{
          background: 'var(--au-surface)',
          border: `1px solid ${error ? 'var(--au-error)' : focused ? 'transparent' : 'var(--au-border)'}`,
          borderRadius: 'var(--au-radius-lg)',
          padding: 6,
          boxShadow: focused && !error ? 'var(--au-glow-violet)' : 'var(--au-shadow-card)',
          transition: 'box-shadow var(--au-duration) var(--au-ease), border-color var(--au-duration) var(--au-ease)',
        }}
      >
        <textarea
          id="au-content"
          placeholder={'기사 주소를 붙여넣거나 통계 수치가 담긴 문장을 입력하세요…'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={!!error}
          rows={4}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 120,
            padding: '14px 16px',
            background: 'transparent',
            border: 0,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'var(--au-font-body)',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--au-text)',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 14,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span
          className="au-num"
          style={{
            fontFamily: 'var(--au-font-mono)',
            fontSize: 12,
            color: content.trim().length > 0 ? 'var(--au-text-secondary)' : 'var(--au-text-muted)',
          }}
        >
          {content.trim().length.toLocaleString()} chars
        </span>
        <button
          type="submit"
          disabled={isLoading}
          style={primaryBtnStyle(isLoading)}
          onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.boxShadow = 'var(--au-glow-violet)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
        >
          <SubmitContent isLoading={isLoading} label="검증 시작" />
        </button>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            background: 'var(--au-error-bg)',
            color: 'var(--au-error)',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 'var(--au-radius)',
            border: '1px solid rgba(251, 113, 133, 0.3)',
          }}
        >
          {error}
        </p>
      )}

      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--au-text-muted)', lineHeight: 1.6 }}>
        <span className="au-overline" style={{ marginRight: 6 }}>Tip</span>
        주소인지 본문인지는 알아서 구분해 드려요. 입력값에{' '}
        <code style={tipCodeStyle}>article-2..5</code> 또는{' '}
        <code style={tipCodeStyle}>true</code> /{' '}
        <code style={tipCodeStyle}>false</code> /{' '}
        <code style={tipCodeStyle}>mislead</code> /{' '}
        <code style={tipCodeStyle}>nei</code> 를 넣으면 예시 결과를 미리 볼 수 있어요.
      </p>
    </form>
  )
}

/* ───────────────────── sub-components ────────────────────── */

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

function primaryBtnStyle(disabled: boolean): CSSProperties {
  return {
    height: 44,
    padding: '0 26px',
    fontFamily: 'var(--au-font-body)',
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? 'var(--au-text-muted)' : 'var(--au-on-accent)',
    background: disabled ? 'var(--au-surface-2)' : 'var(--au-grad)',
    border: 0,
    borderRadius: 'var(--au-radius-full)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'box-shadow var(--au-duration) var(--au-ease)',
    whiteSpace: 'nowrap',
  }
}

const tipCodeStyle: CSSProperties = {
  background: 'var(--au-surface-2)',
  color: 'var(--au-violet-bright)',
  padding: '1px 7px',
  borderRadius: 'var(--au-radius-full)',
  fontSize: 11,
}
