// Hand-rolled CSV utilities — no dependency needed for an RFC-4180 subset.
// Shared by the report exports (toCsv/csvResponse) and the product importer
// (parseCsv).

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Formula-injection guard: Excel executes cells starting with = + - @.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

// BOM so Excel opens UTF-8 correctly; attachment disposition so plain
// <a href> links download (session cookies ride along on same-origin GETs).
export function csvResponse(filename: string, csv: string): Response {
  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// RFC-4180 subset parser: quoted fields, "" escapes, CRLF/LF, BOM strip.
// Returns rows of raw string cells; blank lines are skipped.
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}
