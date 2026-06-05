import { z } from 'zod'
import { apiFetch, ApiError } from './client'
import { clearToken, getToken, setToken } from './token'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/* ════════════════════════════════════════════════════════════════════════
 *  로그인 (Bearer 토큰 방식 — 백엔드 src/auth 구현에 맞춤)
 *  ─ 아이디(user_id) + 비밀번호로 POST /auth/login
 *  ─ 성공 시 백엔드가 응답 body로 access_token(JWT)을 준다 → token.ts에 저장
 *  ─ 이후 인증 요청에는 apiFetch가 Authorization: Bearer 헤더를 자동 부착
 * ════════════════════════════════════════════════════════════════════════*/
export const loginRequestSchema = z.object({
  user_id: z
    .string()
    .trim()
    .min(1, '아이디를 입력해주세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 해요'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/* 사용자 정보.
 *  - /auth/login 응답의 user: { id, user_id, name }
 *  - /auth/me 응답:            { user_id, name }   ← id 없음
 *  → 둘 다 수용하도록 id는 optional, name은 nullable.
 */
export const userSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  user_id: z.string(),
  name: z.string().nullable().optional(),
})
export type User = z.infer<typeof userSchema>

/* 로그인 응답: 백엔드 LoginResponse = { access_token, token_type, user? } */
const loginResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  user: userSchema.nullable().optional(),
})

/** 로그인 — 성공 시 토큰을 저장하고 user를 반환한다. */
export async function login(req: LoginRequest): Promise<User | null> {
  if (USE_MOCK) {
    setToken('mock.jwt.token')
    return { id: '1', user_id: req.user_id }
  }

  const raw = await apiFetch<unknown>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ user_id: req.user_id, password: req.password }),
  })

  const parsed = loginResponseSchema.safeParse(raw)
  if (!parsed.success) {
    if (import.meta.env.DEV) {
      console.error('[schema mismatch]', parsed.error.format())
    }
    throw new Error('응답 형식이 예상과 다릅니다. (백엔드 스키마 확인 필요)')
  }

  setToken(parsed.data.access_token)
  return parsed.data.user ?? null
}

/**
 * 현재 로그인 사용자 조회 (GET /auth/me).
 * apiFetch가 저장된 토큰을 Authorization 헤더로 자동 부착한다.
 * 토큰이 없거나 만료(401)면 null을 반환한다.
 */
export async function getCurrentUser(): Promise<User | null> {
  // mock 모드엔 /auth/me가 없으므로 저장된 토큰 유무로 로그인 상태를 흉내낸다.
  if (USE_MOCK) return getToken() ? { user_id: 'mock-user' } : null
  try {
    const raw = await apiFetch<unknown>('/auth/me')
    const parsed = userSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null
    throw err
  }
}

/**
 * 로그아웃 — 백엔드 `POST /auth/logout` 을 best-effort(멱등, 실패 무시)로 호출한 뒤
 * 클라이언트 토큰을 제거한다. (stateless JWT 라 서버 측 즉시 폐기는 없음 — 토큰은
 * 만료까지 유효. denylist 도입 시 강화 가능, auth-spec.md §5-2)
 */
export function logout(): void {
  // 서버 로그아웃은 실패해도 무시하고 클라 토큰 제거가 핵심. Authorization 헤더는
  // apiFetch 안에서 clearToken 전에 동기적으로 읽혀 현재 토큰이 실린다.
  if (!USE_MOCK) void apiFetch('/auth/logout', { method: 'POST' }).catch(() => {})
  clearToken()
}
