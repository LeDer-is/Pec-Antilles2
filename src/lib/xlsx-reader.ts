import * as XLSX from 'xlsx';
import { trimHeader } from './utils';

/** Read first sheet of an Excel/CSV file as JSON rows with trimmed headers */
export async function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        let wb: XLSX.WorkBook;

        if (file.name.match(/\.csv$/i)) {
          // CSV: read as text, detect separator
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(result as ArrayBuffer);
          // Detect separator: if first line has more ; than , use ;
          const firstLine = text.split(/\r?\n/)[0] || '';
          const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
          wb = XLSX.read(text, { type: 'string', FS: sep, raw: false });
        } else {
          wb = XLSX.read(result, { type: 'array', cellDates: true });
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];

        // Trim all header keys (remove BOM, spaces)
        const cleaned = data.map(row => {
          const out: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(row)) {
            out[trimHeader(key)] = val;
          }
          return out;
        });

        resolve(cleaned);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsArrayBuffer(file);
  });
}
