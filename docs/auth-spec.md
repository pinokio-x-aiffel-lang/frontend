# 인증/로그인 정합성 메모 (프론트 ↔ 백엔드)

> 방식 결정: **Bearer 토큰(응답 body + `Authorization` 헤더)**.
> 백엔드 `src/auth` 구현에 프론트를 맞춤. (교차 사이트라 CSRF 부담이 없는 헤더 방식 채택)

---

## 0. 결정 요약

| 항목 | 값 |
|---|---|
| 로그인 방식 | 아이디(`user_id`) + 비밀번호 |
| 토큰 전달 | 응답 body `access_token`(JWT) → 클라이언트 보관 → `Authorization: Bearer` 헤더 |
| 클라이언트 보관 | `localStorage` (`auth-token`) — `src/lib/api/token.ts` |
| 비밀번호 | bcrypt 해싱 (백엔드 `passlib`) ✅ |
| 보호 대상 | `POST /verify`, `GET /auth/me` 는 로그인 필요 |

## 1. 엔드포인트 (구현된 형태)

```
POST /auth/register   { user_id, password, name? } → 201 { access_token, token_type, user }
POST /auth/login      { user_id, password }        → 200 { access_token, token_type, user }
                                                      실패 401 { detail }
GET  /auth/me         (Authorization: Bearer)      → 200 { user_id, name }   / 미인증 401
POST /verify          (Authorization: Bearer)      → { job_id }              / 미인증 401
GET  /verify/stream?job_id=...                     → SSE (인증 불필요)
```

- 로그인 성공 응답 user: `{ id, user_id, name }` (`id`는 `user_id` 문자열과 동일).

## 2. 프론트가 맞춰 둔 동작

- `login()` → 토큰을 `token.ts`에 저장(`src/lib/api/auth.ts`).
- `apiFetch`가 저장된 토큰을 `Authorization: Bearer`로 **자동 부착**(`src/lib/api/client.ts`) → `/auth/me`, `verify.ts` 커버.
- `useVerifySSE`의 `POST /verify`에도 같은 헤더 부착.
- `getCurrentUser()` → `GET /auth/me`로 로그인 상태 확인.
- `logout()` → 클라이언트 토큰만 제거(서버 폐기 엔드포인트 없음).

## 3. 백엔드 보완 권고 (보안/정합성)

우선순위 순:

1. **🔴 JWT 시크릿 교체** — `src/config.py`의 `jwt_secret_key = "change-me-in-production"` 기본값. 운영에서 반드시 env로 강한 값 주입. (안 하면 토큰 위조 가능)
2. **🔴 `/auth/login` rate limit** — 현재 `/verify`에만 `rate_limit`이 걸려 있어 로그인 무차별 대입(brute-force)에 무방비. 로그인에도 적용 권장.
3. **🟡 토큰 수명/폐기** — `jwt_expire_days = 7`로 길고 stateless라 폐기 불가. 만료 단축 + `POST /auth/refresh` + 로그아웃 블랙리스트(또는 짧은 access + refresh) 권장.
4. **🟡 `/auth/me`에 `id` 포함** — 현재 `{ user_id, name }`만 반환. 로그인 응답 user(`{ id, user_id, name }`)와 형태를 통일하면 프론트 처리가 단순해짐. (프론트는 일단 `id` optional로 수용 중)
5. **🟢 로그인 실패 메시지 문구** — `detail="Incorrect email or password"` 인데 아이디 로그인이므로 "Incorrect **user_id** or password" 등으로. (사용자 열거 방지를 위해 아이디/비번 케이스를 구분하지 않는 현재 동작은 ✅ 유지)

## 4. 보안 트레이드오프 (합의된 사항)

Bearer + localStorage 방식은:
- ✅ CSRF 무관 (헤더는 자동 전송되지 않음) — 교차 사이트에 적합
- 🔻 XSS에 토큰 노출 (JS가 읽음) — CSP·`dangerouslySetInnerHTML` 금지 등 XSS 1차 방어가 중요. 토큰 보관을 메모리로 옮기려면 `token.ts`만 수정하면 됨(단 새로고침 시 재로그인/refresh 필요).
