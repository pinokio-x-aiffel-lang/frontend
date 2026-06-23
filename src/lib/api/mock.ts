import type {
  Claim,
  ClaimResult,
  Diagnostics,
  Evidence,
  PipelineStep,
  VerdictCode,
  VerifyRequest,
  VerifyResponse,
} from './schema'
import { countByVerdict, deriveOverallVerdict } from '@/lib/verdict'

/* ─────────────── 공통 helpers ─────────────── */

const PIPELINE_DONE: PipelineStep[] = [
  { step: 1, name: '기사 내용 추출', status: 'done', duration_ms: 420 },
  { step: 2, name: '주장 탐지', status: 'done', duration_ms: 1850 },
  { step: 3, name: '주장 분류', status: 'done', duration_ms: 980 },
  { step: 4, name: '주장 구조화', status: 'done', duration_ms: 1340 },
  { step: 5, name: 'KOSIS 카탈로그 필터링', status: 'done', duration_ms: 210 },
  { step: 6, name: '임베딩 검색 (Top-50)', status: 'done', duration_ms: 760 },
  { step: 7, name: '재순위화 (Top-5)', status: 'done', duration_ms: 890 },
  { step: 8, name: 'RAG 추론 (Top-1)', status: 'done', duration_ms: 2100 },
  { step: 9, name: 'KOSIS API + 수치 비교', status: 'done', duration_ms: 1450 },
]

const PIPELINE_NO_MATCH: PipelineStep[] = [
  ...PIPELINE_DONE.slice(0, 5),
  { step: 6, name: '임베딩 검색 (Top-50)', status: 'error', duration_ms: 890 },
  { step: 7, name: '재순위화 (Top-5)', status: 'skipped', duration_ms: null },
  { step: 8, name: 'RAG 추론 (Top-1)', status: 'skipped', duration_ms: null },
  { step: 9, name: 'KOSIS API + 수치 비교', status: 'skipped', duration_ms: null },
]

const RETRIEVED_AT = '2026-05-14'

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/* ─────────────── 시나리오 정의 ─────────────── */

interface MockScenario {
  key: string
  matcher: (input: string) => boolean
  build: () => VerifyResponse
}

/* ── 시나리오 1: T+F+M 혼합 (3 claims) ── */
const scenarioMixed: MockScenario = {
  key: 'mixed',
  matcher: (s) => s.includes('article-1') || s.includes('mixed') || s.includes('default'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      {
        claim_id: 'chosun_20240115_m_c01',
        sentence: '2023년 청년(15~29세) 실업률은 5.9%였다.',
        claim_info: {
          subject: '청년 실업률',
          claim_type: '규모',
          claim_value: '5.9',
          normalized_value: '5.9',
          unit: '%',
          period: '2023',
          compare_period: null,
          population: '15~29세',
          cited_source: '통계청 고용동향',
        },
      },
      {
        claim_id: 'chosun_20240115_m_c02',
        sentence: '같은 해 합계출산율은 0.95명까지 떨어졌다.',
        claim_info: {
          subject: '합계출산율',
          claim_type: '규모',
          claim_value: '0.95',
          normalized_value: '0.95',
          unit: '명',
          period: '2023',
          compare_period: null,
          population: '전국',
          cited_source: null,
        },
      },
      {
        claim_id: 'chosun_20240115_m_c03',
        sentence: '소비자물가는 전년 대비 무려 두 배 가까이 올랐다.',
        claim_info: {
          subject: '소비자물가지수',
          claim_type: '변화율',
          claim_value: '~100',
          normalized_value: '100',
          unit: '%',
          period: '2023',
          compare_period: '2022',
          population: '전국',
          cited_source: null,
        },
      },
    ]
    const claim_results: ClaimResult[] = [
      {
        claim_id: 'chosun_20240115_m_c01',
        verdict: 'T',
        mismatch_type: null,
        claim_value: '5.9',
        kosis_value: '5.9',
        explanation:
          '2023년 청년 연간 평균 실업률 5.9%는 KOSIS 고용동향과 정확히 일치합니다.',
        confidence: 0.94,
        evidence: [evidenceYouthUnemp2023],
      },
      {
        claim_id: 'chosun_20240115_m_c02',
        verdict: 'F',
        mismatch_type: 'numeric_mismatch',
        claim_value: '0.95',
        kosis_value: '0.72',
        explanation:
          '기사의 2023년 합계출산율 0.95명은 KOSIS 공식 수치 0.72명과 약 32% 차이가 있어 불일치로 판정했습니다.',
        confidence: 0.91,
        evidence: [evidenceTFR2023],
      },
      {
        claim_id: 'chosun_20240115_m_c03',
        verdict: 'M',
        mismatch_type: 'rhetorical_exaggeration',
        claim_value: '~100',
        kosis_value: '3.6',
        explanation:
          '"두 배 가까이"는 약 100% 상승을 의미하지만 2023년 소비자물가지수 상승률은 3.6%입니다. 수사적 표현이 실제 통계와 크게 달라 오해 소지가 있습니다.',
        confidence: 0.78,
        evidence: [evidenceCPI2023],
      },
    ]
    return buildResponse({
      article: {
        title: '청년 실업·출산율·물가, 2023 한국 경제 핵심 지표',
        source: 'chosun',
        published_at: '2024-01-15',
        content:
          '2023년 청년(15~29세) 실업률은 5.9%였다. 같은 해 합계출산율은 0.95명까지 떨어졌다. 소비자물가는 전년 대비 무려 두 배 가까이 올랐다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-mixed',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 47,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_1B8000F',
        },
        total_latency_ms: 11_900,
      }),
    })
  },
}

