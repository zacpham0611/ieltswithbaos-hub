import type { ChartType } from '../components/WritingImportModal';

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  rawTableText: string;
}

/**
 * Extracts Markdown table lines (| Col 1 | Col 2 |) from prompt text
 */
export function extractMarkdownTable(text: string): ParsedTable | null {
  if (!text) return null;
  const lines = text.split('\n');
  const tableLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
      tableLines.push(trimmed);
    }
  }

  if (tableLines.length < 2) return null;

  const rawTableText = tableLines.join('\n');
  const parsedRows: string[][] = [];

  for (const tLine of tableLines) {
    // Check if separator line (|---|---|)
    const inner = tLine.replace(/^\||\|$/g, '').trim();
    if (/^[:\s|-]+$/.test(inner)) continue;

    const cells = tLine
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length > 0) {
      parsedRows.push(cells);
    }
  }

  if (parsedRows.length === 0) return null;

  const headers = parsedRows[0];
  const rows = parsedRows.slice(1);

  return { headers, rows, rawTableText };
}

/**
 * Strips markdown table from prompt text so it doesn't repeat awkwardly below the visual
 */
export function stripMarkdownTableFromPrompt(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const nonTableLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      continue;
    }
    nonTableLines.push(line);
  }
  return nonTableLines.join('\n').trim();
}

/**
 * Determines the effective chart type based on explicit type or text clues
 */
export function detectChartType(
  explicitType?: string,
  prompt?: string,
  hasTable?: boolean
): ChartType {
  if (explicitType) {
    const normalized = explicitType.toLowerCase();
    if (normalized.includes('line')) return 'Line Graph';
    if (normalized.includes('bar') || normalized.includes('column')) return 'Bar Chart';
    if (normalized.includes('pie')) return 'Pie Chart';
    if (normalized.includes('table')) return 'Table';
    if (normalized.includes('process') || normalized.includes('diagram') || normalized.includes('cycle'))
      return 'Process / Diagram';
    if (normalized.includes('map') || normalized.includes('plan')) return 'Map';
    if (normalized.includes('mix')) return 'Mixed Charts';
  }

  const pLower = (prompt || '').toLowerCase();
  if (pLower.includes('line graph') || pLower.includes('lines graph')) return 'Line Graph';
  if (pLower.includes('bar chart') || pLower.includes('column chart')) return 'Bar Chart';
  if (pLower.includes('pie chart')) return 'Pie Chart';
  if (pLower.includes('process') || pLower.includes('flow chart') || pLower.includes('life cycle') || pLower.includes('stages'))
    return 'Process / Diagram';
  if (pLower.includes('map') || pLower.includes('maps') || pLower.includes('plan')) return 'Map';
  if ((pLower.includes('chart') && pLower.includes('table')) || pLower.includes('mixed')) return 'Mixed Charts';
  if (hasTable || pLower.includes('table')) return 'Table';

  return hasTable ? 'Table' : 'Bar Chart';
}
