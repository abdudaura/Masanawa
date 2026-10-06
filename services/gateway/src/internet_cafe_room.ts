export type InternetCafeServiceFamily =
  | "quick-purchase"
  | "applications"
  | "business-services"
  | "documents"
  | "online-help";

export type InternetCafeFieldKind =
  | "short-text"
  | "long-text"
  | "choice"
  | "date"
  | "phone"
  | "email"
  | "document";

export interface InternetCafeChoiceProjection {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

export interface InternetCafeIntakeFieldProjection {
  readonly fieldId: string;
  readonly label: string;
  readonly kind: InternetCafeFieldKind;
  readonly required: boolean;
  readonly helpText?: string;
  readonly choices: readonly InternetCafeChoiceProjection[];
}

export interface InternetCafeTaskIntakeProjection {
  readonly title: string;
  readonly submitLabel: string;
  readonly intro?: string;
  readonly fields: readonly InternetCafeIntakeFieldProjection[];
}

export type InternetCafeExecutionBindingProjection =
  | Readonly<{
      kind: "billing";
      billingServiceRef: string;
      skillRef?: never;
    }>
  | Readonly<{
      kind: "skill";
      skillRef: string;
      billingServiceRef?: never;
    }>;

export interface InternetCafeServiceProjection {
  readonly serviceId: string;
  readonly label: string;
  readonly description: string;
  readonly family: InternetCafeServiceFamily;
  readonly intentId: string;
  readonly execution: InternetCafeExecutionBindingProjection;
  readonly iconKey?: string;
  readonly intake?: InternetCafeTaskIntakeProjection;
  readonly badge?: string;
}

export interface InternetCafeSectionProjection {
  readonly family: InternetCafeServiceFamily;
  readonly title: string;
  readonly description: string;
  readonly services: readonly InternetCafeServiceProjection[];
}

export interface InternetCafeQuickStartProjection {
  readonly intentId: string;
  readonly label: string;
  readonly serviceId: string;
  readonly iconKey?: string;
}

export interface InternetCafeSelectionProjection {
  readonly selectionId: string;
  readonly serviceId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly options: readonly InternetCafeChoiceProjection[];
}

export interface InternetCafeRoomProjection {
  readonly roomId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly quickStarts: readonly InternetCafeQuickStartProjection[];
  readonly sections: readonly InternetCafeSectionProjection[];
  readonly activeSelection?: InternetCafeSelectionProjection;
  readonly continuationLabel?: string;
}

export interface InternetCafeBillingReferences {
  readonly airtime: string;
  readonly data: string;
  readonly electricity: string;
  readonly tv: string;
}

export interface InternetCafeSkillReferences {
  readonly jobApplication: string;
  readonly schoolApplication: string;
  readonly scholarshipApplication: string;
  readonly generalForms: string;
  readonly businessRegistration: string;
  readonly proposal: string;
  readonly quotationInvoice: string;
  readonly businessDocuments: string;
  readonly cvResume: string;
  readonly coverLetter: string;
  readonly formalLetter: string;
  readonly documentEditing: string;
  readonly pdfPreparation: string;
  readonly formFilling: string;
  readonly applicationResearch: string;
  readonly accountAssistance: string;
  readonly bookings: string;
  readonly websiteFormAssistance: string;
  readonly otherInternetTask: string;
}

export interface InternetCafeProjectionInput {
  readonly billing: InternetCafeBillingReferences;
  readonly skills: InternetCafeSkillReferences;
  readonly activeSelection?: InternetCafeSelectionProjection;
  readonly continuationLabel?: string;
}

function bounded(value: string, name: string, max = 512): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const result = value.trim();
  if (result.length < 1 || result.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return result;
}

function billingBinding(ref: string): InternetCafeExecutionBindingProjection {
  return Object.freeze({
    kind: "billing" as const,
    billingServiceRef: bounded(ref, "billingServiceRef", 1024),
  });
}

function skillBinding(ref: string): InternetCafeExecutionBindingProjection {
  return Object.freeze({
    kind: "skill" as const,
    skillRef: bounded(ref, "skillRef", 1024),
  });
}

function choice(
  value: string,
  label: string,
  description?: string,
): InternetCafeChoiceProjection {
  return Object.freeze({
    value,
    label,
    ...(description === undefined ? {} : { description }),
  });
}

function field(input: {
  fieldId: string;
  label: string;
  kind: InternetCafeFieldKind;
  required: boolean;
  helpText?: string;
  choices?: readonly InternetCafeChoiceProjection[];
}): InternetCafeIntakeFieldProjection {
  const choices = Object.freeze([...(input.choices ?? [])]);
  if (input.kind === "choice" && choices.length === 0) {
    throw new TypeError("Internet Cafe choice field requires choices");
  }
  if (input.kind !== "choice" && choices.length > 0) {
    throw new TypeError("Only Internet Cafe choice fields may define choices");
  }
  return Object.freeze({
    fieldId: bounded(input.fieldId, "fieldId", 128),
    label: bounded(input.label, "field.label", 500),
    kind: input.kind,
    required: input.required,
    ...(input.helpText === undefined
      ? {}
      : { helpText: bounded(input.helpText, "field.helpText", 1000) }),
    choices,
  });
}

function intake(
  title: string,
  fields: readonly InternetCafeIntakeFieldProjection[],
  intro?: string,
): InternetCafeTaskIntakeProjection {
  const ids = fields.map((item) => item.fieldId);
  if (new Set(ids).size !== ids.length) {
    throw new TypeError("Duplicate Internet Cafe intake field id");
  }
  return Object.freeze({
    title,
    submitLabel: "Continue",
    ...(intro === undefined ? {} : { intro }),
    fields: Object.freeze([...fields]),
  });
}

function service(input: {
  serviceId: string;
  label: string;
  description: string;
  family: InternetCafeServiceFamily;
  intentId: string;
  execution: InternetCafeExecutionBindingProjection;
  iconKey?: string;
  intake?: InternetCafeTaskIntakeProjection;
  badge?: string;
}): InternetCafeServiceProjection {
  return Object.freeze({
    serviceId: bounded(input.serviceId, "serviceId", 128),
    label: bounded(input.label, "service.label", 500),
    description: bounded(input.description, "service.description", 2000),
    family: input.family,
    intentId: bounded(input.intentId, "intentId", 256),
    execution: input.execution,
    ...(input.iconKey === undefined ? {} : { iconKey: input.iconKey }),
    ...(input.intake === undefined ? {} : { intake: input.intake }),
    ...(input.badge === undefined ? {} : { badge: input.badge }),
  });
}

function buildSections(
  refs: InternetCafeProjectionInput,
): readonly InternetCafeSectionProjection[] {
  const billingServices = [
    service({
      serviceId: "airtime",
      label: "Airtime",
      description: "Buy airtime for a supported mobile number.",
      family: "quick-purchase",
      intentId: "internet-cafe.airtime",
      execution: billingBinding(refs.billing.airtime),
      iconKey: "airtime",
    }),
    service({
      serviceId: "data",
      label: "Data",
      description: "Choose and buy a supported mobile data bundle.",
      family: "quick-purchase",
      intentId: "internet-cafe.data",
      execution: billingBinding(refs.billing.data),
      iconKey: "data",
    }),
    service({
      serviceId: "electricity",
      label: "Electricity",
      description: "Buy a token or pay a supported electricity account.",
      family: "quick-purchase",
      intentId: "internet-cafe.electricity",
      execution: billingBinding(refs.billing.electricity),
      iconKey: "electricity",
    }),
    service({
      serviceId: "tv",
      label: "TV",
      description: "Pay a supported cable or TV subscription.",
      family: "quick-purchase",
      intentId: "internet-cafe.tv",
      execution: billingBinding(refs.billing.tv),
      iconKey: "tv",
    }),
  ];

  const applicationIntake = intake(
    "Application details",
    [
      field({
        fieldId: "goal",
        label: "What are you applying for?",
        kind: "long-text",
        required: true,
      }),
      field({
        fieldId: "deadline",
        label: "Deadline",
        kind: "date",
        required: false,
      }),
      field({
        fieldId: "document",
        label: "Supporting document",
        kind: "document",
        required: false,
      }),
    ],
    "Share only the details needed to prepare or complete the application.",
  );

  const documentIntake = intake("Document details", [
    field({
      fieldId: "instructions",
      label: "What should the document contain?",
      kind: "long-text",
      required: true,
    }),
    field({
      fieldId: "sourceDocument",
      label: "Existing document",
      kind: "document",
      required: false,
    }),
  ]);

  const app = (id: string, label: string, description: string, ref: string) =>
    service({
      serviceId: id,
      label,
      description,
      family: "applications",
      intentId: `internet-cafe.${id}`,
      execution: skillBinding(ref),
      intake: applicationIntake,
    });

  const business = (id: string, label: string, description: string, ref: string) =>
    service({
      serviceId: id,
      label,
      description,
      family: "business-services",
      intentId: `internet-cafe.${id}`,
      execution: skillBinding(ref),
      intake: documentIntake,
    });

  const document = (id: string, label: string, description: string, ref: string) =>
    service({
      serviceId: id,
      label,
      description,
      family: "documents",
      intentId: `internet-cafe.${id}`,
      execution: skillBinding(ref),
      intake: documentIntake,
    });

  const online = (id: string, label: string, description: string, ref: string) =>
    service({
      serviceId: id,
      label,
      description,
      family: "online-help",
      intentId: `internet-cafe.${id}`,
      execution: skillBinding(ref),
      intake: applicationIntake,
    });

  return Object.freeze([
    Object.freeze({
      family: "quick-purchase" as const,
      title: "Quick Purchase",
      description: "Everyday bills and mobile services.",
      services: Object.freeze(billingServices),
    }),
    Object.freeze({
      family: "applications" as const,
      title: "Applications",
      description: "Forms and applications with guided document intake.",
      services: Object.freeze([
        app("job-application", "Job application", "Prepare or complete a job application.", refs.skills.jobApplication),
        app("school-application", "School admission", "Prepare or complete a school or admission application.", refs.skills.schoolApplication),
        app("scholarship-application", "Scholarship", "Prepare or complete a scholarship application.", refs.skills.scholarshipApplication),
        app("general-forms", "General forms", "Get help completing a supported online form.", refs.skills.generalForms),
      ]),
    }),
    Object.freeze({
      family: "business-services" as const,
      title: "Business Services",
      description: "Practical business documents and registration assistance.",
      services: Object.freeze([
        business("business-registration", "Business registration", "Prepare information and documents for a supported registration flow.", refs.skills.businessRegistration),
        business("proposal", "Proposal", "Draft a business or project proposal.", refs.skills.proposal),
        business("quotation-invoice", "Quotation or invoice", "Prepare a quotation or invoice.", refs.skills.quotationInvoice),
        business("business-documents", "Business documents", "Prepare basic company and business documents.", refs.skills.businessDocuments),
      ]),
    }),
    Object.freeze({
      family: "documents" as const,
      title: "Documents",
      description: "Create, edit and prepare everyday documents.",
      services: Object.freeze([
        document("cv-resume", "CV / Resume", "Create or improve a CV or resume.", refs.skills.cvResume),
        document("cover-letter", "Cover letter", "Create a tailored cover letter.", refs.skills.coverLetter),
        document("formal-letter", "Formal letter", "Prepare a formal or application letter.", refs.skills.formalLetter),
        document("document-editing", "Edit or format document", "Improve the content and formatting of a document.", refs.skills.documentEditing),
        document("pdf-preparation", "PDF preparation", "Prepare or convert a document for PDF delivery.", refs.skills.pdfPreparation),
        document("form-filling", "Fill a form", "Use provided information to help complete a supported form.", refs.skills.formFilling),
      ]),
    }),
    Object.freeze({
      family: "online-help" as const,
      title: "Online Help",
      description: "Guided assistance for supported online tasks.",
      services: Object.freeze([
        online("application-research", "Application research", "Research information needed for an application or task.", refs.skills.applicationResearch),
        online("account-assistance", "Account assistance", "Get help with a supported online account or application.", refs.skills.accountAssistance),
        online("bookings", "Bookings or appointments", "Prepare or complete a supported booking or appointment.", refs.skills.bookings),
        online("website-form-assistance", "Website form assistance", "Get help completing a supported website form.", refs.skills.websiteFormAssistance),
        online("other-internet-task", "Other Internet task", "Start another supported Internet task.", refs.skills.otherInternetTask),
      ]),
    }),
  ]);
}

function validateSelection(
  selection: InternetCafeSelectionProjection,
  serviceIds: ReadonlySet<string>,
): InternetCafeSelectionProjection {
  bounded(selection.selectionId, "selectionId", 256);
  bounded(selection.serviceId, "selection.serviceId", 128);
  bounded(selection.title, "selection.title", 1000);
  if (!serviceIds.has(selection.serviceId)) {
    throw new TypeError("Internet Cafe selection references unknown service");
  }
  if (!Array.isArray(selection.options) || selection.options.length < 1 || selection.options.length > 100) {
    throw new TypeError("Internet Cafe selection requires bounded options");
  }
  const values = new Set<string>();
  const options = selection.options.map((item) => {
    const value = bounded(item.value, "selection.option.value", 256);
    if (!values.add(value)) {
      throw new TypeError("Internet Cafe selection option values must be unique");
    }
    return Object.freeze({
      value,
      label: bounded(item.label, "selection.option.label", 500),
      ...(item.description === undefined
        ? {}
        : { description: bounded(item.description, "selection.option.description", 1000) }),
    });
  });
  return Object.freeze({
    selectionId: selection.selectionId.trim(),
    serviceId: selection.serviceId.trim(),
    title: selection.title.trim(),
    ...(selection.subtitle === undefined
      ? {}
      : { subtitle: bounded(selection.subtitle, "selection.subtitle", 1000) }),
    options: Object.freeze(options),
  });
}

export function projectInternetCafeRoom(
  input: InternetCafeProjectionInput,
): InternetCafeRoomProjection {
  const sections = buildSections(input);
  const allServices = sections.flatMap((section) => section.services);
  const serviceIds = new Set(allServices.map((item) => item.serviceId));
  if (serviceIds.size !== allServices.length) {
    throw new TypeError("Internet Cafe service ids must be unique");
  }

  const quickStarts = Object.freeze([
    Object.freeze({ intentId: "internet-cafe.data", label: "Data", serviceId: "data", iconKey: "data" }),
    Object.freeze({ intentId: "internet-cafe.airtime", label: "Airtime", serviceId: "airtime", iconKey: "airtime" }),
    Object.freeze({ intentId: "internet-cafe.electricity", label: "Electricity", serviceId: "electricity", iconKey: "electricity" }),
    Object.freeze({ intentId: "internet-cafe.tv", label: "TV", serviceId: "tv", iconKey: "tv" }),
  ]);

  const activeSelection =
    input.activeSelection === undefined
      ? undefined
      : validateSelection(input.activeSelection, serviceIds);

  return Object.freeze({
    roomId: "internet-cafe",
    title: "Internet Cafe",
    subtitle: "Bills, applications, documents and supported online tasks in one place.",
    quickStarts,
    sections,
    ...(activeSelection === undefined ? {} : { activeSelection }),
    ...(input.continuationLabel === undefined
      ? {}
      : { continuationLabel: bounded(input.continuationLabel, "continuationLabel", 500) }),
  });
}