/* ── 시나리오 2: 모두 사실 (T) ── */
const scenarioAllTrue: MockScenario = {
  key: 'all-true',
  matcher: (s) => s.includes('article-2') || s.includes('true'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      {
        claim_id: 'chosun_20240220_t_c01',
        sentence: '2022년 한국의 고령자(65세 이상) 비율은 17.5%였다.',
        claim_info: {
          subject: '고령인구 비율',
          claim_type: '비율',
          claim_value: '17.5',
          normalized_value: '17.5',
          unit: '%',
          period: '2022',
          compare_period: null,
          population: '65세 이상',
          cited_source: '통계청',
        },
      },
      {
        claim_id: 'chosun_20240220_t_c02',
        sentence: '같은 해 1인 가구 비율은 34.5%로 사상 최고치를 기록했다.',
        claim_info: {
          subject: '1인 가구 비율',
          claim_type: '비율',
          claim_value: '34.5',
          normalized_value: '34.5',
          unit: '%',
          period: '2022',
          compare_period: null,
          population: '전국 가구',
          cited_source: '통계청',
        },
      },
    ]
    const claim_results: ClaimResult[] = [
      {
        claim_id: 'chosun_20240220_t_c01',
        verdict: 'T',
        mismatch_type: null,
        claim_value: '17.5',
        kosis_value: '17.5',
        explanation:
          '통계청 인구총조사 기준 2022년 65세 이상 인구 비율 17.5%와 정확히 일치합니다.',
        confidence: 0.96,
        evidence: [evidenceElderly2022],
      },
      {
        claim_id: 'chosun_20240220_t_c02',
        verdict: 'T',
        mismatch_type: null,
        claim_value: '34.5',
        kosis_value: '34.5',
        explanation:
          'KOSIS 인구총조사 가구 통계의 2022년 1인 가구 비율 34.5%와 일치합니다.',
        confidence: 0.93,
        evidence: [evidenceSingleHH2022],
      },
    ]
    return buildResponse({
      article: {
        title: '고령화·1인 가구 비율 사상 최고…인구 구조 격변',
        source: 'chosun',
        published_at: '2024-02-20',
        content:
          '2022년 한국의 고령자(65세 이상) 비율은 17.5%였다. 같은 해 1인 가구 비율은 34.5%로 사상 최고치를 기록했다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-all-true',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 32,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_1IN1502',
        },
        total_latency_ms: 9_800,
      }),
    })
  },
}

/* ── 시나리오 3: 모두 거짓 (F) ── */
const scenarioAllFalse: MockScenario = {
  key: 'all-false',
  matcher: (s) => s.includes('article-3') || s.includes('false'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      {
        claim_id: 'unknown_20240305_f_c01',
        sentence: '2023년 합계출산율이 0.95명으로 OECD 평균을 웃돌았다.',
        claim_info: {
          subject: '합계출산율',
          claim_type: '규모',
          claim_value: '0.95',
          normalized_value: '0.95',
          unit: '명',
          period: '2023',
          compare_period: null,
          population: '전국',
          cited_source: null,
        },
      },
      {
        claim_id: 'unknown_20240305_f_c02',
        sentence: '청년 실업률도 12%를 넘어섰다.',
        claim_info: {
          subject: '청년 실업률',
          claim_type: '규모',
          claim_value: '12.0',
          normalized_value: '12.0',
          unit: '%',
          period: '2023',
          compare_period: null,
          population: '15~29세',
          cited_source: null,
        },
      },
    ]
    const claim_results: ClaimResult[] = [
      {
        claim_id: 'unknown_20240305_f_c01',
        verdict: 'F',
        mismatch_type: 'numeric_mismatch',
        claim_value: '0.95',
        kosis_value: '0.72',
        explanation:
          '2023년 한국의 합계출산율은 KOSIS 출생통계 기준 0.72명으로, 기사가 인용한 0.95명과 약 32% 차이가 납니다.',
        confidence: 0.92,
        evidence: [evidenceTFR2023],
      },
      {
        claim_id: 'unknown_20240305_f_c02',
        verdict: 'F',
        mismatch_type: 'numeric_mismatch',
        claim_value: '12.0',
        kosis_value: '5.9',
        explanation:
          'KOSIS 고용동향의 2023년 청년 실업률은 5.9%입니다. 기사가 인용한 12%는 약 2배 부풀려진 수치입니다.',
        confidence: 0.9,
        evidence: [evidenceYouthUnemp2023],
      },
    ]
    return buildResponse({
      article: {
        title: '출산율 반등·청년 실업률 급등…충격적 통계',
        source: '미상',
        published_at: '2024-03-05',
        content:
          '2023년 합계출산율이 0.95명으로 OECD 평균을 웃돌았다. 청년 실업률도 12%를 넘어섰다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-all-false',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 40,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_1B8000F',
        },
        total_latency_ms: 10_300,
      }),
    })
  },
}

