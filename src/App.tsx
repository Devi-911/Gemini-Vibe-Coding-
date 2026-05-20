import React, { useState, useEffect, useRef } from "react";
import { ModelFile, ValidationResponse, SimulationResult, TestCase } from "./types";
import { SAMPLE_MODELS } from "./data/examples";
import { XmlEditor } from "./components/XmlEditor";
import { ModelVisualizer } from "./components/ModelVisualizer";
import {
  ShieldAlert,
  Play,
  RotateCw,
  Sparkles,
  Layers,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileDown,
  Info,
  Sliders,
  ChevronRight,
  ArrowRight,
  Database,
  ExternalLink,
  Plus,
  Network,
  Code,
  FolderOpen,
  X,
  Trash2,
  Upload,
  Check,
  Cpu,
  FileText
} from "lucide-react";

const BPMN_ELEMENT_TYPES = [
  { value: "StartEvent", label: "Start Event" },
  { value: "EndEvent", label: "End Event" },
  { value: "UserTask", label: "User Task" },
  { value: "ServiceTask", label: "Service Task" },
  { value: "BusinessRuleTask", label: "Business Rule Task" },
  { value: "ScriptTask", label: "Script Task" },
  { value: "ExclusiveGateway", label: "Exclusive Gateway" },
  { value: "ParallelGateway", label: "Parallel Gateway" },
];

const DMN_ELEMENT_TYPES = [
  { value: "InputData", label: "Input Data Field" },
  { value: "DecisionTable", label: "Decision Table Rules" },
  { value: "Decision", label: "Decision Case Element" },
  { value: "BusinessKnowledgeModel", label: "Business Knowledge Model" },
];

