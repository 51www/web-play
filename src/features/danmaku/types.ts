export type DanmakuMode = 'scroll' | 'top' | 'bottom';

export interface DanmakuItem {
  id: string;
  time: number;
  mode: DanmakuMode;
  color: string;
  fontSize: number;
  text: string;
}

export interface Anime {
  id: string;
  title: string;
  raw: Record<string, unknown>;
}

export interface Episode {
  id: string;
  title: string;
  no?: number;
  commentId?: string;
  url?: string;
  raw: Record<string, unknown>;
}

export interface CommentTarget {
  id?: string;
  url?: string;
}
