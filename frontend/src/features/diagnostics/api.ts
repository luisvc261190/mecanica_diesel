import { apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Diagnostic, DiagnosticTest, Finding } from "@/types/domain";

export interface DiagnosticCreateInput {
  branch_id?: string;
  vehicle_id: string;
  reception_id?: string;
  work_order_id?: string;
  summary?: string;
  recommendations?: string;
  resolution_status?: string;
}

export interface FindingCreateInput {
  area?: string;
  symptom?: string;
  description: string;
  probable_cause?: string;
  confirmed_cause?: string;
  is_confirmed?: boolean;
  severity?: string;
  fault_code_ids?: string[];
  resolution?: string;
}

export const diagnosticsApi = {
  get: (id: string) => apiGet<Diagnostic>(`/workshop/diagnostics/${id}`),
  create: (payload: DiagnosticCreateInput) => apiPost<Diagnostic>("/workshop/diagnostics", payload),
  update: (id: string, payload: Partial<Diagnostic>) => apiPatch<Diagnostic>(`/workshop/diagnostics/${id}`, payload),
  findings: (id: string) => apiGet<Finding[]>(`/workshop/diagnostics/${id}/findings`),
  addFinding: (id: string, payload: FindingCreateInput) => apiPost<Finding>(`/workshop/diagnostics/${id}/findings`, payload),
  tests: (id: string) => apiGet<DiagnosticTest[]>(`/workshop/diagnostics/${id}/tests`),
  addTest: (id: string, payload: { test_type: string; result?: string; notes?: string }) =>
    apiPost<DiagnosticTest>(`/workshop/diagnostics/${id}/tests`, payload),
};