import { describe, expect, it } from "vitest";

import {
  DIAGNOSTIC_RESOLUTION_STATUS,
  DIAGNOSTIC_TEST_TYPE,
  QUOTE_STATUS,
  SEVERITY,
  WORK_ORDER_ACTIONS,
  WORK_ORDER_FLOW,
  WORK_ORDER_STATUS,
} from "@/constants/status";

describe("WORK_ORDER_STATUS", () => {
  it("cubre todos los estados del flujo canónico", () => {
    for (const state of WORK_ORDER_FLOW) {
      expect(WORK_ORDER_STATUS[state], `falta estado ${state}`).toBeDefined();
    }
  });

  it("cada status tiene label, tone e icono", () => {
    for (const meta of Object.values(WORK_ORDER_STATUS)) {
      expect(meta.label).toBeTruthy();
      expect(meta.tone).toBeTruthy();
      const icon = meta.icon as unknown;
      const isComponent =
        typeof icon === "function" || (typeof icon === "object" && icon !== null && "render" in icon);
      expect(isComponent, "icon debe ser un componente (función o React.lazy)").toBe(true);
    }
  });

  it("todas las acciones conocidas corresponden a un estado válido", () => {
    for (const state of Object.keys(WORK_ORDER_ACTIONS)) {
      expect(WORK_ORDER_STATUS[state], `estado sin meta ${state}`).toBeDefined();
    }
  });
});

describe("constantes de diagnóstico", () => {
  it("resolución cubre UNRESOLVED/PARTIAL/RESOLVED", () => {
    expect(DIAGNOSTIC_RESOLUTION_STATUS.UNRESOLVED).toBeDefined();
    expect(DIAGNOSTIC_RESOLUTION_STATUS.PARTIAL).toBeDefined();
    expect(DIAGNOSTIC_RESOLUTION_STATUS.RESOLVED).toBeDefined();
  });

  it("tipos de prueba cubren los del OpenAPI", () => {
    for (const key of ["SCAN", "COMPRESSION", "ELECTRICAL", "BRAKES", "SUSPENSION", "FLUID", "VISUAL", "ROAD", "OTHER"]) {
      expect(DIAGNOSTIC_TEST_TYPE[key], `falta tipo ${key}`).toBeDefined();
    }
  });
});

describe("SEVERITY y QUOTE_STATUS", () => {
  it("severidades completas", () => {
    expect(Object.keys(SEVERITY).sort()).toEqual(["CRITICAL", "HIGH", "LOW", "MEDIUM"]);
  });

  it("quote status expone los estados del backend", () => {
    expect(QUOTE_STATUS.CONVERTED).toBeDefined();
    expect(QUOTE_STATUS.EXPIRED).toBeDefined();
  });
});