export type FieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "SINGLE_SELECT"
  | "MULTI_SELECT"
  | "CALCULATED";

export type FieldValue = string | number | boolean | string[] | null;
export type AssessmentStatus = "DRAFT" | "READY_FOR_REVIEW" | "RETURNED" | "APPROVED" | "COMPLETED";
export type Persona = "ASSESSOR" | "REVIEWER";
export type CompliancePlanStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ComplianceActivityType = "MONITORING" | "POLICY_REVIEW" | "TRAINING" | "ADVISORY" | "REPORTING";
export type ComplianceActivityPriority = "HIGH" | "MEDIUM" | "LOW";
export type ComplianceActivityCadence = "ONCE" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
export type ComplianceOccurrenceStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED" | "CANCELLED";

export interface OrganizationUnit {
  id: string;
  name: string;
  parentId: string | null;
  description: string;
}

export interface ReviewConfiguration {
  mode: "SOLO" | "REVIEWER";
  assessorName: string;
  reviewerName: string;
}

export interface GeneralAgentConfiguration {
  allowedWebSources: string[];
}

export interface SourceCitation {
  sourceName: string;
  locator: string;
}

export interface RiskScenario {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  sourceCitations: SourceCitation[];
}

export interface SelectOption {
  id: string;
  label: string;
  score?: number;
}

export interface FieldDefinition {
  id: string;
  label: string;
  helpText: string;
  type: FieldType;
  required: boolean;
  options: SelectOption[];
}

export interface MatrixCell {
  rowValue: string;
  columnValue: string;
  result: FieldValue;
}

export interface MatrixCalculation {
  id: string;
  type: "MATRIX";
  outputFieldId: string;
  rowFieldId: string;
  columnFieldId: string;
  cells: MatrixCell[];
}

export interface ThresholdTerm {
  fieldId: string;
  weight: number;
}

export interface ThresholdBand {
  min: number;
  max: number;
  result: FieldValue;
}

export interface ThresholdCalculation {
  id: string;
  type: "THRESHOLD";
  outputFieldId: string;
  terms: ThresholdTerm[];
  bands: ThresholdBand[];
}

export type CalculationDefinition = MatrixCalculation | ThresholdCalculation;

export interface WorkspaceConfiguration {
  organizationName: string;
  units: OrganizationUnit[];
  review: ReviewConfiguration;
  agent: GeneralAgentConfiguration;
  scenarios: RiskScenario[];
  fields: FieldDefinition[];
  calculations: CalculationDefinition[];
  finalRatingFieldId: string;
}

export interface SourceDocument {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  locators: string[];
  addedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  text: string;
  createdAt: string;
  sourceNames?: string[];
}

export interface ProposedFieldValue {
  fieldId: string;
  value: FieldValue;
}

export interface RegisterRowChange {
  scenarioId: string;
  applicable: boolean;
  rationale: string;
  values: ProposedFieldValue[];
  citations: SourceCitation[];
}

export interface RegisterChangeProposal {
  id: string;
  summary: string;
  changes: RegisterRowChange[];
  warnings: string[];
  createdAt: string;
}

export interface ScenarioThread {
  scenarioId: string;
  messages: ConversationMessage[];
  sources: SourceDocument[];
  pendingProposal: RegisterChangeProposal | null;
}

export interface AuditChange {
  fieldId: string;
  label: string;
  before: FieldValue;
  after: FieldValue;
}

export interface AuditEvent {
  id: string;
  scenarioId: string;
  actor: string;
  actorType: "HUMAN" | "AI";
  source: "MANUAL" | "AI_PROPOSAL";
  action: "FIELD_UPDATED" | "RATIONALE_UPDATED" | "APPLICABILITY_UPDATED" | "PROPOSAL_APPLIED";
  changes: AuditChange[];
  citations: SourceCitation[];
  createdAt: string;
}

export interface AssessmentRow {
  id: string;
  scenarioId: string;
  applicable: boolean;
  values: Record<string, FieldValue>;
  rationale: string;
  citations: SourceCitation[];
  lastEditedBy: "HUMAN" | "AI";
  updatedAt: string;
}

export interface Assessment {
  id: string;
  unitId: string;
  period: string;
  status: AssessmentStatus;
  rows: AssessmentRow[];
  initialBrief: string;
  scenarioThreads: Record<string, ScenarioThread>;
  auditEvents: AuditEvent[];
  reviewComment: string;
  updatedAt: string;
}

export interface ComplianceRiskSnapshot {
  assessmentId: string;
  rowId: string;
  scenarioId: string;
  unitId: string;
  period: string;
  code: string;
  title: string;
  category: string;
  finalRating: FieldValue;
  finalRatingLabel: string;
  rationale: string;
  citations: SourceCitation[];
  capturedAt: string;
}

export interface CompliancePlanSource {
  assessmentId: string;
  unitId: string;
  period: string;
  status: AssessmentStatus;
  capturedAt: string;
  risks: ComplianceRiskSnapshot[];
}

export interface ComplianceActivitySchedule {
  cadence: ComplianceActivityCadence;
  startDate: string;
  endDate: string;
}

export interface ComplianceEvidenceReference {
  id: string;
  kind: "FILE" | "LINK";
  name: string;
  url: string;
}

export interface ComplianceActivityOccurrence {
  id: string;
  dueDate: string;
  status: ComplianceOccurrenceStatus;
  outcome: string;
  evidence: ComplianceEvidenceReference[];
  completedAt: string;
}

export interface CompliancePlanActivity {
  id: string;
  unitId: string;
  type: ComplianceActivityType;
  title: string;
  objective: string;
  owner: string;
  priority: ComplianceActivityPriority;
  inclusionRationale: string;
  sourceScenarioIds: string[];
  schedule: ComplianceActivitySchedule;
  occurrences: ComplianceActivityOccurrence[];
  createdBy: "HUMAN" | "AI";
  updatedAt: string;
}

export interface CompliancePlanChange {
  operation: "ADD" | "UPDATE" | "REMOVE";
  activityId: string;
  type: ComplianceActivityType;
  title: string;
  objective: string;
  owner: string;
  priority: ComplianceActivityPriority;
  inclusionRationale: string;
  sourceScenarioIds: string[];
  cadence: ComplianceActivityCadence;
  startDate: string;
  endDate: string;
}

export interface CompliancePlanChangeProposal {
  id: string;
  unitId: string;
  summary: string;
  changes: CompliancePlanChange[];
  warnings: string[];
  createdAt: string;
}

export interface CompliancePlanThread {
  unitId: string;
  messages: ConversationMessage[];
  sources: SourceDocument[];
  pendingProposal: CompliancePlanChangeProposal | null;
}

export interface CompliancePlanAuditEvent {
  id: string;
  unitId: string;
  activityId: string;
  actor: string;
  actorType: "HUMAN" | "AI";
  action: "ACTIVITY_ADDED" | "ACTIVITY_UPDATED" | "ACTIVITY_REMOVED" | "PROPOSAL_APPLIED" | "PLAN_ACTIVATED" | "PLAN_CLOSED" | "OCCURRENCE_UPDATED";
  summary: string;
  createdAt: string;
}

export interface CompliancePlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: CompliancePlanStatus;
  unitIds: string[];
  sources: CompliancePlanSource[];
  activities: CompliancePlanActivity[];
  unitThreads: Record<string, CompliancePlanThread>;
  auditEvents: CompliancePlanAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  version: 4;
  onboarded: boolean;
  configuration: WorkspaceConfiguration;
  assessments: Assessment[];
  compliancePlans: CompliancePlan[];
  persona: Persona;
}
