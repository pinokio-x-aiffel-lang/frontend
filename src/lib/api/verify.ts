import { apiFetch } from './client'
import { verifyResponseSchema } from './schema'
import type { VerifyRequest, VerifyResponse } from './schema'
import { getMockResponse } from './mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export async function verifyArticle(req: VerifyRequest): Promise<VerifyResponse> {
  if (USE_MOCK) {
    return getMockResponse(req)
  }

  // 백엔드는 content 한 필드만 받음 (URL인지 본문인지 백엔드가 판별)
  const raw = await apiFetch<unknown>('/verify', {
    method: 'POST',
    body: JSON.stringify({ content: req.content }),
  })

  const parsed = verifyResponseSchema.safeParse(raw)
  if (!parsed.success) {
    if (import.meta.env.DEV) {
      console.error('[schema mismatch]', parsed.error.format())
    }
    throw new Error('응답 형식이 예상과 다릅니다. (백엔드 스키마 확인 필요)')
  }

  return parsed.data
}
