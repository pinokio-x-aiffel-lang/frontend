import { useState, useRef } from 'react'
import type { PipelineStep, VerifyRequest, VerifyResponse } from '@/lib/api/schema'

type Status = 'idle' | 'loading' | 'done' | 'error'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function useVerifySSE() {
  const [status, setStatus] = useState<Status>('idle')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  async function verify(req: VerifyRequest, opts?: { path?: string }) {
    const path = opts?.path ?? 'verify'
    esRef.current?.close()

    setStatus('loading')
    setSteps([])
    setResult(null)
    setErrorMsg(null)

    let job_id: string
    try {
      const res = await fetch(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ content: req.content }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { message?: string }).message ?? `서버 오류 (${res.status})`)
      }
      ;({ job_id } = await res.json())
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '알 수 없는 오류가 발생했어요')
      setStatus('error')
      return
    }

    const es = new EventSource(`${BASE_URL}/${path}/stream?job_id=${job_id}`)
    esRef.current = es

    es.addEventListener('step', (e) => {
      const data = JSON.parse(e.data) as PipelineStep
      setSteps((prev) => {
        const next = [...prev]
        next[data.step - 1] = data
        return next
      })
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
      setStatus('error')
      es.close()
    })
  }

  function reset() {
    esRef.current?.close()
    setStatus('idle')
    setSteps([])
    setResult(null)
    setErrorMsg(null)
  }

  return { verify, reset, status, steps, result, errorMsg }
}
