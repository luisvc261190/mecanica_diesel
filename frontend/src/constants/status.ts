import type { BadgeProps } from "@/components/ui/badge";
import type { ComponentType } from "react";
import {
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  PauseCircle,
  SearchCheck,
  UserCheck,
  PackageSearch,
  XCircle,
  FileText,
  Send,
  CheckCheck,
  X,
  CalendarClock,
  CircleDashed,
  Ban,
  HandCoins,
  ScanSearch,
  Zap,
  Disc3,
  Car,
  Droplets,
  Eye,
  type LucideProps,
} from "lucide-react";

export type BadgeTone = NonNullable<BadgeProps["variant"]>;

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  icon: ComponentType<LucideProps>;
}

export const WORK_ORDER_STATUS: Record<string, StatusMeta> = {
  RECEIVED: { label: "Recepcionado", tone: "info", icon: ClipboardCheck },
  DIAGNOSIS: { label: "En diagnóstico", tone: "info", icon: SearchCheck },
  QUOTED: { label: "Cotizado", tone: "secondary", icon: FileText },
  WAITING_APPROVAL: { label: "En espera de aprobación", tone: "warning", icon: AlertTriangle },
  APPROVED: { label: "Aprobado", tone: "success", icon: CheckCircle2 },
  IN_PROGRESS: { label: "En reparación", tone: "primary", icon: Wrench },
  WAITING_PARTS: { label: "Esperando repuestos", tone: "warning", icon: PackageSearch },
  PAUSED: { label: "Pausado", tone: "secondary", icon: PauseCircle },
  QUALITY_CONTROL: { label: "Control de calidad", tone: "info", icon: Gauge },
  COMPLETED: { label: "Completado", tone: "success", icon: CheckCircle2 },
  READY_FOR_PICKUP: { label: "Listo para entrega", tone: "success", icon: UserCheck },
  DELIVERED: { label: "Entregado", tone: "default", icon: CheckCheck },
  CANCELLED: { label: "Cancelada", tone: "destructive", icon: XCircle },
};

/** Orden canónico del flujo del taller (para stepper y dashboard). */
export const WORK_ORDER_FLOW = [
  "RECEIVED",
  "DIAGNOSIS",
  "QUOTED",
  "WAITING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "QUALITY_CONTROL",
  "COMPLETED",
  "READY_FOR_PICKUP",
  "DELIVERED",
] as const;

/** Acciones permitidas por estado (espejo del backend _STATUS_ACTIONS). */
export const WORK_ORDER_ACTIONS: Record<string, Array<{ action: string; label: string }>> = {
  RECEIVED: [
    { action: "start", label: "Iniciar trabajo" },
    { action: "request_approval", label: "Solicitar aprobación" },
    { action: "cancel", label: "Cancelar orden" },
  ],
  DIAGNOSIS: [
    { action: "start", label: "Iniciar trabajo" },
    { action: "request_approval", label: "Solicitar aprobación" },
    { action: "cancel", label: "Cancelar orden" },
  ],
  QUOTED: [
    { action: "approve", label: "Aprobar" },
    { action: "start", label: "Iniciar trabajo" },
    { action: "request_approval", label: "Solicitar aprobación" },
    { action: "cancel", label: "Cancelar orden" },
  ],
  WAITING_APPROVAL: [
    { action: "approve", label: "Aprobar" },
    { action: "start", label: "Iniciar trabajo" },
    { action: "cancel", label: "Cancelar orden" },
  ],
  APPROVED: [
    { action: "start", label: "Iniciar trabajo" },
    { action: "cancel", label: "Cancelar orden" },
  ],
  IN_PROGRESS: [
    { action: "wait_parts", label: "Esperar repuestos" },
    { action: "pause", label: "Pausar" },
    { action: "quality_control", label: "Enviar a control de calidad" },
    { action: "complete", label: "Completar" },
  ],
  WAITING_PARTS: [
    { action: "resume_parts", label: "Reanudar (llegaron repuestos)" },
    { action: "pause", label: "Pausar" },
    { action: "quality_control", label: "Enviar a control de calidad" },
    { action: "complete", label: "Completar" },
  ],
  PAUSED: [{ action: "resume", label: "Reanudar" }],
  QUALITY_CONTROL: [
    { action: "start", label: "Volver a reparación" },
    { action: "complete", label: "Completar" },
  ],
  COMPLETED: [{ action: "ready", label: "Marcar listo para entrega" }],
  READY_FOR_PICKUP: [{ action: "deliver", label: "Entregar vehículo" }],
  DELIVERED: [],
  CANCELLED: [],
};

export const WORK_ORDER_PRIORITY: Record<string, StatusMeta> = {
  LOW: { label: "Baja", tone: "secondary", icon: Clock },
  NORMAL: { label: "Normal", tone: "info", icon: CircleDashed },
  HIGH: { label: "Alta", tone: "warning", icon: AlertTriangle },
  URGENT: { label: "Urgente", tone: "destructive", icon: XCircle },
};

export const QUOTE_STATUS: Record<string, StatusMeta> = {
  DRAFT: { label: "Borrador", tone: "secondary", icon: FileText },
  SENT: { label: "Enviada", tone: "info", icon: Send },
  APPROVED: { label: "Aprobada", tone: "success", icon: CheckCheck },
  REJECTED: { label: "Rechazada", tone: "destructive", icon: X },
  EXPIRED: { label: "Vencida", tone: "muted", icon: CalendarClock },
  CONVERTED: { label: "Convertida", tone: "primary", icon: Wrench },
};

