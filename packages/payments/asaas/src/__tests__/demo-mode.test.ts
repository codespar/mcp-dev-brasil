import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => {
  class FakeServer {
    constructor() {}
    setRequestHandler() {}
    connect() { return Promise.resolve(); }
  }
  return { Server: FakeServer };
});

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({ StdioServerTransport: class {} }));

import * as asaas from "../index.js";

// Reset the in-process demo state before every test so the call
// counter and installment ledger don't bleed across cases. Without
// this, tests would be order-sensitive and the assertion in the
// "distinct ids" case would silently rely on whatever counter value
// the previous tests left behind.
beforeEach(() => {
  asaas.resetDemoState();
});

describe("createPaymentDemoResponse (demo mode)", () => {
  it("issues distinct fixture ids on consecutive calls within one process", () => {
    const a = asaas.createPaymentDemoResponse({ customer: "cus_x", billingType: "PIX", value: 100, dueDate: "2026-06-01" });
    const b = asaas.createPaymentDemoResponse({ customer: "cus_x", billingType: "PIX", value: 200, dueDate: "2026-06-02" });
    expect(a.id).toBe("pay_demo_001");
    expect(b.id).toBe("pay_demo_002");
  });

  it("echoes input value, billingType, customer, and dueDate", () => {
    const r = asaas.createPaymentDemoResponse({ customer: "cus_demo", billingType: "PIX", value: 4416, dueDate: "2026-07-01" });
    expect(r.value).toBe(4416);
    expect(r.billingType).toBe("PIX");
    expect(r.customer).toBe("cus_demo");
    expect(r.dueDate).toBe("2026-07-01");
    expect(r.status).toBe("PENDING");
    expect(r.invoiceUrl).toBe(`https://sandbox.asaas.com/i/${r.id}`);
  });

  it("includes installments and installmentValue when CREDIT_CARD + installments are provided", () => {
    const r = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: 4800,
      dueDate: "2026-07-01",
      installments: 6,
    });
    expect(r.billingType).toBe("CREDIT_CARD");
    expect(r.installments).toBe(6);
    expect(r.installmentValue).toBe(800);
  });

  it("omits installments fields when billingType is PIX even if installments is supplied", () => {
    const r = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "PIX",
      value: 4800,
      dueDate: "2026-07-01",
      installments: 6,
    });
    expect(r.installments).toBeUndefined();
    expect(r.installmentValue).toBeUndefined();
  });

  it("omits installments fields when installments is 1 or less (single-payment fallback)", () => {
    const r = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: 4800,
      dueDate: "2026-07-01",
      installments: 1,
    });
    expect(r.installments).toBeUndefined();
  });

  it("treats zero, negative, NaN, Infinity, and non-number installments as single-payment intent", () => {
    for (const bad of [0, -3, NaN, Infinity, "6" as unknown as number, null as unknown as number, undefined as unknown as number]) {
      const r = asaas.createPaymentDemoResponse({
        customer: "cus_demo",
        billingType: "CREDIT_CARD",
        value: 4800,
        dueDate: "2026-07-01",
        installments: bad,
      });
      expect(r.installments).toBeUndefined();
      expect(r.installmentValue).toBeUndefined();
    }
  });

  it("floors fractional installments (6.5 → 6) before computing the schedule", () => {
    const r = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: 4800,
      dueDate: "2026-07-01",
      installments: 6.5,
    });
    expect(r.installments).toBe(6);
    expect(r.installmentValue).toBe(800);
  });

  it("does not register installment ledger entries when value is zero or negative", () => {
    const a = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: 0,
      dueDate: "2026-07-01",
      installments: 6,
    });
    expect(a.installments).toBeUndefined();
    const b = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: -100,
      dueDate: "2026-07-01",
      installments: 6,
    });
    expect(b.installments).toBeUndefined();
  });
});

describe("getInstallmentsDemoResponse (demo mode)", () => {
  it("returns the schedule recorded by a prior create_payment with installments", () => {
    const created = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: 5280,
      dueDate: "2026-07-15",
      installments: 6,
    });
    const got = asaas.getInstallmentsDemoResponse({ id: created.id }) as any;
    expect(got.id).toBe(created.id);
    expect(got.installmentCount).toBe(6);
    expect(got.totalValue).toBe(5280);
    expect(Array.isArray(got.installments)).toBe(true);
    expect(got.installments).toHaveLength(6);
    expect(got.installments[0]).toMatchObject({ number: 1, value: 880, dueDate: "2026-07-15", status: "PENDING" });
    expect(got.installments[5]).toMatchObject({ number: 6, value: 880 });
  });

  it("returns a single-installment fallback when the id was not registered with installment intent", () => {
    const got = asaas.getInstallmentsDemoResponse({ id: "pay_demo_999" }) as any;
    expect(got.id).toBe("pay_demo_999");
    expect(got.installmentCount).toBe(1);
    expect(got.installments).toHaveLength(1);
  });

  it("supports a preview path: (value, installments) returns a hypothetical schedule without creating a payment", () => {
    const got = asaas.getInstallmentsDemoResponse({ value: 4800, installments: 6 }) as any;
    expect(got.preview).toBe(true);
    expect(got.totalValue).toBe(4800);
    expect(got.installmentCount).toBe(6);
    expect(got.installmentValue).toBe(800);
    expect(got.installments).toHaveLength(6);
    expect(got.installments[0]).toMatchObject({ number: 1, value: 800, status: "PREVIEW" });
    expect(got.installments[5]).toMatchObject({ number: 6, value: 800 });
  });

  it("preview path ignores fewer-than-two installments and falls through to single-installment fallback", () => {
    const got = asaas.getInstallmentsDemoResponse({ value: 4800, installments: 1 }) as any;
    expect(got.preview).toBeUndefined();
    expect(got.installmentCount).toBe(1);
  });

  it("preview path rejects zero, negative, NaN, and non-number value (falls back to single-installment)", () => {
    for (const bad of [0, -100, NaN, Infinity, "4800" as unknown as number]) {
      const got = asaas.getInstallmentsDemoResponse({ value: bad, installments: 6 }) as any;
      expect(got.preview).toBeUndefined();
      expect(got.installmentCount).toBe(1);
    }
  });

  it("when both id and (value, installments) are supplied, id wins if it is registered", () => {
    const created = asaas.createPaymentDemoResponse({
      customer: "cus_demo",
      billingType: "CREDIT_CARD",
      value: 1200,
      dueDate: "2026-08-01",
      installments: 3,
    });
    const got = asaas.getInstallmentsDemoResponse({
      id: created.id,
      value: 4800,
      installments: 6,
    }) as any;
    // id path returns the ledger entry (3 × 400), not the preview (6 × 800).
    expect(got.id).toBe(created.id);
    expect(got.installmentCount).toBe(3);
    expect(got.installmentValue).toBeUndefined(); // ledger path doesn't expose this field
    expect(got.installments[0]).toMatchObject({ number: 1, value: 400 });
  });

  it("when id is provided but unregistered AND preview args are supplied, falls through to preview (graceful degradation)", () => {
    const got = asaas.getInstallmentsDemoResponse({
      id: "pay_demo_never_existed",
      value: 4800,
      installments: 6,
    }) as any;
    // id miss falls through to preview, not to the single-installment fallback.
    expect(got.preview).toBe(true);
    expect(got.installmentCount).toBe(6);
    expect(got.installmentValue).toBe(800);
  });
});
