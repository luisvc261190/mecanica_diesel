import { apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Reception } from "@/types/domain";

export const receptionsApi = {
  list: (params: { branch_id?: string; client_id?: string; vehicle_id?: string; status?: string; page?: number; page_size?: number }) =>
    apiGet<{ items: Reception[]; total: number }>("/workshop/receptions", params),
  get: (id: string) => apiGet<Reception>(`/workshop/receptions/${id}`),
  create: (payload: Partial<Reception>) => apiPost<Reception>("/workshop/receptions", payload),
  update: (id: string, payload: Partial<Reception>) => apiPatch<Reception>(`/workshop/receptions/${id}`, payload),
};