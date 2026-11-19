export interface SubscriberCsvRow {
  email: string;
  locale: string;
  status: string;
  created_at: string;
}

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV cell per RFC 4180 and neutralizes spreadsheet
 * formula injection (=, +, -, @, tab, CR prefixes).
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const neutralized = FORMULA_TRIGGER.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

/**
 * Builds a UTF-8 BOM CSV export for newsletter subscribers.
 */
export function buildSubscribersCsv(rows: SubscriberCsvRow[]): string {
  const header = ["email", "locale", "status", "subscribed_at"].join(",");
  const lines = rows.map((row) =>
    [
      escapeCsvCell(row.email),
      escapeCsvCell(row.locale),
      escapeCsvCell(row.status),
      escapeCsvCell(row.created_at),
    ].join(",")
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}
