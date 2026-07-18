
"use client";
// Enhanced memory graph with force-directed layout and drag support

import AppLayout from "@/components/layout/AppLayout";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  Handle,
  Position,
  Connection,
  Node,
  Edge,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  NodeMouseHandler,
  getSmoothStepPath,
} from "reactflow";
import "reactflow/dist/style.css";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  User,
  FileText,
  Target,
  Star,
  Briefcase,
  BookOpen,
  CalendarCheck,
  Sparkles,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  Code,
  Building,
  MapPin,
  Award,
  Calendar,
  Mail,
  CheckSquare,
  Heart,
  Cpu,
  Globe,
  ExternalLink,
  MessageSquare,
  Brain,
  ZoomIn,
  Layers,
  Maximize2,
  Download,
  Focus,
} from "lucide-react";
import {
  getMemoryGraph,
  getRelatedMemories,
  deleteMemory,
  getMemories,
  getGraphStats,
  Memory,
  GraphStats,
  chatWithDocument,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import dagre from "dagre";
import { EdgeProps, EdgeLabelRenderer } from "reactflow";

// --- Custom Edge Component ---
function CustomConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const confidence = data?.confidence ?? 1.0;
  const label = data?.label ?? "";

  // Opacity based on confidence:
  // confidence > 0.9: solid (1.0)
  // confidence 0.7: slightly transparent (0.65)
  // confidence < 0.5: very transparent (0.3)
  let confidenceOpacity = 1.0;
  if (confidence > 0.9) {
    confidenceOpacity = 1.0;
  } else if (confidence >= 0.7) {
    confidenceOpacity = 0.65;
  } else {
    confidenceOpacity = 0.3;
  }

  // Fade out if not highlighted/selected in parent logic
  const parentOpacity = style.opacity !== undefined ? Number(style.opacity) : 1.0;
  const finalOpacity = parentOpacity < 1.0 ? parentOpacity : confidenceOpacity;

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: "#A855F7",
          strokeWidth: 2,
          strokeDasharray: "5 5",
          opacity: finalOpacity,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: "rgba(15, 23, 42, 0.95)",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid rgba(168, 85, 247, 0.4)",
              fontSize: "10px",
              fontWeight: 600,
              color: "#C084FC",
              pointerEvents: "none",
              opacity: finalOpacity,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.5)",
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes = {
  relationship: CustomConnectionEdge,
};

const FILTER_CATEGORIES = [
  "Person",
  "Project",
  "Document",
  "Email",
  "Technology",
  "Company",
  "Skill",
  "Meeting",
  "Memory",
];


// --- Configuration: Node Types & Colors ---
// Updated to match user's requirements
const NODE_COLORS: Record<string, string> = {
  Person: "#3B82F6",       // Blue (User)
  Document: "#A855F7",     // Purple
  Email: "#EF4444",        // Red
  Technology: "#22C55E",   // Green
  Company: "#F97316",      // Orange
  Event: "#FBBF24",        // Yellow
  Project: "#EC4899",      // Pink
  University: "#06B6D4",   // Cyan
  Skill: "#84CC16",        // Lime
  Custom: "#6B7280",       // Grey (Memory)
  Memory: "#6B7280",       // Grey
  Organization: "#F97316",
  Task: "#FBBF24",
  Meeting: "#06B6D4",
  Certificate: "#84CC16",
  Conversation: "#A855F7",
};

const NODE_ICONS: Record<string, any> = {
  Person: User,
  Project: Briefcase,
  Company: Building,
  Technology: Sparkles,
  Skill: Star,
  Language: Code,
  Framework: Globe,
  University: BookOpen,
  Organization: Building,
  Document: FileText,
  Email: Mail,
  Task: CheckSquare,
  Goal: Target,
  Preference: Heart,
  Location: MapPin,
  Date: Calendar,
  Event: CalendarCheck,
  Meeting: Calendar,
  Certificate: Award,
  Conversation: Sparkles,
  Custom: Brain,
  Memory: Brain,
};