/* ── 시나리오 4: 모호 + 판단불가 (M+NEI) ── */
const scenarioMisleading: MockScenario = {
  key: 'misleading',
  matcher: (s) => s.includes('article-4') || s.includes('mislead') || s.includes('ambig'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      {
        claim_id: 'unknown_20240312_x_c01',
        sentence: '최근 물가가 크게 올랐다.',
        claim_info: {
          subject: '소비자물가지수',
          claim_type: '정성/추상',
          claim_value: '크게',
          normalized_value: '',
          unit: '%',
          period: '2024',
          compare_period: '2023',
          population: '전국',
          cited_source: null,
        },
      },
      {
        claim_id: 'unknown_20240312_x_c02',
        sentence: '서민들의 체감 경기는 IMF 시절보다 더 나쁘다는 평가가 나온다.',
        claim_info: {
          subject: '경기체감지수',
          claim_type: '비교',
          claim_value: 'IMF 시절보다 나쁨',
          normalized_value: '',
          unit: '',
          period: '2024',
          compare_period: '1998',
          population: '전국 가구',
          cited_source: null,
        },
      },
    ]
    const claim_results: ClaimResult[] = [
      {
        claim_id: 'unknown_20240312_x_c01',
        verdict: 'M',
        mismatch_type: 'rhetorical_exaggeration',
        claim_value: '크게',
        kosis_value: '2.3',
        explanation:
          '"크게 올랐다"는 정성적 표현으로 구체적 수치가 없어 정량 비교가 어렵습니다. 실제 2024년 CPI 상승률 2.3%는 "크게"라는 강도와 부합하지 않을 수 있어 모호로 판정했습니다.',
        confidence: 0.42,
        evidence: [evidenceCPI2024],
      },
      {
        claim_id: 'unknown_20240312_x_c02',
        verdict: 'NEI',
        mismatch_type: null,
        claim_value: 'IMF 시절보다 나쁨',
        kosis_value: null,
        explanation:
          '"IMF 시절보다 나쁘다"는 주관적 비교로, 두 시점 간 직접 대조 가능한 단일 통계 지표가 없어 판정을 보류합니다.',
        confidence: 0.15,
        evidence: [],
      },
    ]
    return buildResponse({
      article: {
        title: '물가 급등, IMF 때보다 힘들다는 서민',
        source: '미상',
        published_at: '2024-03-12',
        content:
          '최근 물가가 크게 올랐다. 서민들의 체감 경기는 IMF 시절보다 더 나쁘다는 평가가 나온다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-misleading',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 22,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_1J20001',
        },
        total_latency_ms: 8_600,
        errors: [
          {
            stage: 'comparison',
            message: 'claim_value is qualitative — quantitative comparison skipped',
          },
        ],
      }),
    })
  },
}

/* ── 시나리오 5: NEI (1 claim, 대응 표 없음) ── */
const scenarioNEI: MockScenario = {
  key: 'nei',
  matcher: (s) => s.includes('article-5') || s.includes('nei') || s.includes('none'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      {
        claim_id: 'chosun_20240401_n_c01',
        sentence: '2023년 소상공인 폐업률이 역대 최고를 기록했다.',
        claim_info: {
          subject: '소상공인 폐업률',
          claim_type: '규모',
          claim_value: '역대 최고',
          normalized_value: '',
          unit: '%',
          period: '2023',
          compare_period: null,
          population: '소상공인',
          cited_source: null,
        },
      },
    ]
    const claim_results: ClaimResult[] = [
      {
        claim_id: 'chosun_20240401_n_c01',
        verdict: 'NEI',
        mismatch_type: null,
        claim_value: '역대 최고',
        kosis_value: null,
        explanation:
          '"소상공인 폐업률"은 현재 KOSIS 카탈로그(검토 대상 50여 개 표)에 포함되어 있지 않아 대응 통계를 찾지 못했습니다. 외부 데이터 소스 확장이 필요합니다.',
        confidence: 0,
        evidence: [],
      },
    ]
    return buildResponse({
      article: {
        title: '소상공인 폐업 역대 최고…경기침체 직격탄',
        source: 'chosun',
        published_at: '2024-04-01',
        content: '2023년 소상공인 폐업률이 역대 최고를 기록했다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-nei',
        pipeline: PIPELINE_NO_MATCH,
        retrieval: {
          catalog_filtered: 3,
          embedding_top50: 50,
          rerank_top5: 0,
          rag_top1_table_id: null,
        },
        total_latency_ms: 5_400,
        errors: [
          { stage: 'retrieval', message: 'No matching table in KOSIS catalog (threshold 0.6)' },
        ],
      }),
    })
  },
}

