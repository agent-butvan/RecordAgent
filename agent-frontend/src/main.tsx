import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initApiBaseUrl } from './services/api'

// 桌面端先等待后端 sidecar 就绪，再渲染应用；浏览器开发环境立即返回
initApiBaseUrl().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
