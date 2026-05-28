import { useEffect, useState } from 'react'

/**
 * 디버그 패널 표시 여부.
 *   1) ?debug=1 URL 쿼리 (개발 시 즉석 토글)
 *   2) VITE_SHOW_DEBUG=true 환경변수 (배포 빌드에서 켜둘 때)
 */
export function useDebugMode(): boolean {
  const [debug, setDebug] = useState(() => readDebug())

  useEffect(() => {
    const onPop = () => setDebug(readDebug())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return debug
}

function readDebug(): boolean {
  if (typeof window === 'undefined') return false
  const fromEnv = import.meta.env.VITE_SHOW_DEBUG === 'true'
  const fromQuery = new URLSearchParams(window.location.search).get('debug')
  if (fromQuery === '1' || fromQuery === 'true') return true
  if (fromQuery === '0' || fromQuery === 'false') return false
  return fromEnv
}