/* ─────────────── helpers (시나리오 6~8 작성 단순화) ─────────────── */

function mkClaim(
  id: string,
  sentence: string,
  info: {
    subject: string
    claim_value: string
    claim_type?: string
    normalized_value?: string
    unit?: string
    period?: string
    compare_period?: string | null
    population?: string
    cited_source?: string | null
  },
): Claim {
  return {
    claim_id: id,
    sentence,
    claim_info: {
      subject: info.subject,
      claim_type: info.claim_type ?? '규모',
      claim_value: info.claim_value,
      normalized_value: info.normalized_value ?? info.claim_value,
      unit: info.unit ?? '%',
      period: info.period ?? '2023',
      compare_period: info.compare_period ?? null,
      population: info.population ?? '전국',
      cited_source: info.cited_source ?? null,
    },
  }
}

function mkResult(
  id: string,
  verdict: VerdictCode,
  claim_value: string,
  kosis_value: string | null,
  explanation: string,
  confidence: number,
  evidence: Evidence[],
  mismatch_type: string | null = null,
): ClaimResult {
  return {
    claim_id: id,
    verdict,
    mismatch_type: mismatch_type ?? (verdict === 'F' ? 'numeric_mismatch' : null),
    claim_value,
    kosis_value,
    explanation,
    confidence,
    evidence,
  }
}

/* ── 시나리오 6: 4종 모두 등장 (T+F+M+NEI 비대칭) — 10 claims, 40/30/20/10 ── */
const scenarioAllFour: MockScenario = {
  key: 'all-four',
  matcher: (s) => s.includes('article-6') || s.includes('all-four') || s.includes('mix-all'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      mkClaim('c6-01', '2023년 합계출산율은 0.72명이다.', { subject: '합계출산율', claim_value: '0.72', unit: '명' }),
      mkClaim('c6-02', '2022년 65세 이상 비율은 17.5%였다.', { subject: '고령인구 비율', claim_value: '17.5', period: '2022', population: '65세 이상' }),
      mkClaim('c6-03', '2022년 1인 가구 비율은 34.5%였다.', { subject: '1인 가구 비율', claim_value: '34.5', period: '2022', population: '전국 가구' }),
      mkClaim('c6-04', '2023년 청년(15~29세) 실업률은 5.9%였다.', { subject: '청년 실업률', claim_value: '5.9', population: '15~29세' }),
      mkClaim('c6-05', '2023년 GDP 성장률은 5%를 기록했다.', { subject: 'GDP 성장률', claim_value: '5.0' }),
      mkClaim('c6-06', '가계부채는 GDP 대비 70% 수준이다.', { subject: '가계부채 / GDP 비율', claim_value: '70' }),
      mkClaim('c6-07', '2023년 외국인 관광객은 1억 명을 돌파했다.', { subject: '외국인 관광객 수', claim_value: '100000000', unit: '명' }),
      mkClaim('c6-08', '부동산 가격이 폭등하고 있다.', { subject: '주택매매가격지수', claim_value: '폭등', claim_type: '정성/추상', unit: '' }),
      mkClaim('c6-09', '환율은 안정세를 유지하고 있다.', { subject: '원/달러 환율', claim_value: '안정세', claim_type: '정성/추상', unit: '원' }),
      mkClaim('c6-10', '청년 자살률이 OECD 1위를 기록했다.', { subject: '청년 자살률', claim_value: 'OECD 1위', claim_type: '비교', unit: '명/10만' }),
    ]
    const claim_results: ClaimResult[] = [
      // T × 4
      mkResult('c6-01', 'T', '0.72', '0.72', '2023년 합계출산율 0.72명 — KOSIS 출생통계와 정확히 일치합니다.', 0.96, [evidenceTFR2023]),
      mkResult('c6-02', 'T', '17.5', '17.5', '2022년 65세 이상 인구 비율 17.5% — KOSIS 인구총조사와 일치합니다.', 0.94, [evidenceElderly2022]),
      mkResult('c6-03', 'T', '34.5', '34.5', '2022년 1인 가구 비율 34.5% — 인구총조사 가구 통계와 일치합니다.', 0.93, [evidenceSingleHH2022]),
      mkResult('c6-04', 'T', '5.9', '5.9', '2023년 청년 실업률 5.9% — 고용동향과 일치합니다.', 0.92, [evidenceYouthUnemp2023]),
      // F × 3
      mkResult('c6-05', 'F', '5.0', '1.4', '2023년 한국 GDP 성장률은 1.4%(국민계정)로, 5%와는 약 3.6%p 차이가 나는 거짓 수치입니다.', 0.91, [evidenceGDP2023]),
      mkResult('c6-06', 'F', '70', '105.5', '2023년 가계부채/GDP 비율은 약 105.5%로, 70%는 약 35%p 과소평가된 거짓 수치입니다.', 0.89, [evidenceHouseholdDebt2023]),
      mkResult('c6-07', 'F', '100000000', '11030000', '2023년 외국인 관광객은 약 1,103만 명입니다. "1억 명"은 약 9배 과장된 거짓 수치입니다.', 0.93, [evidenceTourists2023]),
      // M × 2
      mkResult('c6-08', 'M', '폭등', '-3.3', '"폭등"은 정성적 표현이며 2023년 주택매매가격지수 변동률은 -3.3%로 오히려 하락했습니다.', 0.62, [evidenceHousing2023], 'rhetorical_exaggeration'),
      mkResult('c6-09', 'M', '안정세', '1305', '2023년 원/달러 평균 환율은 1,305원, 연중 변동폭은 약 65원이었습니다. "안정세"라 단정하기엔 변동폭이 작지 않습니다.', 0.55, [evidenceFX2023], 'rhetorical_misinterpretation'),
      // NEI × 1
      mkResult('c6-10', 'NEI', 'OECD 1위', null, '청년 자살률의 OECD 국가 간 비교는 KOSIS 카탈로그만으로 직접 대조하기 어렵습니다. 외부 OECD 데이터셋 확장이 필요합니다.', 0.2, []),
    ]
    return buildResponse({
      article: {
        title: '거시경제 10대 지표, 2024 상반기 종합',
        source: 'chosun',
        published_at: '2024-07-10',
        content:
          '인구 구조부터 외국인 관광객까지, 2023~2024 한국 거시경제 10대 지표를 종합 분석한다. 합계출산율 0.72명, 고령인구 비율 17.5%, 1인 가구 34.5%, 청년 실업률 5.9% 등은 통계청 자료와 부합한다. 반면 GDP 성장률 5%, 가계부채 GDP 대비 70%, 외국인 관광객 1억 명 같은 수치는 실제와 큰 차이가 있다. 부동산 가격 폭등론과 환율 안정세 주장은 정성적 평가이며, 청년 자살률 OECD 1위 주장은 KOSIS만으로는 검증이 어렵다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-all-four',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 78,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_111Y002',
        },
        total_latency_ms: 14_600,
      }),
    })
  },
}

