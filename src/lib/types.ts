export type OperatingModel = "FIRST_LINE_LED" | "COMPLIANCE_LED";
export type UserRole =
  | "FRAMEWORK_ADMIN"
  | "BUSINESS_CONTRIBUTOR"
  | "COMPLIANCE_OFFICER"
  | "MANAGEMENT_VIEWER";
export type RiskRating = "Low" | "Moderate" | "High" | "Severe";
export type AssessmentStatus =
  | "FACT_GATHERING"
  | "AI_DRAFT_READY"
  | "IN_REVIEW"
  | "FINALIZED";
export type EvidenceStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type ExceptionKind =
  | "APPETITE_BREACH"
  | "MISSING_EVIDENCE"
  | "LOW_CONFIDENCE"
  | "MATERIAL_CHANGE"
  | "INCONSISTENCY";

export interface OrganizationSettings {
  id: string;
  name: string;
  operatingModel: OperatingModel;
  reviewCadence: "Quarterly" | "Semi-annual" | "Annual";
  dataRegion: string;
  updatedAt: string;
}

export interface FrameworkSource {
  id: string;
  name: string;
  type: "PDF" | "DOCX" | "XLSX" | "CSV";
  size: string;
  status: "Parsed" | "Needs review" | "Processing";
  uploadedAt: string;
}

export interface RiskScenario {
  id: string;
  code: string;
  title: string;
  category: string;
  definition: string;
  inherentRating: RiskRating;
  appetite: RiskRating;
  controls: string[];
  evidenceRequired: string[];
  sourceCitation: string;
}

export interface FrameworkVersion {
  id: string;
  version: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt?: string;
  scenarios: RiskScenario[];
  sources: FrameworkSource[];
}

export interface BusinessQuestion {
  id: string;
  section: string;
  prompt: string;
  help: string;
  answer: string;
  required: boolean;
}

export interface ScenarioAssessment {
  id: string;
  scenarioId: string;
  relevant: boolean;
  proposedRating: RiskRating;
  acceptedRating?: RiskRating;
  rationale: string;
  confidence: number;
  controlEffectiveness: "Effective" | "Partially effective" | "Ineffective";
  withinAppetite: boolean;
  citations: string[];
  accepted: boolean;
  changedFromPrior: boolean;
}

export interface Evidence {
  id: string;
  scenarioId: string;
  name: string;
  type: "FILE" | "LINK" | "ATTESTATION";
  status: EvidenceStatus;
  owner: string;
  addedAt: string;
}

export interface ReviewException {
  id: string;
  scenarioAssessmentId: string;
  kind: ExceptionKind;
  title: string;
  detail: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "OPEN" | "RESOLVED";
  resolution?: string;
}

export interface AssessmentCycle {
  id: string;
  reference: string;
  businessUnit: string;
  period: string;
  dueDate: string;
  owner: string;
  operatingModelSnapshot: OperatingModel;
  frameworkVersion: string;
  status: AssessmentStatus;
  completion: number;
  questions: BusinessQuestion[];
  scenarioAssessments: ScenarioAssessment[];
  evidence: Evidence[];
  exceptions: ReviewException[];
  lastUpdated: string;
  finalizedAt?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  context: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  complete: boolean;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  at: string;
}

export interface ChangeEvent {
  id: string;
  businessUnit: string;
  title: string;
  detail: string;
  recordedAt: string;
  impactStatus: "Pending analysis" | "Assessed";
}

export interface AppState {
  organization: OrganizationSettings;
  frameworkVersions: FrameworkVersion[];
  assessments: AssessmentCycle[];
  tasks: TaskItem[];
  auditEvents: AuditEvent[];
  changes: ChangeEvent[];
}
