export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(value: string): number | null {
  const match = value.trim().match(/(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millis = Number(match[4].padEnd(3, '0'));
  if (![hours, minutes, seconds, millis].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function parseSubtitle(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) continue;
    const times = lines[timeIndex].split('-->');
    if (times.length < 2) continue;

    const start = parseTimestamp(times[0]);
    const endMatch = times[1].trim().match(/^(\d{1,3}:\d{2}:\d{2}[,.]\d{1,3})/);
    const end = endMatch ? parseTimestamp(endMatch[1]) : null;
    if (start === null || end === null || end <= start) continue;

    const text = cleanText(lines.slice(timeIndex + 1).join('\n'));
    if (!text) continue;
    cues.push({ start, end, text });
  }

  return cues.sort((a, b) => a.start - b.start);
}