/* ── 시나리오 7: 대부분 사실 + 일부 의심 (T 압도) — 8 claims, 75/12.5/12.5 ── */
const scenarioMostlyTrue: MockScenario = {
  key: 'mostly-true',
  matcher: (s) => s.includes('article-7') || s.includes('mostly-true') || s.includes('dominant-true'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      mkClaim('c7-01', '2022년 65세 이상 비율은 17.5%였다.', { subject: '고령인구 비율', claim_value: '17.5', period: '2022', population: '65세 이상' }),
      mkClaim('c7-02', '2022년 1인 가구 비율은 34.5%였다.', { subject: '1인 가구 비율', claim_value: '34.5', period: '2022', population: '전국 가구' }),
      mkClaim('c7-03', '2023년 합계출산율은 0.72명이다.', { subject: '합계출산율', claim_value: '0.72', unit: '명' }),
      mkClaim('c7-04', '2023년 청년 실업률은 5.9%였다.', { subject: '청년 실업률', claim_value: '5.9', population: '15~29세' }),
      mkClaim('c7-05', '2023년 소비자물가 상승률은 3.6%였다.', { subject: '소비자물가 상승률', claim_value: '3.6', compare_period: '2022' }),
      mkClaim('c7-06', '2023년 GDP 성장률은 1.4%였다.', { subject: 'GDP 성장률', claim_value: '1.4' }),
      mkClaim('c7-07', '청년 실업률이 두 자리수를 넘었다.', { subject: '청년 실업률', claim_value: '10+', claim_type: '정성/추상', population: '15~29세' }),
      mkClaim('c7-08', '경제가 호황을 누리고 있다.', { subject: '경제 동향', claim_value: '호황', claim_type: '정성/추상', unit: '' }),
    ]
    const claim_results: ClaimResult[] = [
      // T × 6
      mkResult('c7-01', 'T', '17.5', '17.5', '2022년 65세 이상 비율 17.5% — KOSIS 인구총조사와 일치.', 0.95, [evidenceElderly2022]),
      mkResult('c7-02', 'T', '34.5', '34.5', '2022년 1인 가구 비율 34.5% — 인구총조사 가구 통계와 일치.', 0.93, [evidenceSingleHH2022]),
      mkResult('c7-03', 'T', '0.72', '0.72', '2023년 합계출산율 0.72명 — KOSIS와 일치.', 0.96, [evidenceTFR2023]),
      mkResult('c7-04', 'T', '5.9', '5.9', '2023년 청년 실업률 5.9% — 고용동향과 일치.', 0.94, [evidenceYouthUnemp2023]),
      mkResult('c7-05', 'T', '3.6', '3.6', '2023년 CPI 상승률 3.6% — KOSIS와 일치.', 0.93, [evidenceCPI2023]),
      mkResult('c7-06', 'T', '1.4', '1.4', '2023년 GDP 성장률 1.4% — 국민계정과 일치.', 0.92, [evidenceGDP2023]),
      // F × 1
      mkResult('c7-07', 'F', '10+', '5.9', '"두 자리수"는 10% 이상을 의미하지만 2023년 실제 청년 실업률은 5.9%로 한 자리수 후반입니다.', 0.86, [evidenceYouthUnemp2023]),
      // M × 1
      mkResult('c7-08', 'M', '호황', '1.4', '"호황"은 정성적 평가입니다. 2023년 GDP 성장률 1.4%는 잠재성장률을 하회하는 수치로 일반적으로 "호황"이라 부르지 않습니다.', 0.4, [evidenceGDP2023], 'rhetorical_exaggeration'),
    ]
    return buildResponse({
      article: {
        title: '한국 인구·경제 핵심 지표 8가지 — 통계 확인 결과',
        source: 'chosun',
        published_at: '2024-04-20',
        content:
          '2022년 65세 이상 비율은 17.5%, 1인 가구 비율은 34.5%였다. 2023년 합계출산율은 0.72명, 청년 실업률은 5.9%, 소비자물가 상승률은 3.6%, GDP 성장률은 1.4%였다. 일각에선 청년 실업률이 두 자리수를 넘었다거나 경제가 호황을 누리고 있다는 주장도 나온다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-mostly-true',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 58,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_1B8000F',
        },
        total_latency_ms: 12_400,
      }),
    })
  },
}

