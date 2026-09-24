import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

const CURRENCY_CODE = "PEN";

/** Formatea montos en soles peruanos: S/ 1,250.00 */
export function formatCurrency(value: number | string, currency: string = CURRENCY_CODE): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(amount)) return "—";

  const formatted = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return currency === "PEN" ? formatted.replace("S/", "S/ ") : formatted.replace(/\s/g, " ");
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-PE").format(n);
}

export function formatInteger(value: number | string | null | undefined): string {
  return formatNumber(value);
}

/** ISO → fecha corta: 22 sep 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "d MMM yyyy", { locale: es });
}

/** ISO → fecha + hora: 22 sep 2026, 10:30 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return format(d, "d MMM yyyy, HH:mm", { locale: es });
}

/** Relativo amigable: Hoy, Ayer, hace 3 días */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isToday(d)) return `Hoy, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Ayer, ${format(d, "HH:mm")}`;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

/** Normaliza una placa: ABC-123 */
export function formatPlate(value: string | null | undefined): string {
  if (!value) return "—";
  const upper = value.toUpperCase().replace(/\s+/g, "");
  const match = upper.match(/^([A-Z0-9]{0,3})-?([0-9]{0,3})/);
  if (!match) return upper;
  const [, letters = "", digits = ""] = match;
  if (!digits) return letters;
  return `${letters}-${digits}`;
}

export function formatHours(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("es-PE")}%`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toLocaleString("es-PE", { maximumFractionDigits: 1 })} ${units[i]}`;
}