import { calculateValues } from "@/lib/scoring";
import type {
  AppState,
  Assessment,
  AssessmentRow,
  FieldDefinition,
  MatrixCalculation,
  RiskScenario,
  WorkspaceConfiguration,
} from "@/lib/types";

const ratingOptions = [
  { id: "low", label: "Low", score: 1 },
  { id: "moderate", label: "Moderate", score: 2 },
  { id: "high", label: "High", score: 3 },
  { id: "severe", label: "Severe", score: 4 },
];

const fields: FieldDefinition[] = [
  {
    id: "likelihood",
    label: "Likelihood",
    helpText: "How likely is this scenario to occur in the assessment period?",
    type: "SINGLE_SELECT",
    required: true,
    options: [
      { id: "rare", label: "Rare", score: 1 },
      { id: "possible", label: "Possible", score: 2 },
      { id: "likely", label: "Likely", score: 3 },
      { id: "almost-certain", label: "Almost certain", score: 4 },
    ],
  },
  {
    id: "financial-impact",
    label: "Financial impact",
    helpText: "Expected financial consequence before controls.",
    type: "SINGLE_SELECT",
    required: true,
    options: [
      { id: "minimal", label: "Minimal", score: 1 },
      { id: "material", label: "Material", score: 2 },
      { id: "major", label: "Major", score: 3 },
      { id: "critical", label: "Critical", score: 4 },
    ],
  },
  {
    id: "inherent-risk",
    label: "Inherent risk",
    helpText: "Calculated from likelihood and financial impact.",
    type: "CALCULATED",
    required: true,
    options: ratingOptions,
  },
  {
    id: "control-effectiveness",
    label: "Control effectiveness",
    helpText: "How effectively do the controls reduce the exposure?",
    type: "SINGLE_SELECT",
    required: true,
    options: [
      { id: "strong", label: "Strong", score: 1 },
      { id: "adequate", label: "Adequate", score: 2 },
      { id: "weak", label: "Weak", score: 3 },
      { id: "ineffective", label: "Ineffective", score: 4 },
    ],
  },
  {
    id: "residual-risk",
    label: "Residual risk",
    helpText: "Calculated after considering control effectiveness.",
    type: "CALCULATED",
    required: true,
    options: ratingOptions,
  },
  {
    id: "assessment-note",
    label: "Assessment note",
    helpText: "The key facts and judgment behind the assessment.",
    type: "LONG_TEXT",
    required: false,
    options: [],
  },
];

function matrixCells(
  rows: string[],
  columns: string[],
  ratings: string[][],
) {
  return rows.flatMap((rowValue, rowIndex) =>
    columns.map((columnValue, columnIndex) => ({
      rowValue,
      columnValue,
      result: ratings[rowIndex][columnIndex],
    })),
  );
}

const calculations: MatrixCalculation[] = [
  {
    id: "calc-inherent",
    type: "MATRIX",
    outputFieldId: "inherent-risk",
    rowFieldId: "likelihood",
    columnFieldId: "financial-impact",
    cells: matrixCells(
      ["rare", "possible", "likely", "almost-certain"],
      ["minimal", "material", "major", "critical"],
      [
        ["low", "low", "moderate", "moderate"],
        ["low", "moderate", "moderate", "high"],
        ["moderate", "moderate", "high", "severe"],
        ["moderate", "high", "severe", "severe"],
      ],
    ),
  },
  {
    id: "calc-residual",
    type: "MATRIX",
    outputFieldId: "residual-risk",
    rowFieldId: "inherent-risk",
    columnFieldId: "control-effectiveness",
    cells: matrixCells(
      ["low", "moderate", "high", "severe"],
      ["strong", "adequate", "weak", "ineffective"],
      [
        ["low", "low", "low", "moderate"],
        ["low", "moderate", "moderate", "high"],
        ["moderate", "moderate", "high", "severe"],
        ["moderate", "high", "severe", "severe"],
      ],
    ),
  },
];

export const starterConfiguration: WorkspaceConfiguration = {
  organizationName: "",
  units: [],
  review: { mode: "SOLO", assessorName: "", reviewerName: "" },
  agent: { allowedWebSources: [] },
  scenarios: [],
  fields,
  calculations,
  finalRatingFieldId: "residual-risk",
};

