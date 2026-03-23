import { describe, it, expect } from 'vitest';
import { splitCsvRow, parseCSV, serializeCSV, joinMultiValue } from '../src/csvUtils';

// ── splitCsvRow ───────────────────────────────────────────────

describe('splitCsvRow', () => {
  it('splits a simple row', () => {
    expect(splitCsvRow('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields containing commas', () => {
    expect(splitCsvRow('"hello, world",foo,bar')).toEqual(['hello, world', 'foo', 'bar']);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(splitCsvRow('"say ""hello""",next')).toEqual(['say "hello"', 'next']);
  });

  it('handles empty fields', () => {
    expect(splitCsvRow('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles a single field', () => {
    expect(splitCsvRow('only')).toEqual(['only']);
  });

  it('handles fully quoted field with no special chars', () => {
    expect(splitCsvRow('"quoted"')).toEqual(['quoted']);
  });
});

// ── parseCSV ──────────────────────────────────────────────────

describe('parseCSV', () => {
  it('parses a well-formed CSV string', () => {
    const csv = 'date,amount,spend_type\n2024-01-01,1200,monthly_fixed\n2024-02-01,95.50,actual_spend';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ date: '2024-01-01', amount: '1200', spend_type: 'monthly_fixed' });
    expect(rows[1]).toEqual({ date: '2024-02-01', amount: '95.50', spend_type: 'actual_spend' });
  });

  it('returns empty array when fewer than two lines', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('header only')).toEqual([]);
  });

  it('lowercases header names', () => {
    const csv = 'Date,Amount,Spend_Type\n2024-01-01,100,actual_spend';
    const rows = parseCSV(csv);
    expect(rows[0]).toHaveProperty('date');
    expect(rows[0]).toHaveProperty('amount');
    expect(rows[0]).toHaveProperty('spend_type');
  });

  it('trims whitespace from header and cell values', () => {
    const csv = ' date , amount \n 2024-01-01 , 100 ';
    const rows = parseCSV(csv);
    expect(rows[0]['date']).toBe('2024-01-01');
    expect(rows[0]['amount']).toBe('100');
  });

  it('handles CRLF line endings', () => {
    const csv = 'date,amount\r\n2024-01-01,100\r\n2024-02-01,200';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]['date']).toBe('2024-01-01');
  });

  it('handles CR-only line endings', () => {
    const csv = 'date,amount\r2024-01-01,100';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]['date']).toBe('2024-01-01');
  });

  it('ignores blank lines', () => {
    const csv = 'date,amount\n2024-01-01,100\n\n2024-02-01,200\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it('fills missing columns with empty string', () => {
    const csv = 'date,amount,description\n2024-01-01,100';
    const rows = parseCSV(csv);
    expect(rows[0]['description']).toBe('');
  });
});

// ── serializeCSV ──────────────────────────────────────────────

describe('serializeCSV', () => {
  it('produces a valid CSV with header and data rows', () => {
    const output = serializeCSV(
      ['date', 'amount', 'spend_type'],
      [
        ['2024-01-01', '1200', 'monthly_fixed'],
        ['2024-03-10', '94.80', 'actual_spend'],
      ],
    );
    const lines = output.split('\n').filter(l => l);
    expect(lines[0]).toBe('date,amount,spend_type');
    expect(lines[1]).toBe('2024-01-01,1200,monthly_fixed');
    expect(lines[2]).toBe('2024-03-10,94.80,actual_spend');
  });

  it('quotes cells that contain commas', () => {
    const output = serializeCSV(['description'], [['bread, milk']]);
    expect(output).toContain('"bread, milk"');
  });

  it('quotes cells that contain double-quotes and escapes them', () => {
    const output = serializeCSV(['note'], [['"hello"']]);
    expect(output).toContain('"""hello"""');
  });

  it('ends with a trailing newline', () => {
    const output = serializeCSV(['col'], [['val']]);
    expect(output.endsWith('\n')).toBe(true);
  });

  it('pipe-joins array cell values', () => {
    const output = serializeCSV(['tags'], [[['foo', 'bar', 'baz']]]);
    expect(output).toContain('foo|bar|baz');
  });
});

// ── joinMultiValue ────────────────────────────────────────────

describe('joinMultiValue', () => {
  it('joins values with pipe separator', () => {
    expect(joinMultiValue(['a', 'b', 'c'])).toBe('a|b|c');
  });

  it('returns single value unchanged', () => {
    expect(joinMultiValue(['only'])).toBe('only');
  });

  it('returns empty string for empty array', () => {
    expect(joinMultiValue([])).toBe('');
  });
});
