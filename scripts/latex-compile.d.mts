export interface LatexDiagnostic { message: string; file?: string; line: number; severity: 'warning' | 'error' }
export interface LatexCompileResult { success: boolean; pdfBase64?: string; log: string; diagnostics: LatexDiagnostic[]; steps: string[]; buildId?: string }
export function compileLatex(source: unknown, project?: unknown, keepBuild?: boolean): Promise<LatexCompileResult>;
export function syncLatex(query: unknown): Promise<{ page: number; x: number; y: number } | { file: string; line: number }>;
export function safeProjectPath(value: unknown): string;
export function normalizeProject(source: unknown, project?: unknown): unknown;
export function diagnostics(log: string): LatexDiagnostic[];
