import { apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Paginated, Quote, WorkOrder } from "@/types/domain";

export interface QuoteItemPayload {
  kind: "SERVICE" | "PART";
  service_id?: string;
  part_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface CreateQuotePayload {
  branch_id: string;
  client_id: string;
  vehicle_id?: string;
  work_order_id?: string;
  valid_until?: string;
  terms?: string;
  items: QuoteItemPayload[];
}

export interface QuoteListParams {
  status?: string;
  client_id?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export const quotesApi = {
  list: (params: QuoteListParams) => apiGet<Paginated<Quote>>("/quotes", params),
  get: (id: string) => apiGet<Quote>(`/quotes/${id}`),
  create: (payload: CreateQuotePayload) => apiPost<Quote>("/quotes", payload),
  update: (id: string, payload: { valid_until?: string; terms?: string }) => apiPatch<Quote>(`/quotes/${id}`, payload),
  approve: (id: string, notes?: string) => apiPost<Quote>(`/quotes/${id}/approve`, { notes }),
  reject: (id: string, notes?: string) => apiPost<Quote>(`/quotes/${id}/reject`, { notes }),
  send: (id: string) => apiPost<Quote>(`/quotes/${id}/send`, {}),
  convert: (id: string) => apiPost<WorkOrder>(`/quotes/${id}/convert`, {}),
};