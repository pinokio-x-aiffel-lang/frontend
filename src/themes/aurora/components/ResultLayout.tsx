import { useMemo, useState, type CSSProperties } from 'react'
import type {
  Article,
  Claim,
  ClaimResult,
  Diagnostics,
  Evidence,
  VerdictCode,
  VerifyResponse,
} from '@/lib/api/schema'
import { countByVerdict } from '@/lib/verdict'

interface ResultLayoutProps {
  result: VerifyResponse
  onReset: () => void
  showDebug: boolean
}

export function ResultLayout({ result, onReset, showDebug }: ResultLayoutProps) {
  const { article, claims, verifications, diagnostics } = result

  const claimMap = useMemo(() => new Map(claims.map((c) => [c.claim_id, c])), [claims])

  const allEvidence = useMemo(() => {
    const seen = new Map<string, Evidence>()
    for (const r of verifications.claim_results) {
      for (const e of r.evidence) {
        const key = `${e.table_name}|${e.period}|${e.population}`
        if (!seen.has(key)) seen.set(key, e)
      }
    }
    return [...seen.values()]
  }, [verifications.claim_results])

  return (
    <div style={{ maxWidth: 'var(--au-max-width-narrow)', margin: '0 auto', padding: '0 24px 96px' }}>
      <button onClick={onReset} style={backBtnStyle} aria-label="다시 검증">
        <span aria-hidden="true">←</span>
        <span>다른 기사 확인하기</span>
      </button>

      <ArticleHero article={article} summary={verifications.summary} claim_results={verifications.claim_results} />

      <Divider />

      <ClaimsSection claim_results={verifications.claim_results} claimMap={claimMap} />

      <Divider />

      <EvidenceSection references={allEvidence} />

      {showDebug && diagnostics && (
        <>
          <Divider />
          <DebugSection diagnostics={diagnostics} />
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */

function Divider() {
  return <hr className="au-divider" style={{ margin: '56px 0' }} />
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header style={{ marginBottom: 28 }}>
      <div className="au-overline" style={{ marginBottom: 8 }}>{eyebrow}</div>
      <h2 style={{ fontSize: 'var(--au-text-section)' }}>{title}</h2>
    </header>
  )
}

/* ───────────────────── verdict view 매핑 ───────────────────── */

const VERDICT_ORDER: VerdictCode[] = ['T', 'F', 'M', 'NEI']

const VERDICT_VIEW: Record<VerdictCode, { label: string; color: string; bg: string }> = {
  T: { label: '사실', color: 'var(--au-verdict-true)', bg: 'var(--au-verdict-true-bg)' },
  F: { label: '거짓', color: 'var(--au-verdict-false)', bg: 'var(--au-verdict-false-bg)' },
  M: { label: '오해 소지', color: 'var(--au-verdict-mislead)', bg: 'var(--au-verdict-mislead-bg)' },
  NEI: { label: '확인 어려움', color: 'var(--au-verdict-nei)', bg: 'var(--au-verdict-nei-bg)' },
}

/* ───────────────────── A. Article hero ───────────────────── */

function ArticleHero({
  article,
  summary,
  claim_results,
}: {
  article: Article
  summary: VerifyResponse['verifications']['summary']
  claim_results: ClaimResult[]
}) {
  const counts = useMemo(() => countByVerdict(claim_results), [claim_results])
  const contentExcerpt = useMemo(() => excerpt(article.content, 220), [article.content])
  const isLong = article.content.length > 220
  const [expanded, setExpanded] = useState(false)

  return (
    <section aria-labelledby="article-verdict">
      <div className="au-overline" style={{ marginBottom: 12 }}>기사 전체 결과</div>
      <h1 id="article-verdict" style={{ fontSize: 'var(--au-text-headline)', lineHeight: 1.05, margin: '0 0 10px' }}>
        이 기사를 <span className="au-grad-text">확인했어요</span>
      </h1>
      <p style={{ fontSize: 15, color: 'var(--au-text-muted)', margin: '0 0 28px' }}>
        주장 <strong className="au-num" style={{ color: 'var(--au-text)' }}>{summary.total_claims}</strong>개를 살펴봤어요 · 평균 신뢰도{' '}
        <strong className="au-num" style={{ color: 'var(--au-text)' }}>{Math.round(summary.average_confidence * 100)}%</strong>
      </p>

      <VerdictDistributionBar counts={counts} total={summary.total_claims} />

      {/* 전체 총평 / 해석 */}
      {summary.overview_reason && <OverviewReason text={summary.overview_reason} />}

      {/* Article meta — glass card */}
      <article className="au-card" style={{ marginTop: 32, padding: '24px 28px' }}>
        <h2 style={{ fontSize: 'var(--au-text-subhead)', margin: '0 0 10px' }}>{article.title}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'var(--au-text-muted)', marginBottom: 16, fontFamily: 'var(--au-font-mono)' }}>
          <span>{article.source}</span>
          <span>·</span>
          <span className="au-num">{formatDate(article.published_at)}</span>
        </div>
        <p style={{ fontSize: 'var(--au-text-body-lg)', lineHeight: 1.7, margin: 0, color: 'var(--au-text-secondary)', whiteSpace: 'pre-wrap' }}>
          {expanded || !isLong ? article.content : contentExcerpt}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={showMoreStyle}
          >
            {expanded ? '접기' : '더보기'}
            <span aria-hidden="true" style={{ fontSize: 9 }}>{expanded ? '▲' : '▼'}</span>
          </button>
        )}
      </article>
    </section>
  )
}

