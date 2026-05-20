import React, { useState, useEffect } from "react";
import { Play, Check, AlertCircle, RefreshCw } from "lucide-react";

interface XmlEditorProps {
  xml: string;
  onSaveXml: (newXml: string) => void;
  isSaving: boolean;
}

export function XmlEditor({ xml, onSaveXml, isSaving }: XmlEditorProps) {
  const [editedXml, setEditedXml] = useState(xml);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setEditedXml(xml);
    setIsDirty(false);
  }, [xml]);

  const handleXmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedXml(e.target.value);
    setIsDirty(e.target.value !== xml);
  };

  const handleSave = () => {
    onSaveXml(editedXml);
    setIsDirty(false);
  };

  // Generate line numbers column
  const lineCount = editedXml.split("\n").length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
      {/* Editor Header Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-xs font-mono font-semibold text-slate-300 ml-2">
            model.xml Source Editor
          </span>
        </div>
        
        {/* Save & Run Validation button */}
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Unsaved adjustments
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              isDirty
                ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm cursor-pointer"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Check className="w-3 h-3" />
                Apply Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Work Surface */}
      <div className="flex flex-1 overflow-hidden font-mono text-xs">
        {/* Line Numbers column */}
        <pre className="p-3 bg-slate-950/75 text-slate-600 select-none text-right pr-4 border-r border-slate-800 shrink-0 leading- relaxed font-normal">
          {lineNumbers}
        </pre>

        {/* XML Textarea Input */}
        <textarea
          value={editedXml}
          onChange={handleXmlChange}
          placeholder="Paste or write BPMN/DMN XML schema specification here..."
          className="flex-1 p-3 bg-slate-900 text-slate-100 placeholder-slate-600 focus:outline-none resize-none leading-relaxed overflow-y-auto whitespace-pre font-mono selection:bg-indigo-800 selection:text-white"
          spellCheck={false}
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
}
