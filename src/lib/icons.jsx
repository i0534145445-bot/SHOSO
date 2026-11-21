import React from 'react';

const Svg = ({ children, size = 20, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconMenu = (p) => (
  <Svg {...p}><path d="M3 12h18M3 6h18M3 18h18" /></Svg>
);
export const IconHome = (p) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6.5h5V21" /></Svg>
);
export const IconBook = (p) => (
  <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 18.5V5.5" /><path d="M8 7h8" /></Svg>
);
export const IconLibrary = (p) => (
  <Svg {...p}><path d="M5 4v16" /><path d="M9.5 4v16" /><path d="M14 4.5 18 19" /><path d="M17.5 4.5 21 19" /></Svg>
);
export const IconAuthor = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5c1.3-4 4-6 7.5-6s6.2 2 7.5 6" /></Svg>
);
export const IconCollection = (p) => (
  <Svg {...p}><path d="M4 7h11" /><path d="M4 12h11" /><path d="M4 17h7" /><circle cx="18" cy="16" r="2.4" /><path d="M20.4 16V8.5l1.6-.5" /></Svg>
);
export const IconHeart = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 3.1C19.5 15.4 12 20 12 20Z" />
  </Svg>
);
export const IconFolder = (p) => (
  <Svg {...p}><path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Svg>
);
export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const IconHistory = (p) => (
  <Svg {...p}><path d="M4 12a8 8 0 1 1 2.3 5.6" /><path d="M4 12H2.5M4 12l-1.5-2M12 8v4l3 2" /></Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></Svg>
);
export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconFormat = (p) => (
  <Svg {...p}><path d="M6 3h9l4 4v14H6Z" /><path d="M15 3v4h4" /><path d="M9 12h6M9 16h6" /></Svg>
);
export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>
);
export const IconClose = (p) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const IconChevron = (p) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
);
export const IconChevronLeft = (p) => (
  <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
);
export const IconSort = (p) => (
  <Svg {...p}><path d="M7 4v16" /><path d="m3.5 16.5 3.5 3.5 3.5-3.5" /><path d="M13 7h7" /><path d="M13 12h5" /><path d="M13 17h3" /></Svg>
);
export const IconFullscreen = (p) => (
  <Svg {...p}><path d="M4 9V4h5" /><path d="M20 15v5h-5" /><path d="M15 4h5v5" /><path d="M9 20H4v-5" /></Svg>
);
export const IconBookmark = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M7 4h10v16l-5-3.5L7 20Z" />
  </Svg>
);
export const IconToc = (p) => (
  <Svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></Svg>
);
export const IconFont = (p) => (
  <Svg {...p}><path d="M5 19 12 5l7 14" /><path d="M8 14h8" /></Svg>
);
export const IconTts = (p) => (
  <Svg {...p}><path d="M4 10v4h3l4 3.5v-11L7 10Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /><path d="M17.5 7a7.5 7.5 0 0 1 0 10" /></Svg>
);
export const IconGrid = (p) => (
  <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>
);
export const IconList = (p) => (
  <Svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></Svg>
);
export const IconTrash = (p) => (
  <Svg {...p}><path d="M4.5 7h15" /><path d="M9.5 7V4.8h5V7" /><path d="M6.5 7l1 12.2h9l1-12.2" /><path d="M10.5 10.5v6M13.5 10.5v6" /></Svg>
);
export const IconRefresh = (p) => (
  <Svg {...p}><path d="M20 11a8 8 0 1 0-2.5 6" /><path d="M20 5v6h-6" /></Svg>
);
export const IconMore = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><circle cx="12" cy="5.5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="18.5" r="1.7" /></Svg>
);
export const IconKeyboard = (p) => (
  <Svg {...p}><rect x="3" y="6.5" width="18" height="11" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></Svg>
);
export const IconBack = (p) => (
  <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
);
export const IconForward = (p) => (
  <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>
);
export const IconZoomIn = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /><path d="M11 8.5v5M8.5 11h5" /></Svg>
);
export const IconZoomOut = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /><path d="M8.5 11h5" /></Svg>
);
export const IconPlay = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5Z" /></Svg>
);
export const IconPause = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><rect x="7" y="5" width="3.6" height="14" rx="1.2" /><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" /></Svg>
);
export const IconStop = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></Svg>
);
export const IconSparkle = (p) => (
  <Svg {...p}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9Z" /></Svg>
);
export const IconInfo = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8h.01" /></Svg>
);
export const IconEdit = (p) => (
  <Svg {...p}><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m13.5 6.5 3 3" /></Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const IconExternal = (p) => (
  <Svg {...p}><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></Svg>
);
export const IconMoon = (p) => (
  <Svg {...p}><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" /></Svg>
);
export const IconSun = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></Svg>
);
