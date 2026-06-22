import { z } from 'zod'

/* ════════════════════════════════════════════════════════════════════════
 *  Verdict codes
 * ════════════════════════════════════════════════════════════════════════
 *  claim-level    : T / F / M / NEI
 *  article-level  : 위 4개의 조합 (한 기사가 여러 claim을 포함할 때 모든
 *                   판정 종류의 집합으로 표시)
 *    T          → 모든 claim이 사실
 *    T+F        → 사실과 거짓이 혼재
 *    T+F+M+NEI  → 네 가지 판정이 모두 등장
 *    ...
 *  → 사용자 UI에서는 분포 막대로 시각화하고, 코드 자체는 분석/로깅용으로만 사용
 * ════════════════════════════════════════════════════════════════════════*/

export const verdictCodeSchema = z.enum(['T', 'F', 'M', 'NEI'])
export type VerdictCode = z.infer<typeof verdictCodeSchema>

export const overallVerdictSchema = z.enum([
  'T',
  'F',
  'M',
  'NEI',
  'T+F',
  'T+M',
  'T+NEI',
  'F+M',
  'F+NEI',
  'M+NEI',
  'T+F+M',
  'T+F+NEI',
  'T+M+NEI',
  'F+M+NEI',
  'T+F+M+NEI',
])
export type OverallVerdict = z.infer<typeof overallVerdictSchema>

/* ──────────────────────────  Article (메타데이터)  ────────────────────── */
export const articleSchema = z.object({
  title: z.string().nullable(),
  source: z.string().nullable(),
  published_at: z.string().nullable(),
  content: z.string(),
})
export type Article = z.infer<typeof articleSchema>

/* ──────────────────────────  Claim (주장 정보)  ───────────────────────── */
export const claimInfoSchema = z.object({
  subject: z.string(),
  claim_type: z.string(),
  claim_value: z.string(),
  normalized_value: z.string().nullable(),
  unit: z.string(),
  period: z.string(),
  compare_period: z.string().nullable(),
  population: z.string(),
  cited_source: z.string().nullable(),
})
export type ClaimInfo = z.infer<typeof claimInfoSchema>

export const claimSchema = z.object({
  claim_id: z.string(),
  sentence: z.string(),
  claim_info: claimInfoSchema,
})
export type Claim = z.infer<typeof claimSchema>

/* ──────────────────────────  Evidence  ────────────────────────────────── */
export const evidenceSchema = z.object({
  source: z.literal('KOSIS'),
  subject: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string(),
  period: z.string(),
  population: z.string(),
  table_name: z.string(),
  url: z.string().nullable(),
  last_updated: z.string(),
  // 백엔드 추가(증감 비교근거·매칭 품질) — 없을 수 있음
  compare_value: z.string().nullable().optional(),
  compare_period: z.string().nullable().optional(),
  population_fallback: z.boolean().optional(),
})
export type Evidence = z.infer<typeof evidenceSchema>

/* ──────────────────────────  Verifications  ───────────────────────────── */
export const claimResultSchema = z.object({
  claim_id: z.string(),
  verdict: verdictCodeSchema,
  mismatch_type: z.string().nullable(),
  claim_value: z.string(),
  kosis_value: z.string().nullable(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  evidence: z.array(evidenceSchema),
  // 백엔드 추가 — 증감(change_rate) claim의 비교가능 산출값. 없을 수 있음.
  computed_value: z.string().nullable().optional(),
  within_tolerance: z.boolean().nullable().optional(),
})
export type ClaimResult = z.infer<typeof claimResultSchema>

export const verificationSummarySchema = z.object({
  total_claims: z.number().int().nonnegative(),
  overall_verdict: overallVerdictSchema,
  average_confidence: z.number().min(0).max(1),
  // 기사 전체에 대한 총평/해석 한 문단 (백엔드 생성, 없을 수도 있음)
  overview_reason: z.string().optional(),
})
export type VerificationSummary = z.infer<typeof verificationSummarySchema>

export const verificationsSchema = z.object({
  summary: verificationSummarySchema,
  claim_results: z.array(claimResultSchema),
})
export type Verifications = z.infer<typeof verificationsSchema>

/* ──────────────────────────  Diagnostics (optional)  ──────────────────── *
 *  백엔드에 디버그/내부 진단 정보를 별도 필드로 받기로 합의 → 응답에 없어도 OK
 *  (현재 mock에서는 계속 생성, 백엔드 추가 전까지 ?debug=1 모드에서만 사용)
 * ──────────────────────────────────────────────────────────────────────── */
export const pipelineStepSchema = z.object({
  step: z.number().int(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'done', 'skipped', 'error']),
  duration_ms: z.number().int().nullable(),
  // 백엔드 StepEvent는 'error' 상태일 때 메시지를 함께 보낸다(디버그 로그용, 선택)
  error: z.string().nullish(),
})
export type PipelineStep = z.infer<typeof pipelineStepSchema>

export const diagnosticsSchema = z.object({
  request_id: z.string(),
  pipeline: z.array(pipelineStepSchema),
  llm_calls: z.array(
    z.object({
      stage: z.string(),
      model: z.string(),
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      latency_ms: z.number().int().nonnegative(),
    }),
  ),
  retrieval: z.object({
    catalog_filtered: z.number().int().nonnegative(),
    embedding_top50: z.number().int().nonnegative(),
    rerank_top5: z.number().int().nonnegative(),
    rag_top1_table_id: z.string().nullable(),
  }),
  errors: z.array(
    z.object({
      stage: z.string(),
      message: z.string(),
    }),
  ),
  total_latency_ms: z.number().int().nonnegative(),
})
export type Diagnostics = z.infer<typeof diagnosticsSchema>

/* ──────────────────────────  최상위 응답  ──────────────────────────────── */
export const verifyResponseSchema = z.object({
  article: articleSchema,
  claims: z.array(claimSchema),
  verifications: verificationsSchema,
  diagnostics: diagnosticsSchema.optional(),
})
export type VerifyResponse = z.infer<typeof verifyResponseSchema>

/* ──────────────────────────  요청 (content 단일 필드)  ──────────────────
 *  사용자가 입력하는 값은 기사 URL일 수도 있고 본문 일부일 수도 있다.
 *  분기 처리는 백엔드 책임 — 프론트는 단순 string 전달.
 * ──────────────────────────────────────────────────────────────────────── */
export const verifyRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, '기사 URL 또는 본문을 입력해주세요'),
})
export type VerifyRequest = z.infer<typeof verifyRequestSchema>
