import { apiGet, apiPost, apiPatch, apiDelete } from "@/services/api/http";
import type { Movement, Paginated, Part, StockLevel } from "@/types/domain";

export interface PartListParams {
  q?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export const inventoryApi = {
  list: (params: PartListParams) => apiGet<Paginated<Part>>("/inventory/parts", params),
  get: (id: string) => apiGet<Part>(`/inventory/parts/${id}`),
  create: (payload: Partial<Part>) => apiPost<Part>("/inventory/parts", payload),
  update: (id: string, payload: Partial<Part>) => apiPatch<Part>(`/inventory/parts/${id}`, payload),
  remove: (id: string) => apiDelete<void>(`/inventory/parts/${id}`),
  lowStock: () => apiGet<Array<Record<string, unknown>>>("/inventory/low-stock"),
  movements: (id: string, params: { page?: number; page_size?: number }) =>
    apiGet<Paginated<Movement>>(`/inventory/parts/${id}/movements`, params),
  stock: (branchId: string, partId: string) => apiGet<StockLevel>(`/inventory/stock/${branchId}/${partId}`),
  adjust: (payload: { branch_id: string; part_id: string; new_quantity: number; reason?: string }) =>
    apiPost<StockLevel>("/inventory/stock/adjust", payload),
  transfer: (payload: { source_branch_id: string; target_branch_id: string; part_id: string; quantity: number; notes?: string }) =>
    apiPost<Record<string, unknown>>("/inventory/stock/transfer", payload),
};