/* ───────────────────── overview reason ───────────────────── */

function OverviewReason({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'relative',
        marginTop: 28,
        padding: '20px 24px 20px 26px',
        background: 'var(--au-grad-soft)',
        border: '1px solid var(--au-border)',
        borderRadius: 'var(--au-radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* 좌측 그라데이션 액센트 바 */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: 'var(--au-grad)',
          boxShadow: 'var(--au-accent-glow)',
        }}
      />
      <div className="au-overline" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span aria-hidden="true" style={{ fontSize: 13 }}>✦</span>
        한눈에 보는 총평
      </div>
      <p style={{ margin: 0, fontSize: 'var(--au-text-body-lg)', lineHeight: 1.65, color: 'var(--au-text)', fontWeight: 500 }}>
        {text}
      </p>
    </div>
  )
}

/* ───────────────────── distribution bar ───────────────────── */

function VerdictDistributionBar({ counts, total }: { counts: Record<VerdictCode, number>; total: number }) {
  const [hoveredCode, setHoveredCode] = useState<VerdictCode | null>(null)
  const segments = VERDICT_ORDER.filter((c) => counts[c] > 0)

  return (
    <div>
      <div
        role="img"
        aria-label={`주장 ${total}개 중 사실 ${counts.T}, 거짓 ${counts.F}, 오해 소지 ${counts.M}, 확인 어려움 ${counts.NEI}`}
        style={{
          display: 'flex',
          width: '100%',
          height: 16,
          borderRadius: 'var(--au-radius-full)',
          overflow: 'hidden',
          background: 'var(--au-surface-2)',
          border: '1px solid var(--au-border)',
          position: 'relative',
        }}
      >
        {segments.map((code, i) => {
          const view = VERDICT_VIEW[code]
          const pct = total === 0 ? 0 : (counts[code] / total) * 100
          const isHovered = hoveredCode === code
          return (
            <div
              key={code}
              onMouseEnter={() => setHoveredCode(code)}
              onMouseLeave={() => setHoveredCode(null)}
              style={{
                width: `${pct}%`,
                background: view.color,
                borderLeft: i > 0 ? '2px solid var(--au-bg)' : 'none',
                boxShadow: isHovered ? `0 0 16px ${view.color}` : 'none',
                transition: 'box-shadow var(--au-duration) var(--au-ease), filter var(--au-duration) var(--au-ease)',
                filter: isHovered ? 'brightness(1.15)' : 'none',
                position: 'relative',
                cursor: 'help',
              }}
              aria-hidden="true"
            >
              {isHovered && <Tooltip text={`${view.label} ${counts[code]}개 · ${pct.toFixed(1)}%`} color={view.color} />}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        {VERDICT_ORDER.map((code) => {
          const view = VERDICT_VIEW[code]
          const n = counts[code]
          const muted = n === 0
          return (
            <div
              key={code}
              onMouseEnter={() => !muted && setHoveredCode(code)}
              onMouseLeave={() => setHoveredCode(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                borderRadius: 'var(--au-radius-full)',
                background: muted ? 'transparent' : view.bg,
                border: `1px solid ${muted ? 'var(--au-border)' : 'transparent'}`,
                opacity: muted ? 0.5 : 1,
                cursor: muted ? 'default' : 'help',
                transition: 'opacity var(--au-duration) var(--au-ease)',
              }}
            >
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: view.color, boxShadow: muted ? 'none' : `0 0 8px ${view.color}` }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--au-text)' }}>{view.label}</span>
              <span className="au-num" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 13, color: 'var(--au-text-muted)' }}>{n}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Tooltip({ text, color }: { text: string; color: string }) {
  return (
    <span
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        padding: '6px 12px',
        background: 'var(--au-surface-solid)',
        color: 'var(--au-text)',
        fontFamily: 'var(--au-font-body)',
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 'var(--au-radius-full)',
        border: '1px solid var(--au-border-strong)',
        boxShadow: 'var(--au-shadow-elevated)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 1, boxShadow: `0 0 6px ${color}` }} />
      {text}
    </span>
  )
}

/* ───────────────────── B. Claims ───────────────────── */

function ClaimsSection({ claim_results, claimMap }: { claim_results: ClaimResult[]; claimMap: Map<string, Claim> }) {
  return (
    <section aria-labelledby="claims-heading">
      <SectionHeader eyebrow={`주장 하나씩 보기 · ${claim_results.length}개`} title="주장별로 따져봤어요" />
      <ol id="claims-heading" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
        {claim_results.map((r, idx) => (
          <ClaimRow key={r.claim_id} index={idx + 1} result={r} claim={claimMap.get(r.claim_id)} />
        ))}
      </ol>
    </section>
  )
}

function ClaimRow({ index, result, claim }: { index: number; result: ClaimResult; claim: Claim | undefined }) {
  const sentence = claim?.sentence ?? '(원문을 찾지 못했어요)'
  const unit = claim?.claim_info.unit ?? ''
  const subject = claim?.claim_info.subject ?? '주장'
  const view = VERDICT_VIEW[result.verdict]
  // 증감(change_rate) claim은 '레벨'(kosis_value)이 아니라 비교가능한 증감값(computed_value)을
  // 보여줘야 "기사 속 수치(+193,000)"와 정합한다.
  const isChange = claim?.claim_info.claim_type === 'change_rate'
  const officialRaw =
    isChange && result.computed_value != null ? result.computed_value : result.kosis_value
  const confLabel = result.confidence == null ? '—' : `${Math.round(result.confidence * 100)}%`

  return (
    <li className="au-card au-card-hoverable" style={{ overflow: 'hidden', padding: 0 }}>
      {/* 상단 판정 띠 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 22px',
          background: view.bg,
          borderBottom: `1px solid ${view.color}`,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--au-font-display)', fontSize: 17, fontWeight: 600, color: view.color }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: view.color, boxShadow: `0 0 10px ${view.color}` }} />
          {view.label}
        </span>
        <span className="au-num" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 13, color: view.color, opacity: 0.85 }}>
          {String(index).padStart(2, '0')}번 주장
        </span>
      </div>

      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 'var(--au-text-body-lg)', lineHeight: 1.55, margin: '0 0 18px', color: 'var(--au-text)' }}>
          “{sentence}”
        </p>

        {/* 비교 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 16,
            padding: '16px 20px',
            background: 'var(--au-surface-2)',
            borderRadius: 'var(--au-radius)',
            marginBottom: 16,
          }}
        >
          <NumberBlock label="기사 속 수치" value={fmtNumeric(result.claim_value, isChange)} unit={unit} />
          <span aria-hidden="true" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 13, color: 'var(--au-text-faint)' }}>vs</span>
          <NumberBlock
            label="공식 통계"
            align="right"
            value={fmtNumeric(officialRaw, isChange)}
            unit={unit}
            valueColor={officialRaw == null ? 'var(--au-text-faint)' : view.color}
          />
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.7, margin: '0 0 18px', color: 'var(--au-text-secondary)' }}>
          {result.explanation}
        </p>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: '1px solid var(--au-border)', flexWrap: 'wrap' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 'var(--au-radius-full)',
              background: view.bg,
              color: view.color,
              fontFamily: 'var(--au-font-display)',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {subject.slice(0, 1)}
          </span>
          <span style={{ fontSize: 14, color: 'var(--au-text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subject}
          </span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Pill label={`신뢰도 ${confLabel}`} />
            <Pill label={`근거 ${result.evidence.length}건`} />
            {result.mismatch_type && <Pill label={result.mismatch_type} tone="accent" />}
          </span>
        </div>

        {/* 근거 링크 */}
        {result.evidence.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {result.evidence.map((ev, i) => (
              <a
                key={i}
                href={ev.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--au-font-mono)',
                  fontSize: 12,
                  color: 'var(--au-violet-bright)',
                  padding: '5px 12px',
                  background: 'var(--au-accent-tint)',
                  borderRadius: 'var(--au-radius-full)',
                }}
              >
                <span>{ev.table_name}</span>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' }) {
  const bg = tone === 'accent' ? 'var(--au-accent-tint)' : 'var(--au-surface-2)'
  const color = tone === 'accent' ? 'var(--au-violet-bright)' : 'var(--au-text-muted)'
  return (
    <span
      className="au-num"
      style={{
        fontFamily: 'var(--au-font-mono)',
        fontSize: 12,
        fontWeight: 500,
        padding: '4px 12px',
        borderRadius: 'var(--au-radius-full)',
        background: bg,
        color,
      }}
    >
      {label}
    </span>
  )
}

function NumberBlock({
  label,
  value,
  unit,
  align = 'left',
  valueColor = 'var(--au-text)',
}: {
  label: string
  value: string
  unit: string
  align?: 'left' | 'right'
  valueColor?: string
}) {
  return (
    <div style={{ textAlign: align, minWidth: 0 }}>
      <div className="au-overline" style={{ marginBottom: 4 }}>{label}</div>
      <div className="au-num" style={{ fontFamily: 'var(--au-font-display)', fontSize: 24, fontWeight: 600, color: valueColor, lineHeight: 1.1 }}>
        {value}
        {unit && <span style={{ fontSize: 14, color: 'var(--au-text-faint)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

/* ───────────────────── C. Evidence ───────────────────── */

function EvidenceSection({ references }: { references: Evidence[] }) {
  if (references.length === 0) {
    return (
      <section aria-labelledby="evidence-heading">
        <SectionHeader eyebrow="근거 자료" title="비교할 자료를 찾지 못했어요" />
        <div className="au-card" style={{ padding: 32, textAlign: 'center', color: 'var(--au-text-muted)', fontSize: 14 }}>
          이 기사의 주장과 맞는 통계청 공식 자료를 찾지 못했어요.
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="evidence-heading">
      <SectionHeader eyebrow={`근거 자료 · ${references.length}개`} title="근거가 된 통계청 자료" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {references.map((ev, i) => (
          <EvidenceCard key={i} ev={ev} />
        ))}
      </div>
    </section>
  )
}

function EvidenceCard({ ev }: { ev: Evidence }) {
  return (
    <article className="au-card au-card-hoverable" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div className="au-overline" style={{ marginBottom: 6, color: 'var(--au-violet-bright)' }}>{ev.source}</div>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{ev.table_name}</h3>
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 4, columnGap: 12, margin: 0, fontSize: 13 }}>
        <dt className="au-overline">항목</dt>
        <dd style={{ margin: 0, color: 'var(--au-text)' }}>{ev.subject}</dd>
        <dt className="au-overline">기간</dt>
        <dd className="au-num" style={{ margin: 0, fontFamily: 'var(--au-font-mono)' }}>{fmtPeriod(ev.period)}</dd>
        <dt className="au-overline">대상</dt>
        <dd style={{ margin: 0, color: 'var(--au-text)' }}>{ev.population}</dd>
        <dt className="au-overline">갱신</dt>
        <dd className="au-num" style={{ margin: 0, fontFamily: 'var(--au-font-mono)', color: 'var(--au-text-muted)' }}>{ev.last_updated}</dd>
      </dl>

      <div
        style={{
          padding: '12px 16px',
          background: 'var(--au-grad-soft)',
          border: '1px solid var(--au-border)',
          borderRadius: 'var(--au-radius)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span className="au-overline">공식 수치</span>
        <span className="au-num" style={{ fontFamily: 'var(--au-font-display)', fontSize: 20, fontWeight: 600, color: 'var(--au-text)' }}>
          {fmtNumeric(String(ev.value))}
        </span>
        <span style={{ fontSize: 12, color: 'var(--au-text-muted)' }}>{ev.unit}</span>
      </div>

      <a href={ev.url ?? undefined} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 12 }}>
        통계청에서 보기 →
      </a>
    </article>
  )
}

/* ───────────────────── D. Debug ───────────────────── */

function DebugSection({ diagnostics }: { diagnostics: Diagnostics }) {
  const [showJson, setShowJson] = useState(false)

  return (
    <section
      aria-labelledby="debug-heading"
      style={{ background: 'var(--au-bg-elev)', border: '1px solid var(--au-border)', borderRadius: 'var(--au-radius-lg)', padding: 28 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <h2 id="debug-heading" style={{ fontSize: 'var(--au-text-subhead)', margin: 0 }}>디버그 정보</h2>
        <div className="au-num" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 12, color: 'var(--au-text-muted)' }}>
          {diagnostics.request_id} · {(diagnostics.total_latency_ms / 1000).toFixed(2)}s
        </div>
      </div>

      <DebugBlock title="처리 단계">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
          {diagnostics.pipeline.map((step) => (
            <div
              key={step.step}
              style={{
                background: 'var(--au-surface)',
                padding: '8px 12px',
                borderRadius: 'var(--au-radius-sm)',
                boxShadow: `inset 3px 0 0 0 ${pipelineColor(step.status)}`,
                fontFamily: 'var(--au-font-mono)',
                fontSize: 11,
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--au-text-secondary)',
              }}
            >
              <span><span style={{ color: pipelineColor(step.status) }}>●</span> {step.step}. {step.name}</span>
              <span className="au-num" style={{ color: 'var(--au-text-muted)' }}>{step.duration_ms !== null ? `${step.duration_ms}ms` : '—'}</span>
            </div>
          ))}
        </div>
      </DebugBlock>

      <DebugBlock title="자료 검색 단계">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
          <DStat label="catalog_filtered" value={String(diagnostics.retrieval.catalog_filtered)} />
          <DStat label="embedding_top50" value={String(diagnostics.retrieval.embedding_top50)} />
          <DStat label="rerank_top5" value={String(diagnostics.retrieval.rerank_top5)} />
          <DStat label="rag_top1" value={diagnostics.retrieval.rag_top1_table_id ?? '∅'} />
        </div>
      </DebugBlock>

      <DebugBlock title="LLM 호출">
        <table style={{ width: '100%', fontFamily: 'var(--au-font-mono)', fontSize: 11, borderCollapse: 'collapse', color: 'var(--au-text-secondary)' }}>
          <thead>
            <tr style={{ color: 'var(--au-text-muted)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>stage</th>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>model</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>in</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>out</th>
              <th style={{ textAlign: 'right', padding: '6px 8px' }}>ms</th>
            </tr>
          </thead>
          <tbody>
            {diagnostics.llm_calls.map((c, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--au-border)' }}>
                <td style={{ padding: '6px 8px' }}>{c.stage}</td>
                <td style={{ padding: '6px 8px' }}>{c.model}</td>
                <td className="au-num" style={{ padding: '6px 8px', textAlign: 'right' }}>{c.input_tokens}</td>
                <td className="au-num" style={{ padding: '6px 8px', textAlign: 'right' }}>{c.output_tokens}</td>
                <td className="au-num" style={{ padding: '6px 8px', textAlign: 'right' }}>{c.latency_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DebugBlock>

      {diagnostics.errors.length > 0 && (
        <DebugBlock title="오류">
          {diagnostics.errors.map((e, i) => (
            <div key={i} style={{ color: 'var(--au-error)', fontFamily: 'var(--au-font-mono)', fontSize: 11, marginBottom: 4 }}>
              [{e.stage}] {e.message}
            </div>
          ))}
        </DebugBlock>
      )}

      <button
        type="button"
        onClick={() => setShowJson((v) => !v)}
        style={{
          background: 'transparent',
          border: '1px solid var(--au-border-strong)',
          color: 'var(--au-text)',
          padding: '8px 18px',
          fontFamily: 'var(--au-font-body)',
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 'var(--au-radius-full)',
          cursor: 'pointer',
        }}
      >
        {showJson ? '원본 숨기기' : '원본 JSON 보기'}
      </button>
      {showJson && (
        <pre
          style={{
            marginTop: 12,
            padding: 14,
            background: 'rgba(0,0,0,0.4)',
            color: 'var(--au-text-secondary)',
            border: '1px solid var(--au-border)',
            borderRadius: 'var(--au-radius-sm)',
            fontFamily: 'var(--au-font-mono)',
            fontSize: 11,
            overflowX: 'auto',
            maxHeight: 320,
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      )}
    </section>
  )
}

function DebugBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="au-overline" style={{ marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

function DStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--au-surface)', padding: 10, borderRadius: 'var(--au-radius-sm)' }}>
      <div className="au-overline" style={{ marginBottom: 2 }}>{label}</div>
      <div className="au-num" style={{ fontFamily: 'var(--au-font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--au-text)' }}>{value}</div>
    </div>
  )
}

/* ───────────────────── helpers ───────────────────── */

/** 기사 전문 펼침 토글 — 작고 희미하지만 점선 밑줄로 눈에 띄게 */
const showMoreStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  marginTop: 14,
  padding: 0,
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  fontFamily: 'var(--au-font-mono)',
  fontSize: 12,
  letterSpacing: '0.04em',
  color: 'var(--au-text-muted)',
  textDecoration: 'underline dotted',
  textUnderlineOffset: 3,
}

const backBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 40,
  padding: '9px 18px',
  background: 'var(--au-surface)',
  color: 'var(--au-text-secondary)',
  border: '1px solid var(--au-border)',
  borderRadius: 'var(--au-radius-full)',
  cursor: 'pointer',
  fontFamily: 'var(--au-font-body)',
  fontSize: 13,
  fontWeight: 500,
  transition: 'border-color var(--au-duration) var(--au-ease)',
}

function pipelineColor(status: 'pending' | 'running' | 'done' | 'skipped' | 'error'): string {
  switch (status) {
    case 'done': return 'var(--au-verdict-true)'
    case 'running': return 'var(--au-violet-bright)'
    case 'error': return 'var(--au-error)'
    case 'skipped': return 'var(--au-text-faint)'
    case 'pending': return 'var(--au-border-strong)'
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '날짜 정보 없음'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

function excerpt(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

/** 수치 문자열 표시 정규화: 천단위 구분 + 소수 정리 + (증감이면) 부호. 숫자가 아니면 원문. */
function fmtNumeric(raw: string | null, signed = false): string {
  if (raw == null || raw === '') return '—'
  const n = Number(String(raw).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(raw)
  const body = Math.abs(n).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
  return (n < 0 ? '−' : signed ? '+' : '') + body
}

/** 기간 표시 정규화: 202503 → 2025-03 (그 외 포맷은 그대로). */
function fmtPeriod(p: string): string {
  const m = /^(\d{4})(\d{2})$/.exec(p)
  return m ? `${m[1]}-${m[2]}` : p
}
