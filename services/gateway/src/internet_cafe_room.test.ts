import { describe, expect, it } from "vitest";

import {
  projectInternetCafeRoom,
  resolveInternetCafeIntent,
  validateInternetCafeIntakeSubmission,
  type InternetCafeProjectionInput,
} from "./internet_cafe_room.js";

function input(): InternetCafeProjectionInput {
  return {
    billing: {
      airtime: "billing:airtime",
      data: "billing:data",
      electricity: "billing:electricity",
      tv: "billing:tv",
    },
    skills: {
      jobApplication: "skill:job-application",
      schoolApplication: "skill:school-application",
      scholarshipApplication: "skill:scholarship-application",
      generalForms: "skill:general-forms",
      businessRegistration: "skill:business-registration",
      proposal: "skill:proposal",
      quotationInvoice: "skill:quotation-invoice",
      businessDocuments: "skill:business-documents",
      cvResume: "skill:cv-resume",
      coverLetter: "skill:cover-letter",
      formalLetter: "skill:formal-letter",
      documentEditing: "skill:document-editing",
      pdfPreparation: "skill:pdf-preparation",
      formFilling: "skill:form-filling",
      applicationResearch: "skill:application-research",
      accountAssistance: "skill:account-assistance",
      bookings: "skill:bookings",
      websiteFormAssistance: "skill:website-form",
      otherInternetTask: "skill:other-internet-task",
    },
  };
}

describe("Internet Cafe room projection", () => {
  it("projects four billing quick starts without prices or outcomes", () => {
    const view = projectInternetCafeRoom(input());

    expect(view.roomId).toBe("internet-cafe");
    expect(view.quickStarts.map((item) => item.serviceId)).toEqual([
      "data",
      "airtime",
      "electricity",
      "tv",
    ]);

    const purchase = view.sections[0]!;
    expect(purchase.family).toBe("quick-purchase");
    expect(purchase.services).toHaveLength(4);
    expect(purchase.services[0]?.execution).toEqual({
      kind: "billing",
      billingServiceRef: "billing:airtime",
    });
    expect(JSON.stringify(view)).not.toContain("price");
    expect(JSON.stringify(view)).not.toContain("receipt");
  });

  it("binds non-billing services only to supplied Skill references", () => {
    const view = projectInternetCafeRoom(input());
    const nonBilling = view.sections.slice(1).flatMap((section) => section.services);

    expect(nonBilling.length).toBeGreaterThan(10);
    expect(nonBilling.every((item) => item.execution.kind === "skill")).toBe(true);
    expect(
      nonBilling.find((item) => item.serviceId === "cv-resume")?.execution,
    ).toEqual({
      kind: "skill",
      skillRef: "skill:cv-resume",
    });
  });

  it("projects bounded application/document intake", () => {
    const view = projectInternetCafeRoom(input());
    const job = view.sections
      .flatMap((section) => section.services)
      .find((item) => item.serviceId === "job-application");
    const cv = view.sections
      .flatMap((section) => section.services)
      .find((item) => item.serviceId === "cv-resume");

    expect(job?.intake?.fields.some((field) => field.fieldId === "deadline")).toBe(true);
    expect(cv?.intake?.fields.some((field) => field.fieldId === "sourceDocument")).toBe(true);
  });

  it("accepts a server-owned selection for a known service", () => {
    const base = input();
    const view = projectInternetCafeRoom({
      ...base,
      activeSelection: {
        selectionId: "network-choice",
        serviceId: "data",
        title: "Choose a network",
        options: [
          { value: "mtn", label: "MTN" },
          { value: "airtel", label: "Airtel" },
        ],
      },
    });

    expect(view.activeSelection?.serviceId).toBe("data");
    expect(view.activeSelection?.options).toHaveLength(2);
  });

  it("rejects a selection for an unknown service", () => {
    const base = input();
    expect(() =>
      projectInternetCafeRoom({
        ...base,
        activeSelection: {
          selectionId: "bad",
          serviceId: "unknown",
          title: "Choose",
          options: [{ value: "a", label: "A" }],
        },
      }),
    ).toThrow("Internet Cafe selection references unknown service");
  });

  it("resolves only an exact server-owned service/intent pair", () => {
    const room = projectInternetCafeRoom(input());

    expect(
      resolveInternetCafeIntent(room, {
        serviceId: "data",
        intentId: "internet-cafe.data",
      }),
    ).toEqual({
      serviceId: "data",
      intentId: "internet-cafe.data",
      execution: {
        kind: "billing",
        billingServiceRef: "billing:data",
      },
    });

    expect(() =>
      resolveInternetCafeIntent(room, {
        serviceId: "data",
        intentId: "internet-cafe.airtime",
      }),
    ).toThrow("Internet Cafe service/intent binding is invalid");
  });

  it("revalidates task intake on the server and rejects forged fields", () => {
    const room = projectInternetCafeRoom(input());

    expect(
      validateInternetCafeIntakeSubmission(room, {
        serviceId: "job-application",
        intentId: "internet-cafe.job-application",
        values: {
          goal: "Apply for the analyst role",
          deadline: "2026-12-01",
        },
      }),
    ).toMatchObject({
      serviceId: "job-application",
      intentId: "internet-cafe.job-application",
      execution: {
        kind: "skill",
        skillRef: "skill:job-application",
      },
      values: {
        goal: "Apply for the analyst role",
        deadline: "2026-12-01",
      },
    });

    expect(() =>
      validateInternetCafeIntakeSubmission(room, {
        serviceId: "job-application",
        intentId: "internet-cafe.job-application",
        values: {
          goal: "Apply",
          attackerField: "forged",
        },
      }),
    ).toThrow("Internet Cafe intake contains unknown fields");
  });

  it("requires intake fields and rejects intake against billing services", () => {
    const room = projectInternetCafeRoom(input());

    expect(() =>
      validateInternetCafeIntakeSubmission(room, {
        serviceId: "job-application",
        intentId: "internet-cafe.job-application",
        values: {},
      }),
    ).toThrow("Required Internet Cafe intake field is missing: goal");

    expect(() =>
      validateInternetCafeIntakeSubmission(room, {
        serviceId: "data",
        intentId: "internet-cafe.data",
        values: {},
      }),
    ).toThrow("Internet Cafe service does not accept task intake");
  });

  it("fails closed when a canonical execution reference is missing", () => {
    const base = input();
    expect(() =>
      projectInternetCafeRoom({
        ...base,
        billing: {
          ...base.billing,
          electricity: " ",
        },
      }),
    ).toThrow("billingServiceRef is invalid");
  });
});
