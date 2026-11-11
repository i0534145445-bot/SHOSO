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

export const IconHome = (p) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6.5h5V21" /></Svg>
);
export const IconMusic = (p) => (
  <Svg {...p}><circle cx="8" cy="18" r="3" /><circle cx="18" cy="15.5" r="3" /><path d="M11 18V6.5l10-2v11" /></Svg>
);
export const IconAlbum = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.6" /></Svg>
);
export const IconArtist = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20.5c1.3-4 4-6 7.5-6s6.2 2 7.5 6" /></Svg>
);
export const IconPlaylist = (p) => (
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
export const IconQueue = (p) => (
  <Svg {...p}><path d="M4 6h12" /><path d="M4 11h12" /><path d="M4 16h7" /><path d="M17 13.5 21 16l-4 2.5Z" /></Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></Svg>
);
export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const IconGenre = (p) => (
  <Svg {...p}><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h6" /><circle cx="18" cy="17" r="2.5" /></Svg>
);
export const IconPlay = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5Z" /></Svg>
);
export const IconPause = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><rect x="7" y="5" width="3.6" height="14" rx="1.2" /><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" /></Svg>
);
export const IconNext = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><path d="M6 5.5v13l9-6.5Z" /><rect x="16.5" y="5.5" width="2.6" height="13" rx="1" /></Svg>
);
export const IconPrev = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><path d="M18 5.5v13L9 12Z" /><rect x="4.9" y="5.5" width="2.6" height="13" rx="1" /></Svg>
);
export const IconShuffle = (p) => (
  <Svg {...p}><path d="M4 7h3.5L18 17h2" /><path d="M4 17h3.5L18 7h2" /><path d="M18 4.5 20.5 7 18 9.5" /><path d="M18 14.5 20.5 17 18 19.5" /></Svg>
);
export const IconRepeat = (p) => (
  <Svg {...p}><path d="M6 5.5h9a3 3 0 0 1 3 3V10" /><path d="M18 18.5H9a3 3 0 0 1-3-3V13" /><path d="M15.5 3 18 5.5 15.5 8" /><path d="M8.5 21 6 18.5 8.5 16" /></Svg>
);
export const IconRepeatOne = (p) => (
  <Svg {...p}><path d="M6 5.5h9a3 3 0 0 1 3 3V10" /><path d="M18 18.5H9a3 3 0 0 1-3-3V13" /><path d="M15.5 3 18 5.5 15.5 8" /><path d="M8.5 21 6 18.5 8.5 16" /><path d="M11.6 10.6 12.8 10v4" /></Svg>
);
export const IconVolume = ({ level = 2, ...p }) => (
  <Svg {...p}>
    <path d="M4 9.5h3l4-3.5v12l-4-3.5H4Z" />
    {level > 0 && <path d="M15 9a4 4 0 0 1 0 6" />}
    {level > 1 && <path d="M17.5 6.5a7.5 7.5 0 0 1 0 11" />}
  </Svg>
);
export const IconMuted = (p) => (
  <Svg {...p}><path d="M4 9.5h3l4-3.5v12l-4-3.5H4Z" /><path d="M16 10l4 4M20 10l-4 4" /></Svg>
);
export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Svg>
);
export const IconLyrics = (p) => (
  <Svg {...p}><path d="M4 6h10" /><path d="M4 11h7" /><path d="M4 16h9" /><path d="M17 6v8.2" /><circle cx="18.6" cy="16.4" r="2.4" /></Svg>
);
export const IconEq = (p) => (
  <Svg {...p}><path d="M5 20V9" /><path d="M12 20V4" /><path d="M19 20v-7" /><circle cx="5" cy="7" r="1.8" /><circle cx="12" cy="16.5" r="1.8" /><circle cx="19" cy="10.5" r="1.8" /></Svg>
);
export const IconTrash = (p) => (
  <Svg {...p}><path d="M4.5 7h15" /><path d="M9.5 7V4.8h5V7" /><path d="M6.5 7l1 12.2h9l1-12.2" /><path d="M10.5 10.5v6M13.5 10.5v6" /></Svg>
);
export const IconClose = (p) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const IconChevron = (p) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
);
export const IconSort = (p) => (
  <Svg {...p}><path d="M7 4v16" /><path d="m3.5 16.5 3.5 3.5 3.5-3.5" /><path d="M13 7h7" /><path d="M13 12h5" /><path d="M13 17h3" /></Svg>
);
export const IconSparkle = (p) => (
  <Svg {...p}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9Z" /></Svg>
);
export const IconFullscreen = (p) => (
  <Svg {...p}><path d="M4 9V4h5" /><path d="M20 15v5h-5" /><path d="M15 4h5v5" /><path d="M9 20H4v-5" /></Svg>
);
export const IconGauge = (p) => (
  <Svg {...p}><path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="M12 12.5 15.5 9" /><circle cx="12" cy="13" r="1.4" /></Svg>
);
export const IconMicrophone = (p) => (
  <Svg {...p}><rect x="9" y="3.5" width="6" height="10" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></Svg>
);
export const IconKeyboard = (p) => (
  <Svg {...p}><rect x="3" y="6.5" width="18" height="11" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></Svg>
);
export const IconRefresh = (p) => (
  <Svg {...p}><path d="M20 11a8 8 0 1 0-2.5 6" /><path d="M20 5v6h-6" /></Svg>
);
export const IconMore = (p) => (
  <Svg {...p} fill="currentColor" stroke="none"><circle cx="12" cy="5.5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="18.5" r="1.7" /></Svg>
);
