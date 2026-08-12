import type { AppState, BusinessQuestion, RiskScenario } from "@/lib/types";

export const seedScenarios: RiskScenario[] = [
  {
    id: "risk-aml-01",
    code: "AML-01",
    title: "Customer due diligence failure",
    category: "Financial crime",
    definition:
      "The firm fails to identify, verify, or appropriately risk-rate customers before or during the relationship.",
    inherentRating: "Severe",
    appetite: "Moderate",
    controls: ["CDD standard", "PEP and sanctions screening", "Periodic KYC review"],
    evidenceRequired: ["CDD quality sample", "Screening MI", "Overdue KYC report"],
    sourceCitation: "Financial Crime Risk Library.xlsx, CDD scenarios, row 8",
  },
  {
    id: "risk-aml-02",
    code: "AML-07",
    title: "Transaction monitoring coverage gap",
    category: "Financial crime",
    definition:
      "Products or transaction flows are not fully covered by calibrated monitoring scenarios.",
    inherentRating: "High",
    appetite: "Moderate",
    controls: ["Monitoring scenario inventory", "Annual calibration", "Alert QA"],
    evidenceRequired: ["Coverage assessment", "Calibration approval"],
    sourceCitation: "Financial Crime Risk Library.xlsx, Monitoring, row 19",
  },
  {
    id: "risk-conduct-01",
    code: "CON-03",
    title: "Unsuitable customer outcomes",
    category: "Customer conduct",
    definition:
      "Product design, sales, or servicing practices lead to foreseeable customer harm.",
    inherentRating: "High",
    appetite: "Low",
    controls: ["Product governance forum", "Outcome testing", "Vulnerable customer standard"],
    evidenceRequired: ["Outcome testing results", "Product review minutes"],
    sourceCitation: "Conduct Risk Policy.pdf, page 14",
  },
  {
    id: "risk-data-01",
    code: "DAT-02",
    title: "Inaccurate regulatory reporting",
    category: "Regulatory obligations",
    definition:
      "Required regulatory submissions are incomplete, inaccurate, or submitted late.",
    inherentRating: "Moderate",
    appetite: "Low",
    controls: ["Submission maker-checker", "Data reconciliation", "Breach escalation"],
    evidenceRequired: ["Submission control log", "Reconciliation evidence"],
    sourceCitation: "Compliance Risk Taxonomy.docx, section 6.2",
  },
  {
    id: "risk-market-01",
    code: "MAR-05",
    title: "Market abuse surveillance failure",
    category: "Markets compliance",
    definition:
      "Trading behavior indicative of market abuse is not identified and escalated promptly.",
    inherentRating: "Severe",
    appetite: "Low",
    controls: ["Trade surveillance", "Restricted list", "Escalation procedure"],
    evidenceRequired: ["Surveillance coverage map", "Alert disposition sample"],
    sourceCitation: "Market Conduct Standard.pdf, page 22",
  },
];

const questions: BusinessQuestion[] = [
  {
    id: "q1",
    section: "Customers and services",
    prompt: "Which customers does the business unit serve, and have those groups changed?",
    help: "Include customer types, countries, higher-risk groups, and significant changes since the last review.",
    answer:
      "UK retail and small-business customers. The unit began onboarding limited companies with non-UK beneficial owners in April.",
    required: true,
  },
  {
    id: "q2",
    section: "Customers and services",
    prompt: "What products, services, and transaction channels does the unit operate?",
    help: "Describe what customers can do, including new or materially changed services.",
    answer:
      "Current accounts, savings, domestic and international payments through mobile, web, and branch channels.",
    required: true,
  },
  {
    id: "q3",
    section: "Controls in practice",
    prompt: "Where does the team rely on manual checks or workarounds?",
    help: "Focus on how work is actually performed, including temporary processes.",
    answer:
      "Quality checks for complex ownership structures are manual. A backlog arose after two experienced analysts left.",
    required: true,
  },
  {
    id: "q4",
    section: "Controls in practice",
    prompt: "Which control results or indicators are causing concern?",
    help: "Include failed testing, overdue work, complaints, incidents, or worsening metrics.",
    answer:
      "Overdue periodic reviews increased from 3% to 8%. CDD quality testing fell below the 95% threshold in May.",
    required: true,
  },
  {
    id: "q5",
    section: "Change and outlook",
    prompt: "What material changes are planned for the next twelve months?",
    help: "Include product, technology, customer, supplier, and operating-model changes.",
    answer: "Migration to a new onboarding platform is planned for Q4.",
    required: true,
  },
  {
    id: "q6",
    section: "Change and outlook",
    prompt: "Is there anything else that could change the compliance exposure?",
    help: "Add context that is not covered above.",
    answer: "",
    required: false,
  },
];