/* ── 시나리오 8: 대부분 거짓 + 약간 사실 (F 압도) — 9 claims, 56/22/11/11 ── */
const scenarioMostlyFalse: MockScenario = {
  key: 'mostly-false',
  matcher: (s) => s.includes('article-8') || s.includes('mostly-false') || s.includes('dominant-false'),
  build: (): VerifyResponse => {
    const claims: Claim[] = [
      mkClaim('c8-01', '2023년 합계출산율이 1.2명까지 회복됐다.', { subject: '합계출산율', claim_value: '1.2', unit: '명' }),
      mkClaim('c8-02', '청년 실업률이 15%를 돌파했다.', { subject: '청년 실업률', claim_value: '15', population: '15~29세' }),
      mkClaim('c8-03', '2023년 GDP 성장률은 6%였다.', { subject: 'GDP 성장률', claim_value: '6.0' }),
      mkClaim('c8-04', '가계부채는 GDP의 50%에 불과하다.', { subject: '가계부채 / GDP 비율', claim_value: '50' }),
      mkClaim('c8-05', '2023년 외국인 관광객은 5천만 명을 넘었다.', { subject: '외국인 관광객 수', claim_value: '50000000', unit: '명' }),
      mkClaim('c8-06', '물가가 사상 최악으로 치솟았다.', { subject: '소비자물가 상승률', claim_value: '사상 최악', claim_type: '정성/추상' }),
      mkClaim('c8-07', '실업률이 IMF 시절보다 심각하다.', { subject: '실업률', claim_value: 'IMF보다 심각', claim_type: '비교', unit: '' }),
      mkClaim('c8-08', '청년 우울증 발병률이 50%에 달했다.', { subject: '청년 우울증 발병률', claim_value: '50' }),
      mkClaim('c8-09', '2022년 1인 가구 비율은 34.5%였다.', { subject: '1인 가구 비율', claim_value: '34.5', period: '2022', population: '전국 가구' }),
    ]
    const claim_results: ClaimResult[] = [
      // F × 5
      mkResult('c8-01', 'F', '1.2', '0.72', '2023년 합계출산율은 0.72명이며, "1.2명까지 회복"은 사실과 큰 차이가 있는 거짓 주장입니다.', 0.96, [evidenceTFR2023]),
      mkResult('c8-02', 'F', '15', '5.9', '2023년 청년 실업률은 5.9%이며, 15% 돌파는 약 2.5배 과장된 거짓 수치입니다.', 0.93, [evidenceYouthUnemp2023]),
      mkResult('c8-03', 'F', '6.0', '1.4', '2023년 GDP 성장률은 1.4%로 6%는 약 4배 부풀려진 거짓 수치입니다.', 0.95, [evidenceGDP2023]),
      mkResult('c8-04', 'F', '50', '105.5', '2023년 가계부채/GDP 비율은 약 105.5%로, 50%는 실제의 절반에도 못 미치는 거짓 수치입니다.', 0.92, [evidenceHouseholdDebt2023]),
      mkResult('c8-05', 'F', '50000000', '11030000', '2023년 외국인 관광객은 약 1,103만 명입니다. "5천만 명 돌파"는 약 4.5배 부풀려진 수치입니다.', 0.94, [evidenceTourists2023]),
      // M × 2
      mkResult('c8-06', 'M', '사상 최악', '3.6', '2023년 CPI 상승률은 3.6%로 "사상 최악"이라 부르기엔 과장된 표현입니다. (1980년대 후반 7%대 기록 존재)', 0.55, [evidenceCPI2023], 'rhetorical_exaggeration'),
      mkResult('c8-07', 'M', 'IMF보다 심각', null, '"IMF 시절보다 심각"은 정성적 비교로, 1998년 실업률 약 7%와 2023년 2.7%(연간 평균)를 단순 대조하기 어렵습니다.', 0.42, [], 'rhetorical_misinterpretation'),
      // NEI × 1
      mkResult('c8-08', 'NEI', '50', null, '"청년 우울증 발병률"은 KOSIS 카탈로그에 직접 대응 표가 없습니다. 보건복지부 정신건강 통계 확장이 필요합니다.', 0.15, []),
      // T × 1
      mkResult('c8-09', 'T', '34.5', '34.5', '2022년 1인 가구 비율 34.5% — 정확한 수치입니다.', 0.93, [evidenceSingleHH2022]),
    ]
    return buildResponse({
      article: {
        title: '충격! 한국 경제 9대 지표 — 사실은?',
        source: '미상',
        published_at: '2024-05-08',
        content:
          '2023년 합계출산율이 1.2명까지 회복됐고, 청년 실업률은 15%를 돌파했다. GDP 성장률 6%, 가계부채는 GDP의 50%에 불과하다. 외국인 관광객은 5천만 명을 넘었고, 물가는 사상 최악으로 치솟았다. 실업률은 IMF 시절보다 심각하고 청년 우울증 발병률은 50%에 달한다. 다만 1인 가구 비율 34.5% 통계만큼은 정확하다.',
      },
      claims,
      claim_results,
      diagnostics: buildDiagnostics({
        request_id: 'mock-req-mostly-false',
        pipeline: PIPELINE_DONE,
        retrieval: {
          catalog_filtered: 65,
          embedding_top50: 50,
          rerank_top5: 5,
          rag_top1_table_id: 'DT_1B8000F',
        },
        total_latency_ms: 13_200,
      }),
    })
  },
}

