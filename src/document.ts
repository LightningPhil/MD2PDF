export type Preset = 'simple' | 'technical' | 'academic' | 'notes' | 'custom';
export interface DocumentSettings {
  preset: Preset;
  fontFamily: 'serif' | 'sans';
  headingFamily: 'serif' | 'sans';
  fontSize: number;
  lineHeight: number;
  spacing: number;
  margin: number;
  pageSize: 'a4' | 'letter' | 'legal' | 'tabloid' | 'a3';
  accent: string;
  titlePage: boolean;
  title: string;
  subtitle: string;
  author: string;
  date: string;
  header: string;
  footer: string;
  pageNumbers: 'none' | 'number' | 'total';
  toc: boolean;
  numberEquations: boolean;
}
export const DEFAULT_SETTINGS: DocumentSettings = {
  preset: 'simple', fontFamily: 'serif', headingFamily: 'serif', fontSize: 12,
  lineHeight: 1.6, spacing: 1, margin: 20, pageSize: 'a4', accent: '#2463a6',
  titlePage: false, title: '', subtitle: '', author: '', date: '', header: '', footer: '',
  pageNumbers: 'number', toc: false, numberEquations: false,
};
export const PRESETS: Record<Exclude<Preset, 'custom'>, Partial<DocumentSettings>> = {
  simple: { fontFamily: 'serif', headingFamily: 'serif', fontSize: 12, lineHeight: 1.6, spacing: 1, margin: 20, accent: '#2463a6' },
  technical: { fontFamily: 'sans', headingFamily: 'sans', fontSize: 14, lineHeight: 1.5, spacing: .85, margin: 20, accent: '#245a81' },
  academic: { fontFamily: 'serif', headingFamily: 'serif', fontSize: 16, lineHeight: 1.8, spacing: 1, margin: 25.4, accent: '#343434' },
  notes: { fontFamily: 'sans', headingFamily: 'sans', fontSize: 14, lineHeight: 1.65, spacing: 1.1, margin: 15, accent: '#537149' },
};
const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export function normalizeSettings(value: unknown): DocumentSettings {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_SETTINGS };
  for (const key of ['title', 'subtitle', 'author', 'date', 'header', 'footer'] as const) if (typeof raw[key] === 'string') result[key] = raw[key].slice(0, 500);
  for (const key of ['titlePage', 'toc', 'numberEquations'] as const) if (typeof raw[key] === 'boolean') result[key] = raw[key];
  if (['simple', 'technical', 'academic', 'notes', 'custom'].includes(String(raw.preset))) result.preset = raw.preset as Preset;
  for (const key of ['fontFamily', 'headingFamily'] as const) if (raw[key] === 'serif' || raw[key] === 'sans') result[key] = raw[key];
  result.fontSize = bounded(raw.fontSize, result.fontSize, 10, 20);
  result.lineHeight = bounded(raw.lineHeight, result.lineHeight, 1.2, 2.2);
  result.spacing = bounded(raw.spacing, result.spacing, .5, 1.8);
  result.margin = bounded(raw.margin, result.margin, 15, 30);
  if (['a4', 'letter', 'legal', 'tabloid', 'a3'].includes(String(raw.pageSize))) result.pageSize = raw.pageSize as DocumentSettings['pageSize'];
  if (['none', 'number', 'total'].includes(String(raw.pageNumbers))) result.pageNumbers = raw.pageNumbers as DocumentSettings['pageNumbers'];
  if (typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent)) result.accent = raw.accent;
  return result;
}
const metadata = /^<!-- md2pdf:([^\n]+) -->\r?\n(?:\r?\n)?/;
export function decodeDocument(text: string): { content: string; settings: DocumentSettings; hasSettings: boolean } {
  const match = metadata.exec(text);
  if (match) {
    try { return { content: text.slice(match[0].length), settings: normalizeSettings(JSON.parse(match[1])), hasSettings: true }; } catch { /* Keep unrecognized source intact. */ }
  }
  return { content: text, settings: { ...DEFAULT_SETTINGS }, hasSettings: false };
}
export function encodeDocument(content: string, settings: DocumentSettings): string {
  const json = JSON.stringify(normalizeSettings(settings)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!-- md2pdf:${json} -->\n\n${content}`;
}
export function applyDocumentStyle(settings: DocumentSettings): void {
  const style = document.documentElement.style;
  style.setProperty('--document-font', settings.fontFamily === 'sans' ? 'Arial, Helvetica, sans-serif' : 'Georgia, "Times New Roman", serif');
  style.setProperty('--document-heading-font', settings.headingFamily === 'sans' ? 'Arial, Helvetica, sans-serif' : 'Georgia, "Times New Roman", serif');
  style.setProperty('--document-leading', String(settings.lineHeight));
  style.setProperty('--document-spacing', `${settings.spacing}em`);
  style.setProperty('--document-accent', settings.accent);
  style.setProperty('--page-font-size', `${settings.fontSize}px`);
  style.setProperty('--page-margin', `${settings.margin}mm`);
  document.documentElement.dataset.documentPreset = settings.preset;
}
export const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const validLabel = (value: string) => /^(?:eq|fig|tab):[a-zA-Z0-9][\w:-]*$/.test(value);
