import { apiDelete, apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Client, ClientContact, Paginated, Vehicle } from "@/types/domain";

export type ClientListParams = {
  q?: string;
  client_type?: string;
  page?: number;
  page_size?: number;
};

export const clientsApi = {
  list: (params: ClientListParams) => apiGet<Paginated<Client>>("/clients", params),
  get: (id: string) => apiGet<Client>(`/clients/${id}`),
  create: (payload: Partial<Client>) => apiPost<Client>("/clients", payload),
  update: (id: string, payload: Partial<Client>) => apiPatch<Client>(`/clients/${id}`, payload),
  remove: (id: string) => apiDelete<void>(`/clients/${id}`),
  vehicles: (id: string) => apiGet<Paginated<Vehicle>>(`/vehicles`, { client_id: id, page_size: 50 }),
  contacts: (id: string) => apiGet<ClientContact[]>(`/clients/${id}/contacts`),
  addContact: (id: string, payload: { full_name: string; phone?: string; email?: string; is_primary?: boolean; notes?: string }) =>
    apiPost<ClientContact>(`/clients/${id}/contacts`, payload),
  removeContact: (clientId: string, contactId: string) =>
    apiDelete<void>(`/clients/${clientId}/contacts/${contactId}`),
};