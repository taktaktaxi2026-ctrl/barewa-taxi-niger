/**
 * Écriture CSV pour Excel francophone : séparateur « ; », UTF-8 avec BOM,
 * champs contenant « ; », guillemets ou retours à la ligne correctement échappés.
 */

const SEPARATOR = ';';
const BOM = '\uFEFF';

export type CsvCell = string | number | boolean | null | undefined;

const escapeCell = (value: CsvCell): string => {
  if (value === null || value === undefined) return '';
  const raw =
    typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value);
  if (/[;"\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

/** Assemble un CSV complet (BOM inclus) à partir des en-têtes et des lignes. */
export const buildCsv = (headers: string[], rows: CsvCell[][]): string => {
  const lines = [headers.map(escapeCell).join(SEPARATOR)];
  rows.forEach((row) => lines.push(row.map(escapeCell).join(SEPARATOR)));
  return `${BOM}${lines.join('\r\n')}\r\n`;
};

/** Contenu CSV encodé en base64, prêt pour UploadBase64File. */
export const csvToBase64 = (csv: string): string =>
  Buffer.from(csv, 'utf8').toString('base64');
