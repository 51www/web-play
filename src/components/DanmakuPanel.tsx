import { useEffect, useMemo, useState } from 'react';
import type { DanmakuSettings } from '../types';
import type { Anime, DanmakuItem, Episode } from '../features/danmaku/types';
import { formatTime } from '../utils';
import { Icon } from './Icon';

interface SearchResults {
  animes: Anime[];
  episodes: Episode[];
}

interface DanmakuPanelProps {
  open: boolean;
  keyword: string;
  detectedEpisode?: number;
  status: string;
  busy: boolean;
  results: SearchResults | null;
  selectedAnimeId: string | null;
  selectedEpisodeId: string | null;
  settings: DanmakuSettings;
  items: DanmakuItem[];
  onSeek: (time: number) => void;
  onKeywordChange: (value: string) => void;
  onSearch: (keyword: string) => void;
  onQuickLoad: (keyword: string, episode?: number) => void;
  onSelectAnime: (anime: Anime) => void;
  onSelectEpisode: (episode: Episode) => void;
  onLoad: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onSettingsChange: (patch: Partial<DanmakuSettings>) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function DanmakuPanel({
  open,
  keyword,
  detectedEpisode,
  status,
  busy,
  results,
  selectedAnimeId,
  selectedEpisodeId,
  settings,
  items,
  onSeek,
  onKeywordChange,
  onSearch,
  onQuickLoad,
  onSelectAnime,
  onSelectEpisode,
  onLoad,
  onImport,
  onClear,
  onSettingsChange,
  onOpenSettings,
  onClose,
}: DanmakuPanelProps) {
  const [episode, setEpisode] = useState(detectedEpisode ?? 1);
  const [tab, setTab] = useState<'load' | 'list'>('load');
  const [listFilter, setListFilter] = useState('');
  const visibleItems = useMemo(() => {
    const keyword = listFilter.trim().toLowerCase();
    return [...items]
      .sort((a, b) => a.time - b.time)
      .filter((item) => !keyword || item.text.toLowerCase().includes(keyword))
      .slice(0, 600);
  }, [items, listFilter]);

  useEffect(() => {
    if (detectedEpisode) setEpisode(detectedEpisode);
  }, [detectedEpisode]);

  return (
    <div className={`drawer-backdrop${open ? ' open' : ''}`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="drawer" role="dialog" aria-label="弹幕调度台" aria-hidden={!open}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">DANMAKU / CONTROL</p>
            <h2>弹幕调度台</h2>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭"><Icon name="close" /></button>
        </header>

        <div className="drawer-tabs">
          <button className={tab === 'load' ? 'active' : ''} onClick={() => setTab('load')}>装填弹幕</button>
          <button className={tab === 'list' ? 'active' : ''} onClick={() => setTab('list')}>弹幕列表 <span className="mono">{items.length}</span></button>
        </div>

        {tab === 'load' ? <>
        <div className="status-strip mono"><span className={busy ? 'pulse' : ''} />{status}</div>

        <div className="field-block">
          <label>匹配关键词</label>
          <div className="search-line">
            <input
              value={keyword}
              placeholder="例如：葬送的芙莉莲 第1集"
              onChange={(event) => onKeywordChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSearch(keyword);
              }}
            />
            <button className="button primary" disabled={busy || !keyword.trim()} onClick={() => onSearch(keyword)}>
              <Icon name="search" size={17} /> 搜索
            </button>
          </div>
          <div className="field-row">
            <label>集数 <input type="number" min={1} value={episode} onChange={(event) => setEpisode(Number(event.target.value) || 1)} /></label>
            <button className="button quiet" disabled={busy || !keyword.trim()} onClick={() => onQuickLoad(keyword, episode)}>
              <Icon name="refresh" size={16} /> 一键装填
            </button>
          </div>
        </div>

        {results?.animes.length ? (
          <div className="field-block">
            <label>选择作品</label>
            <div className="chip-row">
              {results.animes.map((anime) => (
                <button
                  key={anime.id}
                  className={`chip${anime.id === selectedAnimeId ? ' active' : ''}`}
                  onClick={() => onSelectAnime(anime)}
                >{anime.title}</button>
              ))}
            </div>
          </div>
        ) : null}

        {results?.episodes.length ? (
          <div className="field-block episode-block">
            <label>选择剧集（已按集数优先匹配）</label>
            <div className="episode-list">
              {results.episodes.map((episodeItem) => (
                <button
                  key={episodeItem.id}
                  className={`episode-row${episodeItem.id === selectedEpisodeId ? ' active' : ''}`}
                  onClick={() => onSelectEpisode(episodeItem)}
                >
                  <span className="mono">{String(episodeItem.no ?? '—').padStart(2, '0')}</span>
                  <span>{episodeItem.title}</span>
                  <Icon name={episodeItem.id === selectedEpisodeId ? 'check' : 'play'} size={15} />
                </button>
              ))}
            </div>
            <button className="button primary wide" disabled={busy} onClick={onLoad}><Icon name="import" size={17} /> 加载选中弹幕</button>
          </div>
        ) : null}

        <div className="field-block">
          <label>弹幕样式</label>
          <div className="style-grid">
            <label className="switch-row">
              <span>显示弹幕</span>
              <input type="checkbox" checked={settings.enabled} onChange={(event) => onSettingsChange({ enabled: event.target.checked })} />
            </label>
            <label>字号 <input type="number" min={12} max={48} value={settings.fontSize} onChange={(event) => onSettingsChange({ fontSize: Number(event.target.value) || 25 })} /></label>
            <label>颜色 <input type="color" value={settings.color} onChange={(event) => onSettingsChange({ color: event.target.value })} /></label>
            <label>速度 <input type="number" min={4} max={16} value={settings.speed} onChange={(event) => onSettingsChange({ speed: Number(event.target.value) || 8 })} /></label>
            <label>行数 <input type="number" min={1} max={24} value={settings.maxLines} onChange={(event) => onSettingsChange({ maxLines: Number(event.target.value) || 8 })} /></label>
          </div>
          <label className="slider-field">
            透明度 <span className="mono">{settings.opacity.toFixed(2)}</span>
            <input type="range" min={0.2} max={1} step={0.05} value={settings.opacity} onChange={(event) => onSettingsChange({ opacity: Number(event.target.value) })} />
          </label>
          <label>屏蔽词（逗号或换行分隔）
            <textarea rows={2} value={settings.blockWords} placeholder="例如：剧透, 广告" onChange={(event) => onSettingsChange({ blockWords: event.target.value })} />
          </label>
        </div>

        <div className="drawer-actions">
          <label className="button quiet">
            <Icon name="import" size={16} /> 导入弹幕文件
            <input type="file" accept=".json,.xml,.txt" hidden onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = '';
            }} />
          </label>
          <button className="button quiet" onClick={onOpenSettings}><Icon name="settings" size={16} /> 更多设置</button>
          <button className="button quiet danger" onClick={onClear}><Icon name="trash" size={16} /> 清空</button>
        </div>
        </> : (
          <div className="field-block danmaku-list-block">
            <label>弹幕列表（点击跳转到对应时间）</label>
            <input value={listFilter} placeholder="筛选弹幕内容" onChange={(event) => setListFilter(event.target.value)} />
            {visibleItems.length ? (
              <div className="danmaku-list">
                {visibleItems.map((item, index) => (
                  <button key={`${item.time}-${index}`} className="danmaku-row" onClick={() => onSeek(item.time)}>
                    <span className="mono">{formatTime(item.time)}</span>
                    <span>{item.text}</span>
                    <Icon name="play" size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">没有匹配的弹幕。请先装填或导入弹幕。</p>
            )}
            {items.length > 600 && <p className="hint">仅显示按时间排序的前 600 条，可用关键词缩小范围。</p>}
          </div>
        )}
      </section>
    </div>
  );
}
