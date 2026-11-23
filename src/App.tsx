import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DanmakuPanel } from './components/DanmakuPanel';
import { HelpPanel } from './components/HelpPanel';
import { Icon } from './components/Icon';
import { Player } from './components/Player';
import type { PlayerHandle } from './components/Player';
import { PlaylistSidebar } from './components/PlaylistSidebar';
import { SettingsPanel } from './components/SettingsPanel';
import {
  clearDanmakuCache,
  getComments,
  matchEpisode,
  searchAnime,
  searchEpisodes,
} from './features/danmaku/api';
import { parseDanmakuPayload, parseImportedText } from './features/danmaku/parser';
import type { Anime, DanmakuItem, Episode } from './features/danmaku/types';
import { deleteVideo, getVideo, loadState, putVideo, saveState } from './storage/db';
import { DEFAULT_SETTINGS } from './types';
import type { AppSettings, DanmakuSettings, PersistedState, Playlist, PlaylistItem } from './types';
import { cleanFileName, detectEpisode, fileBaseName, formatBytes, normalizeTags, uid } from './utils';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

interface SearchResults {
  animes: Anime[];
  episodes: Episode[];
}

const EMPTY_STATE: PersistedState = {
  playlists: [],
  activePlaylistId: null,
  activeItemId: null,
  settings: DEFAULT_SETTINGS,
};

