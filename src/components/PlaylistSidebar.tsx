import { useMemo, useState } from 'react';
import type { Playlist } from '../types';
import { formatBytes, formatTime, sortPlaylistItems } from '../utils';
import type { PlaylistSortKey } from '../utils';
import { Icon } from './Icon';

const folderInputProps = { webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>;

interface PlaylistSidebarProps {
  playlists: Playlist[];
  activePlaylistId: string | null;
  activeItemId: string | null;
  open: boolean;
  onToggle: () => void;
  onSwitchPlaylist: (id: string) => void;
  onCreatePlaylist: (name: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onSelectItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onReorder: (from: number, to: number) => void;
  onImport: (files: File[]) => void;
  onToggleFavorite: (id: string) => void;
}

export function PlaylistSidebar({
  playlists,
  activePlaylistId,
  activeItemId,
  open,
  onToggle,
  onSwitchPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onSelectItem,
  onRemoveItem,
  onRenameItem,
  onReorder,
  onImport,
  onToggleFavorite,
}: PlaylistSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<PlaylistSortKey>('default');
  const [filter, setFilter] = useState<'all' | 'favorite' | 'recent'>('all');
  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) ?? playlists[0];

  const visibleItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const now = Date.now();
    const matched = (activePlaylist?.items ?? [])
      .map((item, index) => ({ item, index, name: item.name, size: item.size, lastPlayedAt: item.lastPlayedAt }))
      .filter(({ item }) => {
        if (filter === 'favorite' && !item.favorite) return false;
        if (filter === 'recent' && (!item.lastPlayedAt || now - item.lastPlayedAt > 7 * 86400000)) return false;
        if (!keyword) return true;
        return `${item.name} ${item.fileName} ${(item.tags ?? []).join(' ')}`.toLowerCase().includes(keyword);
      });
    return sortPlaylistItems(matched, sortBy);
  }, [activePlaylist, query, sortBy, filter]);

  const submitCreate = () => {
    const name = draftName.trim();
    if (!name) return;
    onCreatePlaylist(name);
    setDraftName('');
    setCreating(false);
  };

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`}>
      <div className="sidebar-head">
        <div>
          <p className="eyebrow">COLLECTION</p>
          <h2>片单</h2>
        </div>
        <button className="icon-button only-mobile" onClick={onToggle} title="收起片单"><Icon name="close" /></button>
      </div>

      <div className="playlist-tabs">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            className={`playlist-tab${playlist.id === activePlaylist?.id ? ' active' : ''}`}
            onClick={() => onSwitchPlaylist(playlist.id)}
          >
            {playlist.name}
            <span>{playlist.items.length}</span>
          </button>
        ))}
        {creating ? (
          <div className="inline-create">
            <input
              autoFocus
              value={draftName}
              placeholder="片单名称"
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCreate();
                if (event.key === 'Escape') setCreating(false);
              }}
            />
            <button className="icon-button" onClick={submitCreate} title="创建"><Icon name="check" /></button>
          </div>
        ) : (
          <button className="ghost-button" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> 新建片单</button>
        )}
      </div>

      {activePlaylist && (
        <div className="playlist-tools">
          <button className="mini-button" onClick={() => {
            const name = window.prompt('重命名片单', activePlaylist.name);
            if (name?.trim()) onRenamePlaylist(activePlaylist.id, name.trim());
          }}><Icon name="edit" size={15} /> 重命名</button>
          <button className="mini-button danger" onClick={() => {
            if (window.confirm(`删除片单“${activePlaylist.name}”？本地视频引用也会被移除。`)) onDeletePlaylist(activePlaylist.id);
          }}><Icon name="trash" size={15} /> 删除</button>
        </div>
      )}

      <div className="playlist-filters">
        <input value={query} placeholder="搜索片名或标签" onChange={(event) => setQuery(event.target.value)} />
        <label className="sort-select" title="排序方式">
          <Icon name="sort" size={14} />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as PlaylistSortKey)}>
            <option value="default">默认顺序</option>
            <option value="name">按名称</option>
            <option value="episode">按集数</option>
            <option value="size">按大小</option>
            <option value="recent">最近播放</option>
          </select>
        </label>
      </div>
      <div className="filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
        <button className={filter === 'favorite' ? 'active' : ''} onClick={() => setFilter('favorite')}><Icon name="star" size={13} /> 收藏</button>
        <button className={filter === 'recent' ? 'active' : ''} onClick={() => setFilter('recent')}><Icon name="history" size={13} /> 最近</button>
      </div>

      <div className="item-list">
        {visibleItems.length ? visibleItems.map(({ item, index }) => (
          <div
            key={item.id}
            className={`playlist-item${item.id === activeItemId ? ' active' : ''}${dragIndex === index ? ' dragging' : ''}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            onClick={() => onSelectItem(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSelectItem(item.id);
              if (event.altKey && event.key === 'ArrowUp') onReorder(index, index - 1);
              if (event.altKey && event.key === 'ArrowDown') onReorder(index, index + 1);
            }}
          >
            <span className="grip" title="拖动排序"><Icon name="grip" size={16} /></span>
            <span className="item-index mono">{String(index + 1).padStart(2, '0')}</span>
            <div className="item-main">
              <strong
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  const name = window.prompt('重命名视频', item.name);
                  if (name?.trim()) onRenameItem(item.id, name.trim());
                }}
              >{item.name}</strong>
              <span className="mono item-meta">
                {formatBytes(item.size)}
                {item.duration ? ` · ${formatTime(item.duration)}` : ''}
                {item.progress && item.progress > 1 ? ' · 续播' : ''}
                {item.tags?.length ? ` · ${item.tags.join(' / ')}` : ''}
              </span>
            </div>
            <div className="item-actions" onClick={(event) => event.stopPropagation()}>
              <button
                className={`icon-button tiny${item.favorite ? ' favorite-active' : ''}`}
                onClick={() => onToggleFavorite(item.id)}
                title={item.favorite ? '取消收藏' : '收藏'}
              ><Icon name="star" size={14} /></button>
              <button className="icon-button tiny" onClick={() => onReorder(index, index - 1)} disabled={index === 0} title="上移"><Icon name="up" size={14} /></button>
              <button className="icon-button tiny" onClick={() => onReorder(index, index + 1)} disabled={index === activePlaylist.items.length - 1} title="下移"><Icon name="down" size={14} /></button>
              <button className="icon-button tiny danger" onClick={() => {
                if (window.confirm(`从片单移除“${item.name}”？`)) onRemoveItem(item.id);
              }} title="移除"><Icon name="trash" size={14} /></button>
            </div>
          </div>
        )) : (
          <div className="empty-list">
            <Icon name="list" size={26} />
            <p>这个片单还是空的</p>
            <label className="ghost-button">
              <Icon name="plus" size={16} /> 添加视频
              <input type="file" accept="video/*,.srt,.vtt" multiple hidden onChange={(event) => {
                if (event.target.files?.length) onImport(Array.from(event.target.files));
                event.target.value = '';
              }} />
            </label>
          </div>
        )}
      </div>

      <label className="sidebar-add">
        <Icon name="upload" size={17} />
        添加视频到当前片单
        <input type="file" accept="video/*,.srt,.vtt" multiple hidden onChange={(event) => {
          if (event.target.files?.length) onImport(Array.from(event.target.files));
          event.target.value = '';
        }} />
      </label>
      <label className="sidebar-add">
        <Icon name="folder" size={17} />
        导入整个文件夹（含同名字幕）
        <input type="file" multiple hidden {...folderInputProps} onChange={(event) => {
          if (event.target.files?.length) onImport(Array.from(event.target.files));
          event.target.value = '';
        }} />
      </label>
    </aside>
  );
}
