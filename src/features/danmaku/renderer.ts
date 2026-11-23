import { isDanmakuBlocked } from '../../utils';
import type { DanmakuSettings } from '../../types';
import type { DanmakuItem, DanmakuMode } from './types';

interface ActiveDanmaku {
  el: HTMLDivElement;
  born: number;
  duration: number;
  width: number;
  mode: DanmakuMode;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
}

export interface DanmakuSnapshotItem {
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
  x: number;
  y: number;
  mode: DanmakuMode;
}

export interface DanmakuSnapshot {
  time: number;
  width: number;
  height: number;
  items: DanmakuSnapshotItem[];
}

interface RendererOptions {
  container: HTMLElement;
  getVideo: () => HTMLVideoElement | null;
  getItems: () => DanmakuItem[];
  getSettings: () => DanmakuSettings;
}

export class DanmakuRenderer {
  private container: HTMLElement;
  private getVideo: () => HTMLVideoElement | null;
  private getItems: () => DanmakuItem[];
  private getSettings: () => DanmakuSettings;
  private active: ActiveDanmaku[] = [];
  private scrollLanes: number[] = [];
  private topLanes: number[] = [];
  private bottomLanes: number[] = [];
  private index = 0;
  private raf = 0;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private observer: ResizeObserver;

  constructor(options: RendererOptions) {
    this.container = options.container;
    this.getVideo = options.getVideo;
    this.getItems = options.getItems;
    this.getSettings = options.getSettings;
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this.container);
    this.measure();
  }

  start(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  reset(): void {
    this.active.forEach((item) => item.el.remove());
    this.active = [];
    this.scrollLanes = [];
    this.topLanes = [];
    this.bottomLanes = [];
    this.index = 0;
    this.lastTime = this.getVideo()?.currentTime || 0;
  }

  getSnapshot(): DanmakuSnapshot {
    return {
      time: this.getVideo()?.currentTime || 0,
      width: this.width,
      height: this.height,
      items: this.active.map((item) => ({
        text: item.text,
        color: item.color,
        fontSize: item.fontSize,
        opacity: item.opacity,
        x: item.x,
        y: item.y,
        mode: item.mode,
      })),
    };
  }

  destroy(): void {
    this.stop();
    this.observer.disconnect();
    this.reset();
  }

  private measure(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const video = this.getVideo();
    if (!video) return;
    const settings = this.getSettings();
    if (!settings.enabled) {
      if (this.active.length) this.reset();
      return;
    }
    const time = video.currentTime || 0;
    if (time < this.lastTime - 0.5) this.reset();
    this.lastTime = time;
    if (video.paused || video.ended) return;
    this.emit(time, settings);
    this.update(time, settings);
  };

  private laneCount(settings: DanmakuSettings): number {
    const lineHeight = Math.max(18, settings.fontSize * 1.35);
    const top = this.height * (settings.topMargin / 100);
    const bottom = this.height * (1 - settings.bottomMargin / 100);
    const usable = Math.max(lineHeight, bottom - top);
    return Math.max(1, Math.min(settings.maxLines, Math.floor(usable / lineHeight)));
  }

  private laneTop(lane: number, mode: DanmakuMode, settings: DanmakuSettings): number {
    const lineHeight = Math.max(18, settings.fontSize * 1.35);
    const top = this.height * (settings.topMargin / 100);
    const bottom = this.height * (1 - settings.bottomMargin / 100);
    if (mode === 'bottom') return bottom - (lane + 1) * lineHeight;
    return top + lane * lineHeight;
  }

  private pickLane(mode: DanmakuMode, time: number, duration: number, textWidth: number, settings: DanmakuSettings): number {
    const count = this.laneCount(settings);
    const lanes = mode === 'scroll' ? this.scrollLanes : mode === 'top' ? this.topLanes : this.bottomLanes;
    while (lanes.length < count) lanes.push(0);
    let lane = 0;
    let earliest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < count; i += 1) {
      if (lanes[i] <= time) {
        lane = i;
        break;
      }
      if (lanes[i] < earliest) {
        earliest = lanes[i];
        lane = i;
      }
    }
    const occupancy = this.width > 0 ? (textWidth + 48) / (this.width + textWidth) : 0.6;
    lanes[lane] = time + (mode === 'scroll' ? duration * Math.min(0.95, occupancy) : duration);
    return lane;
  }

  private emit(time: number, settings: DanmakuSettings): void {
    const items = this.getItems();
    while (this.index < items.length && items[this.index].time <= time) {
      const item = items[this.index];
      this.index += 1;
      if (settings.enabled === false) return;
      if (isDanmakuBlocked(item.text, settings.blockWords)) continue;
      if (time - item.time > settings.speed + 1) continue;
      if (this.active.length >= 400) break;

      const el = document.createElement('div');
      const color = settings.color || item.color;
      const fontSize = settings.fontSize || item.fontSize;
      el.className = 'dm-item';
      el.textContent = item.text;
      el.style.color = color;
      el.style.fontSize = `${fontSize}px`;
      el.style.opacity = String(settings.opacity);
      el.style.top = '0px';
      el.style.transform = 'translate3d(-9999px,0,0)';
      this.container.appendChild(el);
      const textWidth = el.offsetWidth;
      const y = this.laneTop(this.pickLane(item.mode, time, settings.speed, textWidth, settings), item.mode, settings);
      el.style.top = `${y}px`;
      this.active.push({
        el,
        born: time,
        duration: settings.speed,
        width: textWidth,
        mode: item.mode,
        x: -9999,
        y,
        text: item.text,
        color,
        fontSize,
        opacity: settings.opacity,
      });
    }
  }

  private update(time: number, settings: DanmakuSettings): void {
    this.active = this.active.filter((item) => {
      const progress = (time - item.born) / item.duration;
      if (progress >= 1) {
        item.el.remove();
        return false;
      }
      if (item.mode === 'scroll') {
        const x = this.width - progress * (this.width + item.width);
        item.x = x;
        item.el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      } else {
        const x = Math.max(0, (this.width - item.width) / 2);
        item.x = x;
        item.opacity = settings.opacity * Math.min(1, (1 - progress) * 5);
        item.el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
        item.el.style.opacity = String(item.opacity);
      }
      return true;
    });
  }
}
