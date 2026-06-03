// 백엔드 API 서버 주소의 단일 소스(single source of truth)
// - VITE_API_BASE_URL='' (빈 값): same-origin → vite.config.ts의 dev 프록시 경유
//   (ngrok 무료 플랜 SSE 경고 우회용. 프록시 대상은 VITE_API_PROXY_TARGET)
// - VITE_API_BASE_URL=http://... : 해당 주소로 직접 연결
// - 미설정(undefined): 로컬 기본값(127.0.0.1)으로 직접 연결
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
