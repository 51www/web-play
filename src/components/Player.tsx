import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import videojs from 'video.js';
import { PLAYBACK_RATES } from '../types';
import type { AppSettings, PlaylistItem } from '../types';
import type { DanmakuItem } from '../features/danmaku/types';
import { DanmakuRenderer } from '../features/danmaku/renderer';
import { parseSubtitle } from '../features/subtitle/parser';
import type { SubtitleCue } from '../features/subtitle/parser';
import { formatBytes, formatTime } from '../utils';
import { Icon } from './Icon';

type VideoPlayer = ReturnType<typeof videojs>;
type NotifyType = 'info' | 'success' | 'error';

export interface PlayerHandle {
  seek: (time: number) => void;
  seekBy: (delta: number) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  capture: () => void;
  changeRate: (direction: -1 | 1) => void;
  changeVolume: (delta: number) => void;
}

interface PlayerProps {
  item: PlaylistItem | null;
  src: string | null;
  settings: AppSettings;
  danmakuItems: DanmakuItem[];
  danmakuStatus: string;
  onFiles: (files: File[]) => void;
  onEnded: () => void;
  onTime: (time: number) => void;
  onDuration: (duration: number) => void;
  onOpenDanmaku: () => void;
  onToggleDanmaku: () => void;
  onRateChange: (rate: number) => void;
  onSubtitleFile: (file: File) => void;
  onToggleSubtitle: () => void;
  onNotify: (message: string, type?: NotifyType) => void;
  onError: (message: string) => void;
}

function guessMime(name: string): string | undefined {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
  };
  return ext ? map[ext] : undefined;
}

function pictureFilter(picture: AppSettings['picture']): string {
  if (!picture.enhance) return 'none';
  const parts: string[] = [];
  if (Math.abs(picture.brightness - 1) > 0.001) parts.push(`brightness(${picture.brightness.toFixed(2)})`);
  if (Math.abs(picture.contrast - 1) > 0.001) parts.push(`contrast(${picture.contrast.toFixed(2)})`);
  if (Math.abs(picture.saturation - 1) > 0.001) parts.push(`saturate(${picture.saturation.toFixed(2)})`);
  return parts.length ? parts.join(' ') : 'none';
}

function skipBounds(duration: number, settings: AppSettings) {
  const intro = Math.max(0, settings.skipIntro || 0);
  const outro = Math.max(0, settings.skipOutro || 0);
  if (duration <= intro + outro + 1) return { intro: 0, outro: 0 };
  return { intro, outro };
}

function nextPlaybackRate(current: number): number {
  const rates = PLAYBACK_RATES as readonly number[];
  return rates.find((rate) => rate > current + 0.001) ?? rates[0] ?? 1;
}

const HEATMAP_BUCKETS = 200;

function heatOpacity(ratio: number): number {
  return ratio <= 0 ? 0 : 0.3 + ratio * 0.7;
}

