import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { createXlsxBlob } from './xlsxUtils';

describe('xlsxUtils — createXlsxBlob', () => {
  it('should create a valid xlsx Blob', () => {
    const data = [
      { Name: 'Alice', Age: 30 },
      { Name: 'Bob', Age: 25 },
    ];
    const columns = ['Name', 'Age'];

    const blob = createXlsxBlob(data, columns);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should contain the correct data when parsed back', async () => {
    const data = [
      { Name: 'Alice', Age: 30, City: 'NYC' },
      { Name: 'Bob', Age: 25, City: 'LA' },
    ];
    const columns = ['Name', 'Age', 'City'];

    const blob = createXlsxBlob(data, columns);

    // Parse the blob back into a workbook
    const arrayBuffer = await blob.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    expect(workbook.SheetNames).toEqual(['Sheet1']);

    const sheet = workbook.Sheets['Sheet1'];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    expect(json).toHaveLength(2);
    expect(json[0]).toEqual({ Name: 'Alice', Age: 30, City: 'NYC' });
    expect(json[1]).toEqual({ Name: 'Bob', Age: 25, City: 'LA' });
  });

  it('should handle empty data', () => {
    const blob = createXlsxBlob([], ['A', 'B']);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should produce larger blob with more data', () => {
    const smallData = [{ A: 1 }];
    const largeData = Array.from({ length: 100 }, (_, i) => ({
      Name: `Person ${i}`,
      Age: 20 + i,
      City: `City ${i}`,
    }));

    const smallBlob = createXlsxBlob(smallData, ['A']);
    const largeBlob = createXlsxBlob(largeData, ['Name', 'Age', 'City']);

    expect(largeBlob.size).toBeGreaterThan(smallBlob.size);
  });

  it('should respect column order from the columns parameter', async () => {
    const data = [
      { B: 2, A: 1, C: 3 },
    ];
    // Explicitly specify column order
    const columns = ['A', 'B', 'C'];

    const blob = createXlsxBlob(data, columns);
    const arrayBuffer = await blob.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets['Sheet1'];

    // Check the header row matches our specified order
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('A,B,C');
  });

  it('should handle null/undefined cell values', async () => {
    const data = [
      { Name: 'Alice', Age: null, City: undefined },
    ];
    const columns = ['Name', 'Age', 'City'];

    const blob = createXlsxBlob(data as Record<string, unknown>[], columns);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