// --- Custom Node Component ---
function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  const isHighlighted = data.isHighlighted;
  const Icon = NODE_ICONS[data.type] || Sparkles;
  const color = NODE_COLORS[data.type] || "#6B7280";
  const importance = data.importance || 0.5;
  const scale = 0.8 + importance * 0.6; // Scale from 0.8 to 1.4 based on importance

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-2xl transition-all duration-300 ${
        selected
          ? "shadow-[0_0_30px_rgba(168,85,247,0.6)] ring-2 ring-offset-2 ring-offset-slate-950"
          : isHighlighted
          ? "shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          : "hover:scale-105"
      }`}
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: selected ? color : isHighlighted ? `${color}80` : "#334155",
        boxShadow: selected
          ? `0 0 30px ${color}60`
          : isHighlighted
          ? `0 0 20px ${color}40`
          : undefined,
        transform: `scale(${selected ? scale * 1.1 : isHighlighted ? scale * 1.05 : scale})`,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-slate-400"
      />
      <div className="flex items-center gap-2">
        <div
          className="p-1.5 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}25` }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-white truncate max-w-[120px]">
          {data.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-slate-400"
      />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

const performDagreLayout = (apiNodes: any[], apiEdges: any[]) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 80, edgesep: 50, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  apiNodes.forEach((node) => {
    g.setNode(node.id, { width: 180, height: 60 });
  });

  apiEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return apiNodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      id: node.id,
      type: "custom",
      position: {
        x: nodeWithPosition ? nodeWithPosition.x - 90 : 200 + Math.random() * 400,
        y: nodeWithPosition ? nodeWithPosition.y - 30 : 200 + Math.random() * 400,
      },
      data: {
        label: node.label,
        type: node.type || node.category,
        description: node.description || "",
        date: node.date || "",
        importance: node.importance || 0.5,
      },
    };
  });
};

