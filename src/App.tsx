import React, { useState, useEffect } from "react";
import { ModelFile, ValidationResponse, SimulationResult, TestCase } from "./types";
import { SAMPLE_MODELS } from "./data/examples";
import { Sidebar } from "./components/Sidebar";
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
  Send,
  ArrowRight,
  Database,
  ExternalLink,
  Plus,
  Network
} from "lucide-react";

export default function App() {
  const [files, setFiles] = useState<ModelFile[]>(() => {
    // Try restoring state from localStorage to persist user workflows
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

  const [selectedFileId, setSelectedFileId] = useState<string | null>(SAMPLE_MODELS[0].id);
  const [activeTab, setActiveTab] = useState<"validate" | "simulate" | "tests">("validate");

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
  const handleDeleteFile = (id: string) => {
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

  // Trigger valuation on file select change
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
    setActiveTab("simulate");
  };

  // Generate and download standard XML compliance logs + Test suite reports as readable JSON artifact
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
    <div className="flex w-full h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* Sidebar Section */}
      <aside className="w-80 shrink-0">
        <Sidebar
          files={files}
          selectedFileId={selectedFileId}
          onSelectFile={(f) => {
            setSelectedFileId(f.id);
          }}
          onUploadFile={handleUploadFile}
          onDeleteFile={handleDeleteFile}
        />
      </aside>

      {/* Main Sandbox Frame */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Workspace Top Header Nav Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-base font-semibold text-slate-800 font-display truncate">
              {selectedFile ? selectedFile.name : "Select or Upload a file"}
            </h2>
            {selectedFile && (
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded uppercase tracking-wider shrink-0 ${
                selectedFile.type === "bpmn"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-100"
              }`}>
                {selectedFile.type.toUpperCase()} MODEL
              </span>
            )}
            
            {selectedFile?.isPreloaded && (
              <button
                onClick={handleResetToStock}
                title="Revert modified XML structure back to initial demo stock standard"
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 ml-1 select-none"
              >
                <RotateCw className="w-3 h-3" /> Revert to Sample
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Download summary log button in top boundary */}
            {validationResult && (
              <button
                onClick={handleDownloadReport}
                className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                Export Suitest Report
              </button>
            )}

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500 font-medium">Validation Hub Ready</span>
            </div>
          </div>
        </header>

        {/* Outer Application Structure Viewport */}
        <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">
          
          {/* Left panel: Source XML Code Editor (fixed-span span-6) */}
          <section className="col-span-6 flex flex-col h-full overflow-hidden">
            {selectedFile ? (
              <XmlEditor
                xml={selectedFile.xml}
                onSaveXml={handleSaveXml}
                isSaving={isValidating}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-8 text-center">
                <Database className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="font-semibold text-slate-800 text-sm">No Active Model Workspace</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Please select an existing BPMN process or DMN decision model from the sidebar to start live evaluation.
                </p>
              </div>
            )}
          </section>

          {/* Right panel: Live Analysis results, Sandbox Simulation, and Generated inputs (span-6) */}
          <section className="col-span-6 flex flex-col h-full overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
            
            {/* Tab navigation headers */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 p-1 shrink-0">
              <nav className="flex space-x-1">
                <button
                  onClick={() => setActiveTab("validate")}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                    activeTab === "validate"
                      ? "bg-white text-slate-900 border border-slate-200/50 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                  Compliance & Analysis
                </button>
                <button
                  onClick={() => setActiveTab("simulate")}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                    activeTab === "simulate"
                      ? "bg-white text-slate-900 border border-slate-200/50 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  Sandbox Execution Run
                </button>
                <button
                  onClick={() => setActiveTab("tests")}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                    activeTab === "tests"
                      ? "bg-white text-slate-900 border border-slate-200/50 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  GenAI Test Scenarios
                </button>
              </nav>

              <div className="pr-3 text-[10px] text-slate-400 font-mono">
                {validationResult?.fileType ? validationResult.fileType.toUpperCase() : "XML"} Engine
              </div>
            </div>

            {/* TAB CONTENT SPANS */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0">
              
              {/* 1. Validation Analysis TAB */}
              {activeTab === "validate" && (
                <div className="space-y-6">
                  {/* Validation error from fetch */}
                  {validationError && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-900">Verification Failure</h4>
                        <p className="text-xs text-rose-700/85 mt-1">{validationError}</p>
                        <p className="text-[10px] text-slate-500 mt-2 bg-white/70 p-2 rounded leading-relaxed border border-rose-100">
                          Please ensure you have configured <code className="font-semibold text-rose-800">GEMINI_API_KEY</code> within AI Studio Secrets panel.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Loading block Indicator */}
                  {isValidating && (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <RotateCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                      <h4 className="font-semibold text-slate-800 text-sm">Analyzing XML Semantics</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Consulting Gemini engine to extract structural hierarchies, trace logical forks, and look for compliance issues according to the BPMN 2.0 / DMN 1.3 definitions.
                      </p>
                    </div>
                  )}

                  {/* Render analysis result once retrieved */}
                  {!isValidating && validationResult && (
                    <div className="space-y-5 animate-fade-in">
                      
                      {/* Model Overview Banner */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Model Summary
                        </h4>
                        <h3 className="text-sm font-bold text-slate-800 font-display">
                          {validationResult.modelName || selectedFile?.name}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                          {validationResult.description || "No model description was extracted."}
                        </p>
                      </div>

                      {/* Interactive Visual Graph Sequence Flow Canvas */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                          <Network className="w-3.5 h-3.5 text-slate-500" />
                          Interactive Process & Decision Map
                        </h4>
                        <ModelVisualizer
                          graph={validationResult.visualGraph}
                          fileType={validationResult.fileType}
                          activeElementId={activeVisualElementId}
                          onSelectNode={(nodeId) => setActiveVisualElementId(nodeId)}
                        />
                      </div>

                      {/* Issues and Compliance Checklist */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          Compliance Audits ({validationResult.issues?.length || 0})
                        </h4>

                        {!validationResult.issues || validationResult.issues.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <div>
                              <div className="text-xs font-bold text-emerald-950">Valid Model Specification</div>
                              <p className="text-[11px] text-emerald-700/80">No fatal blockages, sequence flaws, or unreachable outcomes were detected.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {validationResult.issues.map((issue) => {
                              const isError = issue.severity === "error";
                              const isWarning = issue.severity === "warning";
                              
                              return (
                                <div
                                  key={issue.id}
                                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-colors ${
                                    isError
                                      ? "bg-rose-50/40 border-rose-200"
                                      : isWarning
                                        ? "bg-amber-50/30 border-amber-200"
                                        : "bg-blue-50/20 border-blue-200"
                                  }`}
                                >
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                    isError
                                      ? "bg-rose-100 text-rose-700"
                                      : isWarning
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-blue-100 text-blue-700"
                                  }`}>
                                    {isError ? "!" : isWarning ? "?" : "i"}
                                  </div>
                                  
                                  <div className="min-w-0 flex-1">
                                    <div className={`text-xs font-bold truncate ${
                                      isError
                                        ? "text-rose-950"
                                        : isWarning
                                          ? "text-amber-950"
                                          : "text-blue-950"
                                    }`}>
                                      {issue.message}
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                      {issue.detail}
                                    </p>
                                    
                                    {issue.elementId && (
                                      <div className="mt-1.5">
                                        <span className="text-[9px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md font-mono text-slate-600 text-ellipsis overflow-hidden inline-block max-w-full">
                                          Element ID: {issue.elementId}
                                        </span>
                                      </div>
                                    )}

                                    {issue.fixSuggestion && (
                                      <div className="mt-2.5 p-2 bg-white/70 border border-slate-100 rounded-lg text-[11px]">
                                        <span className="font-semibold text-slate-700 block">Proposed Fix:</span>
                                        <p className="text-slate-600 mt-0.5">{issue.fixSuggestion}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Extracted Flow Elements Registry */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                          Model Elements Registry ({validationResult.elements?.length || 0})
                        </h4>
                        <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                          {validationResult.elements && validationResult.elements.length > 0 ? (
                            validationResult.elements.map((elem) => (
                              <div key={elem.id} className="p-3 bg-white hover:bg-slate-50/50 flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-800 bg-white inline-block">
                                    {elem.name || "Unnamed Component"}
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {elem.description || "Constituent element inside the XML scheme definition."}
                                  </p>
                                </div>
                                <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider shrink-0">
                                  {elem.type || "Element"}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-slate-400">
                              No parsed elements to display. Use clean BPMN XML.
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {!isValidating && !validationResult && !validationError && (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No model analyzed yet. Choose a file to initialize dynamic checking.
                    </div>
                  )}
                </div>
              )}

              {/* 2. Sandbox Simulation TAB */}
              {activeTab === "simulate" && (
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                      <Sliders className="w-4 h-4 text-indigo-500" />
                      Dynamic Parameters Config
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Customise input parameters derived from Gemini's analysis of variables checking to trace branches, evaluate decisions, and verify specific process scopes.
                    </p>
                  </div>

                  {/* Empty warning if no variables found */}
                  {(!validationResult?.inputVariables || validationResult.inputVariables.length === 0) && (
                    <div className="p-3 bg-amber-50/55 text-amber-800 text-xs rounded-lg border border-amber-100/50">
                      No external inputs were auto-detected. Click "GenAI Test Scenarios" tab to search the model's parameters and propose inputs automatically!
                    </div>
                  )}

                  {/* Dynamic inputs construction grid */}
                  {validationResult?.inputVariables && validationResult.inputVariables.length > 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {validationResult.inputVariables.map((v) => {
                          return (
                            <div key={v.name} className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <span className="font-mono text-indigo-600">{v.name}</span>
                                <span className="text-[9px] font-normal text-slate-400 capitalize bg-slate-100 px-1 rounded">
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
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none bg-white"
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
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none bg-white font-medium"
                                >
                                  <option value="">-- Choose option --</option>
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
                                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-indigo-500 outline-none bg-white"
                                />
                              )}
                              
                              <p className="text-[10px] text-slate-400 italic">
                                {v.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Let users dynamically inject extra parameters if model analyzer missed something */}
                      <div className="pt-2">
                        <details className="text-xs group border border-slate-150 rounded-lg">
                          <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-500 group-open:border-b border-slate-150 select-none">
                            + Manual Parameter Overrides (Advanced)
                          </summary>
                          <div className="p-3 bg-slate-50 space-y-2">
                            <p className="text-[10px] text-slate-500">
                              Manually add elements like custom approval flow states or flags not auto-discovered.
                            </p>
                            <div className="flex gap-2">
                              <input
                                id="custom-param-key"
                                type="text"
                                placeholder="Key (e.g., customStatus)"
                                className="w-1/2 p-1.5 text-[11px] border border-slate-200 rounded bg-white"
                              />
                              <input
                                id="custom-param-val"
                                type="text"
                                placeholder="Value (e.g., APPROVED)"
                                className="w-1/2 p-1.5 text-[11px] border border-slate-200 rounded bg-white"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const kEl = document.getElementById("custom-param-key") as HTMLInputElement;
                                const vEl = document.getElementById("custom-param-val") as HTMLInputElement;
                                if (kEl && vEl && kEl.value.trim() !== "") {
                                  let finalValue: any = vEl.value;
                                  if (vEl.value === "true") finalValue = true;
                                  else if (vEl.value === "false") finalValue = false;
                                  else if (!isNaN(Number(vEl.value)) && vEl.value !== "") finalValue = Number(vEl.value);
                                  
                                  setSimulationInputs((prev) => ({
                                    ...prev,
                                    [kEl.value.trim()]: finalValue,
                                  }));
                                  kEl.value = "";
                                  vEl.value = "";
                                }
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 rounded text-slate-800 transition-colors"
                            >
                              Add Overwrite Object
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {/* Run sandbox trigger */}
                  <div className="pt-2">
                    <button
                      onClick={handleRunSimulation}
                      disabled={isSimulating}
                      className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      {isSimulating ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          Running Sandbox Trace...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                          Execute Sandbox Testing Trace
                        </>
                      )}
                    </button>
                    {simulationError && (
                      <p className="text-xs text-rose-600 font-semibold mt-3 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                        {simulationError}
                      </p>
                    )}
                  </div>

                  {/* Render simulated path outcome */}
                  {simulationResult && (
                    <div className="space-y-5 animate-fade-in border-t border-slate-100 pt-5">
                      
                      {/* Summary Banner */}
                      <div className="p-4 bg-emerald-50/45 border border-emerald-100 text-slate-800 rounded-xl">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          Dry-Run Outcome Summary
                        </h4>
                        <p className="text-xs font-medium text-slate-800">
                          {simulationResult.summary}
                        </p>
                      </div>

                      {/* Warnings if any during mock token passing */}
                      {simulationResult.warnings && simulationResult.warnings.length > 0 && (
                        <div className="space-y-1.5">
                          {simulationResult.warnings.map((warn, index) => (
                            <div key={index} className="flex gap-2 items-center text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <p className="truncate">{warn}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Trace Stepper timeline structure */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                          Token Sandbox Execution Path
                        </h4>
                        <div className="relative border-l border-indigo-100 pl-4 ml-2.5 space-y-4 text-xs">
                          {simulationResult.executionPath?.map((step, idx) => {
                            return (
                              <div key={idx} className="relative">
                                {/* Dot Indicator */}
                                <div className="absolute -left-[24.5px] top-1 w-4 h-4 rounded-full border border-indigo-200 bg-indigo-50 flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-indigo-700">{step.stepNumber}</span>
                                </div>

                                <div 
                                  onClick={() => {
                                    if (step.elementId) {
                                      setActiveVisualElementId(step.elementId);
                                      setActiveTab("validate");
                                    }
                                  }}
                                  className={`border rounded-xl p-3 shadow-none transition-all cursor-pointer ${
                                    activeVisualElementId === step.elementId
                                      ? "bg-indigo-50/50 border-indigo-450 ring-2 ring-indigo-400/10"
                                      : "bg-white border-slate-150 hover:border-slate-300 hover:shadow-xs"
                                  }`}
                                  title={step.elementId ? `Click to look up element '${step.elementId}' inside process canvas` : undefined}
                                >
                                  <div className="flex items-start justify-between gap-1.5">
                                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                                      {step.elementName || "Gate / Task Step"}
                                      {step.elementId && (
                                        <span className="text-[9px] text-indigo-500 font-medium underline">
                                          (Show Map)
                                        </span>
                                      )}
                                    </h5>
                                    
                                    <span className="text-[9px] font-mono font-medium text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded shrink-0">
                                      {step.actionType}
                                    </span>
                                  </div>
                                  
                                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                    {step.description}
                                  </p>

                                  {step.stateUpdate && (
                                    <div className="mt-1.5 bg-slate-50 p-1.5 rounded text-[9.5px] font-mono text-slate-500 overflow-x-auto">
                                      Update: {step.stateUpdate}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Final variables outputs evaluation */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Evaluated Output Variables
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {simulationResult.finalOutputs && simulationResult.finalOutputs.length > 0 ? (
                            simulationResult.finalOutputs.map((out) => (
                              <div key={out.name} className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                  <span className="text-[10px] font-bold">✓</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-slate-800">
                                      {out.name}
                                    </span>
                                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-ellipsis overflow-hidden">
                                      {String(out.value)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    {out.explanation}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-slate-400 text-xs">
                              No final model outcome parameters declared.
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {!simulationResult && !isSimulating && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Set input arguments and execute mock tokens tracing above to verify outcomes.
                    </div>
                  )}
                </div>
              )}

              {/* 3. Auto Gen test cases TAB */}
              {activeTab === "tests" && (
                <div className="space-y-6">
                  <div className="bg-indigo-50/50 border border-indigo-100/60 p-4 rounded-xl">
                    <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Dynamic Edge & Range Test Scenarios
                    </h3>
                    <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                      Instruct the underlying AI validation engine to discover all valid boundary values, error pathways, and alternative conditional branches. Leverage these for rigorous testing.
                    </p>
                  </div>

                  {/* Trigger suite estimation */}
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateTestSuites}
                      disabled={isGeneratingCases}
                      className="w-full py-2 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      {isGeneratingCases ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          Generating 5 compliance cases...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Optimize Model Path Coverage (5 cases)
                        </>
                      )}
                    </button>
                    {generationError && (
                      <p className="text-xs text-rose-600 font-semibold mt-3 bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                        {generationError}
                      </p>
                    )}
                  </div>

                  {/* Generated cases deck */}
                  {generatedCases.length > 0 && (
                    <div className="space-y-4 mt-6">
                      {generatedCases.map((tc, index) => {
                        return (
                          <div
                            key={index}
                            className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all flex flex-col justify-between"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
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
                                <h4 className="font-bold text-xs text-slate-800 mt-1.5">
                                  {tc.title}
                                </h4>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1">
                              {tc.description}
                            </p>

                            <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-400 block mb-1">Proposed Inputs:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(tc.inputs || {}).map(([key, val]) => (
                                  <span key={key} className="text-[10px] bg-white border border-slate-150 px-2 py-0.5 rounded font-mono">
                                    {key}: <span className="font-semibold text-indigo-700">{String(val)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mt-2.5 text-[11px] text-slate-600">
                              <span className="font-bold text-slate-700">Expected Outcome:</span>
                              <p className="text-slate-500 mt-0.5">{tc.expectedOutcome}</p>
                            </div>

                            <button
                              onClick={() => applyTestCaseInputs(tc.inputs)}
                              className="w-full mt-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-indigo-600 border border-slate-200 hover:border-indigo-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              Apply Preset Inputs to Sandbox
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {generatedCases.length === 0 && !isGeneratingCases && (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Run Optimize coverage function above to discover 5 valuable cases from the live XML model constraints automatically.
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Bottom Workspace Actions */}
            <div className="mt-auto p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] text-slate-500">
                  Fully client-persisted in local sandboxed storage.
                </span>
              </div>
              <a
                href="https://www.omg.org/spec/BPMN/2.0/"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
              >
                OMG Standard Specs <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

          </section>

        </div>

      </main>

    </div>
  );
}