const scenarios: RiskScenario[] = [
  {
    id: "scenario-cdd",
    code: "AML-01",
    title: "Customer due diligence failure",
    category: "Financial crime",
    description: "Customers are onboarded or retained without sufficient identification, verification, or risk classification.",
    sourceCitations: [{ sourceName: "Financial Crime Risk Library.xlsx", locator: "CDD scenarios, row 8" }],
  },
  {
    id: "scenario-monitoring",
    code: "AML-07",
    title: "Transaction monitoring coverage gap",
    category: "Financial crime",
    description: "Products or transaction flows are not covered by appropriately calibrated monitoring.",
    sourceCitations: [{ sourceName: "Financial Crime Risk Library.xlsx", locator: "Monitoring, row 19" }],
  },
  {
    id: "scenario-conduct",
    code: "CON-03",
    title: "Unsuitable customer outcomes",
    category: "Customer conduct",
    description: "Product design, sales, or servicing practices lead to foreseeable customer harm.",
    sourceCitations: [{ sourceName: "Conduct Risk Policy.pdf", locator: "page 14" }],
  },
  {
    id: "scenario-reporting",
    code: "REG-02",
    title: "Inaccurate regulatory reporting",
    category: "Regulatory obligations",
    description: "Required regulatory submissions are incomplete, inaccurate, or submitted late.",
    sourceCitations: [{ sourceName: "Compliance Risk Taxonomy.docx", locator: "section 6.2" }],
  },
];

export const sampleConfiguration: WorkspaceConfiguration = {
  ...starterConfiguration,
  organizationName: "Northstar Financial",
  units: [
    { id: "unit-retail", name: "Retail Banking", parentId: null, description: "Retail products and customer operations" },
    { id: "unit-payments", name: "Payments Operations", parentId: "unit-retail", description: "Domestic and international payment operations" },
    { id: "unit-wealth", name: "Wealth Management", parentId: null, description: "Investment and advisory services" },
  ],
  review: { mode: "REVIEWER", assessorName: "Jordan Lee", reviewerName: "Sofia Andersson" },
  scenarios,
};

function row(
  id: string,
  scenarioId: string,
  values: Record<string, string>,
  rationale: string,
  citations: { sourceName: string; locator: string }[],
): AssessmentRow {
  return {
    id,
    scenarioId,
    applicable: true,
    values: calculateValues(sampleConfiguration, values),
    rationale,
    citations,
    lastEditedBy: "AI",
    updatedAt: "Today, 09:42",
  };
}

const sampleAssessment: Assessment = {
  id: "assessment-retail-2026",
  unitId: "unit-retail",
  period: "2026 annual review",
  status: "DRAFT",
  rows: [
    row(
      "row-retail-cdd",
      "scenario-cdd",
      {
        likelihood: "likely",
        "financial-impact": "major",
        "control-effectiveness": "weak",
        "assessment-note": "CDD quality fell below target while higher-complexity ownership structures increased.",
      },
      "CDD quality performance is below target and overdue reviews have increased. Expansion into non-UK beneficial ownership adds complexity while experienced capacity has reduced.",
      [
        { sourceName: "Retail risk update.docx", locator: "Controls in practice" },
        { sourceName: "Financial Crime Risk Library.xlsx", locator: "CDD scenarios, row 8" },
      ],
    ),
    row(
      "row-retail-monitoring",
      "scenario-monitoring",
      {
        likelihood: "possible",
        "financial-impact": "material",
        "control-effectiveness": "adequate",
        "assessment-note": "Coverage remains stable; annual calibration is complete.",
      },
      "International payment flows remain in scope, with no reported monitoring coverage change. Existing calibration and alert QA controls apply.",
      [{ sourceName: "Retail risk update.docx", locator: "Products and channels" }],
    ),
    row(
      "row-retail-conduct",
      "scenario-conduct",
      {
        likelihood: "possible",
        "financial-impact": "major",
        "control-effectiveness": "adequate",
        "assessment-note": "No worsening complaints or outcome testing failures were reported.",
      },
      "Retail products create customer outcome exposure, but current information does not indicate deterioration.",
      [{ sourceName: "Conduct Risk Policy.pdf", locator: "page 14" }],
    ),
  ],
  messages: [
    {
      id: "message-1",
      role: "USER",
      text: "Assess Retail Banking using the attached risk update. Pay particular attention to CDD quality and the new customer profile.",
      createdAt: "Today, 09:39",
      sourceNames: ["Retail risk update.docx"],
    },
    {
      id: "message-2",
      role: "ASSISTANT",
      text: "I found three applicable scenarios. CDD risk needs the most attention because customer complexity increased while control performance deteriorated. I drafted the register values for your review.",
      createdAt: "Today, 09:42",
    },
  ],
  sources: [
    { id: "source-retail", name: "Retail risk update.docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 242000, locators: ["Customers and services", "Controls in practice"], addedAt: "Today" },
  ],
  pendingProposal: null,
  reviewComment: "",
  updatedAt: "Today, 09:42",
};

export const emptyState: AppState = {
  version: 2,
  onboarded: false,
  configuration: starterConfiguration,
  assessments: [],
  persona: "ASSESSOR",
};

export const sampleState: AppState = {
  version: 2,
  onboarded: true,
  configuration: sampleConfiguration,
  assessments: [sampleAssessment],
  persona: "ASSESSOR",
};