const folderInputProps = { webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>;

function hydrate(saved: PersistedState | null): PersistedState {
  if (!saved) return EMPTY_STATE;
  const base = saved.settings ?? DEFAULT_SETTINGS;
  return {
    ...saved,
    playlists: saved.playlists ?? [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...base,
      danmaku: { ...DEFAULT_SETTINGS.danmaku, ...(base.danmaku ?? {}) },
      subtitle: { ...DEFAULT_SETTINGS.subtitle, ...(base.subtitle ?? {}) },
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误';
}

export default function App() {
  const [state, setState] = useState<PersistedState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panel, setPanel] = useState<'danmaku' | 'settings' | 'help' | null>(null);
  const playerRef = useRef<PlayerHandle>(null);

  const [keyword, setKeyword] = useState('');
  const [danmakuItems, setDanmakuItems] = useState<DanmakuItem[]>([]);
  const [danmakuStatus, setDanmakuStatus] = useState('尚未加载弹幕');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [selectedAnimeId, setSelectedAnimeId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  const notify = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = uid('toast');
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3400);
  }, []);

  useEffect(() => {
    let alive = true;
    loadState()
      .then((saved) => { if (alive) setState(hydrate(saved)); })
      .catch(() => { if (alive) notify('读取本地数据失败', 'error'); })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      saveState(state).catch(() => notify('本地存储写入失败，可能空间不足', 'error'));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state, ready, notify]);

  const activePlaylistId = state.activePlaylistId && state.playlists.some((p) => p.id === state.activePlaylistId)
    ? state.activePlaylistId
    : state.playlists[0]?.id ?? null;
  const activePlaylist = state.playlists.find((playlist) => playlist.id === activePlaylistId) ?? null;
  const activeItem = activePlaylist?.items.find((item) => item.id === state.activeItemId) ?? activePlaylist?.items[0] ?? null;

  useEffect(() => {
    if (activePlaylist && activeItem && state.activeItemId !== activeItem.id) {
      setState((prev) => ({ ...prev, activeItemId: activeItem.id }));
    }
  }, [activeItem, activePlaylist, state.activeItemId]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!activeItem) {
      setBlobUrl(null);
      return;
    }
    getVideo(activeItem.blobKey)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setBlobUrl(null);
          notify('找不到该视频的本地数据，请重新添加', 'error');
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) notify('读取本地视频失败', 'error'); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeItem?.blobKey, notify]);

  useEffect(() => {
    if (!activeItem) return;
    setKeyword(activeItem.danmakuKeyword ?? cleanFileName(activeItem.fileName));
    setResults(null);
    setSelectedAnimeId(null);
    setSelectedEpisodeId(null);
    setDanmakuItems([]);
    setDanmakuStatus('尚未加载弹幕');
  }, [activeItem?.id]);

  const apiBase = state.settings.danmaku.apiBase;
  const cacheTTL = state.settings.danmaku.cacheTTL;
  const detectedEpisode = activeItem?.danmakuEpisode ?? detectEpisode(activeItem?.fileName ?? '');

  const updateItem = useCallback((id: string, patch: Partial<PlaylistItem>) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((playlist) => ({
        ...playlist,
        items: playlist.items.map((item) => item.id === id ? { ...item, ...patch } : item),
      })),
    }));
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    const videoPattern = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv|avi|ts|flv|m3u8)$/i;
    const subtitlePattern = /\.(srt|vtt)$/i;
    const videoFiles = files.filter((file) => file.type.startsWith('video/') || videoPattern.test(file.name));
    const subtitleFiles = files.filter((file) => subtitlePattern.test(file.name));
    if (!videoFiles.length) {
      notify('没有找到可识别的视频文件', 'error');
      return;
    }
    const subtitles = new Map<string, { name: string; content: string }>();
    for (const file of subtitleFiles) {
      try {
        subtitles.set(fileBaseName(file.name), { name: file.name, content: await file.text() });
      } catch {
        notify(`字幕读取失败：${file.name}`, 'error');
      }
    }
    const newItems: PlaylistItem[] = [];
    for (const file of videoFiles) {
      const blobKey = uid('video');
      try {
        await putVideo(blobKey, file);
      } catch {
        notify('本地存储空间不足，部分视频未加入', 'error');
        continue;
      }
      const subtitle = subtitles.get(fileBaseName(file.name));
      newItems.push({
        id: uid('item'),
        name: cleanFileName(file.name) || file.name,
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        blobKey,
        danmakuKeyword: cleanFileName(file.name),
        danmakuEpisode: detectEpisode(file.name),
        subtitle: subtitle ? { ...subtitle, enabled: true, delay: 0 } : undefined,
      });
    }
    if (!newItems.length) return;
    setState((prev) => {
      const playlists = prev.playlists.map((playlist) => ({ ...playlist, items: [...playlist.items] }));
      let playlist = playlists.find((item) => item.id === prev.activePlaylistId);
      if (!playlist) {
        const created: Playlist = {
          id: uid('list'),
          name: '默认片单',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items: [],
        };
        playlists.push(created);
        playlist = created;
      }
      playlist.items.push(...newItems);
      playlist.updatedAt = Date.now();
      return {
        ...prev,
        playlists,
        activePlaylistId: playlist.id,
        activeItemId: prev.activeItemId ?? newItems[0].id,
      };
    });
    notify(`已加入 ${newItems.length} 个视频`, 'success');
  }, [notify]);

  const createPlaylist = useCallback((name: string) => {
    const playlist: Playlist = { id: uid('list'), name, createdAt: Date.now(), updatedAt: Date.now(), items: [] };
    setState((prev) => ({ ...prev, playlists: [...prev.playlists, playlist], activePlaylistId: playlist.id, activeItemId: null }));
    setDanmakuItems([]);
    notify('片单已创建', 'success');
  }, [notify]);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((playlist) => playlist.id === id ? { ...playlist, name, updatedAt: Date.now() } : playlist),
    }));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    const target = state.playlists.find((playlist) => playlist.id === id);
    if (!target) return;
    target.items.forEach((item) => { void deleteVideo(item.blobKey).catch(() => undefined); });
    setState((prev) => {
      const playlists = prev.playlists.filter((playlist) => playlist.id !== id);
      const next = prev.activePlaylistId === id ? playlists[0] ?? null : null;
      return {
        ...prev,
        playlists,
        activePlaylistId: next?.id ?? null,
        activeItemId: prev.activePlaylistId === id ? next?.items[0]?.id ?? null : prev.activeItemId,
      };
    });
    setDanmakuItems([]);
    notify('片单已删除', 'success');
  }, [notify, state.playlists]);

  const switchPlaylist = useCallback((id: string) => {
    const playlist = state.playlists.find((item) => item.id === id);
    setState((prev) => ({ ...prev, activePlaylistId: id, activeItemId: playlist?.items[0]?.id ?? null }));
    setDanmakuItems([]);
    setSidebarOpen(false);
  }, [state.playlists]);

  const selectItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      activeItemId: id,
      playlists: prev.playlists.map((playlist) => ({
        ...playlist,
        items: playlist.items.map((item) => item.id === id ? { ...item, lastPlayedAt: Date.now() } : item),
      })),
    }));
    setSidebarOpen(false);
  }, []);

  const removeItem = useCallback((id: string) => {
    const target = state.playlists.flatMap((playlist) => playlist.items).find((item) => item.id === id);
    if (target) void deleteVideo(target.blobKey).catch(() => undefined);
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((playlist) => ({
        ...playlist,
        items: playlist.items.filter((item) => item.id !== id),
      })),
      activeItemId: prev.activeItemId === id ? null : prev.activeItemId,
    }));
    setDanmakuItems([]);
  }, [state.playlists]);

  const reorder = useCallback((from: number, to: number) => {
    if (!activePlaylist || from === to || to < 0 || to >= activePlaylist.items.length) return;
    setState((prev) => ({
      ...prev,
      playlists: prev.playlists.map((playlist) => {
        if (playlist.id !== activePlaylist.id) return playlist;
        const items = [...playlist.items];
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        return { ...playlist, items, updatedAt: Date.now() };
      }),
    }));
  }, [activePlaylist]);

  const playAt = useCallback((delta: number) => {
    const items = activePlaylist?.items ?? [];
    if (items.length < 2) return;
    const current = items.findIndex((item) => item.id === activeItem?.id);
    let next = current + delta;
    if (state.settings.shuffle) {
      do { next = Math.floor(Math.random() * items.length); } while (next === current && items.length > 1);
    } else {
      next = (next + items.length) % items.length;
    }
    const nextId = items[next].id;
    setState((prev) => ({
      ...prev,
      activeItemId: nextId,
      playlists: prev.playlists.map((playlist) => ({
        ...playlist,
        items: playlist.items.map((item) => item.id === nextId ? { ...item, lastPlayedAt: Date.now() } : item),
      })),
    }));
  }, [activeItem?.id, activePlaylist?.items, state.settings.shuffle]);

  const handleEnded = useCallback(() => {
    if (state.settings.autoNext) playAt(1);
  }, [playAt, state.settings.autoNext]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  }, []);

  const updateDanmakuSettings = useCallback((patch: Partial<DanmakuSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, danmaku: { ...prev.settings.danmaku, ...patch } },
    }));
  }, []);

  const importSubtitleFile = useCallback(async (file: File) => {
    if (!activeItem) {
      notify('请先选择视频再挂载字幕', 'error');
      return;
    }
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      notify('仅支持 SRT 或 VTT 字幕', 'error');
      return;
    }
    try {
      const content = await file.text();
      updateItem(activeItem.id, {
        subtitle: { name: file.name, content, enabled: true, delay: activeItem.subtitle?.delay ?? 0 },
      });
      notify(`已挂载字幕：${file.name}`, 'success');
    } catch {
      notify('字幕读取失败', 'error');
    }
  }, [activeItem, notify, updateItem]);

  const toggleSubtitle = useCallback(() => {
    if (!activeItem?.subtitle) {
      notify('当前视频没有挂载字幕', 'info');
      return;
    }
    updateItem(activeItem.id, {
      subtitle: { ...activeItem.subtitle, enabled: !activeItem.subtitle.enabled },
    });
  }, [activeItem, notify, updateItem]);

  const toggleFavorite = useCallback((id: string) => {
    const target = state.playlists.flatMap((playlist) => playlist.items).find((item) => item.id === id);
    if (target) updateItem(id, { favorite: !target.favorite });
  }, [state.playlists, updateItem]);

  const setItemTags = useCallback((id: string, value: string) => {
    updateItem(id, { tags: normalizeTags(value) });
  }, [updateItem]);

  const seekDanmaku = useCallback((time: number) => {
    playerRef.current?.seek(time);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();

      if (key === 'escape') {
        setPanel(null);
        setSidebarOpen(false);
        return;
      }
      if (event.key === '?' || key === '/') {
        event.preventDefault();
        setPanel('help');
        return;
      }
      if (panel) return;

      if (key === 'n' || key === 'b') {
        event.preventDefault();
        playAt(key === 'n' ? 1 : -1);
        return;
      }
      const player = playerRef.current;
      if (!player) return;

      switch (key) {
        case ' ':
        case 'k':
          player.togglePlay();
          break;
        case 'j':
          player.seekBy(-10);
          break;
        case 'l':
          player.seekBy(10);
          break;
        case 'arrowleft':
          player.seekBy(-5);
          break;
        case 'arrowright':
          player.seekBy(5);
          break;
        case 'arrowup':
          player.changeVolume(0.05);
          break;
        case 'arrowdown':
          player.changeVolume(-0.05);
          break;
        case 'm':
          player.toggleMute();
          break;
        case 'f':
          player.toggleFullscreen();
          break;
        case 'p':
          player.togglePip();
          break;
        case 's':
          player.capture();
          break;
        case 'c':
          updateDanmakuSettings({ enabled: !state.settings.danmaku.enabled });
          break;
        case 'v':
          toggleSubtitle();
          break;
        case '[':
          player.changeRate(-1);
          break;
        case ']':
          player.changeRate(1);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, playAt, state.settings.danmaku.enabled, toggleSubtitle, updateDanmakuSettings]);

  const loadEpisode = useCallback(async (anime: Anime, episode: Episode, matchKeyword: string) => {
    setBusy(true);
    setDanmakuStatus('正在读取弹幕…');
    try {
      const raw = await getComments({ id: episode.commentId ?? episode.id, url: episode.url }, apiBase, cacheTTL);
      const parsed = parseDanmakuPayload(raw);
      if (!parsed.length) throw new Error('这个剧集暂时没有弹幕');
      setDanmakuItems(parsed);
      setDanmakuStatus(`已装填 ${parsed.length} 条 · ${anime.title} · ${episode.title}`);
      if (activeItem) updateItem(activeItem.id, { danmakuKeyword: matchKeyword, danmakuEpisode: episode.no });
      notify('弹幕装填完成', 'success');
    } catch (error) {
      const message = errorMessage(error);
      setDanmakuStatus(`弹幕加载失败：${message}`);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }, [activeItem, apiBase, cacheTTL, notify, updateItem]);

  const searchDanmaku = useCallback(async (value: string) => {
    const query = value.trim();
    if (!query) return;
    setBusy(true);
    setDanmakuStatus('正在搜索作品…');
    try {
      const animes = await searchAnime(query, apiBase, cacheTTL);
      setResults({ animes, episodes: [] });
      setSelectedAnimeId(animes[0]?.id ?? null);
      setSelectedEpisodeId(null);
      if (!animes.length) {
        setDanmakuStatus('没有找到匹配作品，可以缩短关键词再试');
        return;
      }
      setDanmakuStatus(`找到 ${animes.length} 个作品，正在查找剧集…`);
      const episodes = await searchEpisodes(animes[0], apiBase, cacheTTL);
      setResults({ animes, episodes });
      const episode = matchEpisode(episodes, detectedEpisode);
      setSelectedEpisodeId(episode?.id ?? null);
      setDanmakuStatus(episodes.length ? `找到 ${episodes.length} 集，请选择或装填` : '该作品暂无可加载剧集');
    } catch (error) {
      setDanmakuStatus(`搜索失败：${errorMessage(error)}`);
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }, [apiBase, cacheTTL, detectedEpisode, notify]);

  const selectAnime = useCallback(async (anime: Anime) => {
    setSelectedAnimeId(anime.id);
    setBusy(true);
    setDanmakuStatus('正在查找剧集…');
    try {
      const episodes = await searchEpisodes(anime, apiBase, cacheTTL);
      setResults((prev) => ({ animes: prev?.animes ?? [anime], episodes }));
      const episode = matchEpisode(episodes, detectedEpisode);
      setSelectedEpisodeId(episode?.id ?? null);
      setDanmakuStatus(episodes.length ? `找到 ${episodes.length} 集` : '该作品暂无可加载剧集');
    } catch (error) {
      setDanmakuStatus(`查找剧集失败：${errorMessage(error)}`);
      notify(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }, [apiBase, cacheTTL, detectedEpisode, notify]);

  const quickLoad = useCallback(async (value: string, episodeNo?: number) => {
    const query = value.trim();
    if (!query) return;
    setBusy(true);
    setDanmakuStatus('正在一键匹配…');
    try {
      const animes = await searchAnime(query, apiBase, cacheTTL);
      if (!animes.length) throw new Error('没有找到匹配的作品');
      const anime = animes[0];
      const episodes = await searchEpisodes(anime, apiBase, cacheTTL);
      const episode = matchEpisode(episodes, episodeNo ?? detectedEpisode);
      if (!episode) throw new Error('没有找到匹配的剧集');
      setResults({ animes, episodes });
      setSelectedAnimeId(anime.id);
      setSelectedEpisodeId(episode.id);
      await loadEpisode(anime, episode, query);
    } catch (error) {
      const message = errorMessage(error);
      setDanmakuStatus(`一键装填失败：${message}`);
      notify(message, 'error');
      setBusy(false);
    }
  }, [apiBase, cacheTTL, detectedEpisode, loadEpisode, notify]);

  const loadSelected = useCallback(() => {
    const anime = results?.animes.find((item) => item.id === selectedAnimeId);
    const episode = results?.episodes.find((item) => item.id === selectedEpisodeId);
    if (!anime || !episode) {
      notify('请先选择作品和剧集', 'error');
      return;
    }
    void loadEpisode(anime, episode, keyword);
  }, [keyword, loadEpisode, notify, results, selectedAnimeId, selectedEpisodeId]);

  const importDanmaku = useCallback(async (file: File) => {
    try {
      const items = parseImportedText(await file.text());
      if (!items.length) throw new Error('文件里没有可用的弹幕');
      setDanmakuItems(items);
      setDanmakuStatus(`已导入 ${items.length} 条本地弹幕 · ${file.name}`);
      notify('本地弹幕导入完成', 'success');
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  }, [notify]);

  const selectedAnime = useMemo(
    () => results?.animes.find((item) => item.id === selectedAnimeId) ?? null,
    [results, selectedAnimeId],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Icon name="film" size={22} /></span>
          <div>
            <strong>WEB PLAY</strong>
            <span>本地影像放映室</span>
          </div>
        </div>
        <div className="top-actions">
          <label className="button primary">
            <Icon name="upload" size={17} /> 打开视频
            <input type="file" accept="video/*,.srt,.vtt" multiple hidden onChange={(event) => {
              if (event.target.files?.length) void importFiles(Array.from(event.target.files));
              event.target.value = '';
            }} />
          </label>
          <label className="icon-button only-desktop" title="导入文件夹">
            <Icon name="folder" />
            <input type="file" multiple hidden {...folderInputProps} onChange={(event) => {
              if (event.target.files?.length) void importFiles(Array.from(event.target.files));
              event.target.value = '';
            }} />
          </label>
          <button className="button quiet" onClick={() => setPanel('danmaku')}><Icon name="search" size={17} /> 弹幕</button>
          <button className="icon-button" onClick={() => setPanel('help')} title="操作指南"><Icon name="keyboard" /></button>
          <button className="icon-button" onClick={() => setPanel('settings')} title="设置"><Icon name="settings" /></button>
          <button className="icon-button only-mobile" onClick={() => setSidebarOpen(true)} title="片单"><Icon name="list" /></button>
        </div>
      </header>

      <main className="workspace">
        <PlaylistSidebar
          playlists={state.playlists}
          activePlaylistId={activePlaylistId}
          activeItemId={activeItem?.id ?? null}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
          onSwitchPlaylist={switchPlaylist}
          onCreatePlaylist={createPlaylist}
          onRenamePlaylist={renamePlaylist}
          onDeletePlaylist={deletePlaylist}
          onSelectItem={selectItem}
          onRemoveItem={removeItem}
          onRenameItem={(id, name) => updateItem(id, { name })}
          onReorder={reorder}
          onImport={(files) => void importFiles(files)}
          onToggleFavorite={toggleFavorite}
          onSetTags={setItemTags}
        />

        <div className="main-column">
          <div className="now-playing">
            <div>
              <p className="eyebrow">NOW SHOWING / {activePlaylist?.name ?? 'EMPTY'}</p>
              <h1>{activeItem?.name ?? '等待放映'}</h1>
            </div>
            <div className="now-meta mono">
              <span>{activeItem ? formatBytes(activeItem.size) : '—'}</span>
              <span>{danmakuItems.length} 条弹幕</span>
            </div>
          </div>

          <div className="stage-area">
            <Player
              ref={playerRef}
              item={activeItem}
              src={blobUrl}
              settings={state.settings}
              danmakuItems={danmakuItems}
              danmakuStatus={danmakuStatus}
              onFiles={(files) => void importFiles(files)}
              onEnded={handleEnded}
              onTime={(time) => { if (activeItem) updateItem(activeItem.id, { progress: time }); }}
              onDuration={(duration) => { if (activeItem && duration && activeItem.duration !== duration) updateItem(activeItem.id, { duration }); }}
              onOpenDanmaku={() => setPanel('danmaku')}
              onToggleDanmaku={() => updateDanmakuSettings({ enabled: !state.settings.danmaku.enabled })}
              onRateChange={(rate) => updateSettings({ playbackRate: rate })}
              onSubtitleFile={(file) => void importSubtitleFile(file)}
              onToggleSubtitle={toggleSubtitle}
              onNotify={notify}
              onError={(message) => notify(message, 'error')}
            />
          </div>

          <div className="info-strip">
            <span><i className="legend amber" /> 本地文件不上传</span>
            <span><i className="legend mint" /> 弹幕按播放时间同步</span>
            <span className="mono">{selectedAnime ? `MATCH: ${selectedAnime.title}` : 'MATCH: —'}</span>
          </div>
        </div>
      </main>

      <DanmakuPanel
        open={panel === 'danmaku'}
        keyword={keyword}
        detectedEpisode={detectedEpisode}
        status={danmakuStatus}
        items={danmakuItems}
        onSeek={seekDanmaku}
        busy={busy}
        results={results}
        selectedAnimeId={selectedAnimeId}
        selectedEpisodeId={selectedEpisodeId}
        settings={state.settings.danmaku}
        onKeywordChange={setKeyword}
        onSearch={(value) => void searchDanmaku(value)}
        onQuickLoad={(value, episode) => void quickLoad(value, episode)}
        onSelectAnime={(anime) => void selectAnime(anime)}
        onSelectEpisode={(episode) => setSelectedEpisodeId(episode.id)}
        onLoad={loadSelected}
        onImport={(file) => void importDanmaku(file)}
        onClear={() => {
          setDanmakuItems([]);
          setDanmakuStatus('弹幕已清空');
        }}
        onSettingsChange={updateDanmakuSettings}
        onOpenSettings={() => setPanel('settings')}
        onClose={() => setPanel(null)}
      />

      <SettingsPanel
        open={panel === 'settings'}
        settings={state.settings}
        onChange={updateSettings}
        onDanmakuChange={updateDanmakuSettings}
        onReset={() => {
          setState((prev) => ({ ...prev, settings: DEFAULT_SETTINGS }));
          notify('已恢复默认设置', 'success');
        }}
        onClearCache={() => {
          clearDanmakuCache();
          notify('弹幕缓存已清空', 'success');
        }}
        onClose={() => setPanel(null)}
      />

      <HelpPanel open={panel === 'help'} onClose={() => setPanel(null)} />

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <Icon name={toast.type === 'error' ? 'alert' : 'check'} size={16} />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
