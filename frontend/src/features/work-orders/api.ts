import { apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Paginated, WorkOrder } from "@/types/domain";

export interface WorkOrderListParams {
  branch_id?: string;
  status?: string;
  client_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface CreateWorkOrderPayload {
  branch_id: string;
  client_id: string;
  vehicle_id: string;
  reception_id?: string;
  diagnostic_id?: string;
  quote_id?: string;
  priority?: string;
  notes?: string;
}

export const workOrdersApi = {
  list: (params: WorkOrderListParams) => apiGet<Paginated<WorkOrder>>("/workshop/work-orders", params),
  counts: () => apiGet<Record<string, number>>("/workshop/work-orders/counts"),
  get: (id: string) => apiGet<WorkOrder>(`/workshop/work-orders/${id}`),
  create: (payload: CreateWorkOrderPayload) => apiPost<WorkOrder>("/workshop/work-orders", payload),
  update: (id: string, payload: Partial<CreateWorkOrderPayload>) =>
    apiPatch<WorkOrder>(`/workshop/work-orders/${id}`, payload),
  action: (id: string, action: string, notes?: string) =>
    apiPost<WorkOrder>(`/workshop/work-orders/${id}/action`, { action, notes }),
  addService: (id: string, payload: { service_id?: string; service_name: string; quantity?: number; price?: number; discount?: number }) =>
    apiPost<WorkOrder>(`/workshop/work-orders/${id}/services`, payload),
  addPart: (id: string, partId: string, quantity: number) =>
    apiPost<WorkOrder>(`/workshop/work-orders/${id}/parts`, { part_id: partId, quantity }),
  addLabor: (
    id: string,
    payload: { service_id?: string; hours: number; hourly_rate: number; discount?: number; notes?: string },
  ) => apiPost<WorkOrder>(`/workshop/work-orders/${id}/labor`, { work_order_id: id, ...payload }),
  addTechnician: (id: string, payload: { employee_id: string; role_in_job?: string; hours_worked?: number; notes?: string }) =>
    apiPost<WorkOrder>(`/workshop/work-orders/${id}/technicians`, payload),
};