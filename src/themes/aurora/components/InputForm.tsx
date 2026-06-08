import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { verifyRequestSchema, type VerifyRequest } from '@/lib/api/schema'

/** 로그인 왕복 등으로 InputForm이 언마운트돼도 입력 초안을 잠시 보관하는 sessionStorage 키 */
export const VERIFY_DRAFT_KEY = 'verify-draft'

function readDraft(): string {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(VERIFY_DRAFT_KEY) ?? ''
}

/** 입력창에 기본으로 희미하게 떠 있는 추천 텍스트 — 사용자가 손대지 않고 제출하면 이 문장이 그대로 전송된다 */
const RECOMMENDED_TEXT =
  '성장 전망은 한국은행 한국은행과 통계청이 공개하고 있는 경제 지표를 확인하면, 현재 경기 흐름을 파악할 수 있다. 현재 두 기관에서 공개된 정보들을 살펴보면 우리나라 경제가 하강 국면에 있음을 보여 준다. 한국은행은 지난 2월 경제전망보고서를 발표하고, 올해 우리나라 경제성장률 전망치를 기존 1.9%에서 1.5%로 낮췄다. 한국은행은 매년 2·5·8·11월 경제전망보고서를 발표한다. 경제전망보고서는 책 표지의 색깔(남색)을 따서, ‘인디고북(Indigo Book)’이라고도 불린다. 경제 전망 외에도 대내외 경제 여건과 리스크를 분석해 담고 있고, 도널드 트럼프 미국 대통령의 관세 정책 영향과 같은 주요 현안을 다루기도 한다. 경기 상황을 파악하려면 국내 성장률 전망이 이전에 비해 상향 조정됐는지, 하향 조정됐는지를 살펴보자. 올해 성장률 전망치의 경우 작년 5월 이후 줄곧 하향 조정돼 왔다. 과거 30년간 우리나라 경제성장률이 올해 전망치인 1.5%보다 낮았던 때는 1998년 외환 위기, 2009년 글로벌 금융 위기, 2020년 코로나 팬데믹 위기 등이다. 한국은행 경제통계시스템(ecos.bok.or.kr)에 접속하면 각종 경제와 금융 통계들을 확인할 수 있다. 국내총생산(GDP), 물가, 환율, 산업, 가계, 외환보유액, 해외 지표 등이다. 맨 첫 화면 우측 하단에는 금리, 환율, 주가 등 일일 지표가 실시간으로 제공되기 때문에 관련 정보를 한 번에 확인할 때 편하다. 한국은행이 공표하는 주요 통계에 대한 해설이나 공표 일정도 공개돼 있으므로 관심 있는 정보가 있다면 확인해 볼 수 있다.'

interface InputFormProps {
  onSubmit: (req: VerifyRequest) => void
  isLoading: boolean
  /** 'Tip' 글자 클릭 시 호출 — 현재 입력값을 그대로 넘긴다 (dummy API 테스트용) */
  onTipClick?: (content: string) => void
  /** 넘기면 '검증 시작' 왼쪽에 '새 검증'(초기화) 버튼을 노출한다 */
  onReset?: () => void
}

export function InputForm({ onSubmit, isLoading, onTipClick, onReset }: InputFormProps) {
  const [content, setContent] = useState(() => readDraft() || RECOMMENDED_TEXT)
  // 추천 기본 텍스트를 아직 손대지 않은 상태면 true — 희미하게 표시하고 포커스 시 전체 선택한다
  const [isDefault, setIsDefault] = useState(() => readDraft().length === 0)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  // 로그인 왕복 후 복원한 초안은 한 번만 쓰고 비운다 (이후 마운트에서 옛 텍스트가 다시 뜨지 않도록)
  useEffect(() => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(VERIFY_DRAFT_KEY)
  }, [])

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
      <label
        htmlFor="au-content"
        style={{ display: 'block', marginBottom: 10, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: 'var(--au-text-secondary)' }}
      >
        기사 주소를 붙여넣거나 통계 수치가 담긴 문장을 입력하세요
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
          placeholder={'검증할 기사 주소나 문장을 입력하세요'}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setIsDefault(false)
          }}
          onFocus={(e) => {
            setFocused(true)
            if (isDefault) e.currentTarget.select() // 추천 텍스트는 포커스 시 전체 선택 → 첫 타이핑에 교체
          }}
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
            color: isDefault ? 'var(--au-text-muted)' : 'var(--au-text)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onReset && (
            <button type="button" onClick={onReset} style={resetBtnStyle}>
              새 검증
            </button>
          )}
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
        <span
          className="au-overline"
          role={onTipClick ? 'button' : undefined}
          tabIndex={onTipClick ? 0 : undefined}
          onClick={onTipClick ? () => onTipClick(content) : undefined}
          onKeyDown={
            onTipClick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onTipClick(content)
                  }
                }
              : undefined
          }
          title={onTipClick ? 'dummy API로 테스트 요청 보내기' : undefined}
          style={{
            marginRight: 6,
            cursor: onTipClick ? 'pointer' : 'default',
            textDecoration: onTipClick ? 'underline dotted' : 'none',
            textUnderlineOffset: 3,
          }}
        >
          Tip
        </span>
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

const resetBtnStyle: CSSProperties = {
  height: 44,
  padding: '0 20px',
  fontFamily: 'var(--au-font-body)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--au-text)',
  background: 'var(--au-surface)',
  border: '1px solid var(--au-border-strong)',
  borderRadius: 'var(--au-radius-full)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
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