export const initialState: AppState = {
  organization: {
    id: "org-northstar",
    name: "Northstar Financial",
    operatingModel: "FIRST_LINE_LED",
    reviewCadence: "Annual",
    dataRegion: "European Union",
    updatedAt: "10 Aug 2026",
  },
  frameworkVersions: [
    {
      id: "fw-4",
      version: "4.2",
      name: "Enterprise compliance risk framework",
      status: "PUBLISHED",
      publishedAt: "18 Mar 2026",
      scenarios: seedScenarios,
      sources: [
        { id: "src-1", name: "Financial Crime Risk Library.xlsx", type: "XLSX", size: "384 KB", status: "Parsed", uploadedAt: "17 Mar 2026" },
        { id: "src-2", name: "Conduct Risk Policy.pdf", type: "PDF", size: "1.8 MB", status: "Parsed", uploadedAt: "17 Mar 2026" },
        { id: "src-3", name: "Compliance Risk Taxonomy.docx", type: "DOCX", size: "242 KB", status: "Parsed", uploadedAt: "17 Mar 2026" },
      ],
    },
    {
      id: "fw-5",
      version: "4.3 draft",
      name: "Enterprise compliance risk framework",
      status: "DRAFT",
      scenarios: seedScenarios,
      sources: [
        { id: "src-4", name: "2026 Risk Appetite Update.pdf", type: "PDF", size: "920 KB", status: "Needs review", uploadedAt: "7 Aug 2026" },
      ],
    },
  ],
  assessments: [
    {
      id: "asm-retail-2026",
      reference: "CRA-2026-014",
      businessUnit: "Retail Banking",
      period: "2026 annual review",
      dueDate: "28 Aug 2026",
      owner: "Maya Chen",
      operatingModelSnapshot: "FIRST_LINE_LED",
      frameworkVersion: "4.2",
      status: "IN_REVIEW",
      completion: 86,
      questions,
      lastUpdated: "Today, 09:42",
      scenarioAssessments: [
        {
          id: "sa-1", scenarioId: "risk-aml-01", relevant: true, proposedRating: "High", rationale: "CDD quality performance is below threshold and overdue reviews have more than doubled. Expansion into non-UK beneficial ownership increases complexity while experienced capacity has reduced.", confidence: 91, controlEffectiveness: "Partially effective", withinAppetite: false, citations: ["Business facts: Controls in practice", "Financial Crime Risk Library.xlsx, row 8"], accepted: false, changedFromPrior: true,
        },
        {
          id: "sa-2", scenarioId: "risk-aml-02", relevant: true, proposedRating: "Moderate", rationale: "International payment flows remain in scope, with no reported monitoring coverage change. Existing annual calibration and alert QA controls apply.", confidence: 78, controlEffectiveness: "Effective", withinAppetite: true, citations: ["Business facts: Customers and services", "Financial Crime Risk Library.xlsx, row 19"], accepted: true, acceptedRating: "Moderate", changedFromPrior: false,
        },
        {
          id: "sa-3", scenarioId: "risk-conduct-01", relevant: true, proposedRating: "Moderate", rationale: "Retail products create customer outcome exposure, but no worsening complaints or outcome testing failures were reported.", confidence: 64, controlEffectiveness: "Effective", withinAppetite: false, citations: ["Business facts: Customers and services", "Conduct Risk Policy.pdf, page 14"], accepted: false, changedFromPrior: false,
        },
        {
          id: "sa-4", scenarioId: "risk-data-01", relevant: true, proposedRating: "Low", rationale: "The unit contributes data to regulatory submissions. No errors, late returns, or reconciliation failures were reported.", confidence: 82, controlEffectiveness: "Effective", withinAppetite: true, citations: ["Compliance Risk Taxonomy.docx, section 6.2"], accepted: true, acceptedRating: "Low", changedFromPrior: false,
        },
        {
          id: "sa-5", scenarioId: "risk-market-01", relevant: false, proposedRating: "Low", rationale: "The business unit does not conduct trading activity and the scenario is not applicable to the stated services.", confidence: 96, controlEffectiveness: "Effective", withinAppetite: true, citations: ["Business facts: Customers and services", "Market Conduct Standard.pdf, page 22"], accepted: true, acceptedRating: "Low", changedFromPrior: false,
        },
      ],
      evidence: [
        { id: "ev-1", scenarioId: "risk-aml-01", name: "May CDD quality testing.xlsx", type: "FILE", status: "ACCEPTED", owner: "Maya Chen", addedAt: "8 Aug" },
        { id: "ev-2", scenarioId: "risk-aml-01", name: "KYC remediation plan", type: "LINK", status: "PENDING", owner: "Maya Chen", addedAt: "9 Aug" },
        { id: "ev-3", scenarioId: "risk-aml-02", name: "Monitoring coverage attestation", type: "ATTESTATION", status: "ACCEPTED", owner: "Leo Martin", addedAt: "6 Aug" },
      ],
      exceptions: [
        { id: "ex-1", scenarioAssessmentId: "sa-1", kind: "APPETITE_BREACH", title: "CDD risk exceeds appetite", detail: "Proposed rating is High against a Moderate appetite. Confirm remediation ownership and target date.", severity: "Critical", status: "OPEN" },
        { id: "ex-2", scenarioAssessmentId: "sa-1", kind: "MISSING_EVIDENCE", title: "Remediation evidence awaits review", detail: "The linked remediation plan has not been accepted by compliance.", severity: "High", status: "OPEN" },
        { id: "ex-3", scenarioAssessmentId: "sa-3", kind: "LOW_CONFIDENCE", title: "Conduct rating needs judgment", detail: "The proposal relies on absence of reported issues rather than current outcome-testing evidence.", severity: "Medium", status: "OPEN" },
        { id: "ex-4", scenarioAssessmentId: "sa-1", kind: "MATERIAL_CHANGE", title: "Exposure increased since 2025", detail: "New customer complexity and control deterioration change the prior Moderate assessment.", severity: "High", status: "RESOLVED", resolution: "Change confirmed and reflected in proposed rating." },
      ],
    },
    {
      id: "asm-payments-2026",
      reference: "CRA-2026-015",
      businessUnit: "Payments Operations",
      period: "2026 annual review",
      dueDate: "12 Sep 2026",
      owner: "Compliance team",
      operatingModelSnapshot: "COMPLIANCE_LED",
      frameworkVersion: "4.2",
      status: "FACT_GATHERING",
      completion: 40,
      questions: questions.map((question, index) => ({ ...question, answer: index < 2 ? question.answer : "" })),
      scenarioAssessments: [],
      evidence: [],
      exceptions: [],
      lastUpdated: "Yesterday, 16:18",
    },
    {
      id: "asm-wealth-2026",
      reference: "CRA-2026-009",
      businessUnit: "Wealth Management",
      period: "2026 annual review",
      dueDate: "30 Jun 2026",
      owner: "Sofia Andersson",
      operatingModelSnapshot: "FIRST_LINE_LED",
      frameworkVersion: "4.2",
      status: "FINALIZED",
      completion: 100,
      questions,
      scenarioAssessments: [],
      evidence: [],
      exceptions: [],
      lastUpdated: "30 Jun 2026",
      finalizedAt: "30 Jun 2026",
    },
  ],
  tasks: [
    { id: "task-1", title: "Resolve CDD appetite breach", context: "Retail Banking · CRA-2026-014", due: "Today", priority: "High", complete: false },
    { id: "task-2", title: "Review remediation plan evidence", context: "Retail Banking · AML-01", due: "12 Aug", priority: "High", complete: false },
    { id: "task-3", title: "Complete payments business facts", context: "Payments Operations · CRA-2026-015", due: "22 Aug", priority: "Medium", complete: false },
  ],
  auditEvents: [
    { id: "audit-1", actor: "AI assessment service", action: "Generated assessment draft", target: "CRA-2026-014", detail: "5 scenarios evaluated against framework v4.2; 4 considered relevant.", at: "Today, 09:42" },
    { id: "audit-2", actor: "Maya Chen", action: "Submitted business facts", target: "CRA-2026-014", detail: "All five required sections completed.", at: "Today, 09:31" },
    { id: "audit-3", actor: "Leo Martin", action: "Accepted evidence", target: "May CDD quality testing.xlsx", detail: "Evidence accepted for scenario AML-01.", at: "8 Aug, 15:06" },
    { id: "audit-4", actor: "Aisha Rahman", action: "Published framework", target: "Framework v4.2", detail: "82 scenarios, 41 controls, and 12 appetite thresholds published.", at: "18 Mar, 11:20" },
  ],
  changes: [
    { id: "change-1", businessUnit: "Retail Banking", title: "Non-UK ownership onboarding", detail: "Customer eligibility expanded to limited companies with non-UK beneficial owners.", recordedAt: "4 Apr 2026", impactStatus: "Assessed" },
    { id: "change-2", businessUnit: "Payments Operations", title: "Payment processor migration", detail: "Core processor migration scheduled for November 2026.", recordedAt: "8 Aug 2026", impactStatus: "Pending analysis" },
  ],
};
