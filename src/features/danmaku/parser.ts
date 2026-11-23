import type { DanmakuItem, DanmakuMode } from './types';

type Row = Record<string, unknown>;

function asRow(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

function first(row: Row, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function colorFromDec(value: unknown): string {
  const dec = Number(value);
  if (!Number.isFinite(dec)) return '#ffffff';
  const clamped = Math.max(0, Math.min(0xffffff, Math.round(dec)));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}

function modeFrom(value: unknown): DanmakuMode {
  const raw = String(value ?? '').toLowerCase();
  if (raw === '4' || raw === 'bottom') return 'bottom';
  if (raw === '5' || raw === 'top') return 'top';
  return 'scroll';
}

function normalize(raw: unknown, index: number): DanmakuItem | null {
  let time = NaN;
  let mode: DanmakuMode = 'scroll';
  let color = '#ffffff';
  let fontSize = 25;
  let text = '';

  if (Array.isArray(raw)) {
    time = Number(raw[0]);
    mode = modeFrom(raw[1] ?? 1);
    fontSize = Number(raw[2]) || 25;
    color = colorFromDec(raw[3]);
    text = String(raw[4] ?? '').trim();
  } else {
    const row = asRow(raw);
    if (typeof row.p === 'string' && row.m !== undefined) {
      const parts = row.p.split(',');
      time = Number(parts[0]);
      mode = modeFrom(parts[1] ?? 1);
      if (parts.length >= 4) {
        fontSize = Number(parts[2]) || 25;
        color = colorFromDec(parts[3]);
      } else {
        color = colorFromDec(parts[2]);
      }
      text = String(row.m).trim();
    } else {
      time = Number(first(row, ['time', 't', 'begin', 'P', 'second']));
      mode = modeFrom(first(row, ['mode', 'type', 'position']));
      color = String(first(row, ['color', 'fontColor', 'font_color']) ?? color);
      if (!color.startsWith('#')) color = colorFromDec(color);
      fontSize = Number(first(row, ['fontSize', 'size', 'fontsize'])) || 25;
      text = String(first(row, ['text', 'content', 'comment']) ?? '').trim();
    }
  }

  if (!Number.isFinite(time) || time < 0 || !text) return null;
  if (text.length > 100) text = `${text.slice(0, 99)}…`;

  return {
    id: `dm-${index}-${Math.round(time * 1000)}`,
    time: Math.round(time * 1000) / 1000,
    mode,
    color,
    fontSize: Math.max(12, Math.min(48, fontSize)),
    text,
  };
}

function collectRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = asRow(payload);
  for (const key of ['comments', 'danmaku', 'data', 'list', 'items', 'results']) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  for (const value of Object.values(row)) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function parseDanmakuPayload(payload: unknown): DanmakuItem[] {
  return collectRows(payload)
    .map((row, index) => normalize(row, index))
    .filter((item): item is DanmakuItem => item !== null)
    .sort((a, b) => a.time - b.time);
}

export function parseImportedText(text: string): DanmakuItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return parseDanmakuPayload(JSON.parse(trimmed));
    } catch {
      throw new Error('JSON 弹幕文件解析失败');
    }
  }

  if (trimmed.startsWith('<')) {
    const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
    const nodes = Array.from(doc.querySelectorAll('p'));
    if (nodes.length && !doc.querySelector('parsererror')) {
      const rows: Row[] = nodes.map((node) => {
        const params = (node.textContent ?? '').split(',');
        const next = node.nextSibling?.nodeType === Node.TEXT_NODE ? node.nextSibling.textContent ?? '' : '';
        return {
          p: params.slice(0, 4).join(','),
          m: next.trim() || params.slice(5).join(','),
        };
      });
      const parsed = parseDanmakuPayload(rows);
      if (parsed.length) return parsed;
    }
    const loose: Row[] = [];
    const regex = /<p[^>]*>([^<]*)<\/p>([^<]*)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(trimmed))) {
      loose.push({ p: match[1], m: match[2].trim() });
    }
    const parsed = parseDanmakuPayload(loose);
    if (parsed.length) return parsed;
    throw new Error('XML 弹幕文件解析失败');
  }

  const rows = trimmed.split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split(',');
    return { p: parts.slice(0, 4).join(','), m: parts.slice(4).join(',') };
  });
  const parsed = parseDanmakuPayload(rows);
  if (!parsed.length) throw new Error('未识别的弹幕文件格式');
  return parsed;
}
