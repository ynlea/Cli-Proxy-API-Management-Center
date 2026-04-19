import authStageMediaUrl from '@/assets/login-loop.mp4';

export const AUTH_STAGE_MEDIA_URL = authStageMediaUrl;

export const AUTH_STAGE_MEDIA_MIME_TYPE = 'video/mp4';

const AUTH_STAGE_LINK_MARKER = 'data-auth-stage-media';

let authStageMediaWarmed = false;

function ensureHeadLink({
  href,
  rel,
  as,
  crossOrigin,
  type,
}: {
  href: string;
  rel: string;
  as?: string;
  crossOrigin?: string;
  type?: string;
}) {
  if (typeof document === 'undefined') return;

  const selector = `link[rel="${rel}"][href="${href}"][${AUTH_STAGE_LINK_MARKER}="true"]`;
  const existingLink = document.head.querySelector<HTMLLinkElement>(selector);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  link.setAttribute(AUTH_STAGE_LINK_MARKER, 'true');

  if (as) link.as = as;
  if (crossOrigin) link.crossOrigin = crossOrigin;
  if (type) link.type = type;

  document.head.appendChild(link);
}

export function prewarmAuthStageMedia() {
  if (typeof document === 'undefined' || authStageMediaWarmed) return;

  const authStageBaseUrl = new URL(window.location.href);
  const authStageMediaUrl = new URL(AUTH_STAGE_MEDIA_URL, authStageBaseUrl);
  if (authStageMediaUrl.protocol === 'data:') {
    authStageMediaWarmed = true;
    return;
  }

  const isCrossOriginMedia = authStageMediaUrl.origin !== authStageBaseUrl.origin;

  if (isCrossOriginMedia) {
    ensureHeadLink({
      rel: 'dns-prefetch',
      href: `//${authStageMediaUrl.host}`,
    });
    ensureHeadLink({
      rel: 'preconnect',
      href: authStageMediaUrl.origin,
      crossOrigin: 'anonymous',
    });
  }

  ensureHeadLink({
    rel: 'preload',
    href: AUTH_STAGE_MEDIA_URL,
    as: 'video',
    crossOrigin: isCrossOriginMedia ? 'anonymous' : undefined,
    type: AUTH_STAGE_MEDIA_MIME_TYPE,
  });

  authStageMediaWarmed = true;
}
