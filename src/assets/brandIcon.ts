const BRAND_ICON_SVG = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
  <rect x="10" y="10" width="76" height="76" rx="26" fill="#DFE7FD"/>
  <rect x="20" y="20" width="56" height="56" rx="18" fill="#FBFDFF" stroke="#8EA4EA" stroke-width="4"/>
  <path d="M40 34 28 48l12 14" stroke="#49566E" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m56 34 12 14-12 14" stroke="#49566E" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="45" y="30" width="6" height="36" rx="3" fill="#6C82CB"/>
  <rect x="27" y="69" width="42" height="4" rx="2" fill="#BEE1E6"/>
</svg>`;

export const INLINE_BRAND_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(BRAND_ICON_SVG)}`;
export const BRAND_ICON_MIME_TYPE = 'image/svg+xml';
