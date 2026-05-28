import type { VerdictCode } from './api/schema'

interface VerdictMeta {
  label: string
  code: VerdictCode
  description: string
  colorVar: string
  bgVar: string
  borderVar: string
}

/**
 * verdict 코드별 한국어 라벨·설명·테마 변수 매핑.
 * 색 변수 이름은 default 테마 tokens.css 기준 (true/false/ambiguous/none).
 * 다른 테마(voicebox, geist)는 자체 변수를 사용하므로 이 헬퍼를 안 거치고 직접 매핑.
 */
export const VERDICT_META: Record<VerdictCode, VerdictMeta> = {
  T: {
    label: '사실',
    code: 'T',
    description: '기사의 수치가 공식 통계와 일치합니다',
    colorVar: '--color-verdict-true',
    bgVar: '--color-verdict-true-bg',
    borderVar: '--color-verdict-true-border',
  },
  F: {
    label: '거짓',
    code: 'F',
    description: '기사의 수치가 공식 통계와 불일치합니다',
    colorVar: '--color-verdict-false',
    bgVar: '--color-verdict-false-bg',
    borderVar: '--color-verdict-false-border',
  },
  M: {
    label: '모호',
    code: 'M',
    description: '수치 또는 맥락이 왜곡되어 오해를 일으킬 수 있습니다',
    colorVar: '--color-verdict-ambiguous',
    bgVar: '--color-verdict-ambiguous-bg',
    borderVar: '--color-verdict-ambiguous-border',
  },
  NEI: {
    label: '판단불가',
    code: 'NEI',
    description: '대응하는 공식 통계를 찾을 수 없습니다 (Not Enough Information)',
    colorVar: '--color-verdict-none',
    bgVar: '--color-verdict-none-bg',
    borderVar: '--color-verdict-none-border',
  },
}

export function getVerdictMeta(verdict: VerdictCode): VerdictMeta {
  return VERDICT_META[verdict]
}

/**
 * claim_results 배열에서 verdict 코드별 개수를 집계.
 * 분포 막대(stacked bar) 표시에 사용.
 */
export function countByVerdict(
  results: ReadonlyArray<{ verdict: VerdictCode }>,
): Record<VerdictCode, number> {
  const counts: Record<VerdictCode, number> = { T: 0, F: 0, M: 0, NEI: 0 }
  for (const r of results) counts[r.verdict] += 1
  return counts
}

/**
 * 동일한 claim_results 집계로 overall_verdict 조합형 코드를 계산.
 * (백엔드가 보낸 summary.overall_verdict가 있으면 그대로 사용하지만,
 *  검증/일관성 체크용으로 프론트에서도 동일 계산을 제공.)
 */
export function deriveOverallVerdict(
  results: ReadonlyArray<{ verdict: VerdictCode }>,
): string {
  const counts = countByVerdict(results)
  const order: VerdictCode[] = ['T', 'F', 'M', 'NEI']
  const present = order.filter((c) => counts[c] > 0)
  return present.length === 0 ? 'NEI' : present.join('+')
}
