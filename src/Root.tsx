import { useSyncExternalStore } from 'react'
import AuroraApp from '@/themes/aurora/App'
import Login from '@/themes/aurora/Login'

/* 라우터가 없으므로 해시 기반 경량 분기: '#login' → 로그인, 그 외 → 기존 앱 */
function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export default function Root() {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => '',
  )
  return hash.startsWith('#login') ? <Login /> : <AuroraApp />
}
