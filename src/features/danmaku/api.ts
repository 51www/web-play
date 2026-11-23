import { detectEpisode } from '../../utils';
import type { Anime, CommentTarget, Episode } from './types';

type Row = Record<string, unknown>;

const cache = new Map<string, { value: unknown; expires: number }>();

export function clearDanmakuCache(): void {
  cache.clear();
}

export function buildApiUrl(base: string, path: string, params: Record<string, string | number | undefined> = {}): string {
  const trimmed = base.trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('请先设置弹幕 API 地址');
  const question = trimmed.indexOf('?');
  const withoutQuery = question >= 0 ? trimmed.slice(0, question) : trimmed;
  const baseQuery = question >= 0 ? trimmed.slice(question + 1) : '';
  const url = new URL(`${withoutQuery}${path}`);
  baseQuery.split('&').filter(Boolean).forEach((pair) => {
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? pair.slice(eq + 1) : '';
    try {
      url.searchParams.append(decodeURIComponent(key), decodeURIComponent(value));
    } catch {
      url.searchParams.append(key, value);
    }
  });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function requestJson(url: string, timeout = 10000): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`弹幕服务返回 ${response.status}`);
    const text = await response.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('弹幕服务返回的不是 JSON，请检查接口地址或跨域配置');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('弹幕请求超时，请稍后重试');
    if (error instanceof TypeError) throw new Error('无法连接弹幕服务：请确认接口支持跨域访问（CORS）');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function cachedJson(url: string, ttl: number): Promise<unknown> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && hit.expires > now) return hit.value;
  const value = await requestJson(url);
  cache.set(url, { value, expires: now + Math.max(0, ttl) });
  return value;
}

function asRow(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function pick(row: Row, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function cleanAnimeKeyword(title: string): string {
  return String(title || '')
    .replace(/【[^】]*】/g, '')
    .replace(/\s*from\s+\w+\s*$/i, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractArray(payload: unknown, preferredKeys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = asRow(payload);
  for (const key of preferredKeys) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  for (const key of ['animes', 'episodes', 'comments', 'data', 'list', 'items', 'results', 'rows']) {
    const value = row[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = extractArray(value, preferredKeys);
      if (nested.length) return nested;
    }
  }
  return [];
}

function normalizeAnime(row: unknown, index: number): Anime {
  const item = asRow(row);
  const title = String(pick(item, ['animeTitle', 'anime', 'title', 'name', 'keyword']) ?? `作品 ${index + 1}`);
  const id = String(pick(item, ['animeId', 'id', 'bangumiId']) ?? index);
  return { id, title, raw: item };
}

function normalizeEpisode(row: unknown, index: number, anime: Anime): Episode {
  const item = asRow(row);
  const title = String(pick(item, ['episodeTitle', 'title', 'name', 'animeTitle']) ?? `剧集 ${index + 1}`);
  const rawNo = pick(item, ['episode', 'episodeNo', 'ep', 'num', 'index', 'no']);
  const no = Number(rawNo) || detectEpisode(title) || undefined;
  const idValue = pick(item, ['episodeId', 'commentId', 'cid', 'id']);
  const urlValue = pick(item, ['url', 'videoUrl', 'playUrl']);
  const id = idValue !== undefined ? String(idValue) : `${anime.id}-${no ?? index + 1}`;
  return {
    id,
    title,
    no,
    commentId: idValue !== undefined ? String(idValue) : undefined,
    url: urlValue !== undefined ? String(urlValue) : undefined,
    raw: item,
  };
}

export async function searchAnime(keyword: string, apiBase: string, ttl: number): Promise<Anime[]> {
  const url = buildApiUrl(apiBase, '/api/v2/search/anime', { keyword });
  const payload = await cachedJson(url, ttl);
  return extractArray(payload, ['animes', 'data', 'results', 'list', 'items']).map(normalizeAnime);
}

export async function searchEpisodes(anime: Anime, apiBase: string, ttl: number): Promise<Episode[]> {
  const keyword = cleanAnimeKeyword(anime.title);
  if (!keyword) return [];
  const url = buildApiUrl(apiBase, '/api/v2/search/episodes', { anime: keyword });
  const payload = await cachedJson(url, ttl);

  const animes = extractArray(payload, ['animes', 'data', 'results', 'list', 'items']).map(normalizeAnime);
  let targets = animes;
  const byId = animes.filter((item) => String(item.id) === String(anime.id));
  if (byId.length) {
    targets = byId;
  } else {
    const key = cleanAnimeKeyword(anime.title);
    const exact = animes.filter((item) => cleanAnimeKeyword(item.title) === key);
    if (exact.length) {
      targets = exact;
    } else {
      const loose = animes.filter((item) => {
        const title = cleanAnimeKeyword(item.title);
        return title.length > 0 && (title.includes(key) || key.includes(title));
      });
      if (loose.length) targets = loose;
    }
  }

  const episodes: Episode[] = [];
  for (const target of targets) {
    const rawEpisodes = target.raw.episodes;
    const nested: unknown[] = Array.isArray(rawEpisodes)
      ? rawEpisodes
      : rawEpisodes && typeof rawEpisodes === 'object'
        ? extractArray(rawEpisodes, ['episodes', 'data', 'list', 'items'])
        : [];
    nested.forEach((row) => episodes.push(normalizeEpisode(row, episodes.length, target)));
  }
  if (episodes.length) return episodes;

  const flat = extractArray(payload, ['episodes', 'data', 'list', 'items', 'results']);
  const looksLikeEpisodes = flat.some((row) => {
    const item = asRow(row);
    return pick(item, ['episodeId', 'commentId', 'cid', 'episodeTitle', 'episode']) !== undefined;
  });
  return looksLikeEpisodes ? flat.map((row, index) => normalizeEpisode(row, index, anime)) : [];
}

export async function getComments(target: CommentTarget, apiBase: string, ttl: number): Promise<unknown> {
  const path = target.id
    ? `/api/v2/comment/${encodeURIComponent(target.id)}`
    : '/api/v2/comment';
  const url = buildApiUrl(apiBase, path, {
    format: 'json',
    ...(target.id ? {} : { url: target.url }),
  });
  return cachedJson(url, ttl);
}

export function matchEpisode(episodes: Episode[], no?: number): Episode | undefined {
  if (!no) return episodes[0];
  const looseNo = (title: string): number | undefined => {
    const match = title.match(/(?:^|[^\d])0*(\d{1,3})(?:[^\d]|$)/);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return episodes.find((episode) => episode.no === no)
    ?? episodes.find((episode) => episode.title.includes(`第${no}集`) || episode.title.includes(`第${no}话`))
    ?? episodes.find((episode) => looseNo(episode.title) === no)
    ?? episodes[0];
}
