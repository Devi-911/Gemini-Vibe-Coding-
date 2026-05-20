import React, { useState } from "react";
import { ModelFile } from "../types";
import { SAMPLE_MODELS } from "../data/examples";
import { Upload, FileText, Plus, Database, Trash2, Code } from "lucide-react";

interface SidebarProps {
  files: ModelFile[];
  selectedFileId: string | null;
  onSelectFile: (file: ModelFile) => void;
  onUploadFile: (name: string, xml: string, type: "bpmn" | "dmn") => void;
  onDeleteFile: (id: string) => void;
}

export function Sidebar({
  files,
  selectedFileId,
  onSelectFile,
  onUploadFile,
  onDeleteFile,
}: SidebarProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    setUploadError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setUploadError("Could not read empty file.");
        return;
      }
      const detected = detectTypeFromXml(text);
      if (detected === "unknown") {
        setUploadError("This does not appear to be a standard BPMN 2.0 or DMN 1.3 XML file.");
        return;
      }
      onUploadFile(file.name, text, detected as "bpmn" | "dmn");
    };
    reader.onerror = () => {
      setUploadError("Failed to read file.");
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* App Header Brand */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <h1 className="font-display font-bold text-lg text-slate-900 tracking-tight">
            Testing Lab Workspace
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          BPMN Processes & DMN Decision Models
        </p>
      </div>

      {/* Upload Drag & Drop Zone */}
      <div className="p-4">
        <label
          htmlFor="dropzone-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleFileDrop}
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/30"
              : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <Upload className="w-8 h-8 text-slate-400 mb-2 transition-colors group-hover:text-indigo-500" />
            <p className="text-xs font-semibold text-slate-700">
              Drag & drop model file
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Supports .bpmn, .dmn, or standard .xml
            </p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            accept=".bpmn,.dmn,.xml"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </label>
        {uploadError && (
          <p className="text-xs text-rose-600 mt-2 font-medium bg-rose-50 border border-rose-100 p-2 rounded-lg">
            {uploadError}
          </p>
        )}
      </div>

      {/* Saved & Sample Models Checklist */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Sample models */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Standard Out-of-Box Samples
          </h3>
          <div className="space-y-1.5">
            {files
              .filter((f) => f.isPreloaded)
              .map((file) => {
                const isSelected = file.id === selectedFileId;
                return (
                  <button
                    key={file.id}
                    onClick={() => onSelectFile(file)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 font-medium font-semibold shadow-sm"
                        : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase tracking-wide font-mono ${
                      file.type === "bpmn"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-indigo-100 text-indigo-800"
                    }`}>
                      {file.type}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Custom Uploaded History list */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Uploaded Models Sandbox
          </h3>
          {files.filter((f) => !f.isPreloaded).length === 0 ? (
            <div className="text-center py-6 px-4 bg-slate-50/40 border border-dashed border-slate-200/50 rounded-lg">
              <Code className="w-5 h-5 text-slate-300 mx-auto mb-1" />
              <p className="text-[10px] text-slate-400">
                Uploaded models will persist in your local workspace sandbox.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {files
                .filter((f) => !f.isPreloaded)
                .map((file) => {
                  const isSelected = file.id === selectedFileId;
                  return (
                    <div
                      key={file.id}
                      className={`group w-full rounded-lg border text-xs flex items-center justify-between transition-all p-1.5 pl-2.5 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <button
                        onClick={() => onSelectFile(file)}
                        className="flex-1 text-left min-w-0 pr-2 flex items-center gap-2"
                      >
                        <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="truncate font-medium">{file.name}</span>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wide font-mono ${
                          file.type === "bpmn"
                            ? "bg-emerald-100/70 text-emerald-800"
                            : "bg-indigo-100/70 text-indigo-800"
                        }`}>
                          {file.type}
                        </span>
                        <button
                          onClick={() => onDeleteFile(file.id)}
                          title="Delete file"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-80 group-hover:opacity-100"
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
    </div>
  );
}
