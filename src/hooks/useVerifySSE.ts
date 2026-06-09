import { useState, useRef } from 'react'
import type { PipelineStep, VerifyRequest, VerifyResponse } from '@/lib/api/schema'
import { BASE_URL } from '@/lib/api/config'
import { getMockResponse } from '@/lib/api/mock'
import { authHeader } from '@/lib/api/token'

type Status = 'idle' | 'loading' | 'done' | 'error'

/** 디버그 패널이 시간순으로 그대로 보여주는 append-only 로그 한 줄(step 이벤트 1건) */
export interface VerifyLog {
  seq: number
  step: number
  name: string
  status: PipelineStep['status']
  duration_ms: number | null
  error: string | null
  t: number // 수신 시각(Date.now) — 패널에서 첫 줄 대비 경과시간 계산용
}

// VITE_USE_MOCK=true 이면 서버(SSE) 대신 mock.ts의 파이프라인을 한 step씩
// 흘려보내 SSE를 흉내낸다. (백엔드/ngrok 없이도 Tip·제출 데모가 동작)
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const MOCK_DELAY = import.meta.env.VITE_MOCK_DELAY !== 'false'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// 'step' 이벤트 핸들러와 동일하게 step 번호 위치에 갱신한다.
function putStep(prev: PipelineStep[], step: PipelineStep): PipelineStep[] {
  const next = [...prev]
  next[step.step - 1] = step
  return next
}

export function useVerifySSE() {
  const [status, setStatus] = useState<Status>('idle')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [logs, setLogs] = useState<VerifyLog[]>([])
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  // step 이벤트가 올 때마다 로그를 append (running→done 전이를 모두 보존한다)
  const pushLog = (s: PipelineStep) =>
    setLogs((prev) => [
      ...prev,
      {
        seq: prev.length,
        step: s.step,
        name: s.name,
        status: s.status,
        duration_ms: s.duration_ms,
        error: s.error ?? null,
        t: Date.now(),
      },
    ])
  const pushErrorLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      { seq: prev.length, step: 0, name: '오류', status: 'error', duration_ms: null, error: message, t: Date.now() },
    ])
  // 진행 중인 실행을 식별하는 토큰. reset()이나 새 verify() 호출 시 증가시켜
  // 이전 mock 실행이 뒤늦게 상태를 덮어쓰는 것을 막는다(mock엔 ES.close가 없음).
  const runIdRef = useRef(0)

  async function verify(req: VerifyRequest, opts?: { demo?: boolean }) {
    esRef.current?.close()
    const myRun = ++runIdRef.current

    setStatus('loading')
    setSteps([])
    setLogs([])
    setResult(null)
    setErrorMsg(null)

    // demo(Tip)는 백엔드에 대응 라우트가 없으므로 VITE_USE_MOCK 여부와 무관하게
    // 항상 클라이언트 mock으로 응답한다. 정상 submit만 실서버(/verify)를 탄다.
    if (USE_MOCK || opts?.demo) {
      await runMock(req, myRun)
      return
    }

    let job_id: string
    try {
      const res = await fetch(`${BASE_URL}/verify`, {
        method: 'POST',
        // /verify는 로그인 필요(Bearer) — 저장된 토큰을 Authorization 헤더로 부착
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', ...authHeader() },
        body: JSON.stringify({ content: req.content }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const b = body as { message?: string; detail?: string }
        const msg = res.status === 401 ? '로그인이 필요해요.' : b.message ?? b.detail ?? `서버 오류 (${res.status})`
        throw new Error(msg)
      }
      ;({ job_id } = await res.json())
    } catch (err) {
      if (runIdRef.current !== myRun) return
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했어요'
      setErrorMsg(msg)
      pushErrorLog(msg)
      setStatus('error')
      return
    }
    if (runIdRef.current !== myRun) return

    const es = new EventSource(`${BASE_URL}/verify/stream?job_id=${job_id}`)
    esRef.current = es

    es.addEventListener('step', (e) => {
      const data = JSON.parse(e.data) as PipelineStep
      setSteps((prev) => putStep(prev, data))
      pushLog(data)
    })

    es.addEventListener('result', (e) => {
      const data = JSON.parse(e.data) as VerifyResponse
      setResult(data)
      setStatus('done')
      es.close()
    })

    es.addEventListener('error', (e) => {
      const msg = (e as MessageEvent).data
        ? (JSON.parse((e as MessageEvent).data) as { message: string }).message
        : '알 수 없는 오류가 발생했어요'
      setErrorMsg(msg)
      pushErrorLog(msg)
      setStatus('error')
      es.close()
    })
  }

  // VITE_USE_MOCK 모드: mock 응답의 pipeline을 running→최종상태로 한 step씩 노출해
  // 실시간 SSE처럼 보이게 한다. runId가 바뀌면(reset/재실행) 즉시 중단한다.
  async function runMock(req: VerifyRequest, myRun: number) {
    const active = () => runIdRef.current === myRun

    let mock: VerifyResponse
    try {
      mock = await getMockResponse(req)
    } catch (err) {
      if (!active()) return
      setErrorMsg(err instanceof Error ? err.message : '알 수 없는 오류가 발생했어요')
      setStatus('error')
      return
    }
    if (!active()) return

    const pipeline = mock.diagnostics?.pipeline ?? []
    for (const step of pipeline) {
      if (!active()) return
      // 실제로 수행된 step만 'running'을 먼저 보여준다(skipped/pending은 그대로).
      if (step.status === 'done' || step.status === 'error') {
        const running = { ...step, status: 'running' as const, duration_ms: null }
        setSteps((prev) => putStep(prev, running))
        pushLog(running)
        if (MOCK_DELAY) await sleep(350 + Math.random() * 300)
        if (!active()) return
      }
      setSteps((prev) => putStep(prev, step))
      pushLog(step)
      if (MOCK_DELAY) await sleep(120)
    }

    if (!active()) return
    setResult(mock)
    setStatus('done')
  }

  function reset() {
    esRef.current?.close()
    runIdRef.current++ // 진행 중인 mock 루프 무효화
    setStatus('idle')
    setSteps([])
    setLogs([])
    setResult(null)
    setErrorMsg(null)
  }

  return { verify, reset, status, steps, logs, result, errorMsg }
}
