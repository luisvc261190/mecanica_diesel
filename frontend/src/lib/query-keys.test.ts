import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/query-keys";

describe("queryKeys", () => {
  it("expone claves fijas del dashboard y del taller", () => {
    expect(queryKeys.summary).toEqual(["dashboard", "summary"]);
    expect(queryKeys.notifications).toEqual(["dashboard", "notifications"]);
    expect(queryKeys.lowStock).toEqual(["inventory", "low-stock"]);
    expect(queryKeys.roles).toEqual(["users", "roles"]);
  });

  it("compone claves por recurso", () => {
    expect(queryKeys.client("abc")).toEqual(["clients", "abc"]);
    expect(queryKeys.clientContacts("abc")).toEqual(["clients", "abc", "contacts"]);
    expect(queryKeys.part("p1")).toEqual(["inventory", "parts", "p1"]);
    expect(queryKeys.partMovements("p1", 2)).toEqual(["inventory", "parts", "p1", "movements", 2]);
  });

  it("incluye paginación y filtros como primer objeto", () => {
    expect(queryKeys.clients(1, "juan")).toEqual(["clients", { page: 1, q: "juan" }]);
    expect(queryKeys.workOrders(3, "ot", "OPEN")).toEqual(["workshop", "work-orders", { page: 3, q: "ot", status: "OPEN" }]);
  });
});