/**
 * Client-side CSV download (UTF-8 with BOM for Excel compatibility).
 * Rows may have varying column counts (e.g. section headers + data blocks).
 */
export function downloadCsvLines(filename: string, lines: string[][]): void {
  const bom = '\uFEFF';
  const esc = (cell: string) => {
    const s = String(cell ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = bom + lines.map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fixed-column CSV: first row is headers. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  downloadCsvLines(filename, [headers, ...rows]);
}
