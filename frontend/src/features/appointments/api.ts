import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Appointment } from "@/types/domain";

export const appointmentsApi = {
  day: (params: { day?: string; branch_id?: string }) => apiGet<Appointment[]>(`/workshop/appointments/day`, params),
  counts: () => apiGet<Record<string, number>>("/workshop/appointments/counts"),
  get: (id: string) => apiGet<Appointment>(`/workshop/appointments/${id}`),
  create: (payload: Partial<Appointment>) => apiPost<Appointment>("/workshop/appointments", payload),
  update: (id: string, payload: Partial<Appointment>) => apiPatch<Appointment>(`/workshop/appointments/${id}`, payload),
  remove: (id: string) => apiDelete<void>(`/workshop/appointments/${id}`),
};