export interface ModelFile {
  id: string;
  name: string;
  type: "bpmn" | "dmn" | "unknown";
  xml: string;
  createdAt: string;
  isPreloaded?: boolean;
}

export interface ModelElement {
  id: string;
  name: string;
  type: string;
  description: string;
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  elementId?: string | null;
  message: string;
  detail: string;
  fixSuggestion: string;
}

export interface InputVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "any";
  description: string;
  defaultValue?: string;
  allowedValues?: string[] | null;
}

export interface OutputVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "any";
  description: string;
}

export interface ValidationResponse {
  fileType: "bpmn" | "dmn" | "invalid";
  detectedNamespace?: string;
  modelName?: string;
  description?: string;
  elements?: ModelElement[];
  issues?: ValidationIssue[];
  inputVariables?: InputVariable[];
  outputVariables?: OutputVariable[];
}

export interface ExecutionStep {
  stepNumber: number;
  elementId?: string;
  elementName: string;
  actionType: string;
  description: string;
  stateUpdate?: string;
}

export interface FinalOutput {
  name: string;
  value: any;
  explanation: string;
}

export interface SimulationResult {
  success: boolean;
  summary: string;
  executionPath: ExecutionStep[];
  finalOutputs: FinalOutput[];
  warnings?: string[];
}

export interface TestCase {
  title: string;
  description: string;
  type: "happy_path" | "edge_case" | "error_path" | "alternative_path";
  inputs: Record<string, any>;
  expectedOutcome: string;
}