// --- Main Component ---
function MemoryGraphContent() {
  // --- State ---
  const [apiNodes, setApiNodes] = useState<any[]>([]);
  const [apiEdges, setApiEdges] = useState<any[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedRelatedMemories, setSelectedRelatedMemories] =
    useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [graphData, memoriesData, statsData] = await Promise.all([
        getMemoryGraph(),
        getMemories(),
        getGraphStats(),
      ]);
      setApiNodes(graphData.nodes);
      setApiEdges(graphData.edges);
      setMemories(memoriesData.memories);
      setGraphStats(statsData);

      // Perform Dagre layout
      const initialNodes = performDagreLayout(graphData.nodes, graphData.edges);

      const initialEdges: Edge[] = graphData.edges.map((edge: any, idx: number) => ({
        id: edge.id || `edge-${idx}`,
        source: edge.source,
        target: edge.target,
        type: "relationship", // Use the custom animated relationship edge
        animated: edge.animated !== false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#A855F7",
        },
        data: {
          label: edge.label || edge.relationship,
          confidence: edge.confidence ?? edge.strength ?? 1.0,
          animated: edge.animated !== false,
        },
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);
      setInitialDataLoaded(true);
    } catch (e) {
      console.error("Failed to fetch graph data", e);
    } finally {
      setIsLoading(false);
    }
  }, [setNodes, setEdges]);

  // --- Effects ---
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Center camera when search query matches a node
  useEffect(() => {
    if (searchQuery && reactFlowInstance && nodes.length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const match = nodes.find((n) => n.data.label.toLowerCase().includes(q));
      if (match) {
        reactFlowInstance.fitView({ nodes: [match], duration: 800, padding: 0.3 });
      }
    }
  }, [searchQuery, reactFlowInstance, nodes]);

  // --- Handlers ---
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "relationship",
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#A855F7" },
            data: {
              label: "CONNECTED_TO",
              confidence: 1.0,
              animated: true,
            }
          },
          eds
        )
      ),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    async (_event: any, node) => {
      const apiNode = apiNodes.find((n) => n.id === node.id);
      if (apiNode) {
        setSelectedNode(apiNode);
        const related = await getRelatedMemories(apiNode.label);
        setSelectedRelatedMemories(related);
      }
    },
    [apiNodes]
  );

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemory(memoryId);
      await fetchData();
      if (selectedNode) {
        const related = await getRelatedMemories(selectedNode.label);
        setSelectedRelatedMemories(related);
      }
    } catch (e) {
      console.error("Failed to delete memory", e);
    }
  };

  const centerOnNode = (nodeId: string) => {
    if (reactFlowInstance) {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        reactFlowInstance.fitView({ nodes: [node], duration: 800, padding: 0.3 });
      }
    }
  };

  const askEvolve = async (label: string) => {
    window.location.href = `/ask?q=${encodeURIComponent(`Tell me more about ${label}`)}`;
  };

  const resetLayout = () => {
    if (apiNodes.length > 0) {
      const layoutedNodes = performDagreLayout(apiNodes, apiEdges);
      setNodes(layoutedNodes);
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
      }
    }
  };

  const fitScreen = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
    }
  };

  const centerGraph = () => {
    if (reactFlowInstance) {
      reactFlowInstance.setCenter(600, 400, { zoom: 1, duration: 500 });
    }
  };

  const exportPNG = () => {
    if (reactFlowInstance) {
      alert("Export PNG functionality coming soon!");
    }
  };

  // --- Derived State with memoized filter & selection highlighting ---
  const { filteredNodes, filteredEdges } = useMemo(() => {
    // 1. Filter nodes based on selected filters
    const visibleNodesList = nodes.filter((node) => {
      if (activeFilters.length > 0) {
        const type = node.data?.type;
        return activeFilters.includes(type);
      }
      return true;
    });

    const visibleNodeIds = new Set(visibleNodesList.map((n) => n.id));

    // 2. Determine selection/search highlight target
    const highlightedNodeIds = new Set<string>();
    let activeTargetId: string | null = null;
    
    if (selectedNode) {
      activeTargetId = selectedNode.id;
    } else if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const match = visibleNodesList.find((n) => n.data.label.toLowerCase().includes(q));
      if (match) {
        activeTargetId = match.id;
      }
    }

    if (activeTargetId && visibleNodeIds.has(activeTargetId)) {
      highlightedNodeIds.add(activeTargetId);
      
      // Highlight neighbors that are also currently visible
      edges.forEach((edge) => {
        if (edge.source === activeTargetId && visibleNodeIds.has(edge.target)) {
          highlightedNodeIds.add(edge.target);
        }
        if (edge.target === activeTargetId && visibleNodeIds.has(edge.source)) {
          highlightedNodeIds.add(edge.source);
        }
      });
    }

    const hasHighlightActive = highlightedNodeIds.size > 0;

    // 3. Style visible nodes based on highlight state
    const finalNodes = visibleNodesList.map((node) => {
      const isHighlighted = highlightedNodeIds.has(node.id);
      const isSelected = selectedNode && selectedNode.id === node.id;
      
      let opacity = 1.0;
      if (hasHighlightActive) {
        opacity = (isHighlighted || isSelected) ? 1.0 : 0.15;
      }

      return {
        ...node,
        data: {
          ...node.data,
          isHighlighted: isHighlighted || isSelected,
        },
        style: {
          ...node.style,
          opacity,
        },
      };
    });

    // 4. Filter edges and style based on highlight state
    const finalEdges = edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        let isHighlightedEdge = false;
        if (activeTargetId) {
          isHighlightedEdge = edge.source === activeTargetId || edge.target === activeTargetId;
        }

        let opacity = 1.0;
        if (hasHighlightActive) {
          opacity = isHighlightedEdge ? 1.0 : 0.1;
        }

        return {
          ...edge,
          animated: hasHighlightActive ? isHighlightedEdge : edge.animated,
          style: {
            ...edge.style,
            opacity,
          },
        };
      });

    return { filteredNodes: finalNodes, filteredEdges: finalEdges };
  }, [nodes, edges, searchQuery, activeFilters, selectedNode]);

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };


  return (
    <AppLayout>
      <div className="flex h-screen bg-[#020617]">
        {/* --- Main Graph Area --- */}
        <div ref={reactFlowWrapper} className="flex-1 flex flex-col">
          {/* Top Header Panel */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800 bg-[#020617]/80 backdrop-blur-sm z-10">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-violet-400" />
                Intelligent Memory Graph
              </h1>
              <p className="text-xs mt-0.5 text-slate-400">
                Explore entities, relationships, and your memories visually
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 w-56"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={centerGraph}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
                >
                  <Focus size={14} />
                  Center
                </button>
                <button
                  onClick={resetLayout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
                >
                  <RefreshCw size={14} />
                  Reset
                </button>
                <button
                  onClick={fitScreen}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
                >
                  <Maximize2 size={14} />
                  Fit
                </button>
                <button
                  onClick={exportPNG}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02] bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
                >
                  <Download size={14} />
                  Export
                </button>
                <button
                  onClick={fetchData}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] bg-violet-600 border border-violet-500 text-white hover:bg-violet-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* React Flow Canvas */}
          <div className="flex-1">
            <ReactFlow
              nodes={filteredNodes}
              edges={filteredEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              className="bg-[#020617]"
              minZoom={0.2}
              maxZoom={4}
              onInit={setReactFlowInstance}
            >
              <Background
                color="#334155"
                gap={20}
                style={{ opacity: 0.3 }}
              />
              <Controls className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 text-white shadow-xl" />
              <MiniMap
                nodeColor={(n) =>
                  NODE_COLORS[(n.data as any).type] || "#6B7280"
                }
                className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl shadow-xl"
              />
            </ReactFlow>
          </div>
        </div>

        {/* --- Right Sidebar --- */}
        <div className="w-[420px] bg-slate-900/95 border-l border-slate-800 overflow-y-auto backdrop-blur-md">
          <div className="p-6 space-y-6">
            {/* 1. Stats Panel */}
            {graphStats && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 shadow-lg"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Graph Stats</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <p className="text-slate-400">Total Nodes</p>
                    <p className="text-xl font-bold text-violet-300">
                      {graphStats.total_nodes}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <p className="text-slate-400">Total Edges</p>
                    <p className="text-xl font-bold text-green-300">
                      {graphStats.total_edges}
                    </p>
                  </div>

                  {graphStats.most_connected && (
                    <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 col-span-2">
                      <p className="text-slate-400">Most Connected</p>
                      <p className="text-sm font-semibold text-cyan-300">
                        {graphStats.most_connected.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {graphStats.most_connected.connection_count} connections
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 col-span-2">
                    <p className="text-slate-400">Avg Connections</p>
                    <p className="text-lg font-bold text-orange-300">
                      {graphStats.avg_connections.toFixed(1)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. Filters Panel */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={16} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Filters</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {FILTER_CATEGORIES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleFilter(type)}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${
                      activeFilters.includes(type)
                        ? "bg-violet-500/20 border-violet-500 text-violet-300"
                        : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {activeFilters.length > 0 && (
                <button
                  onClick={() => setActiveFilters([])}
                  className="mt-3 text-xs text-slate-400 hover:text-white"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* 3. Node Details Panel */}
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon =
                        NODE_ICONS[selectedNode.type] || Sparkles;
                      return (
                        <div
                          className="p-3 rounded-2xl"
                          style={{
                            backgroundColor:
                              (NODE_COLORS[selectedNode.type] ||
                                "#6B7280") + "25",
                          }}
                        >
                          <Icon
                            size={24}
                            style={{
                              color:
                                NODE_COLORS[selectedNode.type] ||
                                "#6B7280",
                            }}
                          />
                        </div>
                      );
                    })()}
                    <div className="flex-1">
                      <p className="text-base font-bold text-white">
                        {selectedNode.label}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Layers size={12} />
                        {selectedNode.type}
                      </p>
                      {selectedNode.date && (
                        <p className="text-[10px] text-slate-500 mt-1">
                          {selectedNode.date}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedNode.description && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Description
                      </p>
                      <p className="text-xs text-slate-300">
                        {selectedNode.description}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => centerOnNode(selectedNode.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white hover:bg-slate-700 transition-all"
                    >
                      <ZoomIn size={12} />
                      Center Graph
                    </button>
                    <button
                      onClick={() => askEvolve(selectedNode.label)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-xs font-medium text-white transition-all"
                    >
                      <MessageSquare size={12} />
                      Ask EVOLVE
                    </button>
                    <button
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white hover:bg-slate-700 transition-all"
                    >
                      <ExternalLink size={12} />
                      Open Source
                    </button>
                    <button
                      onClick={() => {
                        if (selectedNode) {
                          // Fit view to selected node and its neighbors
                          const relatedIds = new Set([selectedNode.id]);
                          apiEdges.forEach((e) => {
                            if (e.source === selectedNode.id) {
                              relatedIds.add(e.target);
                            }
                            if (e.target === selectedNode.id) {
                              relatedIds.add(e.source);
                            }
                          });
                          const nodeIdsArray = Array.from(relatedIds);
                          reactFlowInstance?.fitView({
                            nodes: nodeIdsArray.map((id) => ({ id })),
                            padding: 0.2,
                            duration: 800,
                          });
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-medium text-white hover:bg-slate-700 transition-all"
                    >
                      <Brain size={12} />
                      Show Related
                    </button>
                  </div>

                  {/* Relationships */}
                  {selectedRelatedMemories &&
                    selectedRelatedMemories.edges.length > 0 && (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Connected Nodes
                        </p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {selectedRelatedMemories.edges.map(
                            (edge: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-slate-800 px-3 py-2.5 text-xs rounded-lg border border-slate-700 flex items-center gap-2"
                              >
                                <span className="text-white font-medium">
                                  {edge.source_name}
                                </span>
                                <span className="text-violet-400 text-[10px] px-1.5 py-0.5 rounded bg-violet-900/30">
                                  {edge.type}
                                </span>
                                <span className="text-white font-medium">
                                  {edge.target_name}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Connected Memories */}
                  {selectedRelatedMemories &&
                    selectedRelatedMemories.memories.length > 0 && (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Connected Memories
                        </p>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {selectedRelatedMemories.memories.map(
                            (mem: Memory) => (
                              <div
                                key={mem.id}
                                className="bg-slate-800 p-3 flex items-start gap-3 group rounded-lg border border-slate-700"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className="text-[10px] px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          (NODE_COLORS[mem.type] ||
                                            "#6B7280") + "20",
                                        color:
                                          NODE_COLORS[mem.type] ||
                                          "#6B7280",
                                      }}
                                    >
                                      {mem.type}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      Importance: {mem.importance.toFixed(1)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300">
                                    {mem.memory}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    handleDeleteMemory(mem.id)
                                  }
                                  className="p-1 rounded text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-10 text-slate-400 text-xs"
                >
                  <Sparkles size={32} className="mx-auto mb-3 text-slate-600" />
                  Click a node on the graph to view details
                </motion.div>
              )}
            </AnimatePresence>

            {/* 4. All Memories Panel */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-white mb-4">All Memories</h3>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <RefreshCw
                    size={20}
                    className="animate-spin"
                    style={{ color: "#6c5ce7" }}
                  />
                </div>
              ) : memories.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No memories yet. Chat with EVOLVE to add some!
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {memories.map((mem) => (
                    <div
                      key={mem.id}
                      className="bg-slate-800/50 border border-slate-700 p-3 flex items-start gap-3 group rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor:
                                (NODE_COLORS[mem.type] ||
                                  "#94a3b8") + "20",
                              color:
                                NODE_COLORS[mem.type] ||
                                "#94a3b8",
                            }}
                          >
                            {mem.type}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Importance: {mem.importance.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          {mem.memory}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function MemoryGraphPage() {
  return (
    <ReactFlowProvider>
      <MemoryGraphContent />
    </ReactFlowProvider>
  );
}
