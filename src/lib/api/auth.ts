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
 * 로그아웃 — 백엔드에 토큰 폐기(revoke) 엔드포인트가 없고 stateless JWT이므로
 * 클라이언트 토큰만 제거한다. (서버 토큰은 만료까지 유효 — 보안 메모: 만료 단축/
 * refresh·블랙리스트 도입 시 서버 폐기로 강화 권장)
 */
export function logout(): void {
  clearToken()
}