/* ─────────────── Evidence 상수 (중복 제거) ─────────────── */

const evidenceYouthUnemp2023: Evidence = {
  source: 'KOSIS',
  subject: '청년 실업률',
  value: '5.9',
  unit: '%',
  period: '2023',
  population: '15~29세',
  table_name: '고용동향 - 실업률 (연령별)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1DA7001S',
  last_updated: RETRIEVED_AT,
}

const evidenceTFR2023: Evidence = {
  source: 'KOSIS',
  subject: '합계출산율',
  value: '0.72',
  unit: '명',
  period: '2023',
  population: '전국',
  table_name: '출생통계 - 합계출산율',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1B8000F',
  last_updated: RETRIEVED_AT,
}

const evidenceCPI2023: Evidence = {
  source: 'KOSIS',
  subject: '소비자물가지수 상승률',
  value: '3.6',
  unit: '%',
  period: '2023',
  population: '전국',
  table_name: '소비자물가지수 (연간 총지수)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1J20001',
  last_updated: RETRIEVED_AT,
}

const evidenceCPI2024: Evidence = {
  source: 'KOSIS',
  subject: '소비자물가지수 상승률',
  value: '2.3',
  unit: '%',
  period: '2024',
  population: '전국',
  table_name: '소비자물가지수 (연간 총지수)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1J20001',
  last_updated: RETRIEVED_AT,
}

const evidenceElderly2022: Evidence = {
  source: 'KOSIS',
  subject: '고령인구 비율',
  value: '17.5',
  unit: '%',
  period: '2022',
  population: '65세 이상',
  table_name: '인구총조사 - 연령별 인구',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1IN1502',
  last_updated: RETRIEVED_AT,
}

const evidenceSingleHH2022: Evidence = {
  source: 'KOSIS',
  subject: '1인 가구 비율',
  value: '34.5',
  unit: '%',
  period: '2022',
  population: '전국 가구',
  table_name: '인구총조사 - 가구원수별 가구',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1JC1517',
  last_updated: RETRIEVED_AT,
}

const evidenceGDP2023: Evidence = {
  source: 'KOSIS',
  subject: 'GDP 성장률 (실질)',
  value: '1.4',
  unit: '%',
  period: '2023',
  population: '전국',
  table_name: '국민계정 - 경제활동별 GDP (실질)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=301&tblId=DT_111Y002',
  last_updated: RETRIEVED_AT,
}

const evidenceHouseholdDebt2023: Evidence = {
  source: 'KOSIS',
  subject: '가계부채 / GDP 비율',
  value: '105.5',
  unit: '%',
  period: '2023',
  population: '전국',
  table_name: '가계신용 통계 (한국은행 경제통계시스템)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=301&tblId=DT_2KAA901',
  last_updated: RETRIEVED_AT,
}

const evidenceTourists2023: Evidence = {
  source: 'KOSIS',
  subject: '외국인 관광객 입국자 수',
  value: '11030000',
  unit: '명',
  period: '2023',
  population: '전국',
  table_name: '관광객 통계 - 입국자 수 (연간)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=384&tblId=DT_384N_001',
  last_updated: RETRIEVED_AT,
}

const evidenceHousing2023: Evidence = {
  source: 'KOSIS',
  subject: '주택매매가격지수 변동률',
  value: '-3.3',
  unit: '%',
  period: '2023',
  population: '전국',
  table_name: '전국주택가격동향조사 - 매매가격지수',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=408&tblId=DT_408_2006_S00001',
  last_updated: RETRIEVED_AT,
}

