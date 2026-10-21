import { describe, expect, it } from 'vitest';
import { escapeCell, toCsv } from './csv.js';

describe('CSV', () => {
  it('escapa separador, aspas e quebras de linha', () => {
    expect(escapeCell('a;b')).toBe('"a;b"');
    expect(escapeCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(escapeCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutraliza fórmulas em texto, mas não em números', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1");
    expect(escapeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCell(-5)).toBe('-5');
  });
  it('monta arquivo com BOM e CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, null]])).toBe('﻿a;b\r\n1;\r\n');
  });
});
