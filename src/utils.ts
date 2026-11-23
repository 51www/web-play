export function uid(prefix = 'id'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${random}`;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function cleanFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[\[\(【（][^\]\)】）]*[\]\)】）]/g, ' ')
    .replace(/\b(1080p|720p|2160p|4K|H\.?264|H\.?265|HEVC|x264|AAC|WEB-DL|BDRip|BluRay|CHS|CTC|GB|BIG5)\b/gi, ' ')
    .replace(/[_+.]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function detectEpisode(name: string): number | undefined {
  const patterns = [
    /[第]\s*(\d+)\s*[集话話期]/,
    /\bS\s*\d{1,2}\s*E\s*(\d{1,3})\b/i,
    /\bEP?\s*(\d{1,3})\b/i,
    /(?:^|[\s_\-])#\s*(\d{1,3})(?:$|[\s_\-])/,
    /[\[\(【（]\s*(\d{1,3})\s*[\]\)】）]/,
  ];
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

export function isDanmakuBlocked(text: string, blockWords: string): boolean {
  const words = blockWords
    .split(/[\n,，]/)
    .map((word) => word.trim())
    .filter(Boolean);
  return words.some((word) => text.includes(word));
}

export function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').toLowerCase();
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' });
}

export function normalizeTags(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  )).slice(0, 8);
}

export type PlaylistSortKey = 'default' | 'name' | 'episode' | 'size' | 'recent';

export function sortPlaylistItems<T extends { name: string; size: number; lastPlayedAt?: number }>(
  items: T[],
  key: PlaylistSortKey,
): T[] {
  const copy = [...items];
  if (key === 'name') return copy.sort((a, b) => naturalCompare(a.name, b.name));
  if (key === 'size') return copy.sort((a, b) => b.size - a.size);
  if (key === 'recent') return copy.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
  if (key === 'episode') {
    return copy.sort((a, b) => {
      const left = detectEpisode(a.name) ?? 0;
      const right = detectEpisode(b.name) ?? 0;
      return left === right ? naturalCompare(a.name, b.name) : left - right;
    });
  }
  return copy;
}