export const APPOINTMENT_STATUS: Record<string, StatusMeta> = {
  SCHEDULED: { label: "Programada", tone: "info", icon: CalendarClock },
  CONFIRMED: { label: "Confirmada", tone: "primary", icon: CheckCircle2 },
  ARRIVED: { label: "Llegó", tone: "success", icon: UserCheck },
  COMPLETED: { label: "Completada", tone: "default", icon: CheckCheck },
  CANCELLED: { label: "Cancelada", tone: "destructive", icon: XCircle },
  NO_SHOW: { label: "Inasistencia", tone: "warning", icon: X },
};

export const RECEPTION_STATUS: Record<string, StatusMeta> = {
  OPEN: { label: "Abierta", tone: "info", icon: ClipboardCheck },
  IN_DIAGNOSIS: { label: "En diagnóstico", tone: "info", icon: SearchCheck },
  DIAGNOSED: { label: "Diagnosticada", tone: "primary", icon: CheckCircle2 },
  DONE: { label: "Finalizada", tone: "default", icon: CheckCheck },
  CANCELLED: { label: "Cancelada", tone: "destructive", icon: XCircle },
};

export const PAYMENT_STATUS: Record<string, StatusMeta> = {
  PENDING: { label: "Pendiente", tone: "warning", icon: Clock },
  COMPLETED: { label: "Pagado", tone: "success", icon: CheckCircle2 },
  REVERSED: { label: "Reversado", tone: "destructive", icon: XCircle },
  FAILED: { label: "Fallido", tone: "destructive", icon: X },
};

export const PART_STATUS: Record<string, StatusMeta> = {
  ACTIVE: { label: "Activo", tone: "success", icon: CheckCircle2 },
  INACTIVE: { label: "Inactivo", tone: "muted", icon: X },
};

export const WARRANTY_STATUS: Record<string, StatusMeta> = {
  ACTIVE: { label: "Activa", tone: "success", icon: CheckCircle2 },
  USED: { label: "Usada", tone: "primary", icon: Wrench },
  EXPIRED: { label: "Vencida", tone: "muted", icon: CalendarClock },
  CANCELLED: { label: "Cancelada", tone: "destructive", icon: Ban },
};

export const CLAIM_STATUS: Record<string, StatusMeta> = {
  OPEN: { label: "Abierta", tone: "warning", icon: AlertTriangle },
  REJECTED: { label: "Rechazada", tone: "destructive", icon: X },
  APPROVED: { label: "Aprobada", tone: "success", icon: CheckCircle2 },
  IN_REPAIR: { label: "En reparación", tone: "info", icon: Wrench },
  RESOLVED: { label: "Resuelta", tone: "default", icon: CheckCheck },
};

export const MOVEMENT_TYPE: Record<string, StatusMeta> = {
  PURCHASE: { label: "Compra", tone: "success", icon: HandCoins },
  SALE: { label: "Venta", tone: "info", icon: HandCoins },
  WORK_ORDER_USAGE: { label: "Uso en OT", tone: "primary", icon: Wrench },
  RETURN: { label: "Devolución", tone: "success", icon: CheckCircle2 },
  ADJUSTMENT: { label: "Ajuste", tone: "warning", icon: Gauge },
  TRANSFER: { label: "Transferencia", tone: "info", icon: PackageSearch },
  INITIAL_STOCK: { label: "Stock inicial", tone: "secondary", icon: ClipboardCheck },
};

export const PAYMENT_METHOD: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  YAPE: "Yape",
  PLIN: "Plin",
  OTRO: "Otro",
};

export const DOC_TYPE: Record<string, string> = {
  DNI: "DNI",
  CE: "Carné de extranjería",
  RUC: "RUC",
  PASSPORT: "Pasaporte",
};

export const SEVERITY: Record<string, StatusMeta> = {
  LOW: { label: "Baja", tone: "secondary", icon: Clock },
  MEDIUM: { label: "Media", tone: "warning", icon: AlertTriangle },
  HIGH: { label: "Alta", tone: "destructive", icon: AlertTriangle },
  CRITICAL: { label: "Crítica", tone: "destructive", icon: XCircle },
};

export const DIAGNOSTIC_RESOLUTION_STATUS: Record<string, StatusMeta> = {
  UNRESOLVED: { label: "Sin resolver", tone: "warning", icon: AlertTriangle },
  PARTIAL: { label: "Parcial", tone: "info", icon: Clock },
  RESOLVED: { label: "Resuelto", tone: "success", icon: CheckCircle2 },
};

export const DIAGNOSTIC_TEST_TYPE: Record<string, StatusMeta> = {
  SCAN: { label: "Escaner DTC", tone: "default", icon: ScanSearch },
  COMPRESSION: { label: "Compresion", tone: "default", icon: Gauge },
  ELECTRICAL: { label: "Prueba electrica", tone: "default", icon: Zap },
  BRAKES: { label: "Prueba de frenos", tone: "default", icon: Disc3 },
  SUSPENSION: { label: "Inspeccion suspension", tone: "default", icon: Car },
  FLUID: { label: "Revision de fluidos", tone: "default", icon: Droplets },
  VISUAL: { label: "Inspeccion visual", tone: "default", icon: Eye },
  ROAD: { label: "Prueba de ruta", tone: "default", icon: Gauge },
  OTHER: { label: "Otra", tone: "default", icon: ClipboardCheck },
};