/**
 * Gera CSV compatível com Excel em português: separador ';', BOM UTF-8 e CRLF.
 * Valores que começam com = + - @ (ou tab/CR) recebem um apóstrofo para evitar
 * injeção de fórmulas quando o arquivo é aberto em planilhas.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function escapeCell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