function formatClock(time: number): string {
  const total = Math.max(0, Math.floor(time || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player({
  item,
  src,
  settings,
  danmakuItems,
  danmakuStatus,
  onFiles,
  onEnded,
  onTime,
  onDuration,
  onOpenDanmaku,
  onToggleDanmaku,
  onRateChange,
  onSubtitleFile,
  onToggleSubtitle,
  onNotify,
  onError,
}, handleRef) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DanmakuRenderer | null>(null);
  const playerRef = useRef<VideoPlayer | null>(null);
  const itemsRef = useRef(danmakuItems);
  const settingsRef = useRef(settings);
  const itemRef = useRef(item);
  const fileNameRef = useRef('');
  const callbacksRef = useRef({ onEnded, onTime, onDuration, onRateChange, onNotify, onError });
  const playbackRateRef = useRef(settings.playbackRate);
  const sourceLoadingRef = useRef(false);
  const skipStateRef = useRef({ introDone: false, outroDone: false });
  const lastSavedRef = useRef(-1);
  const durationRef = useRef(0);
  const videoSizeRef = useRef({ width: 0, height: 0 });
  const cuesRef = useRef<SubtitleCue[]>([]);
  const lastCueRef = useRef('');
  const thumbSpriteRef = useRef<{ src: string; count: number; itemId: string } | null>(null);
  const thumbVideoRef = useRef<HTMLVideoElement | null>(null);
  const thumbTokenRef = useRef(0);
  const heatmapRef = useRef<HTMLDivElement | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(settings.playbackRate);
  const [dragging, setDragging] = useState(false);
  const [activeCue, setActiveCue] = useState('');
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [estimatedFps, setEstimatedFps] = useState(0);
  const [thumbSprite, setThumbSprite] = useState<{ src: string; count: number } | null>(null);
  const [thumbHover, setThumbHover] = useState<{ time: number; x: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pipActive, setPipActive] = useState(false);

  itemRef.current = item;
  fileNameRef.current = item?.fileName ?? '';
  durationRef.current = duration;
  callbacksRef.current = { onEnded, onTime, onDuration, onRateChange, onNotify, onError };

  const generateThumbnails = useCallback(async (itemId: string, videoSrc: string, videoDuration: number) => {
    if (!videoSrc || videoDuration <= 1) return;
    if (thumbSpriteRef.current?.itemId === itemId) {
      setThumbSprite({ src: thumbSpriteRef.current.src, count: thumbSpriteRef.current.count });
      return;
    }
    const token = ++thumbTokenRef.current;
    thumbVideoRef.current?.removeAttribute('src');
    thumbVideoRef.current?.load();
    const temp = document.createElement('video');
    temp.muted = true;
    temp.preload = 'auto';
    temp.playsInline = true;
    temp.src = videoSrc;
    thumbVideoRef.current = temp;
    try {
      await new Promise<void>((resolve, reject) => {
        temp.onloadedmetadata = () => resolve();
        temp.onerror = () => reject(new Error('thumbnail source failed'));
      });
      const count = 10;
      const tileWidth = 160;
      const tileHeight = 90;
      const sprite = document.createElement('canvas');
      sprite.width = tileWidth * count;
      sprite.height = tileHeight;
      const ctx = sprite.getContext('2d');
      if (!ctx) return;
      for (let index = 0; index < count; index += 1) {
        if (token !== thumbTokenRef.current) return;
        const target = Math.min((index + 0.5) / count * videoDuration, Math.max(0, videoDuration - 0.05));
        await new Promise<void>((resolve) => {
          if (Math.abs(temp.currentTime - target) < 0.01) {
            resolve();
            return;
          }
          temp.onseeked = () => resolve();
          temp.currentTime = target;
        });
        ctx.fillStyle = '#0c0b10';
        ctx.fillRect(index * tileWidth, 0, tileWidth, tileHeight);
        const vw = temp.videoWidth;
        const vh = temp.videoHeight;
        if (vw && vh) {
          const scale = Math.min(tileWidth / vw, tileHeight / vh);
          const width = vw * scale;
          const height = vh * scale;
          ctx.drawImage(temp, index * tileWidth + (tileWidth - width) / 2, (tileHeight - height) / 2, width, height);
        }
      }
      if (token !== thumbTokenRef.current) return;
      const srcData = sprite.toDataURL('image/jpeg', 0.62);
      thumbSpriteRef.current = { src: srcData, count, itemId };
      setThumbSprite({ src: srcData, count });
    } catch {
      setThumbSprite(null);
    } finally {
      if (thumbVideoRef.current === temp) {
        temp.removeAttribute('src');
        temp.load();
        thumbVideoRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const host = videoHostRef.current;
    if (!video || !host) return;
    const screenForInit = stageRef.current?.querySelector('.stage-screen');
    if (screenForInit && !screenForInit.contains(host)) screenForInit.appendChild(host);
    if (!host.contains(video)) host.appendChild(video);
    const player = videojs(video, {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: false,
      responsive: true,
      playbackRates: [...PLAYBACK_RATES],
      controlBar: {
        children: [
          'playToggle',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'volumePanel',
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
      userActions: { hotkeys: false },
    });
    playerRef.current = player;
    player.addClass('video-js');
    player.addClass('webplay-player');

    const overlay = overlayRef.current;
    if (overlay) player.el().appendChild(overlay);

    if (overlay) {
      const renderer = new DanmakuRenderer({
        container: overlay,
        getVideo: () => playerRef.current?.el().querySelector('video') ?? null,
        getItems: () => itemsRef.current,
        getSettings: () => settingsRef.current.danmaku,
      });
      rendererRef.current = renderer;
      renderer.start();
    }

    const onLoadedMetadata = () => {
      sourceLoadingRef.current = false;
      const total = player.duration() || 0;
      const bounds = skipBounds(total, settingsRef.current);
      skipStateRef.current = { introDone: false, outroDone: false };
      setDuration(total);
      callbacksRef.current.onDuration(total);
      videoSizeRef.current = { width: video.videoWidth || 0, height: video.videoHeight || 0 };
      setVideoSize(videoSizeRef.current);
      void generateThumbnails(itemRef.current?.id ?? 'video', player.currentSrc() || '', total);
      player.volume(settingsRef.current.volume);
      player.muted(false);
      player.playbackRate(playbackRateRef.current || settingsRef.current.playbackRate);
      player.loop(settingsRef.current.loop);
      let resumeAt = itemRef.current?.progress ?? 0;
      if (resumeAt > 1 && resumeAt < total - 3) {
        if (bounds.intro > 0 && resumeAt < bounds.intro) resumeAt = bounds.intro;
        if (bounds.outro > 0 && resumeAt > total - bounds.outro) resumeAt = bounds.intro;
        if (resumeAt > 1 && resumeAt < total - 3) player.currentTime(resumeAt);
      }
      lastSavedRef.current = -1;
      const attempt = player.play();
      if (attempt && typeof (attempt as Promise<void>).catch === 'function') {
        void (attempt as Promise<void>).catch(() => undefined);
      }
    };

    const onTimeUpdate = () => {
      if (!videoSizeRef.current.width && video.videoWidth) {
        videoSizeRef.current = { width: video.videoWidth, height: video.videoHeight };
        setVideoSize(videoSizeRef.current);
      }
      const time = player.currentTime() || 0;
      const total = player.duration() || 0;
      const bounds = skipBounds(total, settingsRef.current);
      const skipState = skipStateRef.current;

      if (!skipState.introDone && bounds.intro > 0 && time < bounds.intro) {
        skipState.introDone = true;
        player.currentTime(bounds.intro);
        setCurrentTime(bounds.intro);
        return;
      }
      if (!skipState.outroDone && bounds.outro > 0 && time >= total - bounds.outro) {
        skipState.outroDone = true;
        if (settingsRef.current.loop) {
          player.currentTime(bounds.intro);
          skipState.introDone = true;
          skipState.outroDone = false;
          setCurrentTime(bounds.intro);
          return;
        }
        player.pause();
        setCurrentTime(0);
        callbacksRef.current.onTime(0);
        callbacksRef.current.onEnded();
        return;
      }

      setCurrentTime(time);
      const subtitle = itemRef.current?.subtitle;
      const cueTime = time + (subtitle?.delay ?? 0) + settingsRef.current.subtitle.delay;
      const cue = subtitle?.enabled && settingsRef.current.subtitle.enabled
        ? cuesRef.current.find((entry) => cueTime >= entry.start && cueTime < entry.end)?.text ?? ''
        : '';
      if (cue !== lastCueRef.current) {
        lastCueRef.current = cue;
        setActiveCue(cue);
      }
      const rounded = Math.floor(time);
      if (rounded !== lastSavedRef.current) {
        lastSavedRef.current = rounded;
        callbacksRef.current.onTime(time);
      }
    };

    const onSeeked = () => {
      const total = player.duration() || 0;
      const bounds = skipBounds(total, settingsRef.current);
      const time = player.currentTime() || 0;
      if (bounds.intro > 0 && time >= bounds.intro) skipStateRef.current.introDone = true;
      if (bounds.outro > 0 && time < total - bounds.outro) skipStateRef.current.outroDone = false;
    };

    const onRateChange = () => {
      if (sourceLoadingRef.current) return;
      const rate = player.playbackRate() || 1;
      playbackRateRef.current = rate;
      setPlaybackRate(rate);
      callbacksRef.current.onRateChange(rate);
    };

    const onPause = () => callbacksRef.current.onTime(player.currentTime() || 0);

    const onEnded = () => {
      callbacksRef.current.onTime(0);
      callbacksRef.current.onEnded();
    };

    const onError = () => callbacksRef.current.onError('视频无法播放，可能是文件损坏或浏览器不支持该编码');
    const onEnterPip = () => setPipActive(true);
    const onLeavePip = () => setPipActive(false);

    const progressEl = player.el().querySelector<HTMLElement>('.vjs-progress-control');
    const onProgressMove = (event: MouseEvent) => {
      const rect = progressEl?.getBoundingClientRect();
      const playerRect = player.el().getBoundingClientRect();
      if (!rect || !playerRect.width) return;
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const x = Math.max(90, Math.min(playerRect.width - 90, event.clientX - playerRect.left));
      setThumbHover({ time: ratio * durationRef.current, x });
    };
    const onProgressLeave = () => setThumbHover(null);

    const videoWithFrames = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: (now: number) => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    const frameTimes: number[] = [];
    let frameCallback = 0;
    let frameCount = 0;
    const onFrame = (now: number) => {
      if (video.videoWidth && (
        video.videoWidth !== videoSizeRef.current.width || video.videoHeight !== videoSizeRef.current.height
      )) {
        videoSizeRef.current = { width: video.videoWidth, height: video.videoHeight };
        setVideoSize(videoSizeRef.current);
      }
      frameTimes.push(now);
      if (frameTimes.length > 30) frameTimes.shift();
      frameCount += 1;
      if (frameCount % 10 === 0 && frameTimes.length > 1) {
        const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
        if (span > 0) setEstimatedFps(Math.round((frameTimes.length - 1) * 1000 / span));
      }
      if (videoWithFrames.requestVideoFrameCallback) {
        frameCallback = videoWithFrames.requestVideoFrameCallback(onFrame);
      }
    };
    if (videoWithFrames.requestVideoFrameCallback) frameCallback = videoWithFrames.requestVideoFrameCallback(onFrame);

    player.on('loadedmetadata', onLoadedMetadata);
    player.on('timeupdate', onTimeUpdate);
    player.on('seeked', onSeeked);
    player.on('ratechange', onRateChange);
    player.on('pause', onPause);
    player.on('ended', onEnded);
    player.on('error', onError);
    video.addEventListener('enterpictureinpicture', onEnterPip);
    video.addEventListener('leavepictureinpicture', onLeavePip);
    progressEl?.addEventListener('mousemove', onProgressMove);
    progressEl?.addEventListener('mouseleave', onProgressLeave);

    const heatEl = document.createElement('div');
    heatEl.className = 'danmaku-heatmap';
    progressEl?.appendChild(heatEl);
    heatmapRef.current = heatEl;
    setPortalEl(player.el() as HTMLElement);

    return () => {
      setPortalEl(null);
      player.off('loadedmetadata', onLoadedMetadata);
      player.off('timeupdate', onTimeUpdate);
      player.off('seeked', onSeeked);
      player.off('ratechange', onRateChange);
      player.off('pause', onPause);
      player.off('ended', onEnded);
      player.off('error', onError);
      video.removeEventListener('enterpictureinpicture', onEnterPip);
      video.removeEventListener('leavepictureinpicture', onLeavePip);
      progressEl?.removeEventListener('mousemove', onProgressMove);
      progressEl?.removeEventListener('mouseleave', onProgressLeave);
      if (videoWithFrames.cancelVideoFrameCallback && frameCallback) videoWithFrames.cancelVideoFrameCallback(frameCallback);
      thumbTokenRef.current += 1;
      heatmapRef.current = null;
      thumbVideoRef.current?.removeAttribute('src');
      thumbVideoRef.current?.load();
      thumbVideoRef.current = null;
      rendererRef.current?.destroy();
      rendererRef.current = null;
      const screen = stageRef.current?.querySelector('.stage-screen');
      if (screen && overlayRef.current) screen.appendChild(overlayRef.current);
      player.dispose();
      if (screen && host && !screen.contains(host)) screen.appendChild(host);
      if (host && !host.contains(video)) host.appendChild(video);
      playerRef.current = null;
    };
  }, [generateThumbnails]);

  const updateHeatmap = useCallback((items: DanmakuItem[], total: number) => {
    const container = heatmapRef.current;
    if (!container) return;
    const buckets = new Array<number>(HEATMAP_BUCKETS).fill(0);
    const usable = Number.isFinite(total) && total > 0;
    if (usable) {
      for (const entry of items) {
        const time = entry.time;
        if (!Number.isFinite(time)) continue;
        const bounded = Math.min(Math.max(time, 0), total);
        buckets[Math.min(HEATMAP_BUCKETS - 1, Math.floor(bounded / total * HEATMAP_BUCKETS))] += 1;
      }
    }
    const max = Math.max(1, ...buckets);
    const columns: HTMLElement[] = [];
    for (let index = 0; index < HEATMAP_BUCKETS; index += 1) {
      const cell = document.createElement('i');
      const ratio = buckets[index] / max;
      // 高度增益：中低密度也拉到足够高，密度差异更醒目
      const boosted = Math.min(1, ratio * 1.6);
      cell.style.height = `${Math.round(boosted * 100)}%`;
      cell.style.opacity = String(heatOpacity(boosted));
      columns.push(cell);
    }
    container.replaceChildren(...columns);
    container.classList.toggle('has-data', usable && items.length > 0);
  }, []);

  useEffect(() => {
    updateHeatmap(danmakuItems, duration);
  }, [danmakuItems, duration, updateHeatmap]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !videoSize.width || !videoSize.height) {
      setStageSize(null);
      return;
    }
    const area = stage.parentElement;
    if (!area) return;
    const compute = () => {
      if (document.fullscreenElement && document.fullscreenElement.contains(stage)) return;
      const availW = Math.min(area.clientWidth, 980);
      const availH = area.clientHeight;
      if (availW < 80 || availH < 120) return;
      const innerW = availW - 24;
      const innerH = availH - 24;
      const aspect = videoSize.height / videoSize.width;
      const heightByWidth = innerW * aspect + 100;
      if (heightByWidth <= innerH) {
        setStageSize({ width: availW, height: Math.round(heightByWidth + 24) });
      } else {
        const videoH = Math.max(120, innerH - 100);
        const videoW = videoH / aspect;
        setStageSize({ width: Math.round(Math.min(availW, videoW + 24)), height: Math.round(availH) });
      }
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(area);
    return () => observer.disconnect();
  }, [videoSize.width, videoSize.height]);

  useEffect(() => {
    itemsRef.current = danmakuItems;
    rendererRef.current?.reset();
  }, [danmakuItems]);

  useEffect(() => {
    cuesRef.current = item?.subtitle?.content ? parseSubtitle(item.subtitle.content) : [];
    lastCueRef.current = '';
    setActiveCue('');
  }, [item?.subtitle?.content, item?.subtitle?.enabled]);

  useEffect(() => {
    setInfoOpen(false);
  }, [item?.id]);

  useEffect(() => {
    settingsRef.current = settings;
    playbackRateRef.current = settings.playbackRate;
    setPlaybackRate(settings.playbackRate);
    const player = playerRef.current;
    if (player) {
      player.playbackRate(settings.playbackRate);
      player.loop(settings.loop);
    }
    rendererRef.current?.reset();
  }, [settings]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    skipStateRef.current = { introDone: false, outroDone: false };
    sourceLoadingRef.current = true;
    if (!src) {
      player.pause();
      player.reset();
      sourceLoadingRef.current = false;
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    const type = guessMime(fileNameRef.current);
    player.src(type ? { src, type } : { src });
  }, [src]);

  const handleFiles = (files: FileList | null) => {
    if (files?.length) onFiles(Array.from(files));
  };

  const seek = useCallback((time: number) => {
    const player = playerRef.current;
    if (!player) return;
    const total = player.duration() || time;
    player.currentTime(Math.max(0, Math.min(time, Math.max(0, total - 0.05))));
    rendererRef.current?.reset();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const player = playerRef.current;
    if (!player) return;
    seek((player.currentTime() || 0) + delta);
  }, [seek]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.paused()) void player.play();
    else player.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (player) player.muted(!player.muted());
  }, []);

  const toggleFullscreen = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isFullscreen()) player.exitFullscreen();
    else player.requestFullscreen();
  }, []);

  const togglePip = useCallback(async () => {
    const video = playerRef.current?.el().querySelector('video') as HTMLVideoElement | null;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
      } else {
        callbacksRef.current.onNotify('当前浏览器不支持画中画', 'error');
      }
    } catch {
      callbacksRef.current.onNotify('画中画切换失败', 'error');
    }
  }, []);

  const changeRate = useCallback((direction: -1 | 1) => {
    const player = playerRef.current;
    if (!player) return;
    const rates = PLAYBACK_RATES as readonly number[];
    const current = playbackRateRef.current;
    let index = rates.findIndex((rate) => Math.abs(rate - current) < 0.01);
    if (index < 0) {
      if (direction > 0) {
        index = rates.findIndex((rate) => rate > current);
      } else {
        for (let i = rates.length - 1; i >= 0; i -= 1) {
          if (rates[i] < current) {
            index = i;
            break;
          }
        }
      }
    }
    const next = rates[Math.max(0, Math.min(rates.length - 1, index + direction))] ?? current;
    player.playbackRate(next);
  }, []);

  const changeVolume = useCallback((delta: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.volume(Math.max(0, Math.min(1, (player.volume() || 0) + delta)));
  }, []);

  const capture = useCallback(() => {
    const player = playerRef.current;
    const video = player?.el().querySelector('video') as HTMLVideoElement | null;
    if (!video || !video.videoWidth || !video.videoHeight) {
      callbacksRef.current.onNotify('当前没有可截图的画面', 'error');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = pictureFilter(settingsRef.current.picture);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

    if (settingsRef.current.screenshotWithDanmaku) {
      const snapshot = rendererRef.current?.getSnapshot();
      if (snapshot && snapshot.width > 0 && snapshot.height > 0) {
        const scaleX = canvas.width / snapshot.width;
        const scaleY = canvas.height / snapshot.height;
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = Math.max(1, 3 * scaleY);
        for (const item of snapshot.items) {
          ctx.globalAlpha = item.opacity;
          ctx.fillStyle = item.color;
          ctx.font = `700 ${Math.max(10, item.fontSize * scaleY)}px "Avenir Next", "Segoe UI", sans-serif`;
          ctx.fillText(item.text, item.x * scaleX + 3, item.y * scaleY + 2);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        callbacksRef.current.onNotify('截图生成失败', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `webplay-${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      callbacksRef.current.onNotify('截图已保存', 'success');
    }, 'image/png');
  }, []);

  const handleCycleRate = () => {
    changeRate(1);
  };

  useImperativeHandle(handleRef, () => ({
    seek,
    seekBy,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    togglePip,
    capture,
    changeRate,
    changeVolume,
  }), [seek, seekBy, togglePlay, toggleMute, toggleFullscreen, togglePip, capture, changeRate, changeVolume]);

  const activeVideo = playerRef.current?.el().querySelector('video') ?? videoRef.current;
  const infoWidth = videoSize.width || activeVideo?.videoWidth || 0;
  const infoHeight = videoSize.height || activeVideo?.videoHeight || 0;

  return (
    <section
      ref={stageRef}
      className={`stage${dragging ? ' is-dragging' : ''}`}
      style={stageSize ? { '--stage-w': `${stageSize.width}px`, '--stage-h': `${stageSize.height}px` } as CSSProperties : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className={`stage-screen${src ? '' : ' is-empty'}`}>
        <div data-vjs-player className="video-host" ref={videoHostRef}>
          <video ref={videoRef} className="video-js" playsInline style={{ filter: pictureFilter(settings.picture) }} />
        </div>
        <div
          ref={overlayRef}
          className={`danmaku-overlay${settings.danmaku.enabled ? '' : ' is-hidden'}${activeCue ? ' has-subtitle' : ''}`}
        />
        {activeCue && src && (
          <div
            className="subtitle-layer"
            style={{
              fontSize: `${settings.subtitle.fontSize}px`,
              color: settings.subtitle.color,
              background: settings.subtitle.background,
              bottom: `calc(100px + ${settings.subtitle.bottom}px)`,
            }}
          >
            {activeCue}
          </div>
        )}

        {!src && (
          <div className="empty-stage">
            <div className="empty-mark"><Icon name="film" size={34} /></div>
            <p className="eyebrow">LOCAL CINEMA / 01</p>
            <h2>把视频带进放映室</h2>
            <p className="empty-copy">选择本地文件，或直接拖到这里。视频不会离开你的设备。</p>
            <label className="button primary">
              <Icon name="upload" size={18} />
              打开本地视频
              <input type="file" accept="video/*,.srt,.vtt" multiple hidden onChange={(event) => handleFiles(event.target.files)} />
            </label>
          </div>
        )}

        {dragging && <div className="drop-veil"><Icon name="import" size={32} /><span>松手加入片单</span></div>}
      </div>

      {src && (
        <>
          <div className="danmaku-float-group">
            <button
              className="danmaku-float rate-float"
              onClick={handleCycleRate}
              title={`切换倍速，当前 ${playbackRate}×`}
              aria-label={`切换倍速，当前 ${playbackRate} 倍`}
            >
              <Icon name="speed" size={15} /> <span className="mono">{playbackRate}×</span>
            </button>
            <button
              className="danmaku-float icon-only"
              onClick={onToggleSubtitle}
              title={item?.subtitle?.enabled ? '关闭字幕' : '开启字幕'}
              aria-label={item?.subtitle?.enabled ? '关闭字幕' : '开启字幕'}
            >
              <Icon name={item?.subtitle?.enabled ? 'cc' : 'ccOff'} size={15} />
            </button>
            <label className="danmaku-float icon-only" title="挂载 SRT / VTT 字幕" aria-label="挂载字幕">
              <Icon name="import" size={15} />
              <input type="file" accept=".srt,.vtt" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onSubtitleFile(file);
                event.target.value = '';
              }} />
            </label>
            <button className="danmaku-float icon-only" onClick={capture} title="截图（S）" aria-label="截图">
              <Icon name="camera" size={15} />
            </button>
            <button
              className={`danmaku-float icon-only${pipActive ? ' active' : ''}`}
              onClick={() => void togglePip()}
              title="画中画（P）"
              aria-label="画中画"
            >
              <Icon name="pip" size={15} />
            </button>
            <button
              className={`danmaku-float icon-only${infoOpen ? ' active' : ''}`}
              onClick={() => setInfoOpen((value) => !value)}
              title="视频信息"
              aria-label="视频信息"
            >
              <Icon name="info" size={15} />
            </button>
            <button className="danmaku-float" onClick={onOpenDanmaku} title={danmakuStatus}>
              <Icon name="search" size={15} /> <span className="float-label">弹幕</span> <span className="mono">{danmakuItems.length}</span>
            </button>
            <button className="danmaku-float icon-only" onClick={onToggleDanmaku} title={settings.danmaku.enabled ? '关闭弹幕' : '开启弹幕'} aria-label="切换弹幕">
              <Icon name={settings.danmaku.enabled ? 'check' : 'close'} size={15} />
            </button>
          </div>
          {infoOpen && (
            <div className="player-info-popover">
              <div className="info-popover-head"><Icon name="info" size={16} /><strong>视频信息</strong></div>
              <dl>
                <div><dt>文件</dt><dd>{item?.fileName ?? '—'}</dd></div>
                <div><dt>容器</dt><dd>{item?.fileName.split('.').pop()?.toUpperCase() ?? '—'}</dd></div>
                <div><dt>分辨率</dt><dd className="mono">{infoWidth && infoHeight ? `${infoWidth}×${infoHeight}` : '—'}</dd></div>
                <div><dt>时长</dt><dd className="mono">{formatTime(duration)}</dd></div>
                <div><dt>大小</dt><dd className="mono">{item ? formatBytes(item.size) : '—'}</dd></div>
                <div><dt>平均码率</dt><dd className="mono">{item && duration ? `${(item.size * 8 / duration / 1000).toFixed(0)} kbps` : '—'}</dd></div>
                <div><dt>估算帧率</dt><dd className="mono">{estimatedFps ? `${estimatedFps} fps` : '—'}</dd></div>
                <div><dt>当前倍速</dt><dd className="mono">{playbackRate}×</dd></div>
              </dl>
            </div>
          )}
          {thumbSprite && thumbHover && duration > 0 && portalEl && createPortal(
            <div
              className="thumbnail-preview"
              style={{
                left: thumbHover.x,
                backgroundImage: `url(${thumbSprite.src})`,
                backgroundPosition: `-${Math.min(thumbSprite.count - 1, Math.max(0, Math.floor(thumbHover.time / duration * thumbSprite.count))) * 160}px 0`,
              }}
            />,
            portalEl
          )}
          {thumbHover && duration > 0 && portalEl && createPortal(
            <div
              className={`progress-time-tip${thumbSprite ? ' below' : ''}`}
              style={{ left: thumbHover.x }}
            >
              <span className="mono">{formatTime(thumbHover.time)}</span>
            </div>,
            portalEl
          )}
        </>
      )}
      {src && portalEl && createPortal(
        <div className="progress-clock" aria-hidden="true">
          <span className="mono">{formatClock(currentTime)}</span>
          <span className="mono">{formatClock(duration)}</span>
        </div>,
        portalEl
      )}
    </section>
  );
});
