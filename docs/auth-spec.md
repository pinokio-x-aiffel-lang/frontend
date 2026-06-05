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

---

## 5. 로그아웃 처리 스펙 (백엔드 요청)

### 5-0. 현재 상태 / 문제

- 프론트 `logout()`은 **클라이언트의 토큰만 제거**(`localStorage`)한다.
- 백엔드엔 로그아웃 엔드포인트가 없고, JWT가 **stateless + 만료 7일**이라 → 발급된 토큰은 **만료까지 서버에서 계속 유효**하다. (유출 시 7일간 악용 가능, "서버 측 로그아웃"이 불가)

### 5-1. 권장안 A — 짧은 access + refresh + 로그아웃 시 refresh 폐기  ⭐

가장 표준적이고 보안/UX 균형이 좋다.

- **로그인(`POST /auth/login`)**: access token(짧게, 예: 15~30분) + refresh token(길게, 예: 7~14일) 발급.
  - refresh token은 서버 저장(DB/Redis)하고, 가능하면 httpOnly 쿠키로 내려 XSS 노출을 줄임.
- **갱신(`POST /auth/refresh`)**: 유효한 refresh로 새 access 발급. (refresh 회전(rotation) 권장 — 쓸 때마다 교체)
- **로그아웃(`POST /auth/logout`)**: 해당 **refresh token을 서버에서 폐기(삭제/revoked 처리)**.
  - → 이후 갱신 불가 → access는 짧은 잔여시간 뒤 자연 만료 = 사실상 로그아웃.
  - 즉시 무효화가 필요하면 5-2의 denylist를 access에도 병행.

### 5-2. 권장안 B — denylist (현재 단일 토큰 구조 유지 시 최소 변경)

refresh 도입이 부담이면, 단일 access 토큰 + 블랙리스트로 즉시 무효화만 추가.

- JWT에 **`jti`(고유 ID) claim 추가** 필요. (현재 payload: `sub`, `name`, `exp` → `jti` 추가)
- **로그아웃(`POST /auth/logout`)**: 현재 토큰의 `jti`를 **Redis denylist에 저장(TTL = 토큰 잔여 만료시간)**.
- **인증 의존성(`get_current_user`)**: 토큰 검증 후 `jti`가 denylist에 있으면 거부(401).
- TTL로 만료된 항목은 자동 정리됨.

### 5-3. 엔드포인트 계약 — `POST /auth/logout`

```http
POST /auth/logout
Authorization: Bearer <access_token>      # 있으면 검증, 없어도 best-effort 처리
```

응답:
```http
200 OK
Content-Type: application/json
{ "ok": true }
```
+ (refresh를 쿠키로 줬다면) refresh 쿠키 만료: `Set-Cookie: refresh_token=; Max-Age=0; Path=/auth; HttpOnly; Secure; SameSite=None`

요구사항:
- ⚠️ **204(No Content) 말고 JSON body**(`{ "ok": true }`)로 응답. 프론트 공통 `apiFetch`가 `res.json()`을 호출하므로 빈 본문이면 에러.
- **멱등(idempotent)**: 토큰이 이미 만료/무효/없어도 **200으로 성공 처리**(로그아웃은 막지 말 것). 즉 이 엔드포인트는 인증 실패를 401로 튕기기보다 best-effort로 폐기하고 200을 권장.
- CORS: 기존 설정에 `POST /auth/logout` 포함되도록(현재 `allow_methods=["*"]`라 OK), 쿠키 쓰면 `credentials` 동일 적용.

### 5-4. (선택) 모든 기기에서 로그아웃 / 비번 변경 시

- 유저 레코드에 `token_version`(정수) 보관, JWT에 포함.
- 로그아웃-올 / 비번 변경 시 `token_version`을 +1 → 이전 버전 토큰 전부 무효.

### 5-5. 프론트 연동 (확정되면 반영 예정)

- `auth.ts`의 `logout()`을 **`POST /auth/logout` 호출 후 클라 토큰 제거**로 변경.
- 권장안 A 채택 시: `apiFetch` 401 응답에서 자동 `/auth/refresh` 시도하는 인터셉터 추가 가능.

### 5-6. 합의 필요 항목

- [ ] 권장안 A(refresh) vs B(denylist) 중 선택
- [ ] access token 만료시간 (예: 15~30분), refresh 만료시간 (예: 7~14일)
- [ ] refresh 토큰 전달: 응답 body vs httpOnly 쿠키
- [ ] JWT에 `jti` / `token_version` claim 추가 여부
- [ ] `/auth/logout` 멱등·응답 형태(`{ "ok": true }`) 확정
