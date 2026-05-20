import React, { useState, useMemo, useRef, useEffect } from "react";
import { VisualGraph, VisualNode, VisualEdge } from "../types";
import { 
  Play, 
  HelpCircle, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Layers, 
  Sliders, 
  Activity, 
  Network 
} from "lucide-react";

interface ModelVisualizerProps {
  graph?: VisualGraph;
  fileType: "bpmn" | "dmn" | "unknown" | "invalid";
  activeElementId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}

export function ModelVisualizer({
  graph,
  fileType,
  activeElementId,
  onSelectNode,
}: ModelVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Auto-select when active element changes from simulation path clicks
  useEffect(() => {
    if (activeElementId) {
      setSelectedNodeId(activeElementId);
    }
  }, [activeElementId]);

  // Compute a simple, elegant sequence flow coordinate system (column-based topological layering list)
  const laidOutNodes = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) return [];

    const nodes = [...graph.nodes];
    const edges = graph.edges || [];

    // Create maps for simple topological grouping
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

    // Topological levels
    const nodeLevels: Record<string, number> = {};
    const visited = new Set<string>();

    // Nodes with zero indegree or typical start node identifiers (like StartEvent, InputData) at layer 0
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

    // Default queue to all nodes first if everything is cyclic/orphaned
    if (currentQueue.length === 0) {
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
      // Safe boundary protection
      if (currentLevel > 50) break;
    }

    // Capture unvisited nodes to fallback layer
    nodes.forEach((n) => {
      if (nodeLevels[n.id] === undefined) {
        nodeLevels[n.id] = currentLevel;
      }
    });

    // Group nodes by level to avoid visual overlapping heights
    const levelGroups: Record<number, string[]> = {};
    Object.entries(nodeLevels).forEach(([id, lvl]) => {
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(id);
    });

    // Dimension metrics for standard spacing grid canvas layout representation
    const colWidth = 240;
    const rowHeight = 130;
    const startX = 60;
    const startY = 80;

    return nodes.map((n) => {
      const lvl = nodeLevels[n.id] || 0;
      const indexInLvl = levelGroups[lvl] ? levelGroups[lvl].indexOf(n.id) : 0;
      
      // Horizontal sequential columns, spread elements vertically inside level column index
      const x = startX + lvl * colWidth;
      const y = startY + indexInLvl * rowHeight;

      return {
        ...n,
        x,
        y,
      };
    });
  }, [graph]);

  // Construct dictionary mapping node target positions for draw line connections
  const nodeCoords = useMemo(() => {
    const coords: Record<string, { x: number; y: number; type: string; label: string }> = {};
    laidOutNodes.forEach((n) => {
      coords[n.id] = { x: n.x, y: n.y, type: n.type, label: n.label };
    });
    return coords;
  }, [laidOutNodes]);

  // Helper selectors styling
  const getNodeColor = (type: string, isSelected: boolean, isHovered: boolean) => {
    const t = type.toLowerCase();
    
    let baseBorder = "stroke-slate-400";
    let baseFill = "fill-white";
    let baseText = "text-slate-800";
    
    if (t.includes("start")) {
      baseFill = "fill-emerald-50/90";
      baseBorder = "stroke-emerald-600";
    } else if (t.includes("end")) {
      baseFill = "fill-rose-50/90";
      baseBorder = "stroke-rose-600";
    } else if (t.includes("gateway")) {
      baseFill = "fill-amber-50/90";
      baseBorder = "stroke-amber-500";
    } else if (t.includes("decisiontable") || t.includes("decision")) {
      baseFill = "fill-indigo-50/90";
      baseBorder = "stroke-indigo-600";
    } else if (t.includes("task")) {
      baseFill = "fill-sky-50/80";
      baseBorder = "stroke-sky-600";
    }

    if (isSelected) {
      baseBorder = "stroke-indigo-600 stroke-[3]";
      baseFill = "fill-indigo-50/70";
    } else if (isHovered) {
      baseBorder = "stroke-slate-800 stroke-[2]";
    }

    return { fill: baseFill, border: baseBorder };
  };

  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return null;
    return graph?.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graph]);

  // Handle zoom modifiers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.5));
  const handleZoomReset = () => setZoom(1.0);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-slate-200 border-dashed rounded-xl h-64 select-none">
        <Network className="w-10 h-10 text-slate-300 mb-2" />
        <h4 className="text-xs font-semibold text-slate-700">Visual Model Rendering Pending</h4>
        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
          Once your uploaded model is successfully verified, Gemini will construct an interactive high-fidelity process map here.
        </p>
      </div>
    );
  }

  // Calculate dynamic SVG container bounds to fit elements without scroll issues
  const maxCoords = laidOutNodes.reduce(
    (acc, val) => ({
      x: Math.max(acc.x, val.x + 300),
      y: Math.max(acc.y, val.y + 200),
    }),
    { x: 740, y: 400 }
  );

  return (
    <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner flex-1 min-h-[380px] relative">
      
      {/* Top action toolbar overlay */}
      <h3 className="absolute left-3 top-3 z-10 px-2.5 py-1 text-[10px] bg-white border border-slate-200/80 text-slate-700 rounded-lg flex items-center gap-1.5 font-bold font-mono uppercase tracking-wide shadow-xs pointer-events-auto">
        <Activity className="w-3.5 h-3.5 text-indigo-500" />
        Live Model Graph
      </h3>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 bg-white border border-slate-200/80 p-1 rounded-lg shadow-sm">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded transition-colors cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomReset}
          title="Reset Zoom"
          className="p-1 text-xs font-bold text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded px-1.5 transition-colors cursor-pointer font-mono"
        >
          1:1
        </button>
      </div>

      {/* Main SVG Viewport container */}
      <div 
        ref={containerRef}
        className="flex-1 w-full overflow-auto p-4 cursor-grab active:cursor-grabbing bg-slate-50/70"
      >
        <div 
          style={{ 
            transform: `scale(${zoom})`, 
            transformOrigin: "top left", 
            transition: "transform 0.15s ease-out" 
          }}
          className="relative min-w-full"
        >
          <svg
            id="bpmn_dmn_graph_canvas"
            width={maxCoords.x}
            height={maxCoords.y}
            className="overflow-visible"
          >
            {/* SVG Markers definitions for sequence connection flow arrows */}
            <defs>
              <marker
                id="arrowhead-indigo"
                markerWidth="10"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
              </marker>
              <marker
                id="arrowhead-slate"
                markerWidth="8"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* DRAW EDGES / CONNECTION SHAPES FIRST */}
            <g id="graph_connections_layer">
              {graph.edges &&
                graph.edges.map((edge) => {
                  const src = nodeCoords[edge.source];
                  const dest = nodeCoords[edge.target];

                  if (!src || !dest) return null;

                  // Compute clean cubic bezier connection flow paths
                  // Offset from right side of source element, target starting on left side of destination element
                  const startX = src.x + 85; 
                  const startY = src.y + 25;
                  const endX = dest.x - 5;
                  const endY = dest.y + 25;

                  const midX = (startX + endX) / 2;

                  // Create custom pathway
                  // For tasks, let's output a beautiful path
                  const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                  const isHighlit = hoveredNodeId === edge.source || hoveredNodeId === edge.target || selectedNodeId === edge.source || selectedNodeId === edge.target;

                  return (
                    <g key={edge.id} className="group">
                      {/* Connection Line */}
                      <path
                        d={d}
                        fill="none"
                        className={`transition-all duration-250 ${
                          isHighlit
                            ? "stroke-indigo-500 stroke-[2.5]"
                            : "stroke-slate-300 stroke-[1.5] group-hover:stroke-slate-400 group-hover:stroke-2"
                        }`}
                        markerEnd={isHighlit ? "url(#arrowhead-indigo)" : "url(#arrowhead-slate)"}
                      />
                      
                      {/* Line Condition / Parameter label overlay */}
                      {edge.label && (
                        <foreignObject
                          x={midX - 50}
                          y={(startY + endY) / 2 - 12}
                          width="100"
                          height="24"
                          className="overflow-visible pointer-events-none"
                        >
                          <div className="flex items-center justify-center h-full">
                            <span className="text-[9px] font-semibold text-indigo-700 bg-white/90 border border-indigo-100 rounded px-1 max-w-[90px] truncate shadow-2xs font-mono">
                              {edge.label}
                            </span>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
            </g>

            {/* DRAW NODES LAYER SECOND */}
            <g id="graph_nodes_layer">
              {laidOutNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const { fill, border } = getNodeColor(node.type, isSelected, isHovered);

                const t = node.type.toLowerCase();
                const isGateway = t.includes("gateway");
                const isEvent = t.includes("event") || t.includes("start") || t.includes("end");

                // Let's draw elements natively aligned with the standard spec shapes
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer select-none"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      if (onSelectNode) {
                        onSelectNode(node.id);
                      }
                    }}
                  >
                    {isEvent ? (
                      // 1. Circle representation for Start/End Events
                      <circle
                        cx="40"
                        cy="25"
                        r="18"
                        className={`transition-all duration-200 fill-white ${border} ${fill} stroke-[2] shadow-sm`}
                      />
                    ) : isGateway ? (
                      // 2. Gateway diamond representation
                      <polygon
                        points="40,5 65,25 40,45 15,25"
                        className={`transition-all duration-200 fill-white ${border} ${fill} stroke-[2]`}
                      />
                    ) : (
                      // 3. UserTasks / Decision table rectangular card
                      <rect
                        x="0"
                        y="0"
                        width="110"
                        height="50"
                        rx="8"
                        className={`transition-all duration-200 fill-white ${border} ${fill} stroke-[1.5] shadow-xs`}
                      />
                    )}

                    {/* Small inner icons representing elements type */}
                    <foreignObject
                      x={isEvent ? 28 : (isGateway ? 28 : 6)}
                      y={isEvent ? 14 : (isGateway ? 13 : 8)}
                      width={isGateway || isEvent ? "24" : "98"}
                      height="38"
                      className="overflow-hidden pointer-events-none"
                    >
                      <div className="flex flex-col items-center justify-center w-full h-full text-center">
                        {isEvent || isGateway ? (
                          <span className={`text-[10px] font-bold font-mono ${
                            t.includes("start") ? "text-emerald-700" : t.includes("end") ? "text-rose-700" : "text-amber-700"
                          }`}>
                            {t.includes("start") ? "START" : t.includes("end") ? "END" : "GW"}
                          </span>
                        ) : (
                          <div className="w-full">
                            <span className="text-[9.5px] font-semibold text-slate-800 line-clamp-2 leading-snug px-1.5 bg-white/50 rounded">
                              {node.label || node.id || "Task"}
                            </span>
                          </div>
                        )}
                      </div>
                    </foreignObject>

                    {/* Simple floating helper tag below event circles/diamonds showing full text */}
                    {(isEvent || isGateway) && (
                      <foreignObject
                        x="-30"
                        y="52"
                        width="140"
                        height="36"
                        className="overflow-visible pointer-events-none"
                      >
                        <div className="text-center">
                          <span className="text-[9px] font-medium text-slate-600 bg-white/80 px-1 py-0.5 rounded shadow-2xs font-sans line-clamp-2 leading-tight">
                            {node.label || node.id}
                          </span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Selected Node Inspector Bottom Panel */}
      {selectedNodeId && selectedNodeData && (
        <div className="shrink-0 p-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-4 animate-slide-up select-none">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 text-[8.5px] font-mono font-bold uppercase rounded ${
                selectedNodeData.type.toLowerCase().includes("start")
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : selectedNodeData.type.toLowerCase().includes("end")
                    ? "bg-rose-50 text-rose-700 border border-rose-100"
                    : selectedNodeData.type.toLowerCase().includes("gateway")
                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
              }`}>
                {selectedNodeData.type}
              </span>
              <span className="text-[10px] text-slate-400 font-mono italic">
                Element ID: {selectedNodeData.id}
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-800 mt-1 truncate">
              {selectedNodeData.label}
            </h4>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelectedNodeId(null)}
              className="px-2.5 py-1 hover:bg-slate-50 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Clear Focus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
