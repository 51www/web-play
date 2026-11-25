interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export type IconName =
  | 'play' | 'pause' | 'volume' | 'mute' | 'fullscreen' | 'exitFullscreen'
  | 'prev' | 'next' | 'plus' | 'upload' | 'search' | 'settings' | 'list'
  | 'trash' | 'edit' | 'grip' | 'close' | 'check' | 'alert' | 'up' | 'down'
  | 'film' | 'refresh' | 'import' | 'speed'
  | 'cc' | 'ccOff' | 'camera' | 'pip' | 'info' | 'keyboard'
  | 'star' | 'tag' | 'folder' | 'sort' | 'history'
  | 'danmakuOn' | 'danmakuOff' | 'danmakuSet';

const paths: Record<IconName, JSX.Element> = {
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />,
  pause: <><path d="M8 5v14" /><path d="M16 5v14" /></>,
  volume: <><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M18 6a8 8 0 0 1 0 12" /></>,
  mute: <><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>,
  fullscreen: <><path d="M8 3H3v5" /><path d="M16 3h5v5" /><path d="M21 16v5h-5" /><path d="M3 16v5h5" /></>,
  exitFullscreen: <><path d="M3 8h5V3" /><path d="M21 8h-5V3" /><path d="M16 21v-5h5" /><path d="M8 21v-5H3" /></>,
  prev: <><path d="M18 5v14L8 12z" fill="currentColor" stroke="none" /><path d="M5 5v14" /></>,
  next: <><path d="M6 5v14l10-7z" fill="currentColor" stroke="none" /><path d="M19 5v14" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 5 5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.4 7 7.2 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10.2 3V3h4v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4h-.2a1.7 1.7 0 0 0-1.6 1Z" /></>,
  list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 14h10l1-14" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  edit: <><path d="M4 20h4l11-11-4-4L4 16z" /><path d="m13 7 4 4" /></>,
  grip: <><circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  check: <path d="m5 12 5 5L19 7" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 9v5" /><path d="M12 17h.01" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16" /><path d="M17 4v16" /><path d="M3 9h4" /><path d="M17 9h4" /><path d="M3 15h4" /><path d="M17 15h4" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2 6" /><path d="M20 4v7h-7" /></>,
  import: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></>,
  speed: <><path d="M4.5 18a8 8 0 1 1 15 0" /><path d="M3 18h18" /><path d="m12 18 4-5.5" /></>,
  cc: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 10a2.6 2.6 0 1 0 0 4" /><path d="M17 10a2.6 2.6 0 1 0 0 4" /></>,
  ccOff: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 4 16 16" /></>,
  camera: <><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.4" /></>,
  pip: <><rect x="3" y="4" width="18" height="14" rx="2" /><rect x="12" y="11" width="7" height="5" rx="1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h4M18 14h.01" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  sort: <><path d="M8 6h13M8 12h10M8 18h7" /><path d="m3 8 2-2 2 2M5 6v12" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l4 2" /></>,
  danmakuOn: (
    <>
      <path d="m8 4 4 3.5 4-3.5" />
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 10.5h5" /><path d="M7 13.5h3" />
      <circle cx="17.9" cy="16.9" r="4.1" style={{ fill: 'var(--teal)' }} stroke="none" />
      <path d="m16.2 17 1.2 1.2 2.2-2.4" stroke="#f6f2e8" strokeWidth="1.4" />
    </>
  ),
  danmakuOff: (
    <>
      <path d="m8 4 4 3.5 4-3.5" />
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 10.5h5" /><path d="M7 13.5h3" />
      <circle cx="17.9" cy="16.9" r="4.1" style={{ fill: '#352d28' }} stroke="none" />
      <path d="m16.7 15.9 2.2 2.2" stroke="#f2e8d8" strokeWidth="1.3" />
      <path d="m18.9 15.9-2.2 2.2" stroke="#f2e8d8" strokeWidth="1.3" />
    </>
  ),
  danmakuSet: (
    <>
      <path d="m8 4 4 3.5 4-3.5" />
      <rect x="3" y="7" width="18" height="11" rx="2" />
      <path d="M7 10.5h5" /><path d="M7 13.5h3" />
      <circle cx="17.9" cy="16.9" r="4.1" style={{ fill: '#352d28' }} stroke="none" />
      <circle cx="17.9" cy="16.9" r="1.2" stroke="#f2e8d8" strokeWidth="1.1" />
      <path d="M17.9 14.9v-.9" stroke="#f2e8d8" strokeWidth="1.1" />
      <path d="M17.9 18.9v.9" stroke="#f2e8d8" strokeWidth="1.1" />
      <path d="M14.9 16.9h-.9" stroke="#f2e8d8" strokeWidth="1.1" />
      <path d="M20.9 16.9h.9" stroke="#f2e8d8" strokeWidth="1.1" />
    </>
  ),
};

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
