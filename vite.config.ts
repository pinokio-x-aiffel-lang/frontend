import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // .env(.local)에서 프록시 대상(백엔드/ngrok) 주소를 읽는다.
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET

  // ngrok 무료 플랜 경고 페이지(ERR_NGROK_6024)를 우회하기 위해
  // 서버측(프록시)에서 skip 헤더를 주입한다. EventSource는 헤더를 못 보내므로
  // 브라우저는 same-origin(localhost)으로만 통신하고 Vite가 ngrok으로 전달한다.
  const proxyOptions = proxyTarget
    ? {
        target: proxyTarget,
        changeOrigin: true,
        headers: { 'ngrok-skip-browser-warning': 'true' },
      }
    : undefined

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: proxyOptions
        ? {
            // 프리픽스 매칭 → /verify, /verify/stream 모두 포함
            '/verify': proxyOptions,
            '/dummy': proxyOptions,
            '/health': proxyOptions,
          }
        : undefined,
    },
  }
})
