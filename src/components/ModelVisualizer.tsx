import React, { useState, useMemo, useRef, useEffect } from "react";
import { VisualGraph, VisualNode, VisualEdge, ValidationIssue } from "../types";
import { 
  Play, 
  HelpCircle, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Layers, 
  Sliders, 
  Activity, 
  Network,
  Plus,
  Trash2,
  GitCommit,
  Wand2,
  X,
  PlusCircle,
  AlertTriangle,
  FileDown,
  Sparkles,
  RefreshCw,
  CheckCircle,
  HelpCircle as HelpIcon,
  MousePointer,
  Sparkle
} from "lucide-react";

interface ModelVisualizerProps {
  graph?: VisualGraph;
  fileType: "bpmn" | "dmn" | "unknown" | "invalid";
  activeElementId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  // Enhanced interactive integration
  validationIssues?: ValidationIssue[];
  onModifyModel?: (action: "update" | "add" | "delete" | "connect" | "fix-issue", targetId: string, changes?: any) => Promise<void>;
  isModifying?: boolean;
}

export function ModelVisualizer({
  graph,
  fileType,
  activeElementId,
  onSelectNode,
  validationIssues = [],
  onModifyModel,
  isModifying = false,
}: ModelVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Drag State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // In-place properties conversion state
  const [localEditName, setLocalEditName] = useState("");
  const [localEditType, setLocalEditType] = useState("");

  // Custom panel dragging state (touch/cursor fallback of SVG drops)
  const [panelDraggingType, setPanelDraggingType] = useState<string | null>(null);
  const [panelDragMousePos, setPanelDragMousePos] = useState({ x: 0, y: 0 });
  
  // Custom user-positioned coordinates map saved in localStorage per model graph
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem(`model_positions_v1_${graph?.nodes?.[0]?.id || "default"}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Seamless Connect Tool State
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [trackerMousePos, setTrackerMousePos] = useState({ x: 0, y: 0 });

  // Custom task guards/constraints typed by user
  const [taskRuleInput, setTaskRuleInput] = useState("");
  const [customTaskRules, setCustomTaskRules] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem("custom_task_compliance_rules");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Auto-save customized task rules
  useEffect(() => {
    localStorage.setItem("custom_task_compliance_rules", JSON.stringify(customTaskRules));
  }, [customTaskRules]);

  // Handle active selected node focus
  useEffect(() => {
    if (activeElementId) {
      setSelectedNodeId(activeElementId);
    }
  }, [activeElementId]);

  // Compute a structured topological sorting fallback coordinate system 
  const laidOutNodes = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) return [];

    const nodes = [...graph.nodes];
    const edges = graph.edges || [];

    const adjList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    nodes.forEach((n) => {
      adjList[n.id] = [];
      inDegree[n.id] = 0;
    });

    edges.forEach((e) => {
      if (adjList[e.source] && adjList[e.target] !== undefined) {
        adjList[e.source].push(e.target);
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      }
    });

    const nodeLevels: Record<string, number> = {};
    const visited = new Set<string>();

    let currentQueue: string[] = nodes
      .filter((n) => {
        const typeL = n.type.toLowerCase();
        return (
          inDegree[n.id] === 0 ||
          typeL.includes("start") ||
          typeL.includes("input") ||
          typeL.includes("source")
        );
      })
      .map((n) => n.id);

    if (currentQueue.length === 0 && nodes.length > 0) {
      currentQueue = [nodes[0].id];
    }

    let currentLevel = 0;
    while (currentQueue.length > 0) {
      const nextQueue: string[] = [];
      currentQueue.forEach((nodeId) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        nodeLevels[nodeId] = currentLevel;

        const neighbors = adjList[nodeId] || [];
        neighbors.forEach((neigh) => {
          if (!visited.has(neigh)) {
            nextQueue.push(neigh);
          }
        });
      });
      currentQueue = nextQueue;
      currentLevel++;
      if (currentLevel > 40) break;
    }

    nodes.forEach((n) => {
      if (nodeLevels[n.id] === undefined) {
        nodeLevels[n.id] = currentLevel;
      }
    });

    const levelGroups: Record<number, string[]> = {};
    Object.entries(nodeLevels).forEach(([id, lvl]) => {
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(id);
    });

    const colWidth = 230;
    const rowHeight = 140;
    const startX = 80;
    const startY = 100;

    return nodes.map((n) => {
      const lvl = nodeLevels[n.id] || 0;
      const indexInLvl = levelGroups[lvl] ? levelGroups[lvl].indexOf(n.id) : 0;
      
      const defaultX = startX + lvl * colWidth;
      const defaultY = startY + indexInLvl * rowHeight;

      // Merge user custom manual dragged position if exists
      const hasCustom = nodePositions[n.id];
      const x = hasCustom ? hasCustom.x : defaultX;
      const y = hasCustom ? hasCustom.y : defaultY;

      return {
        ...n,
        x,
        y,
      };
    });
  }, [graph, nodePositions]);

  // Persist nodes positions immediately
  const savePositions = (pos: Record<string, { x: number; y: number }>) => {
    setNodePositions(pos);
    if (graph?.nodes?.[0]?.id) {
      localStorage.setItem(`model_positions_v1_${graph.nodes[0].id}`, JSON.stringify(pos));
    }
  };

  // Convert raw laid out coordinates to a map for edge routing
  const nodeCoords = useMemo(() => {
    const coords: Record<string, { x: number; y: number; type: string; label: string }> = {};
    laidOutNodes.forEach((n) => {
      coords[n.id] = { x: n.x, y: n.y, type: n.type, label: n.label };
    });
    return coords;
  }, [laidOutNodes]);

  // Active highlighted node issues
  const selectedNodeIssues = useMemo(() => {
    if (!selectedNodeId) return [];
    return validationIssues.filter((i) => i.elementId === selectedNodeId);
  }, [selectedNodeId, validationIssues]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return null;
    return graph?.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graph]);

  // Synchronize dynamic conversion properties
  useEffect(() => {
    if (selectedNodeData) {
      setLocalEditName(selectedNodeData.label || selectedNodeData.id);
      setLocalEditType(selectedNodeData.type || "");
    } else {
      setLocalEditName("");
      setLocalEditType("");
    }
  }, [selectedNodeId, selectedNodeData]);

  // Drag listeners
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedNodeId) {
        const svg = svgRef.current;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const mouseX = (e.clientX - rect.left) / zoom;
          const mouseY = (e.clientY - rect.top) / zoom;
          const newX = Math.round(Math.max(20, Math.min(2500, mouseX - dragOffset.x)));
          const newY = Math.round(Math.max(20, Math.min(2500, mouseY - dragOffset.y)));
          
          savePositions({
            ...nodePositions,
            [draggedNodeId]: { x: newX, y: newY }
          });
        }
      } else if (panelDraggingType) {
        setPanelDragMousePos({ x: e.clientX, y: e.clientY });
      } else if (connectingFromId) {
        const svg = svgRef.current;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const mouseX = (e.clientX - rect.left) / zoom;
          const mouseY = (e.clientY - rect.top) / zoom;
          setTrackerMousePos({ x: mouseX, y: mouseY });
        }
      } else if (isPanning) {
        const dX = e.clientX - panStart.x;
        const dY = e.clientY - panStart.y;
        setPanOffset({ x: panOffset.x + dX, y: panOffset.y + dY });
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (draggedNodeId) setDraggedNodeId(null);
      if (isPanning) setIsPanning(false);

      // 1. Releasing active sidebar element drag to drop onto canvas
      if (panelDraggingType) {
        const svg = svgRef.current;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const dropX = Math.round((e.clientX - rect.left - panOffset.x) / zoom);
          const dropY = Math.round((e.clientY - rect.top - panOffset.y) / zoom);
          
          const newId = `${panelDraggingType}_node_${Math.random().toString(36).substring(2, 6)}`;
          
          // Save position coordinate right away before triggering XML update
          savePositions({
            ...nodePositions,
            [newId]: { x: dropX, y: dropY }
          });

          if (onModifyModel) {
            onModifyModel("add", "detached", {
              appendNode: {
                id: newId,
                type: panelDraggingType,
                name: `User ${panelDraggingType.replace(/([A-Z])/g, " $1").trim()}`
              }
            });
          }
        }
        setPanelDraggingType(null);
      }

      // 2. Releasing connector line drag onto destination nodes
      if (connectingFromId) {
        if (hoveredNodeId && hoveredNodeId !== connectingFromId) {
          handleCompleteConnection(hoveredNodeId);
        } else {
          setConnectingFromId(null);
        }
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [
    draggedNodeId, 
    dragOffset, 
    connectingFromId, 
    isPanning, 
    panStart, 
    panOffset, 
    zoom, 
    nodePositions, 
    panelDraggingType, 
    hoveredNodeId, 
    onModifyModel
  ]);

  // Handles panning activation over background (if not dragging anything else)
  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    if (connectingFromId) {
      // Cancel linkage drawing state on outer click
      setConnectingFromId(null);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.id === "canvas_vector_grid_mesh" || target.id === "bpmn_dmn_graph_canvas") {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const getNodeColor = (type: string, isSelected: boolean, isHovered: boolean) => {
    const t = type.toLowerCase();
    let fill = "fill-white";
    let border = "stroke-slate-400";
    
    if (t.includes("start")) {
      fill = "fill-emerald-50/90";
      border = "stroke-emerald-600";
    } else if (t.includes("end")) {
      fill = "fill-rose-50/90";
      border = "stroke-rose-600";
    } else if (t.includes("gateway")) {
      fill = "fill-amber-50/90";
      border = "stroke-amber-500";
    } else if (t.includes("decisiontable") || t.includes("decision")) {
      fill = "fill-indigo-50/90";
      border = "stroke-indigo-600";
    } else if (t.includes("task")) {
      fill = "fill-sky-50/80";
      border = "stroke-sky-600";
    }

    if (isSelected) {
      border = "stroke-indigo-600 stroke-[3]";
      fill = "fill-indigo-50/80";
    } else if (isHovered) {
      border = "stroke-indigo-400 stroke-[2]";
    }

    return { fill, border };
  };

  // Triggering visual node additions
  const handleSpawnNode = async (type: string, visualName?: string) => {
    if (!onModifyModel) return;
    const name = visualName || `New ${type.replace(/([A-Z])/g, " $1").trim()}`;
    const newId = `${type}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Spawn centered or relative to selected node
    const anchorId = selectedNodeId || "detached";
    
    // Auto-compute dropped coordinate in current view bounds
    const spawnX = selectedNodeId && nodeCoords[selectedNodeId] ? nodeCoords[selectedNodeId].x + 180 : Math.round(200 / zoom);
    const spawnY = selectedNodeId && nodeCoords[selectedNodeId] ? nodeCoords[selectedNodeId].y : Math.round(150 / zoom);

    // Track position coordinate locally so it aligns instantly
    savePositions({
      ...nodePositions,
      [newId]: { x: spawnX, y: spawnY }
    });

    await onModifyModel("add", anchorId, {
      appendNode: {
        type,
        name
      }
    });
  };

  // Drop helper for HTML5 Drag-and-Drop
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/bpmn-element-type");
    if (!type) return;

    const svg = svgRef.current;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const dropX = Math.round((e.clientX - rect.left - panOffset.x) / zoom);
      const dropY = Math.round((e.clientY - rect.top - panOffset.y) / zoom);
      
      const newId = `${type}_node_${Math.random().toString(36).substring(2, 6)}`;
      
      // Save position coordinate right away before triggering XML update
      savePositions({
        ...nodePositions,
        [newId]: { x: dropX, y: dropY }
      });

      // Spawn detached node, let Gemini write the tag
      if (onModifyModel) {
        onModifyModel("add", "detached", {
          appendNode: {
            id: newId,
            type,
            name: `User ${type.replace(/([A-Z])/g, " $1").trim()}`
          }
        });
      }
    }
  };

  // Handle manual connector completion 
  const handleCompleteConnection = async (targetId: string) => {
    if (!connectingFromId || !onModifyModel) return;
    if (connectingFromId === targetId) {
      setConnectingFromId(null);
      return;
    }
    
    await onModifyModel("connect", connectingFromId, {
      targetId: targetId,
      label: ""
    });
    setConnectingFromId(null);
  };

  // Auto Remediation Quick Fix trigger
  const handleRunQuickFix = async (issue: ValidationIssue) => {
    if (!onModifyModel || !issue.elementId) return;
    await onModifyModel("fix-issue", issue.elementId, {
      fixSuggestion: issue.fixSuggestion
    });
  };

  // Add Custom Task rule
  const handleAddCustomRule = () => {
    if (!selectedNodeId || !taskRuleInput.trim()) return;
    setCustomTaskRules((prev) => {
      const rules = prev[selectedNodeId] || [];
      return {
        ...prev,
        [selectedNodeId]: [...rules, taskRuleInput.trim()]
      };
    });
    setTaskRuleInput("");
  };

  // Remove Custom Task rule
  const handleRemoveCustomRule = (index: number) => {
    if (!selectedNodeId) return;
    setCustomTaskRules((prev) => {
      const rules = [...(prev[selectedNodeId] || [])];
      rules.splice(index, 1);
      return {
        ...prev,
        [selectedNodeId]: rules
      };
    });
  };

  // Reset visual layout positions
  const handleResetLayout = () => {
    savePositions({});
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.4));
  const handleZoomReset = () => {
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const maxCoords = useMemo(() => {
    return laidOutNodes.reduce(
      (acc, val) => ({
        x: Math.max(acc.x, val.x + 350),
        y: Math.max(acc.y, val.y + 250),
      }),
      { x: 900, y: 500 }
    );
  }, [laidOutNodes]);

  return (
    <div className="flex bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex-1 min-h-[480px] relative select-none">
      
      {/* LEFT DESIGN PALETTE TOOLBAR (DRAG AND DROP HANDLES) */}
      <div className="w-16 shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-3 z-10 shadow-xs">
        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">
          Shapes
        </div>
        
        {/* Palette Items with Draggable handles & descriptive tooltips value */}
        {[
          { type: "StartEvent", label: "Start", color: "bg-emerald-50 border-emerald-500", icon: "🟢" },
          { type: "UserTask", label: "User Task", color: "bg-sky-50 border-sky-500", icon: "👤" },
          { type: "ServiceTask", label: "Service", color: "bg-indigo-50 border-indigo-500", icon: "⚙️" },
          { type: "ExclusiveGateway", label: "Gateway", color: "bg-amber-50 border-amber-500", icon: "🔶" },
          { type: "EndEvent", label: "End", color: "bg-rose-50 border-rose-500", icon: "🔴" },
        ].map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/bpmn-element-type", item.type);
            }}
            onMouseDown={(e) => {
              setPanelDraggingType(item.type);
              setPanelDragMousePos({ x: e.clientX, y: e.clientY });
            }}
            onClick={() => handleSpawnNode(item.type)}
            className={`w-11 h-11 rounded-lg border flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:shadow-2xs transition-all ${item.color} group relative`}
            title={`Drag onto grid or click to append ${item.label} to process sequence`}
          >
            <span className="text-sm">{item.icon}</span>
            <span className="text-[7.5px] font-sans font-bold text-slate-500 text-center leading-tight mt-0.5">
              {item.label}
            </span>
            <div className="absolute left-14 bg-slate-900 text-white text-[9.5px] py-1 px-2 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-md">
              Drag to grid canvas or click to insert node
            </div>
          </div>
        ))}
        
        <div className="h-px bg-slate-100 w-10 mt-1" />
        
        {/* Helper layout buttons */}
        <button
          onClick={handleResetLayout}
          className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          title="Auto-organize graph positions via topology sorted layering"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-[7px] block font-bold text-center mt-0.5">Auto-Align</span>
        </button>
      </div>

      {/* CENTER GRID CANVAS WORKSPACE ZONE */}
      <div 
        ref={containerRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCanvasDrop}
        onMouseDown={handleBackgroundMouseDown}
        className="flex-1 overflow-hidden relative cursor-crosshair"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)",
          backgroundSize: "20px 20px",
          backgroundColor: "#f8fafc"
        }}
        id="canvas_vector_grid_mesh"
      >
        
        {/* Floating status informational pill */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 pointer-events-none select-none">
          <div className="bg-white/95 border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Interactive Designer Canvas</span>
          </div>
          {connectingFromId && (
            <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 text-xs font-bold animate-pulse">
              <span>Linking Mode Active: Click target vertex element to connect</span>
              <button 
                onClick={() => setConnectingFromId(null)}
                className="bg-indigo-700 hover:bg-indigo-800 p-0.5 rounded cursor-pointer pointer-events-auto"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Zoom Panning Widget */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 bg-white border border-slate-200/80 p-1.5 rounded-lg shadow-sm">
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 px-1.5 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 px-1.5 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomReset}
            title="Reset to standard scale"
            className="p-1 text-[9px] font-bold text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded px-1.5 transition-colors cursor-pointer font-mono"
          >
            1:1
          </button>
        </div>

        {/* LOADING PROCESSING OVERLAY SPINNER */}
        {isModifying && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-center">
            <div className="bg-white p-5 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center gap-3 animate-fade-in max-w-[260px]">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Gemini Modeler AI Sync</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                  Re-organizing XML tag references and executing compliance audits...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* master svg graphic */}
        <svg
          ref={svgRef}
          id="bpmn_dmn_graph_canvas"
          width={maxCoords.x + 100}
          height={maxCoords.y + 100}
          className="overflow-visible select-none"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "top left",
            transition: isPanning ? "none" : "transform 0.15s ease-out"
          }}
        >
          {/* DEFINITIONS FOR SVG ARROWS PATH */}
          <defs>
            <marker
              id="connector-arrowhead-indigo"
              markerWidth="11"
              markerHeight="8"
              refX="9"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 11 4, 0 8" fill="#4f46e5" />
            </marker>
            <marker
              id="connector-arrowhead-default"
              markerWidth="8"
              markerHeight="6"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
            </marker>
            
            {/* Soft shadow for beautiful nodes floating glow */}
            <filter id="vector-node-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.06" />
            </filter>
            
            <filter id="node-active-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* ACTIVE DRAG / LIVE LINK SEQUENCE DRAFT LINE SENSOR */}
          {connectingFromId && nodeCoords[connectingFromId] && (
            <line
              x1={nodeCoords[connectingFromId].x + (nodeCoords[connectingFromId].type.toLowerCase().includes("task") ? 55 : 40)}
              y1={nodeCoords[connectingFromId].y + 25}
              x2={trackerMousePos.x}
              y2={trackerMousePos.y}
              className="stroke-indigo-500 stroke-2"
              strokeDasharray="5,5"
              markerEnd="url(#connector-arrowhead-indigo)"
            />
          )}

          {/* LAYER A: SEQUENCEFLOW CONNECTION EDGES */}
          <g id="edges_graph_layer">
            {graph?.edges?.map((edge) => {
              const src = nodeCoords[edge.source];
              const dest = nodeCoords[edge.target];
              if (!src || !dest) return null;

              // Smart calculation for connectors touching bounding boxes cleanly
              const isSrcTask = src.type.toLowerCase().includes("task") || src.type.toLowerCase().includes("decision");
              const isDestTask = dest.type.toLowerCase().includes("task") || dest.type.toLowerCase().includes("decision");
              
              const startX = src.x + (isSrcTask ? 110 : 40);
              const startY = src.y + (isSrcTask ? 25 : 25);
              
              const endX = dest.x;
              const endY = dest.y + (isDestTask ? 25 : 25);

              const midX = (startX + endX) / 2;

              // Straight or beautiful ortho-styled cubics
              const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
              
              const isDirectlyHighlighted = hoveredNodeId === edge.source || hoveredNodeId === edge.target || selectedNodeId === edge.source || selectedNodeId === edge.target;

              return (
                <g key={edge.id} className="group">
                  {/* Thick invisible trace path overlay for easy hovering cursor detection */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="12"
                    className="cursor-pointer"
                  />
                  
                  {/* Real visual stroke connector path */}
                  <path
                    d={d}
                    fill="none"
                    className={`transition-all duration-200 ${
                      isDirectlyHighlighted 
                        ? "stroke-indigo-600 stroke-[2.5]" 
                        : "stroke-slate-400 stroke-[1.5] group-hover:stroke-indigo-400 group-hover:stroke-[2]"
                    }`}
                    markerEnd={isDirectlyHighlighted ? "url(#connector-arrowhead-indigo)" : "url(#connector-arrowhead-default)"}
                  />

                  {edge.label && (
                    <foreignObject
                      x={midX - 55}
                      y={(startY + endY) / 2 - 12}
                      width="110"
                      height="24"
                      className="overflow-visible pointer-events-none"
                    >
                      <div className="flex justify-center items-center h-full">
                        <span className="text-[9px] font-bold font-mono text-indigo-700 bg-white border border-indigo-100 px-1 py-0.5 rounded shadow-2xs truncate max-w-[100px]">
                          {edge.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>

          {/* LAYER B: FLOW ELEMENT VERTEX NODES */}
          <g id="nodes_graph_layer">
            {laidOutNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const { fill, border } = getNodeColor(node.type, isSelected, isHovered);

              const t = node.type.toLowerCase();
              const isGateway = t.includes("gateway");
              const isEvent = t.includes("event") || t.includes("start") || t.includes("end");
              const isConnectingActive = connectingFromId !== null;

              // Check if node has unresolved error issues
              const hasErrors = validationIssues.some(i => i.elementId === node.id && i.severity === "error");
              const hasWarnings = validationIssues.some(i => i.elementId === node.id && i.severity === "warning");

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className={`cursor-pointer select-none transition-all`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  filter={isSelected ? "url(#node-active-glow)" : "url(#vector-node-shadow)"}
                  
                  // Coordinate dragging binding
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const target = e.target as HTMLElement;
                    if (target.closest(".interactive-control-handle")) return;
                    
                    if (connectingFromId) {
                      handleCompleteConnection(node.id);
                      return;
                    }

                    // Start Drag
                    setDraggedNodeId(node.id);
                    const svg = svgRef.current;
                    if (svg) {
                      const rect = svg.getBoundingClientRect();
                      const mouseX = (e.clientX - rect.left) / zoom;
                      const mouseY = (e.clientY - rect.top) / zoom;
                      setDragOffset({
                        x: mouseX - node.x,
                        y: mouseY - node.y,
                      });
                    }
                  }}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if (onSelectNode) onSelectNode(node.id);
                  }}
                >
                  
                  {/* Error indicator ring alert glow */}
                  {hasErrors && (
                    <rect
                      x={isEvent ? 10 : (isGateway ? 10 : -4)}
                      y={isEvent ? -4 : (isGateway ? -4 : -4)}
                      width={isEvent ? 60 : (isGateway ? 60 : 118)}
                      height={isEvent ? 58 : (isGateway ? 58 : 58)}
                      rx={isEvent || isGateway ? 40 : 12}
                      className="fill-none stroke-rose-400 stroke-[5] stroke-dasharray-[4,4] animate-pulse opacity-85"
                    />
                  )}

                  {/* VIRTUAL NODES RENDER SHADOW */}
                  {isEvent ? (
                    <circle
                      cx="40"
                      cy="25"
                      r="20"
                      className={`transition-all duration-150 ${border} ${fill} stroke-[2.2]`}
                    />
                  ) : isGateway ? (
                    <polygon
                      points="40,5 65,25 40,45 15,25"
                      className={`transition-all duration-150 ${border} ${fill} stroke-[2.2]`}
                    />
                  ) : (
                    <rect
                      x="0"
                      y="0"
                      width="110"
                      height="50"
                      rx="10"
                      className={`transition-all duration-150 ${border} ${fill} stroke-[1.8]`}
                    />
                  )}

                  {/* Label tag strings rendering in text wrapper */}
                  <foreignObject
                    x={isEvent ? 24 : (isGateway ? 24 : 6)}
                    y={isEvent ? 12 : (isGateway ? 12 : 6)}
                    width={isEvent || isGateway ? "32" : "98"}
                    height="38"
                    className="overflow-hidden pointer-events-none"
                  >
                    <div className="flex flex-col items-center justify-center w-full h-full text-center">
                      {isEvent ? (
                        <span className={`text-[9px] font-bold font-mono ${
                          t.includes("start") ? "text-emerald-700" : "text-rose-700"
                        }`}>
                          {t.includes("start") ? "START" : "END"}
                        </span>
                      ) : isGateway ? (
                        <span className="text-[10px] font-bold text-amber-700 font-mono">
                          X
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-800 leading-tight block line-clamp-2">
                          {node.label || node.id || "Task"}
                        </span>
                      )}
                    </div>
                  </foreignObject>

                  {/* Warning and errors visual notification badge flags */}
                  {(hasErrors || hasWarnings) && (
                    <g transform={`translate(${isEvent || isGateway ? 42 : 98}, -6)`} className="pointer-events-none">
                      <circle cx="6" cy="6" r="7.5" fill={hasErrors ? "#ef4444" : "#f59e0b"} />
                      <text x="6" y="9.5" textAnchor="middle" fill="white" className="text-[9px] font-black font-sans">
                        {hasErrors ? "!" : "?"}
                      </text>
                    </g>
                  )}

                  {/* Outer floating caption text tags for events/gateways display naming */}
                  {(isEvent || isGateway) && (
                    <foreignObject
                      x="-30"
                      y="52"
                      width="140"
                      height="38"
                      className="overflow-visible pointer-events-none"
                    >
                      <div className="text-center">
                        <span className="text-[9.5px] font-bold text-slate-600 bg-white/95 px-1.5 py-0.5 border border-slate-100 rounded shadow-xs line-clamp-2 max-w-[130px] mx-auto leading-tight">
                          {node.label || node.id}
                        </span>
                      </div>
                    </foreignObject>
                  )}

                  {/* ACTIVE ACTION CONTROL GRIPS HOVER (ONLY WHEN SELECTED) */}
                  {isSelected && (
                    <g className="interactive-control-handle">
                      {/* 1. SEAMLESS LINK DRAWING BUTTON */}
                      <g
                        transform={`translate(${isEvent || isGateway ? 60 : 116}, 10)`}
                        className="cursor-pointer"
                        title="Drag sequence flow linkage to another node"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnectingFromId(node.id);
                          setTrackerMousePos({ x: node.x + 80, y: node.y + 25 });
                        }}
                      >
                        <circle cx="10" cy="10" r="10.5" fill="#4f46e5" className="hover:fill-indigo-700 transition-colors shadow-sm" />
                        <path d="M6,10 L14,10 M11,7 L14,10 L11,13" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                      </g>

                      {/* 2. INSTANT DESTRUCTIVE DELETE & FLOW HEAL */}
                      {onModifyModel && (
                        <g
                          transform={`translate(-18, 10)`}
                          className="cursor-pointer"
                          title="Purge form model and auto-heal gaps sequence"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete and heal all flows for node "${node.label || node.id}"?`)) {
                              await onModifyModel("delete", node.id);
                              setSelectedNodeId(null);
                            }
                          }}
                        >
                          <circle cx="10" cy="10" r="10.5" fill="#ef4444" className="hover:fill-rose-700 transition-colors shadow-sm" />
                          <path d="M7,7 L13,13 M13,7 L7,13" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </g>
                      )}
                    </g>
                  )}

                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* SELECTED DOCK RECOMPOSITION AND IN-PLACE TASK RULES INSPECTOR */}
      {selectedNodeId && selectedNodeData && (
        <div className="w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col z-10 shadow-lg animate-fade-in select-none">
          
          {/* Back panel header detail */}
          <div className="p-4 border-b border-indigo-100 bg-slate-50 flex items-center justify-between">
            <div className="min-w-0">
              <span className="px-2 py-0.5 text-[8px] font-bold font-mono uppercase bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200">
                {selectedNodeData.type}
              </span>
              <h3 className="text-xs font-bold text-slate-800 mt-1 truncate">
                {selectedNodeData.label || selectedNodeId}
              </h3>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* IN-PLACE ELEMENT ATTRIBUTES CONVERTER & EDITOR */}
            <div className="space-y-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                Configure Element Attributes
              </h4>
              
              <div className="space-y-2.5">
                {/* Element Name */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    Display Name / Label
                  </label>
                  <input
                    type="text"
                    value={localEditName}
                    onChange={(e) => setLocalEditName(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                    placeholder="e.g. Approve Loan"
                  />
                </div>

                {/* Element Type Dropdown */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    Standard Symbol Type
                  </label>
                  <select
                    value={localEditType}
                    onChange={(e) => setLocalEditType(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">-- Switch Standard Type --</option>
                    <optgroup label="BPMN Elements">
                      <option value="StartEvent">Start Event</option>
                      <option value="EndEvent">End Event</option>
                      <option value="UserTask">User Task</option>
                      <option value="ServiceTask">Service Task</option>
                      <option value="BusinessRuleTask">Business Rule Task</option>
                      <option value="ScriptTask">Script Task</option>
                      <option value="ExclusiveGateway">Exclusive Gateway</option>
                      <option value="ParallelGateway">Parallel Gateway</option>
                    </optgroup>
                    <optgroup label="DMN Elements">
                      <option value="InputData">Input Data Field</option>
                      <option value="DecisionTable">Decision Table Rules</option>
                      <option value="Decision">Decision Case Element</option>
                      <option value="BusinessKnowledgeModel">Business Knowledge Model</option>
                    </optgroup>
                  </select>
                </div>

                {/* Apply modification button */}
                <button
                  onClick={async () => {
                    if (onModifyModel && selectedNodeId) {
                      await onModifyModel("update", selectedNodeId, { name: localEditName, type: localEditType });
                    }
                  }}
                  disabled={isModifying || (!localEditName && !localEditType)}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isModifying ? "Syncing XML..." : "Save / Convert Symbol"}
                </button>
              </div>
            </div>
            
            {/* INLINE AUDITED ERRORS FOR THIS SPECIFIC TASK */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                Task Diagnostics ({selectedNodeIssues.length})
              </h4>

              {selectedNodeIssues.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[10.5px] text-emerald-800">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    No task structure issues
                  </div>
                  <p className="mt-1 opacity-90 leading-normal">
                    The modeling criteria, gateway splices, and definitions look standards-optimal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedNodeIssues.map((issue) => (
                    <div 
                      key={issue.id} 
                      className={`p-3 rounded-xl border flex flex-col gap-2 ${
                        issue.severity === "error" 
                          ? "bg-rose-50/50 border-rose-150" 
                          : "bg-amber-50/50 border-amber-150"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">
                          {issue.message}
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5 leading-normal">
                          {issue.detail}
                        </p>
                      </div>

                      {issue.fixSuggestion && (
                        <div className="bg-white/80 border border-slate-100 p-2 rounded text-[9.5px] text-slate-600 font-mono">
                          <span className="font-sans font-bold text-slate-700 block">Suggestion:</span>
                          {issue.fixSuggestion}
                        </div>
                      )}

                      {onModifyModel && (
                        <button
                          onClick={() => handleRunQuickFix(issue)}
                          className="mt-1 self-start px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Wand2 className="w-3 h-3" />
                          Apply AI Safe Auto-Fix
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TASK COMPLIANCE ENFORCEMENT RULES SYSTEM */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  Custom Verification Guards
                </h4>
                <p className="text-[9.5px] text-slate-500 mt-0.5 leading-normal">
                  Write explicit operational or compliance rules (e.g., *"Cannot exceed 48 hrs"* or *"Requires secondary audit login"*) which Gemini leverages in model simulation.
                </p>
              </div>

              {/* Added list */}
              <div className="space-y-1.5">
                {(customTaskRules[selectedNodeId] || []).length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No enforced guards active on this element.</p>
                ) : (
                  (customTaskRules[selectedNodeId] || []).map((rule, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-1 text-[10px] font-medium text-slate-700 font-mono">
                      <span className="truncate flex-1">🔒 {rule}</span>
                      <button
                        onClick={() => handleRemoveCustomRule(idx)}
                        className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Rules input */}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={taskRuleInput}
                  onChange={(e) => setTaskRuleInput(e.target.value)}
                  placeholder="e.g. Audit task SLA is strict < 3 days"
                  className="flex-1 p-2 text-[10.5px] border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustomRule();
                  }}
                />
                <button
                  onClick={handleAddCustomRule}
                  disabled={!taskRuleInput.trim()}
                  className="px-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

          </div>

          {/* Coordinate inspection details */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center font-mono text-[9px] text-slate-400 flex justify-between">
            <span>Coordinate: X: {nodeCoords[selectedNodeId]?.x || 0}, Y: {nodeCoords[selectedNodeId]?.y || 0}</span>
            <span>ID: {selectedNodeId}</span>
          </div>

        </div>
      )}

      {/* Floating Drag feedback phantom */}
      {panelDraggingType && (
        <div 
          className="fixed pointer-events-none z-50 bg-indigo-600 text-white rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-xl font-bold text-xs select-none opacity-90 animate-pulse transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: panelDragMousePos.x,
            top: panelDragMousePos.y
          }}
        >
          <Sparkle className="w-3.5 h-3.5 text-indigo-200 animate-spin" />
          <span>Dropping {panelDraggingType}...</span>
        </div>
      )}

    </div>
  );
}
