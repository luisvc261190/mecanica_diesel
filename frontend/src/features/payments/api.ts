import { apiGet, apiPost, apiPatch } from "@/services/api/http";
import type { Balance, Payment, Warranty } from "@/types/domain";

export interface RegisterPaymentPayload {
  work_order_id: string;
  branch_id?: string | null;
  amount: string | number;
  method: string;
  reference?: string;
  observation?: string;
}

export const paymentsApi = {
  listForWorkOrder: (workOrderId: string) => apiGet<Payment[]>(`/payments/work-orders/${workOrderId}`),
  balance: (workOrderId: string) => apiGet<Balance>(`/payments/balance/${workOrderId}`),
  register: (payload: RegisterPaymentPayload) => apiPost<Payment>("/payments", payload),
  reverse: (paymentId: string) => apiPost<void>(`/payments/${paymentId}/reverse`),
  warranties: (workOrderId: string) => apiGet<Warranty[]>(`/payments/warranties/${workOrderId}`),
  createWarranty: (payload: {
    work_order_id: string;
    vehicle_id: string;
    client_id: string;
    start_date?: string;
    end_date?: string;
    max_odometer?: number;
    conditions?: string;
    status?: string;
  }) => apiPost<Warranty>("/payments/warranties", payload),
  updateWarranty: (id: string, payload: Partial<Warranty>) => apiPatch<Warranty>(`/payments/warranties/${id}`, payload),
};