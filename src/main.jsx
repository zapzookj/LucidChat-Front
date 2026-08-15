import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// [로컬 에셋 폴백] dev 전용 — CDN 실패 이미지를 로컬 미러/플레이스홀더로 (프로드 no-op)
import { installLocalAssetFallback } from './utils/localAssetFallback'

installLocalAssetFallback()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
