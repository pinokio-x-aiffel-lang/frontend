/* ════════════════════════════════════════════════════════════════════════
 *  액세스 토큰 보관소 (Bearer 방식)
 *  ─ 백엔드가 응답 body로 JWT(access_token)를 주고, 인증이 필요한 요청에는
 *    Authorization: Bearer <token> 헤더로 실어 보낸다.
 *  ─ ⚠️ localStorage는 JS로 읽혀 XSS에 토큰이 노출된다(트레이드오프). refresh
 *    토큰/짧은 만료가 도입되면 메모리 보관으로 옮기는 것을 권장. 보관 위치를
 *    바꾸려면 이 파일만 수정하면 된다.
 * ════════════════════════════════════════════════════════════════════════*/
const TOKEN_KEY = 'auth-token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TOKEN_KEY)
}

/** 인증 요청에 붙일 Authorization 헤더. 토큰이 없으면 빈 객체(헤더 미부착). */
export function authHeader(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
