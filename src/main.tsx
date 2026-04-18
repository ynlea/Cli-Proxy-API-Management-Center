import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/chartRegistry';
import '@/styles/global.scss';
import { BRAND_ICON_MIME_TYPE, INLINE_BRAND_ICON } from '@/assets/brandIcon';
import { prewarmAuthStageMedia } from '@/constants/media';
import App from './App.tsx';

document.title = 'CPA Console';
document.documentElement.setAttribute('translate', 'no');
document.documentElement.classList.add('notranslate');
prewarmAuthStageMedia();

const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (faviconEl) {
  faviconEl.href = INLINE_BRAND_ICON;
  faviconEl.type = BRAND_ICON_MIME_TYPE;
} else {
  const newFavicon = document.createElement('link');
  newFavicon.rel = 'icon';
  newFavicon.type = BRAND_ICON_MIME_TYPE;
  newFavicon.href = INLINE_BRAND_ICON;
  document.head.appendChild(newFavicon);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