const evidenceFX2023: Evidence = {
  source: 'KOSIS',
  subject: '원/달러 환율 (연 평균)',
  value: '1305',
  unit: '원',
  period: '2023',
  population: '전국',
  table_name: '주요 외환 시세 (한국은행)',
  url: 'https://kosis.kr/statHtml/statHtml.do?orgId=301&tblId=DT_731Y005',
  last_updated: RETRIEVED_AT,
}

/* ─────────────── 응답 builder ─────────────── */

interface BuildResponseInput {
  article: VerifyResponse['article']
  claims: Claim[]
  claim_results: ClaimResult[]
  diagnostics?: Diagnostics
}

function buildResponse({
  article,
  claims,
  claim_results,
  diagnostics,
}: BuildResponseInput): VerifyResponse {
  const total = claim_results.length
  const avg =
    total === 0
      ? 0
      : claim_results.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / total
  const overall = deriveOverallVerdict(claim_results) as VerifyResponse['verifications']['summary']['overall_verdict']

  return {
    article,
    claims,
    verifications: {
      summary: {
        total_claims: total,
        overall_verdict: overall,
        average_confidence: Math.round(avg * 1000) / 1000,
        overview_reason: buildOverviewReason(claim_results),
      },
      claim_results,
    },
    diagnostics,
  }
}

/**
 * 기사 전체 총평 문구 생성 (mock 전용).
 * 백엔드 연동 시 이 필드는 서버 생성 값으로 대체됨.
 */
function buildOverviewReason(claim_results: ClaimResult[]): string {
  const total = claim_results.length
  if (total === 0) return '검증할 수 있는 통계 주장을 찾지 못했어요.'

  const c = countByVerdict(claim_results)

  if (c.F > 0 && c.F >= c.T && c.F >= c.M) {
    return '공식 통계와 어긋나는 주장이 많아, 이 기사의 수치는 전반적으로 신중하게 받아들이는 것이 좋아요.'
  }
  if (c.T === total) {
    return '주요 수치가 모두 공식 통계와 일치해, 이 기사는 통계 면에서 신뢰할 만해요.'
  }
  if (c.T > 0 && c.F === 0 && (c.M > 0 || c.NEI > 0)) {
    return '명백히 틀린 수치는 없지만 맥락상 오해를 부를 수 있는 부분이 있어, 일부 표현은 주의해서 읽는 것이 좋아요.'
  }
  if (c.NEI === total) {
    return '대응하는 공식 통계를 찾지 못해, 이 기사의 수치는 사실 여부를 단정하기 어려워요.'
  }
  return '사실인 주장과 사실과 다른 주장이 섞여 있어, 항목별 판정을 함께 확인하는 것이 좋아요.'
}

/* ─────────────── diagnostics builder ─────────────── */

interface BuildDiagInput {
  request_id: string
  pipeline: PipelineStep[]
  retrieval: {
    catalog_filtered: number
    embedding_top50: number
    rerank_top5: number
    rag_top1_table_id: string | null
  }
  total_latency_ms: number
  errors?: Array<{ stage: string; message: string }>
}

function buildDiagnostics({
  request_id,
  pipeline,
  retrieval,
  total_latency_ms,
  errors = [],
}: BuildDiagInput): Diagnostics {
  return {
    request_id,
    pipeline,
    llm_calls: [
      { stage: 'claim_detection', model: 'HCX-DASH-002', input_tokens: 1240, output_tokens: 220, latency_ms: 1850 },
      { stage: 'claim_normalization', model: 'HCX-005', input_tokens: 380, output_tokens: 410, latency_ms: 1340 },
      { stage: 'table_selection', model: 'HCX-005', input_tokens: 980, output_tokens: 120, latency_ms: 2100 },
      { stage: 'explanation', model: 'HCX-007', input_tokens: 720, output_tokens: 280, latency_ms: 1450 },
    ],
    retrieval,
    errors,
    total_latency_ms,
  }
}

/* ─────────────── 시나리오 매칭 + entry ─────────────── */

const SCENARIOS: MockScenario[] = [
  scenarioMixed,
  scenarioAllTrue,
  scenarioAllFalse,
  scenarioMisleading,
  scenarioNEI,
  scenarioAllFour,
  scenarioMostlyTrue,
  scenarioMostlyFalse,
]

function pickScenario(input: string): MockScenario {
  const lower = input.toLowerCase()
  const match = SCENARIOS.find((s) => s.matcher(lower))
  if (match) return match

  // 해시 기반 폴백 (입력 길이가 0일 땐 첫 시나리오)
  if (lower.length === 0) return SCENARIOS[0]
  const hash = [...lower].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return SCENARIOS[hash % SCENARIOS.length]
}

const SHOULD_DELAY = import.meta.env.VITE_MOCK_DELAY !== 'false'

export async function getMockResponse(req: VerifyRequest): Promise<VerifyResponse> {
  if (SHOULD_DELAY) {
    await delay(1_500 + Math.random() * 1_500)
  }
  const scenario = pickScenario(req.content)
  return scenario.build()
}

export const __MOCK_KEYS = SCENARIOS.map((s) => s.key)
