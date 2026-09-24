import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Client, Paginated, Vehicle, VehicleHistory } from "@/types/domain";

export interface VehicleListParams {
  q?: string;
  client_id?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export const vehiclesApi = {
  list: (params: VehicleListParams) => apiGet<Paginated<Vehicle>>("/vehicles", params),
  get: (id: string) => apiGet<Vehicle>(`/vehicles/${id}`),
  create: (payload: Partial<Vehicle>) => apiPost<Vehicle>("/vehicles", payload),
  update: (id: string, payload: Partial<Vehicle>) => apiPatch<Vehicle>(`/vehicles/${id}`, payload),
  remove: (id: string) => apiDelete<void>(`/vehicles/${id}`),
  history: (id: string) => apiGet<VehicleHistory[]>(`/vehicles/${id}/history`),
  client: async (clientId: string): Promise<Client | null> => {
    try {
      return await apiGet<Client>(`/clients/${clientId}`);
    } catch {
      return null;
    }
  },
};