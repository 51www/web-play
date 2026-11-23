export interface DanmakuSettings {
  enabled: boolean;
  apiBase: string;
  cacheTTL: number;
  fontSize: number;
  color: string;
  opacity: number;
  speed: number;
  maxLines: number;
  topMargin: number;
  bottomMargin: number;
  blockWords: string;
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export interface SubtitleSettings {
  enabled: boolean;
  fontSize: number;
  color: string;
  background: string;
  bottom: number;
  delay: number;
}

export interface SubtitleTrack {
  name: string;
  content: string;
  enabled: boolean;
  delay: number;
}

export interface AppSettings {
  danmaku: DanmakuSettings;
  subtitle: SubtitleSettings;
  autoNext: boolean;
  loop: boolean;
  shuffle: boolean;
  volume: number;
  playbackRate: number;
  skipIntro: number;
  skipOutro: number;
  screenshotWithDanmaku: boolean;
}

export interface PlaylistItem {
  id: string;
  name: string;
  fileName: string;
  size: number;
  lastModified: number;
  blobKey: string;
  duration?: number;
  danmakuKeyword?: string;
  danmakuEpisode?: number;
  progress?: number;
  favorite?: boolean;
  tags?: string[];
  lastPlayedAt?: number;
  subtitle?: SubtitleTrack;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: PlaylistItem[];
}

export interface PersistedState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  activeItemId: string | null;
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  danmaku: {
    enabled: true,
    apiBase: 'https://danmu-api-93060.app.workbuddy.host?sharecode=4ZIBWTWGZ4',
    cacheTTL: 300000,
    fontSize: 25,
    color: '#ffffff',
    opacity: 0.9,
    speed: 8,
    maxLines: 15,
    topMargin: 18,
    bottomMargin: 12,
    blockWords: '',
  },
  subtitle: {
    enabled: true,
    fontSize: 22,
    color: '#ffffff',
    background: 'rgba(18, 15, 13, 0.72)',
    bottom: 14,
    delay: 0,
  },
  autoNext: true,
  loop: false,
  shuffle: false,
  volume: 0.8,
  playbackRate: 1,
  skipIntro: 0,
  skipOutro: 0,
  screenshotWithDanmaku: false,
};