export default function App() {
  const [files, setFiles] = useState<ModelFile[]>(() => {
    const saved = localStorage.getItem("bpmn_dmn_files");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return SAMPLE_MODELS;
      }
    }
    return SAMPLE_MODELS;
  });

  const [selectedFileId, setSelectedFileId] = useState<string | null>(() => {
    const saved = localStorage.getItem("bpmn_dmn_files");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          return parsed[0].id;
        }
      } catch (e) {}
    }
    return SAMPLE_MODELS[0].id;
  });

  // mainView switcher requested: "Interactive Process & Decision Map & model.xml Source Editor are interchangeable"
  const [mainView, setMainView] = useState<"visual_map" | "xml_editor">("visual_map");

  // Out-of-box samples accessible via a button popover / modal as requested (kept offline/clean display)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Validation column state - tabs: "compliance" | "sandbox" | "gentest" | "edit"
  const [rightPanelTab, setRightPanelTab] = useState<"compliance" | "sandbox" | "gentest" | "edit">("compliance");

  // Selected file helper
  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0] || null;

  // Validation state
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Simulation state
  const [simulationInputs, setSimulationInputs] = useState<Record<string, any>>({});
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Test suite dynamic generation
  const [generatedCases, setGeneratedCases] = useState<TestCase[]>([]);
  const [isGeneratingCases, setIsGeneratingCases] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [activeVisualElementId, setActiveVisualElementId] = useState<string | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // XML Modifiers Properties States
  const [isModifying, setIsModifying] = useState(false);
  const [modificationError, setModificationError] = useState<string | null>(null);
  const [modificationSuccessMessage, setModificationSuccessMessage] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [appendTypeName, setAppendTypeName] = useState("UserTask");
  const [appendName, setAppendName] = useState("");
  const [appendCondition, setAppendCondition] = useState("");

  // Sync active visual element inputs when clicked
  useEffect(() => {
    if (activeVisualElementId && validationResult?.elements) {
      const el = validationResult.elements.find((e) => e.id === activeVisualElementId);
      if (el) {
        setEditName(el.name || el.id);
        setEditType(el.type || "");
      }
    } else {
      setEditName("");
      setEditType("");
    }
    setModificationError(null);
    setModificationSuccessMessage(null);
  }, [activeVisualElementId, validationResult]);

  // Handle direct OMG spec XML model download matching true standard format extensions
  const handleDownloadModel = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const extension = selectedFile.type === "bpmn" ? "bpmn" : selectedFile.type === "dmn" ? "dmn" : "xml";
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
    link.download = `${baseName}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Perform structured modification payload requests to the smart refactoring backend
  const handleModifyModel = async (
    action: "update" | "add" | "delete" | "connect" | "fix-issue",
    targetId: string,
    changesObj?: any
  ) => {
    if (!selectedFile) return;
    setIsModifying(true);
    setModificationError(null);
    setModificationSuccessMessage(null);
    try {
      const response = await fetch("/api/modify-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xml: selectedFile.xml,
          fileType: selectedFile.type,
          action,
          elementId: targetId,
          changes: changesObj,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to edit model using Gemini.");
      }

      const result = await response.json();
      if (result.success && result.xml) {
        setModificationSuccessMessage(result.message || "Model modified successfully!");
        handleSaveXml(result.xml);
        
        // Reset inputs after adding successfully
        if (action === "add") {
          setAppendName("");
          setAppendCondition("");
        }
        // Deselect or reset focus if node was deleted
        if (action === "delete") {
          setActiveVisualElementId(null);
        }
      } else {
        throw new Error(result.message || "Error rewriting the process structure XML.");
      }
    } catch (err: any) {
      console.error("Modify model error:", err);
      setModificationError(err.message || "An unexpected error occurred during XML modification.");
    } finally {
      setIsModifying(false);
    }
  };

  // Save files to localStorage whenever modified
  useEffect(() => {
    localStorage.setItem("bpmn_dmn_files", JSON.stringify(files));
  }, [files]);

  // Handle uploading/adding user XML file
  const handleUploadFile = (name: string, xml: string, type: "bpmn" | "dmn") => {
    const newFile: ModelFile = {
      id: `custom-${Date.now()}`,
      name,
      type,
      xml,
      createdAt: new Date().toISOString(),
      isPreloaded: false,
    };
    setFiles((prev) => [newFile, ...prev]);
    setSelectedFileId(newFile.id);
  };

  // Handle deleting a file
  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedFileId === id) {
      const remaining = files.filter((f) => f.id !== id);
      setSelectedFileId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Perform Gemini Validation Analysis of the selected model XML
  const performValidation = async (targetFile: ModelFile) => {
    if (!targetFile) return;
    setIsValidating(true);
    setValidationError(null);
    setValidationResult(null);
    setSimulationResult(null);
    setGeneratedCases([]);

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xml: targetFile.xml,
          fileName: targetFile.name,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Internal validation server error.");
      }

      const data: ValidationResponse = await response.json();
      setValidationResult(data);

      // Extract dynamic input variables & build initial form state
      const initialForm: Record<string, any> = {};
      if (data.inputVariables && data.inputVariables.length > 0) {
        data.inputVariables.forEach((variable) => {
          let fallbackValue: any = "";
          if (variable.type === "boolean") {
            fallbackValue = variable.defaultValue === "true" || false;
          } else if (variable.type === "number") {
            fallbackValue = variable.defaultValue ? Number(variable.defaultValue) : 0;
          } else {
            fallbackValue = variable.defaultValue || "";
          }
          initialForm[variable.name] = fallbackValue;
        });
      }
      setSimulationInputs(initialForm);
    } catch (err: any) {
      console.error(err);
      setValidationError(err.message || "Could not analyze model file. Please make sure the Gemini API credentials are set.");
    } finally {
      setIsValidating(false);
    }
  };

  // Trigger validation on file select change
  useEffect(() => {
    if (selectedFile) {
      performValidation(selectedFile);
    } else {
      setValidationResult(null);
    }
  }, [selectedFileId]);

  // Handle user editor modification save
  const handleSaveXml = (newXml: string) => {
    if (!selectedFile) return;
    const updatedFiles = files.map((file) => {
      if (file.id === selectedFile.id) {
        return { ...file, xml: newXml };
      }
      return file;
    });
    setFiles(updatedFiles);
    // Trigger model re-validation assessment immediately using updated files representation
    const updatedFile = updatedFiles.find((f) => f.id === selectedFile.id)!;
    performValidation(updatedFile);
  };

  // Restore current preloaded file to stock default state if modified
  const handleResetToStock = () => {
    if (!selectedFile || !selectedFile.isPreloaded) return;
    const original = SAMPLE_MODELS.find((m) => m.id === selectedFile.id);
    if (original) {
      handleSaveXml(original.xml);
    }
  };

  // Perform Token Sandbox Simulation Run
  const handleRunSimulation = async () => {
    if (!selectedFile || !validationResult) return;
    setIsSimulating(true);
    setSimulationError(null);
    setSimulationResult(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xml: selectedFile.xml,
          fileType: validationResult.fileType || selectedFile.type,
          inputs: simulationInputs,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Execution engine failure.");
      }

      const runDetails: SimulationResult = await response.json();
      setSimulationResult(runDetails);
    } catch (err: any) {
      console.error(err);
      setSimulationError(err.message || "Token execution evaluation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  // Generate 5 dynamic test scenarios utilizing AI model coverage optimization
  const handleGenerateTestSuites = async () => {
    if (!selectedFile || !validationResult) return;
    setIsGeneratingCases(true);
    setGenerationError(null);
    setGeneratedCases([]);

    try {
      const response = await fetch("/api/generate-test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xml: selectedFile.xml,
          fileType: validationResult.fileType || selectedFile.type,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Dynamic model test cases failure.");
      }

      const output = await response.json();
      setGeneratedCases(output.testCases || []);
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Unable to extract standard test coverage scenarios.");
    } finally {
      setIsGeneratingCases(false);
    }
  };

  // Apply a suggested test case preset array values directly to current workspace simulation
  const applyTestCaseInputs = (testCaseInputs: Record<string, any>) => {
    setSimulationInputs((prev) => ({
      ...prev,
      ...testCaseInputs,
    }));
    setRightPanelTab("sandbox");
  };

  // Parse type from XML
  const detectTypeFromXml = (xmlStr: string): "bpmn" | "dmn" | "unknown" => {
    const lower = xmlStr.toLowerCase();
    if (lower.includes("process") || lower.includes("startevent") || lower.includes("bpmn")) {
      return "bpmn";
    }
    if (lower.includes("decision") || lower.includes("decisiontable") || lower.includes("dmn")) {
      return "dmn";
    }
    return "unknown";
  };

  // Process a chosen file object
  const processUploadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        alert("Could not read empty file.");
        return;
      }
      const detected = detectTypeFromXml(text);
      if (detected === "unknown") {
        alert("This does not appear to be a standard BPMN 2.0 or DMN 1.3 XML file.");
        return;
      }
      handleUploadFile(file.name, text, detected as "bpmn" | "dmn");
    };
    reader.onerror = () => {
      alert("Failed to read file.");
    };
    reader.readAsText(file);
  };

  // Download compliance audit log report
  const handleDownloadReport = () => {
    if (!selectedFile || !validationResult) return;
    
    const reportArtifact = {
      generatedAt: new Date().toISOString(),
      modelFile: {
        name: selectedFile.name,
        type: selectedFile.type,
      },
      validation: {
        modelName: validationResult.modelName,
        detectedType: validationResult.fileType,
        description: validationResult.description,
        totalElements: validationResult.elements?.length || 0,
        issues: validationResult.issues || [],
        detectedInputVariables: validationResult.inputVariables || [],
      },
      activeSimulationInputs: simulationInputs,
      simulationLog: simulationResult || "Not simulated in this workbench session",
      suggestedTestCases: generatedCases.length > 0 ? generatedCases : "Not generated in this turn",
    };

    const str = JSON.stringify(reportArtifact, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.[^/.]+$/, "")}_compliance_report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex w-full h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 select-none">
      
      {/* Outer Widescreen Sandbox Area */}
      <main className="flex-grow w-full flex flex-col min-w-0 h-full">
        
        {/* Widescreen App Main Header Nav Bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-4 min-w-0">
            {/* Title block */}
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600 shrink-0" />
              <h1 className="font-sans font-extrabold text-base text-slate-900 tracking-tight shrink-0">
                Interactive Model Analyzer
              </h1>
            </div>

            {/* Model switch trigger popup */}
            <button
              onClick={() => setIsLibraryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-indigo-400 bg-white text-slate-700 hover:text-indigo-600 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
              Switch Model ({files.length})
            </button>

            {/* Current Active name indicators */}
            {selectedFile && (
              <div className="flex items-center gap-2 min-w-0 pl-3 border-l border-slate-200">
                <span className="text-xs font-bold text-slate-800 font-mono truncate max-w-[200px]" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
                <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider shrink-0 font-mono ${
                  selectedFile.type === "bpmn"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                }`}>
                  {selectedFile.type}
                </span>
              </div>
            )}
            
            {selectedFile?.isPreloaded && (
              <button
                onClick={handleResetToStock}
                title="Revert modified XML structure back to initial default sample state"
                className="text-xs text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 ml-1 select-none"
              >
                <RotateCw className="w-3.5 h-3.5" /> Revert
              </button>
            )}
          </div>

          {/* Center Interchangeable Switcher - BPMN/DMN Process Map vs Source Editor */}
          <div className="hidden md:flex bg-slate-100/80 p-1 rounded-xl border border-slate-250/30">
            <button
              onClick={() => setMainView("visual_map")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all outline-none cursor-pointer ${
                mainView === "visual_map"
                  ? "bg-white text-indigo-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Network className="w-4 h-4 text-indigo-500" />
              Interactive Process Map
            </button>
            <button
              onClick={() => setMainView("xml_editor")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all outline-none cursor-pointer ${
                mainView === "xml_editor"
                  ? "bg-white text-emerald-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Code className="w-4 h-4 text-emerald-500" />
              model.xml Source Editor
            </button>
          </div>

          {/* Action Hub tools */}
          <div className="flex items-center gap-3 shrink-0">
            {/* COMPACT XML UPLOAD BUTTON */}
            <label
              htmlFor="compact-xml-input"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processUploadFile(e.dataTransfer.files[0]);
                }
              }}
              className={`relative flex items-center justify-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs gap-1.5 shadow-xs cursor-pointer select-none transition-all ${
                dragOver ? "ring-2 ring-indigo-500 scale-102" : ""
              }`}
              title="Drag and drop any BPMN/DMN XML file onto this button to upload quickly."
            >
              <Upload className="w-3.5 h-3.5" />
              {dragOver ? "Drop Here!" : "Upload Model"}
              <input
                id="compact-xml-input"
                ref={fileInputRef2}
                type="file"
                accept=".bpmn,.dmn,.xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processUploadFile(e.target.files[0]);
                  }
                }}
              />
            </label>

            {selectedFile && (
              <button
                onClick={handleDownloadModel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title={`Download the currently active ${selectedFile.type.toUpperCase()} XML schema`}
              >
                <FileDown className="w-3.5 h-3.5" />
                Download Model
              </button>
            )}

            {validationResult && (
              <button
                onClick={handleDownloadReport}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                Export Report
              </button>
            )}

            <div className="items-center gap-2 pl-3 border-l border-slate-200 hidden sm:flex shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-500 font-medium uppercase font-mono">LIVE OK</span>
            </div>
          </div>
        </header>

        {/* Small screen notification banner if any */}
        <div className="md:hidden p-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs font-semibold text-indigo-900">
          <span>Active View Style:</span>
          <div className="flex bg-indigo-100/50 p-0.5 rounded-lg">
            <button
              onClick={() => setMainView("visual_map")}
              className={`px-3 py-1 rounded-md transition-all ${
                mainView === "visual_map" ? "bg-white shadow-xs text-indigo-900" : "text-indigo-400"
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setMainView("xml_editor")}
              className={`px-3 py-1 transition-all ${
                mainView === "xml_editor" ? "bg-white shadow-xs text-indigo-900" : "text-indigo-400"
              }`}
            >
              Code XML
            </button>
          </div>
        </div>

        {/* Split Core Workspace Content (Left interchange Full display, Right dynamic column list pane) */}
        <div className="flex-1 flex overflow-hidden w-full relative">
          
          {/* Main Interchange Left Display (Takes the entire space!) */}
          <section className="flex-1 flex flex-col h-full bg-slate-50 min-w-0 overflow-hidden relative">
            
            {/* Visual graph and model summary banner */}
            {mainView === "visual_map" ? (
              <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
                {selectedFile ? (
                  <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                    
                    {/* Model Overview description container */}
                    {validationResult && (
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs shrink-0 flex items-start gap-4 transition-all">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <Network className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                            Process Metadata Summary
                          </h4>
                          <h3 className="text-xs font-bold text-slate-800 mt-1">
                            {validationResult.modelName || selectedFile.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-1 lines-clamp-2 leading-relaxed">
                            {validationResult.description || "Interactive sequence layout generated by Gemini 3.5 AI Core."}
                          </p>
                        </div>
                        {activeVisualElementId && (
                          <div className="bg-indigo-50/50 border border-indigo-150 px-3 py-2 rounded-lg text-[10.5px] shrink-0 font-medium animate-fade-in flex items-center gap-2">
                            <span className="font-mono text-indigo-700">Focus ID: {activeVisualElementId}</span>
                            <button
                              onClick={() => setActiveVisualElementId(null)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                              title="Clear focus element"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Full viewport interactive Process map */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <ModelVisualizer
                        graph={validationResult?.visualGraph}
                        fileType={validationResult?.fileType || selectedFile.type}
                        activeElementId={activeVisualElementId}
                        onSelectNode={(nodeId) => {
                          setActiveVisualElementId(nodeId);
                          // Automatically shift sidebar tab so users can inspect and modify elements attributes
                          setRightPanelTab("edit");
                        }}
                        validationIssues={validationResult?.issues}
                        onModifyModel={handleModifyModel}
                        isModifying={isModifying}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Database className="w-12 h-12 text-slate-300 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-800">No XML Model Uploaded</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Please open the Model Library or upload a standard BPMN 2.0 or DMN 1.3 process configuration mapping to initialize.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Source editor tab full wide screen
              <div className="flex-1 p-6 flex flex-col overflow-hidden min-h-0">
                {selectedFile ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    <XmlEditor
                      xml={selectedFile.xml}
                      onSaveXml={handleSaveXml}
                      isSaving={isValidating}
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200 rounded-xl m-6">
                    <Code className="w-12 h-12 text-slate-300 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-800">Source code empty</h3>
                  </div>
                )}
              </div>
            )}
            
          </section>

          {/* Right audit column beside it: Shows errors, compliance rules, sandboxed variables, test execution elements */}
          <aside className="w-96 shrink-0 h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden shadow-xs z-10">
            
            {/* Secondary sidebar header tabs */}
            <div className="bg-slate-50 border-b border-slate-200 shrink-0 p-1 flex">
              <button
                onClick={() => setRightPanelTab("compliance")}
                className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  rightPanelTab === "compliance"
                    ? "bg-white text-indigo-900 border border-slate-200/40 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                Compliance ({validationResult?.issues?.length || 0})
              </button>
              <button
                onClick={() => setRightPanelTab("edit")}
                className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  rightPanelTab === "edit"
                    ? "bg-white text-indigo-900 border border-slate-200/40 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Properties Inspector & Element Designer Configs"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Edit Model
              </button>
              <button
                onClick={() => setRightPanelTab("sandbox")}
                className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  rightPanelTab === "sandbox"
                    ? "bg-white text-indigo-900 border border-slate-200/40 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Play className="w-3.5 h-3.5 text-emerald-500" />
                Sandbox
              </button>
              <button
                onClick={() => setRightPanelTab("gentest")}
                className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
                  rightPanelTab === "gentest"
                    ? "bg-white text-indigo-900 border border-slate-200/40 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                GenAI Tests
              </button>
            </div>

            {/* TAB CONTENTS INNER SIDEBAR SCROLL AREA */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-5">
              
              {/* COMPLIANCE & ERRORS TAB AREA */}
              {rightPanelTab === "compliance" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Validations & Errors
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Target: {selectedFile ? selectedFile.name : "(none)"}
                    </span>
                  </div>

                  {/* Root validation error */}
                  {validationError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-[11px] font-bold text-rose-900 leading-tight">Gemini Validation Offline</h4>
                        <p className="text-[10.5px] text-rose-700/85 mt-1 leading-normal">{validationError}</p>
                      </div>
                    </div>
                  )}

                  {/* Loader */}
                  {isValidating && (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <RotateCw className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                      <h4 className="text-xs font-semibold text-slate-800 font-mono">Compliance Evaluation Engine Running...</h4>
                      <p className="text-[10.5px] text-slate-400 mt-1 max-w-[240px]">
                        Analyzing structural forks or unmapped sequences via standard OMG models checking specifications.
                      </p>
                    </div>
                  )}

                  {/* Successful validation */}
                  {!isValidating && validationResult && (
                    <div className="space-y-4">
                      
                      {/* Audited issues - errors list */}
                      <div className="space-y-3">
                        {!validationResult.issues || validationResult.issues.length === 0 ? (
                          <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-bold text-emerald-950">Valid XML Model Schema</div>
                              <p className="text-[10.5px] text-emerald-700/80 leading-normal mt-0.5">
                                No blocks, unmapped gateways, cyclic forks, or dead loops were detected.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5 pb-2">
                            {validationResult.issues.map((issue) => {
                              const isError = issue.severity === "error";
                              const isWarning = issue.severity === "warning";
                              
                              // Check if this issue is for the active highlighted element
                              const isHighlighted = issue.elementId && activeVisualElementId && issue.elementId === activeVisualElementId;

                              return (
                                <div
                                  key={issue.id}
                                  onClick={() => {
                                    if (issue.elementId) {
                                      setActiveVisualElementId(issue.elementId);
                                    }
                                  }}
                                  className={`p-3.5 rounded-xl border transition-all text-xs cursor-pointer ${
                                    isHighlighted
                                      ? "ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/60 shadow-xs"
                                      : isError
                                        ? "bg-rose-50/40 border-rose-150 hover:bg-rose-50/60"
                                        : isWarning
                                          ? "bg-amber-50/30 border-amber-150 hover:bg-amber-50/50"
                                          : "bg-blue-50/20 border-blue-150 hover:bg-blue-50/40"
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                      isError
                                        ? "bg-rose-100 text-rose-700"
                                        : isWarning
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-blue-100 text-blue-700"
                                    }`}>
                                      {isError ? "!" : isWarning ? "?" : "i"}
                                    </div>
                                    
                                    <div className="min-w-0 flex-1">
                                      <div className={`font-bold leading-tight ${
                                        isError ? "text-rose-950" : isWarning ? "text-amber-950" : "text-blue-950"
                                      }`}>
                                        {issue.message}
                                      </div>
                                      
                                      <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                                        {issue.detail}
                                      </p>
                                      
                                      {issue.elementId && (
                                        <div className="mt-2 flex items-center justify-between">
                                          <span className="text-[9px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md font-mono text-slate-600">
                                            Element: {issue.elementId}
                                          </span>
                                          {isHighlighted && (
                                            <span className="text-[8.5px] bg-indigo-100 text-indigo-700 font-bold px-1 rounded-sm animate-pulse">
                                              ACTIVE SELECTION
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {issue.fixSuggestion && (
                                        <div className="mt-2 p-2 bg-white/80 border border-slate-100 rounded text-[10.5px]">
                                          <span className="font-bold text-slate-700 block text-[9.5px] uppercase tracking-wide">
                                            Proposed Remediation:
                                          </span>
                                          <p className="text-slate-600 mt-0.5 leading-normal">{issue.fixSuggestion}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Elements Registry list */}
                      <div className="pt-2 border-t border-slate-100">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                          Extracted XML Layout ({validationResult.elements?.length || 0})
                        </h4>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                          Click on any element in the list below to focus its shape on the map canvas.
                        </p>
                        <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                          {validationResult.elements && validationResult.elements.length > 0 ? (
                            validationResult.elements.map((elem) => {
                              const isFocused = activeVisualElementId === elem.id;
                              return (
                                <div
                                  key={elem.id}
                                  onClick={() => setActiveVisualElementId(elem.id)}
                                  className={`p-2.5 bg-white hover:bg-slate-50 flex justify-between items-start gap-2 cursor-pointer transition-colors ${
                                    isFocused ? "bg-indigo-50/50 font-bold border-l-2 border-l-indigo-500" : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-800 truncate">
                                      {elem.name || elem.id}
                                    </div>
                                    <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                                      ID: {elem.id}
                                    </p>
                                  </div>
                                  <span className="font-mono text-[8.5px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                                    {elem.type}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-3 text-center text-slate-400">
                              No parsed elements details.
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {!isValidating && !validationResult && !validationError && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No model checked yet. Please switch to a file or upload one.
                    </div>
                  )}
                </div>
              )}

              {/* EDIT SPECIFICATION / PROPERTIES DESIGNER TAB */}
              {rightPanelTab === "edit" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      BPMN/DMN Properties & Structural Designer
                    </h3>
                    <p className="text-[10.5px] text-slate-500 leading-normal">
                      Adjust attribute naming and symbol types directly in the XML schema, or append standard-compliant connected events, gates, and tasks.
                    </p>
                  </div>

                  {modificationError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-xs">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-rose-950">Refactoring Failure</h4>
                        <p className="text-rose-700 leading-normal mt-0.5">{modificationError}</p>
                      </div>
                    </div>
                  )}

                  {modificationSuccessMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-emerald-950">Refactored Successfully</h4>
                        <p className="text-emerald-700 leading-normal mt-0.5">{modificationSuccessMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Selected element controls */}
                  {activeVisualElementId ? (
                    (() => {
                      const selectedElem = validationResult?.elements?.find((e) => e.id === activeVisualElementId);
                      const isBpmn = selectedFile?.type === "bpmn";
                      const availableTypes = isBpmn ? BPMN_ELEMENT_TYPES : DMN_ELEMENT_TYPES;

                      return (
                        <div className="space-y-4 pt-1">
                          
                          {/* Selected Node card layout details */}
                          <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                            <div className="text-[9px] text-slate-400 font-mono uppercase font-bold tracking-wider mb-2">
                              Selected Node Coordinates
                            </div>
                            <div className="flex items-center gap-2 justify-between">
                              <span className="text-xs font-bold font-mono text-indigo-700 truncate max-w-[150px]">
                                {activeVisualElementId}
                              </span>
                              <span className="px-1.5 py-0.5 text-[8.5px] font-mono font-bold bg-white border border-slate-200 rounded uppercase text-slate-500 shrink-0">
                                {selectedElem?.type || "unknown"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 italic">
                              Click elements on the interactive map directly to switch selected node focus.
                            </p>
                          </div>

                          {/* PART A: Modify properties attributes */}
                          <div className="space-y-3 bg-white p-3.5 border border-slate-150 rounded-xl shadow-xs">
                            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                              Configure Element Attributes
                            </h4>

                            <div className="space-y-2.5">
                              {/* Element Name */}
                              <div className="space-y-1">
                                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                                  Display Name / Label
                                </label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                                  placeholder="e.g. Approve Loan Credit Check"
                                />
                              </div>

                              {/* Element Type Dropdown */}
                              <div className="space-y-1">
                                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                                  Standard Symbol Type
                                </label>
                                <select
                                  value={editType}
                                  onChange={(e) => setEditType(e.target.value)}
                                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 cursor-pointer"
                                >
                                  <option value="">-- Switch Standard Type --</option>
                                  {availableTypes.map((typ) => (
                                    <option key={typ.value} value={typ.value}>
                                      {typ.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Apply modification button */}
                              <button
                                onClick={() => handleModifyModel("update", activeVisualElementId, { name: editName, type: editType })}
                                disabled={isModifying || (!editName && !editType)}
                                className="w-full mt-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                {isModifying ? (
                                  <>
                                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                    Regenerating BPMN Schema...
                                  </>
                                ) : (
                                  <>
                                    Save Properties / Re-validate
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* PART B: Append connected visual flow elements (sequential splicing) */}
                          <div className="space-y-3 bg-white p-3.5 border border-slate-150 rounded-xl shadow-xs">
                            <div>
                              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                                Append Connected Task/Gate
                              </h4>
                              <p className="text-[9.5px] text-slate-400 mt-0.5 leading-normal">
                                Splices a brand new task or exclusive gate downstream sequence right after this element.
                              </p>
                            </div>

                            <div className="space-y-2.5 pt-1 border-t border-slate-100">
                              {/* Select type */}
                              <div className="space-y-1">
                                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                                  Activity Type
                                </label>
                                <select
                                  value={appendTypeName}
                                  onChange={(e) => setAppendTypeName(e.target.value)}
                                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-800 cursor-pointer"
                                >
                                  {availableTypes.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* New element Name */}
                              <div className="space-y-1">
                                <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                                  New Activity Label
                                </label>
                                <input
                                  type="text"
                                  value={appendName}
                                  onChange={(e) => setAppendName(e.target.value)}
                                  placeholder="e.g. Double Check Credit Risk Score"
                                  className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                                />
                              </div>

                              {/* Sequence Condition */}
                              {isBpmn && (
                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                                    <span>Route Branch Condition</span>
                                    <span className="text-[8.5px] font-normal text-slate-400 lowercase font-serif italic">optional</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={appendCondition}
                                    onChange={(e) => setAppendCondition(e.target.value)}
                                    placeholder="e.g. score >= 700"
                                    className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                                  />
                                  <p className="text-[9px] text-slate-400 leading-tight">
                                    Applied on the generated connector if appending task from exclusive gateway outputs.
                                  </p>
                                </div>
                              )}

                              {/* Append activity button */}
                              <button
                                onClick={() => handleModifyModel("add", activeVisualElementId, { appendNode: { type: appendTypeName, name: appendName, condition: appendCondition } })}
                                disabled={isModifying || !appendName}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-750 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                {isModifying ? (
                                  <>
                                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                    Refactoring Flow Lines...
                                  </>
                                ) : (
                                  <>
                                    Insert Connected Activity
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* PART C: Destructive elements removal and auto-repair connections */}
                          <div className="p-3.5 border border-rose-150 bg-rose-50/20 rounded-xl space-y-2.5">
                            <div>
                              <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                                <Trash2 className="w-4 h-4 text-rose-600" />
                                Danger Zone
                              </h4>
                              <p className="text-[9.5px] text-rose-700/80 mt-0.5 leading-normal font-medium">
                                Removing this node will auto-bridge gap connections and heal all incoming/outgoing flows to maintain XML structure integrity.
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to purge element "${selectedElem?.name || activeVisualElementId}" from the diagram? connections will be auto-healed.`)) {
                                  handleModifyModel("delete", activeVisualElementId);
                                }
                              }}
                              disabled={isModifying}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-700 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {isModifying ? (
                                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                "Purge Shape & Auto-Heal Sequence Connector"
                              )}
                            </button>
                          </div>

                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-5 border border-dashed border-slate-200 bg-slate-50 rounded-xl text-center select-none py-10">
                      <Sliders className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                      <h4 className="text-xs font-bold text-slate-700">No Target Selection Detected</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1 max-w-[240px] mx-auto">
                        Click on any node shape within the Interactive Process Map, or select one from the catalog list below, to open editing properties.
                      </p>

                      {validationResult?.elements && validationResult.elements.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200/60 max-w-[240px] mx-auto">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block text-left mb-1.5 font-mono">
                            Select Element From Registry
                          </label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setActiveVisualElementId(e.target.value);
                              }
                            }}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white outline-none text-slate-700 cursor-pointer shadow-xs"
                            defaultValue=""
                          >
                            <option value="" disabled>-- Choose Element --</option>
                            {validationResult.elements.map((el) => (
                              <option key={el.id} value={el.id}>
                                {el.name || el.id} ({el.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SANDBOX EXECUTION WORK TAB */}
              {rightPanelTab === "sandbox" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Interactive Simulation Run
                    </h3>
                    <p className="text-[10.5px] text-slate-500 leading-normal">
                      Customize dynamic parameters to test the runtime paths and trace outputs based on variables.
                    </p>
                  </div>

                  {/* Empty inputs alert */}
                  {(!validationResult?.inputVariables || validationResult.inputVariables.length === 0) && (
                    <div className="p-3 bg-amber-50 text-amber-800 text-[11px] rounded-lg border border-amber-100">
                      No external parameters discovered yet. Use "GenAI Tests" to generate cases automatically!
                    </div>
                  )}

                  {/* Variables listing input */}
                  {validationResult?.inputVariables && validationResult.inputVariables.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {validationResult.inputVariables.map((v) => (
                        <div key={v.name} className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-150/50">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span className="font-mono text-indigo-700">{v.name}</span>
                            <span className="text-[9px] font-normal text-slate-400 uppercase font-mono tracking-wide bg-white px-1 rounded border border-slate-200">
                              {v.type}
                            </span>
                          </label>

                          {v.type === "boolean" ? (
                            <select
                              value={simulationInputs[v.name] !== undefined ? String(simulationInputs[v.name]) : "false"}
                              onChange={(e) =>
                                setSimulationInputs((prev) => ({
                                  ...prev,
                                  [v.name]: e.target.value === "true",
                                }))
                              }
                              className="w-full text-xs p-1.5 border border-slate-200 rounded focus:border-indigo-500 outline-none bg-white font-medium cursor-pointer"
                            >
                              <option value="false">False / No</option>
                              <option value="true">True / Yes</option>
                            </select>
                          ) : v.allowedValues && v.allowedValues.length > 0 ? (
                            <select
                              value={simulationInputs[v.name] || ""}
                              onChange={(e) =>
                                setSimulationInputs((prev) => ({
                                  ...prev,
                                  [v.name]: e.target.value,
                                }))
                              }
                              className="w-full text-xs p-1.5 border border-slate-200 rounded focus:border-indigo-500 outline-none bg-white font-medium cursor-pointer"
                            >
                              <option value="">-- Select option --</option>
                              {v.allowedValues.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={v.type === "number" ? "number" : "text"}
                              value={simulationInputs[v.name] ?? ""}
                              placeholder={v.description || `Enter ${v.type}`}
                              onChange={(e) => {
                                const rawVal = e.target.value;
                                setSimulationInputs((prev) => ({
                                  ...prev,
                                  [v.name]: v.type === "number" ? (rawVal === "" ? "" : Number(rawVal)) : rawVal,
                                }));
                              }}
                              className="w-full text-xs p-1.5 border border-slate-200 rounded focus:border-indigo-500 outline-none bg-white font-medium"
                            />
                          )}
                          {v.description && (
                            <p className="text-[10px] text-slate-400 italic">
                              {v.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual object extra overrules */}
                  <details className="text-xs group border border-slate-200 rounded-lg">
                    <summary className="p-2 cursor-pointer text-[10.5px] font-bold text-slate-500 group-open:border-b border-slate-200 select-none">
                      + Custom Field Overrule Parameters
                    </summary>
                    <div className="p-2.5 bg-slate-50 space-y-2">
                      <div className="flex gap-1.5">
                        <input
                          id="compact-key-override"
                          type="text"
                          placeholder="Key e.g. age"
                          className="w-1/2 p-1 text-[11px] border border-slate-200 rounded bg-white"
                        />
                        <input
                          id="compact-val-override"
                          type="text"
                          placeholder="Value e.g. 25"
                          className="w-1/2 p-1 text-[11px] border border-slate-200 rounded bg-white"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const kEl = document.getElementById("compact-key-override") as HTMLInputElement;
                          const vEl = document.getElementById("compact-val-override") as HTMLInputElement;
                          if (kEl && vEl && kEl.value.trim() !== "") {
                            let valStr: any = vEl.value;
                            if (vEl.value === "true") valStr = true;
                            else if (vEl.value === "false") valStr = false;
                            else if (!isNaN(Number(vEl.value)) && vEl.value !== "") valStr = Number(vEl.value);
                            
                            setSimulationInputs((prev) => ({
                              ...prev,
                              [kEl.value.trim()]: valStr,
                            }));
                            kEl.value = "";
                            vEl.value = "";
                          }
                        }}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 rounded text-slate-700 cursor-pointer"
                      >
                        Inject Overrule Key
                      </button>
                    </div>
                  </details>

                  {/* Trigger execution simulation action */}
                  <div className="pt-2">
                    <button
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs outline-none cursor-pointer"
                    >
                      {isSimulating ? (
                        <>
                          <RotateCw className="w-4.5 h-4.5 animate-spin" />
                          Running Trace Analysis...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                          Execute Sandbox Testing Trace
                        </>
                      )}
                    </button>
                    {simulationError && (
                      <p className="text-[11px] text-rose-600 font-semibold mt-2.5 bg-rose-50 border border-rose-100 p-2 rounded-lg leading-normal">
                        {simulationError}
                      </p>
                    )}
                  </div>

                  {/* Simulated timeline trace and state tracking */}
                  {simulationResult && (
                    <div className="space-y-4 pt-3 border-t border-slate-100 animate-slide-up">
                      
                      {/* Summary text */}
                      <div className="p-3 bg-emerald-50 text-slate-800 rounded-xl border border-emerald-100">
                        <h4 className="text-[9.5px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
                          Simulation Summary:
                        </h4>
                        <p className="text-xs font-medium text-slate-800 leading-snug">
                          {simulationResult.summary}
                        </p>
                      </div>

                      {/* Traced step-by-step element nodes */}
                      <div className="space-y-3">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          Executed Path Steps ({simulationResult.executionPath?.length || 0})
                        </h4>
                        
                        <div className="relative border-l border-indigo-100 pl-3.5 ml-2.5 space-y-3.5 text-xs">
                          {simulationResult.executionPath?.map((step, idx) => {
                            const isFocusedStep = step.elementId && activeVisualElementId && step.elementId === activeVisualElementId;
                            
                            return (
                              <div key={idx} className="relative">
                                {/* Dot */}
                                <div className={`absolute -left-[22.5px] top-1.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  isFocusedStep ? "bg-indigo-600 border-indigo-600 text-white" : "bg-indigo-50 border-indigo-200 text-indigo-700"
                                }`}>
                                  <span className="text-[8px] font-bold">{step.stepNumber}</span>
                                </div>

                                <div
                                  onClick={() => {
                                    if (step.elementId) {
                                      setActiveVisualElementId(step.elementId);
                                    }
                                  }}
                                  className={`p-2.5 border rounded-lg transition-all cursor-pointer ${
                                    isFocusedStep
                                      ? "bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-400/10 shadow-3xs"
                                      : "bg-white border-slate-150 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <h5 className="font-bold text-slate-800 truncate">
                                      {step.elementName || "Gate / Decision Step"}
                                    </h5>
                                    <span className="text-[8px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1 rounded uppercase tracking-wide shrink-0">
                                      {step.actionType}
                                    </span>
                                  </div>
                                  
                                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-normal">
                                    {step.description}
                                  </p>

                                  {step.elementId && (
                                    <span className="text-[9px] text-indigo-600 underline font-semibold mt-1 block">
                                      {isFocusedStep ? "✓ Map Center Active" : "(Spot on Map)"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Evaluated variables */}
                      {simulationResult.finalOutputs && simulationResult.finalOutputs.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            Final Evaluated Outcomes
                          </h4>
                          {simulationResult.finalOutputs.map((out) => (
                            <div key={out.name} className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-slate-700 truncate">{out.name}</span>
                                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  {String(out.value)}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-slate-500 mt-1 leading-normal">
                                {out.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}

              {/* OUT OF BOX GENAI TEST TAB AREA */}
              {rightPanelTab === "gentest" && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      AI Optimized Boundary Coverages
                    </h3>
                    <p className="text-[10.5px] text-slate-500 leading-normal">
                      Leverage Gemini 3.5 validation models to explore maximum conditional combinations, edge metrics, and error sequences automatically.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateTestSuites}
                    disabled={isGeneratingCases}
                    className="w-full py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition-all outline-none cursor-pointer"
                  >
                    {isGeneratingCases ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        Generating compliance tests...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        Optimize Model Coverage (5 Cases)
                      </>
                    )}
                  </button>

                  {generationError && (
                    <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 border border-rose-100 p-2 rounded-lg">
                      {generationError}
                    </p>
                  )}

                  {/* Tests suite scenarios */}
                  {generatedCases.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      {generatedCases.map((tc, index) => {
                        return (
                          <div
                            key={index}
                            className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-2xs transition-all text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                tc.type === "happy_path"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : tc.type === "edge_case"
                                    ? "bg-amber-100 text-amber-800"
                                    : tc.type === "error_path"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-slate-100 text-slate-800"
                              }`}>
                                {tc.type.replace("_", " ")}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">Case #{index + 1}</span>
                            </div>

                            <h4 className="font-bold text-slate-850 mt-1.5">
                              {tc.title}
                            </h4>

                            <p className="text-[10.5px] text-slate-500 mt-1 leading-normal">
                              {tc.description}
                            </p>

                            <div className="mt-2.5 bg-slate-50 p-2 rounded border border-slate-100 text-[10.5px]">
                              <span className="font-bold text-slate-400 block mb-1">Inputs config:</span>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(tc.inputs || {}).map(([k, v]) => (
                                  <span key={k} className="text-[9.5px] bg-white border border-slate-150 px-1.5 py-0.2 rounded font-mono">
                                    {k}: <span className="text-indigo-600 font-bold">{String(v)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mt-2 text-[10.5px]">
                              <span className="font-bold text-slate-700">Expected:</span>
                              <p className="text-slate-500 leading-normal mt-0.5">{tc.expectedOutcome}</p>
                            </div>

                            <button
                              onClick={() => applyTestCaseInputs(tc.inputs)}
                              className="w-full mt-2.5 py-1 bg-slate-50 hover:bg-slate-100 hover:text-indigo-700 border border-slate-200 text-[10.5px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              Load Preset Parameters & Run
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !isGeneratingCases && (
                      <div className="py-6 text-center text-slate-400 text-[11px]">
                        No test suite loaded yet. Click optimized coverage to generate.
                      </div>
                    )
                  )}

                </div>
              )}

            </div>

            {/* Bottom info banner */}
            <div className="mt-auto p-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0 text-[10px] text-slate-400">
              <span className="font-mono flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-300" />
                Workflow Persisted Sandbox
              </span>
              <a
                href="https://www.omg.org/spec/BPMN/2.0/"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline font-semibold"
              >
                OMG Specs Specs
              </a>
            </div>

          </aside>

        </div>

      </main>

      {/* MODEL INVENTORY OVERLAY POPUP / CLOSEABLE MODAL DIALOG */}
      {/* "History/standard out of box examples again can be accessed by clicking a button, does not have to be a part of the default display" */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in pl-4 pr-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200/80 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transform transition-all animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-indigo-600" />
                <div>
                  <h3 className="font-sans font-extrabold text-sm text-slate-900 leading-none">
                    BPMN & DMN Model Library
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Select a sample workspace model or upload a file to evaluate.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Contents */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* COMPACT UPLOAD ELEMENT */}
              <div className="bg-indigo-50/40 border border-indigo-100/60 p-3.5 rounded-xl text-center">
                <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                  Upload custom file model
                </h4>
                <p className="text-[10px] text-slate-500 mb-2.5">
                  Load any standard OMG .bpmn or .dmn mapping directly to analyze instantly.
                </p>
                
                <label
                  htmlFor="dropzone-file-library"
                  className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs gap-1.5 shadow-sm cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Select Model XML File
                  <input
                    id="dropzone-file-library"
                    type="file"
                    accept=".bpmn,.dmn,.xml"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processUploadFile(e.target.files[0]);
                        setIsLibraryOpen(false); // Auto close
                      }
                    }}
                  />
                </label>
              </div>

              {/* Standard Out-of-Box Samples */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Standard Out-of-Box Samples
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {files
                    .filter((f) => f.isPreloaded)
                    .map((file) => {
                      const isSelected = file.id === selectedFileId;
                      return (
                        <div
                          key={file.id}
                          onClick={() => {
                            setSelectedFileId(file.id);
                            setIsLibraryOpen(false);
                          }}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50 text-indigo-950 font-bold shadow-xs"
                              : "border-slate-150 bg-slate-50 hover:bg-slate-100/50 hover:border-slate-350 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                            <span className="truncate font-medium">{file.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide font-mono ${
                              file.type === "bpmn"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}>
                              {file.type}
                            </span>
                            {isSelected && <span className="text-[10px] text-indigo-600 font-bold font-mono">✓ ACTIVE</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Uploaded custom models deck */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Your Uploaded Models ({files.filter((f) => !f.isPreloaded).length})
                </h4>
                {files.filter((f) => !f.isPreloaded).length === 0 ? (
                  <div className="py-6 text-center border border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-[10.5px] text-slate-400">
                    Your uploaded history sandbox list is currently empty.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {files
                      .filter((f) => !f.isPreloaded)
                      .map((file) => {
                        const isSelected = file.id === selectedFileId;
                        return (
                          <div
                            key={file.id}
                            onClick={() => {
                              setSelectedFileId(file.id);
                              setIsLibraryOpen(false);
                            }}
                            className={`group p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs"
                                : "border-slate-150 bg-white hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <FileText className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                              <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                            </div>

                            <div className="flex items-center gap-2 pl-2">
                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide font-mono ${
                                file.type === "bpmn"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}>
                                {file.type}
                              </span>
                              <button
                                onClick={(e) => handleDeleteFile(file.id, e)}
                                title="Remove file"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-150 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-slate-400">
                Stored persistently inside sandbox.
              </span>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
