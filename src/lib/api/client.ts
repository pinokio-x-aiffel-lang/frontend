import { BASE_URL } from './config'
import { authHeader } from './token'

const TIMEOUT_MS = 90_000

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(), // 로그인 상태면 Authorization: Bearer <token> 자동 부착
        ...options.headers,
      },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new ApiError(res.status, text)
    }

    return (await res.json()) as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        408,
        '검증 시간이 초과되었습니다 (90초). 잠시 후 다시 시도하세요.',
      )
    }
    // fetch 자체가 throw → 응답을 못 받은 네트워크 단계 실패(TypeError: Failed to fetch).
    // 원인: 잘못된 API 주소 / CORS 차단 / 서버 다운 / HTTPS 혼합콘텐츠 등.
    // 어떤 주소로 호출하다 실패했는지 함께 노출해 진단을 돕는다.
    if (err instanceof TypeError) {
      throw new ApiError(
        0,
        `서버 연결 실패 (${err.message}) → 호출 주소: ${BASE_URL}${path} ` +
          `· 원인 후보: 잘못된 API 주소(VITE_API_BASE_URL 미설정 시 ${BASE_URL}) / CORS 차단 / 서버 다운 / HTTPS 혼합콘텐츠`,
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
