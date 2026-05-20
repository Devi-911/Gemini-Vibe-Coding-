import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing json and raw text (for raw XML uploads if needed)
app.use(express.json({ limit: "10mb" }));

// Initialize GoogleGenAI SDK safely
// We lazy-load the instance inside utility functions to handle missing keys gracefully on startup
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please supply it in Settings > Secrets.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// REST API Endpoints

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. Validate BPMN / DMN XML Model
app.post("/api/validate", async (req, res) => {
  try {
    const { xml, fileName } = req.body;
    if (!xml || typeof xml !== "string") {
      res.status(400).json({ error: "xml content is required as a string." });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are an expert ISO-compliant BPMN 2.0 and OMG DMN 1.3 systems validation and analysis engineer.
Your task is to thoroughly analyze the provided XML document representing a business model (BPMN) or decision model (DMN).
Complete the structural and semantic analysis, and return a clean, valid JSON object containing validation findings.

Determine the exact format:
- BPMN (Business Process Model and Notation) is typically defined by XML tags like <definitions>, <process>, <startEvent>, <sequenceFlow>, <task>, <exclusiveGateway>, <endEvent>, etc.
- DMN (Decision Model and Notation) is defined by tags like <definitions>, <decision>, <decisionTable>, <inputData>, <inputEntry>, <outputEntry>, etc.

Verify constraints and look for:
- Deadlocks, endless loops, or dangling sequences in BPMN.
- Unreachable decision paths, overlapping rule priorities, or missing default values in DMN tables.
- Standard naming conventions and standard violations.
- Gather list of key elements with human descriptive labels.
- Discover all dynamic input variables (variables critical to process decisions or DMN execution) and expected outputs.

You MUST respond strictly with a valid JSON object matching this schema. Do not enclose the JSON in markdown code blocks. Always respond with raw JSON.

Structure:
{
  "fileType": "bpmn" | "dmn" | "invalid",
  "detectedNamespace": "string",
  "modelName": "string",
  "description": "A comprehensive analysis and summary explaining what process or decision this XML model represents.",
  "elements": [
    {
      "id": "element_id",
      "name": "Human-readable name or ID fallback",
      "type": "StartEvent | UserTask | Gateway | DecisionTable | InputData | etc.",
      "description": "Brief purpose of this element in the flow."
    }
  ],
  "issues": [
    {
      "id": "issue_1",
      "severity": "error" | "warning" | "info",
      "elementId": "id of the element associated with this issue or null",
      "message": "Title of the issue",
      "detail": "Detailed explanation of what is wrong or could be optimized.",
      "fixSuggestion": "A concrete step-by-step description of how to fix this issue in the XML or logic design."
    }
  ],
  "inputVariables": [
    {
      "name": "variableName",
      "type": "string" | "number" | "boolean" | "date",
      "description": "What this variable controls or represents (e.g., 'customerAge', 'orderAmount')",
      "defaultValue": "suggested default value",
      "allowedValues": ["list", "of", "values"] // Optional, list of strings/numbers if applicable, or null
    }
  ],
  "outputVariables": [
    {
      "name": "variableName",
      "type": "string" | "number" | "boolean" | "date",
      "description": "Expected outcome or computed variable"
    }
  ],
  "visualGraph": {
    "nodes": [
      {
        "id": "element_id",
        "label": "Short human friendly label (e.g., 'Apply Risk Model' or 'Score < 500?')",
        "type": "StartEvent | UserTask | ServiceTask | EndEvent | Gateway | DecisionTable | InputData | etc."
      }
    ],
    "edges": [
      {
        "id": "sequence_flow_id",
        "source": "source_node_id",
        "target": "target_node_id",
        "label": "Optional label like 'Yes' or 'No' or condition expression description"
      }
    ]
  }
}`;

    const prompt = `Perform validation on the following XML file: "${fileName || "unnamed_model.xml"}"
Content:
\`\`\`xml
${xml.slice(0, 100000)}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const resultText = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.send(resultText);
  } catch (error: any) {
    console.error("Validation error:", error);
    res.status(500).json({
      error: error.message || "An unexpected error occurred during database analysis.",
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
});

// 3. Simulate Dry-Run execution with user-defined inputs
app.post("/api/simulate", async (req, res) => {
  try {
    const { xml, fileType, inputs } = req.body;
    if (!xml || !fileType) {
      res.status(400).json({ error: "xml and fileType parameters are required." });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are a strict BPMN token execution engine and DMN decision table evaluator simulator.
Analyze the provided business model/process or decision grid and perform a mock dry-run execution using the user's specific inputs parameters.

For BPMN:
- Simulate token traversal starting from the StartEvent(s).
- Evaluate Gateways using the inputs variable values supplied. Use logical reasoning to select sequence flows or branches.
- Record tasks entered, describing what they do and how the variables change.
- Stop when an EndEvent is reached, explaining the final outcome.

For DMN:
- Evaluate the input data against the decision tables.
- Correlate matching rules (e.g. Rule 1: Age < 18 -> Result 'Rejected').
- Show which rules fired, and compute the exact outputs based on standard decision logic (Unique, Any, Priority, Collect etc.).

You MUST respond strictly with a valid JSON object matching the schema below. Do not enclose the JSON inside markdown annotations. Always respond with raw JSON.

Schema:
{
  "success": true,
  "summary": "Short professional summary of this execution scenario run.",
  "executionPath": [
    {
      "stepNumber": 1,
      "elementId": "XML element id",
      "elementName": "Human label of the activity, event, gateway, or decision",
      "actionType": "Token Arrival | Activity Started | Gateway Diverging | Decision Rule Fired | etc.",
      "description": "What happens in this step, referencing the inputs variables used (e.g., 'Order amount of $150 triggers the Over $100 branch at exclusiveGateway_1')",
      "stateUpdate": "Optional details on updated state variables"
    }
  ],
  "finalOutputs": [
    {
      "name": "Output property name",
      "value": "Calculated value or state",
      "explanation": "Human readable justification according to the specification laws."
    }
  ],
  "warnings": [
    "List of warnings such as incomplete execution paths, fallback logic executed, or variables missing"
  ]
}`;

    const prompt = `Simulate this model execution:
File Type: ${fileType}
User Inputs Configuration: ${JSON.stringify(inputs || {})}

Model XML Data:
\`\`\`xml
${xml.slice(0, 100000)}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const resultText = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.send(resultText);
  } catch (error: any) {
    console.error("Simulation error:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during model execution." });
  }
});

// 4. Generate dynamic test scenarios based on model definitions
app.post("/api/generate-test-cases", async (req, res) => {
  try {
    const { xml, fileType } = req.body;
    if (!xml || !fileType) {
      res.status(400).json({ error: "xml and fileType parameters are required." });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are a software testing engineer specializing in BPMN compliance and DMN table path coverage.
Your task is to analyze the uploaded model XML and generate 5 highly valuable, diverse test scenario inputs to optimize model test coverage.

Generate combinations of:
1. Happy Path: A standard, successful run demonstrating typical inputs (e.g. eligible client, small order).
2. Normal Variant: Alternate path or another branch (e.g. premium user, priority handling).
3. Extremes/Edge Case: High numbers, zero, bounds of gates, or maximum decision table thresholds.
4. Error / Rejection Path: Inputs that trigger business error events, gateway exceptions, or decision application rejections (e.g., age under limits, fraudulent flag).
5. Missing / Default Value resilience test: Inputs with blank/null fields to check how default gateways or default rules respond.

For each scenario, you must provide logical mock values for each of the model's required input variables, an elegant title, and clear details.

You MUST respond strictly with a valid JSON object matching this schema. Do not include markdown wraps.

Schema:
{
  "testCases": [
    {
      "title": "Clean, short, elegant scenario title (e.g. 'Standard VIP Order Credit Approval')",
      "description": "Brief description highlighting which path/gateways/decision rules this test exercises and why.",
      "type": "happy_path" | "edge_case" | "error_path" | "alternative_path",
      "inputs": {
        "variable_1": "value_1",
        "variable_2": 250,
        "variable_3": true
      },
      "expectedOutcome": "Detailed expected outcome description (e.g., 'Token ends at SuccessEndEvent; final approval flag is true.')"
    }
  ]
}`;

    const prompt = `Identify valid input variables and generate exactly 5 test scenarios for this model:
File Type: ${fileType}

XML:
\`\`\`xml
${xml.slice(0, 100000)}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const resultText = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.send(resultText);
  } catch (error: any) {
    console.error("Test generation error:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during test scenarios generation." });
  }
});

// 5. Modify Model structured XML following standardized OMG spec edits
app.post("/api/modify-model", async (req, res) => {
  try {
    const { xml, fileType, action, elementId, changes } = req.body;
    if (!xml || !action || !elementId) {
      res.status(400).json({ error: "xml, action, and elementId parameters are required." });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are a strict, professional BPMN 2.0 and DMN 1.3 XML source code modifier.
Your task is to take an original compliant BPMN or DMN XML document, apply a specified properties adjustment or model element addition/deletion, and return a JSON containing the modified XML.

Standard OMG specifications constraints to follow:
- ID fields in XML must always be unique alphanumeric values.
- All tags must open and close correctly. Do not alter any parent schema namespaces or namespaces prefixes (e.g. bpmn:, dmn:, etc.).
- Ensure that you support:
  1. "update":
     - Find the element matching the provided ID 'elementId' (e.g., matching the 'id' attribute).
     - If 'changes.name' is provided, change the 'name' attribute value to the requested name.
     - If 'changes.type' is provided, refactor the XML tag format (e.g., change from <userTask> to <serviceTask> or <exclusiveGateway>, or change <definitions> components) while keeping its 'id' and 'name' attributes intact. Make sure to replace both opening and closing tags.
  2. "add":
     - Append a new sibling element inside the appropriate process container. Generate a unique, compliant XML ID for it based on the requested type (e.g. 'Task_abc123' or 'Gateway_xyz456').
     - Create a brand new <sequenceFlow> or standard reference connecting the core node 'elementId' directly to the new node.
     - If 'changes.appendNode.condition' is provided, render it properly inside the <sequenceFlow> element using a standard <conditionExpression> child block.
     - Splicing (Flow Healing): If 'elementId' previously had an outgoing flow, modify that flow's sourceRef so that it starts from the newly created node instead. This perfectly splices the new node inside the process sequence!
     - Detached Add: If 'elementId' is "detached" or empty, simply append the node under the main process/definitions element without automatically linking it.
  3. "delete":
     - Find and purge the element matching 'elementId'.
     - Flow Healing: If elementId had an incoming flow from Node A and an outgoing flow to Node B, purge both flow tags. Create a new single <sequenceFlow> connecting Node A directly to Node B. This bridges the path seamlessly!
  4. "connect":
     - Create a brand new standard connecting element (e.g., a <sequenceFlow> for BPMN or an <informationRequirement> connector for DMN) with its source reference set as 'elementId' and destination/target reference set as 'changes.targetId'.
     - Set a unique, compliant ID for this new connection. If 'changes.label' is defined, apply it as the name/label attribute of the connection.
  5. "fix-issue":
     - Apply targeted modifications to resolve the specific modeling anomaly or rule violation specified in 'changes.fixSuggestion' (related to element 'elementId'). Perform the exact XML refactoring needed to cure the warning or error cleanly.

Keep all visual BPMN-DI diagram representation configurations unchanged or simply adjust labels. Do not corrupt the layout nodes or positioning definitions.

You MUST respond strictly with a valid JSON matching this schema:
{
  "success": true,
  "xml": "Insert FULL refactored, valid BPMN or DMN XML string of the file here",
  "message": "Action outcome summary e.g. 'Successfully refactored task_1 to Service Task with new name Approval Gate'"
}`;

    const prompt = `Please perform this structural modification on the XML model:
Original File Type: ${fileType || "bpmn"}
Action requested: ${action}
Target Element ID: ${elementId}
Modifications Details: ${JSON.stringify(changes || {})}

XML Content:
\`\`\`xml
${xml}
\`\`\`
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const resultText = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.send(resultText);
  } catch (error: any) {
    console.error("Modify model error:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during model refactoring." });
  }
});

// Serve frontend build or mount Vite development middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BPMN & DMN Testing Lab Backend running on port ${PORT}`);
  });
}

startServer();
