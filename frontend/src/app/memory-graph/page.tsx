
"use client";

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
  useReactFlow,
  ReactFlowProvider,
  Panel,
  NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
<<<<<<< HEAD
  Search,
  X
} from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
=======
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
} from "lucide-react";
>>>>>>> 007607a (Describe your changes)
import {
  getGraph,
  getRelatedMemories,
  deleteMemory,
<<<<<<< HEAD
  type Memory,
  getRelatedMemories
=======
  getMemories,
  getGraphStats,
  GraphNode as APIGraphNode,
  GraphEdge as APIGraphEdge,
  Memory,
  GraphStats,
>>>>>>> 007607a (Describe your changes)
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

<<<<<<< HEAD
const categories = {
  Person: "#4facfe",
  Project: "#00d68f",
  Skill: "#f0a500",
  Company: "#4285f4",
  Technology: "#ff6b6b",
  Goal: "#9b59b6",
  Preference: "#e84393",
  Education: "#34a853",
  Task: "#1abc9c",
  Event: "#e67e22",
  Document: "#e84393",
  Custom: "#A142F4",
  Email: "#ea4335",
  Meeting: "#f0a500",
  Code: "#f0f0f0",
  Chat: "#25d366"
=======
// --- Configuration: Node Types & Colors ---

const NODE_COLORS: Record<string, string> = {
  Person: "#60a5fa", // Blue
  Project: "#34d399", // Green
  Company: "#f87171", // Red
  Technology: "#a78bfa", // Purple
  Skill: "#c4b5fd", // Light purple
  Language: "#fb923c", // Orange
  Framework: "#22d3ee", // Cyan
  University: "#fbbf24", // Yellow
  Organization: "#f97316", // Amber
  Document: "#f472b6", // Pink
  Email: "#ef4444", // Red
  Task: "#facc15", // Yellow
  Goal: "#fdba74", // Orange
  Preference: "#4ade80", // Green
  Location: "#14b8a6", // Teal
  Date: "#94a3b8", // Slate
  Event: "#22c55e", // Green
  Meeting: "#06b6d4", // Cyan
  Certificate: "#eab308", // Yellow
  Custom: "#94a3b8", // Gray
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
  Custom: Sparkles,
};

// --- Custom Node Component ---

function CustomNode({ data, selected }: { data: any; selected: boolean }) {
  const Icon = NODE_ICONS[data.type] || Sparkles;
  const color = NODE_COLORS[data.type] || "#94a3b8";

  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 shadow-lg transition-all duration-300 ${
        selected
          ? "scale-110 shadow-2xl ring-2 ring-offset-2"
          : "scale-100 hover:scale-105"
      }`}
      style={{
        backgroundColor: "#0f172a", // Darker background
        borderColor: selected ? color : "#334155",
        boxShadow: selected ? `0 0 20px ${color}40` : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-500"
      />
      <div className="flex items-center gap-2">
        <div
          className="p-1.5 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={14} style={{ color: color }} />
        </div>
        <span className="text-xs font-semibold text-white">{data.label}</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-500"
      />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
>>>>>>> 007607a (Describe your changes)
};

// --- Main Component ---

<<<<<<< HEAD
// Custom Node Component
const CustomNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div
      className={`px-4 py-2 rounded-xl shadow-lg transition-all duration-200 border-2 ${
        selected ? "scale-110 z-50" : "hover:scale-105"
      }`}
      style={{
        backgroundColor: data.color,
        borderColor: selected ? "white" : "transparent",
        color: "white",
        minWidth: "120px",
        textAlign: "center",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-white" />
      <div className="font-semibold text-sm">{data.label}</div>
      <div className="text-[10px] opacity-80">{data.type}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-white" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const MemoryGraphPageContent = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Function to convert API data to ReactFlow nodes and edges
  const convertToReactFlow = (
    apiNodes: APIGraphNode[],
    apiEdges: APIGraphEdge[]
  ): { nodes: Node[]; edges: Edge[] } => {
    const rfNodes: Node[] = apiNodes.map((node, index) => ({
      id: node.id,
      type: "custom",
      position: {
        x: 100 + index * 150 + Math.random() * 50,
        y: 100 + Math.random() * 200,
      },
      data: {
        ...node,
      },
    }));

    const rfEdges: Edge[] = apiEdges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
      style: { stroke: "#8b5cf6", strokeWidth: 2 },
    }));

    return { nodes: rfNodes, edges: rfEdges };
  };

  // Fetch graph data
  const loadFullGraph = useCallback(async () => {
    try {
      const data = await getMemoryGraph();
      const { nodes: rfNodes, edges: rfEdges } = convertToReactFlow(
        data.nodes,
        data.edges
      );
      setNodes(rfNodes);
      setEdges(rfEdges);
      if (rfNodes.length > 0) {
        setSelectedNodeId(rfNodes[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch memory graph:", err);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  // Search for related memories
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadFullGraph();
      return;
    }
    try {
      const data = await getRelatedMemories(searchQuery);
      const { nodes: rfNodes, edges: rfEdges } = convertToReactFlow(
        data.nodes,
        data.edges
      );
      setNodes(rfNodes);
      setEdges(rfEdges);
      if (rfNodes.length > 0) {
        setSelectedNodeId(rfNodes[0].id);
      }
    } catch (err) {
      console.error("Failed to search memories:", err);
    }
  }, [searchQuery, loadFullGraph, setNodes, setEdges]);

  // Initialize size and fetch graph
  useEffect(() => {
    loadFullGraph();
  }, [loadFullGraph]);

  // Fetch memories
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const data = await getMemories();
        setMemories(data.memories);
      } catch (err) {
        console.error("Failed to fetch memories:", err);
      } finally {
        setMemoriesLoading(false);
      }
    };
    fetchMemories();
  }, []);

  // Delete memory handler
  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await deleteMemory(memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  // Find selected node details
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId)?.data as any;
  }, [nodes, selectedNodeId]);

  // Node click handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);
=======
function MemoryGraphContent() {
  // --- State ---
  const [apiNodes, setApiNodes] = useState<APIGraphNode[]>([]);
  const [apiEdges, setApiEdges] = useState<APIGraphEdge[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<APIGraphNode | null>(null);
  const [selectedRelatedMemories, setSelectedRelatedMemories] =
    useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const { fitView, getNodes, getEdges } = useReactFlow();
  const animationFrameRef = useRef<number>();

  // --- Force-Directed Layout ---
  const runForceLayout = useCallback(() => {
    if (nodes.length === 0) return;

    const width = 1200;
    const height = 800;
    const center = { x: width / 2, y: height / 2 };

    // Create a copy to work with
    const layoutNodes = nodes.map((n) => ({
      ...n,
      x: n.x || center.x + (Math.random() - 0.5) * 400,
      y: n.y || center.y + (Math.random() - 0.5) * 400,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
    }));

    const layoutEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    // Simple force simulation steps (lightweight)
    const alphaDecay = 0.01;
    let alpha = 1;

    const tick = () => {
      // 1. Apply repulsion between all pairs
      for (let i = 0; i < layoutNodes.length; i++) {
        for (let j = i + 1; j < layoutNodes.length; j++) {
          const dx = layoutNodes[i].x! - layoutNodes[j].x!;
          const dy = layoutNodes[i].y! - layoutNodes[j].y!;
          const distSq = dx * dx + dy * dy;
          const force = 20000 / distSq;
          const dist = Math.sqrt(distSq);
          layoutNodes[i].vx! += (dx / dist) * force;
          layoutNodes[i].vy! += (dy / dist) * force;
          layoutNodes[j].vx! -= (dx / dist) * force;
          layoutNodes[j].vy! -= (dy / dist) * force;
        }
      }

      // 2. Apply attraction for connected nodes
      for (const edge of layoutEdges) {
        const source = layoutNodes.find((n) => n.id === edge.source);
        const target = layoutNodes.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = source.x! - target.x!;
        const dy = source.y! - target.y!;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 150) * 0.01;
        source.vx! -= (dx / dist) * force;
        source.vy! -= (dy / dist) * force;
        target.vx! += (dx / dist) * force;
        target.vy! += (dy / dist) * force;
      }

      // 3. Apply centering force
      for (const node of layoutNodes) {
        node.vx! += (center.x - node.x!) * 0.005;
        node.vy! += (center.y - node.y!) * 0.005;
      }

      // 4. Update positions
      for (const node of layoutNodes) {
        node.vx! *= 0.9; // Damping
        node.vy! *= 0.9;
        node.x! += node.vx!;
        node.y! += node.vy!;
      }

      // Update alpha
      alpha *= 1 - alphaDecay;

      // 5. Update ReactFlow nodes
      setNodes(layoutNodes);

      // 6. Continue animating if alpha is still high enough
      if (alpha > 0.01) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    tick();
  }, [nodes, edges, setNodes]);

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [graphData, memoriesData, statsData] = await Promise.all([
        getGraph(),
        getMemories(),
        getGraphStats(),
      ]);
      setApiNodes(graphData.nodes);
      setApiEdges(graphData.edges);
      setMemories(memoriesData.memories);
      setGraphStats(statsData);

      // Convert to ReactFlow nodes, apply initial positions
      const initialNodes: Node[] = graphData.nodes.map((node, idx) => ({
        id: node.id,
        type: "custom",
        position: {
          x: 300 + (idx % 8) * 120,
          y: 200 + Math.floor(idx / 8) * 120,
        },
        data: { label: node.name, type: node.type },
      }));

      const initialEdges: Edge[] = graphData.edges.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#a78bfa",
        },
        label: edge.type,
        labelStyle: {
          fill: "#94a3b8",
          fontSize: "10px",
        },
        style: { stroke: "#6c5ce7", strokeWidth: 2 },
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);
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

  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        fitView({ padding: 0.3 });
        runForceLayout();
      }, 300);
    }
  }, [nodes.length, fitView, runForceLayout]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // --- Handlers ---
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#a78bfa" },
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
        const related = await getRelatedMemories(apiNode.name);
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
        const related = await getRelatedMemories(selectedNode.name);
        setSelectedRelatedMemories(related);
      }
    } catch (e) {
      console.error("Failed to delete memory", e);
    }
  };

  // --- Derived State (Filters & Search) ---
  const { filteredNodes, filteredEdges, highlightedNodeIds } = useMemo(() => {
    let filteredNodes = [...apiNodes];
    let highlightedNodeIds = new Set<string>();

    // 1. Apply Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter((node) =>
        node.name.toLowerCase().includes(q)
      );
      highlightedNodeIds = new Set(filteredNodes.map((n) => n.id));
    }

    // 2. Apply Filters
    if (activeFilters.length > 0) {
      filteredNodes = filteredNodes.filter((node) =>
        activeFilters.includes(node.type)
      );
      highlightedNodeIds = new Set(filteredNodes.map((n) => n.id));
    }

    // 3. Filter edges to only those between filtered nodes (if any filters active)
    const nodeSet = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = apiEdges.filter(
      (e) => nodeSet.has(e.source_node_id) && nodeSet.has(e.target_node_id)
    );

    return { filteredNodes, filteredEdges, highlightedNodeIds };
  }, [apiNodes, apiEdges, searchQuery, activeFilters]);

  // Update ReactFlow nodes to show/hide (by adjusting opacity or just re-setting)
  // Wait, let's instead modify the existing nodes' data or style!
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        let opacity = 1;
        if (
          (searchQuery || activeFilters.length > 0) &&
          !highlightedNodeIds.has(node.id)
        ) {
          opacity = 0.1;
        }
        // Also highlight selected node's neighbors if a node is selected!
        if (selectedNode && selectedNode.id !== node.id) {
          const isNeighbor = edges.some(
            (e) =>
              (e.source === selectedNode.id && e.target === node.id) ||
              (e.target === selectedNode.id && e.source === node.id)
          );
          if (!isNeighbor) {
            opacity = 0.1;
          }
        }
        return {
          ...node,
          style: { ...node.style, opacity },
        };
      })
    );
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        let opacity = 1;
        if (
          (searchQuery || activeFilters.length > 0) &&
          (!highlightedNodeIds.has(edge.source) ||
            !highlightedNodeIds.has(edge.target))
        ) {
          opacity = 0.1;
        }
        // Highlight edges connected to selected node!
        if (
          selectedNode &&
          !(
            edge.source === selectedNode.id || edge.target === selectedNode.id
          )
        ) {
          opacity = 0.1;
        }
        return {
          ...edge,
          style: { ...edge.style, opacity },
        };
      })
    );
  }, [
    highlightedNodeIds,
    searchQuery,
    activeFilters,
    selectedNode,
    edges,
    setNodes,
    setEdges,
  ]);

  const toggleFilter = (type: string) => {
    if (activeFilters.includes(type)) {
      setActiveFilters(activeFilters.filter((t) => t !== type));
    } else {
      setActiveFilters([...activeFilters, type]);
    }
  };
>>>>>>> 007607a (Describe your changes)

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#020617]">
        {/* --- Main Graph Area --- */}
        <div className="flex-1 flex flex-col">
<<<<<<< HEAD
          {/* Header */}
          <div
            className="flex items-center justify-between px-8 py-5 gap-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <h1 className="text-xl font-bold text-white">Memory Graph</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Intelligent knowledge graph of your memories and documents
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search entities..."
                  className="w-full pl-10 pr-10 py-2 rounded-xl text-sm"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      loadFullGraph();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  </button>
                )}
              </form>
              <button
                onClick={loadFullGraph}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.03]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Maximize2 size={14} />
                Reset View
=======
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

            <div className="flex items-center gap-4">
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

              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] bg-slate-800 border border-slate-700 text-white hover:bg-slate-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Refresh
>>>>>>> 007607a (Describe your changes)
              </button>
            </div>
          </div>

          {/* React Flow Canvas */}
<<<<<<< HEAD
          <div ref={reactFlowWrapper} className="flex-1 relative overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={48} className="animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onInit={setReactFlowInstance}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-[#0a0a1a]"
              >
                <Background color="#4c1d95" gap={20} />
                <Controls style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-primary)" }} />
                <MiniMap
                  nodeStrokeColor={(n) => (n.data as any).color || "#888"}
                  nodeColor={(n) => (n.data as any).color || "#888"}
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                />
              </ReactFlow>
            )}
=======
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-[#020617]"
              minZoom={0.2}
              maxZoom={4}
              colorMode="dark"
            >
              <Background
                color="#334155"
                gap={20}
                style={{ opacity: 0.3 }}
              />
              <Controls className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 text-white shadow-xl" />
              <MiniMap
                nodeColor={(n) =>
                  NODE_COLORS[(n.data as any).type] || "#94a3b8"
                }
                className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-xl shadow-xl"
              />
            </ReactFlow>
>>>>>>> 007607a (Describe your changes)
          </div>
        </div>

        {/* --- Right Sidebar --- */}
        <div className="w-[420px] bg-slate-900/95 border-l border-slate-800 overflow-y-auto backdrop-blur-md">
          <div className="p-6 space-y-6">
            {/* 1. Stats Panel */}
            {graphStats && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Graph Stats</h3>
                </div>

<<<<<<< HEAD
            {selectedNode ? (
              <div>
                {/* Node Identity */}
                <div
                  className="flex items-center gap-3 p-4 rounded-xl mb-5"
                  style={{
                    backgroundColor: selectedNode.color + "22",
                    border: `1px solid ${selectedNode.color}`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: selectedNode.color }}
                  >
                    <User size={20} color="white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{selectedNode.label.replace("\n", " ")}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Type: {selectedNode.type || selectedNode.category}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {selectedNode.description && (
                  <div className="mb-5">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Description
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {selectedNode.description}
                    </p>
                  </div>
                )}

                {selectedNode.date && (
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={12} style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Created: {selectedNode.date}
                    </p>
                  </div>
                )}

                {selectedNode.owner && (
                  <div className="flex items-center gap-2 mb-5">
                    <User size={12} style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Owner: {selectedNode.owner}
                    </p>
                  </div>
                )}

                {/* Connected To */}
                {selectedNode.connections && selectedNode.connections.length > 0 && (
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Connected To ({selectedNode.connections.length})
                    </p>
                    <div className="space-y-2">
                      {selectedNode.connections.slice(0, 10).map((conn: string, i: number) => (
                        <div
                          key={i}
                          className="card px-3 py-2.5 flex items-center gap-2.5 cursor-pointer"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                Object.values(categories)[i % Object.values(categories).length],
                            }}
                          />
                          <p className="text-xs text-white">{conn}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
=======
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
                        {graphStats.most_connected.connection_count}{" "}
                        connections
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
>>>>>>> 007607a (Describe your changes)
              </div>
            )}

            {/* 2. Filters Panel */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={16} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Filters</h3>
              </div>
<<<<<<< HEAD
            ) : memories.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No memories extracted yet. Chat to create some!
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="card p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: memoryTypeColors[memory.type] || "#A142F4" }}
                        />
                        <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
                          {memory.type}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          • Importance: {memory.importance.toFixed(1)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={10} style={{ color: "var(--text-muted)" }} />
                      </button>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {memory.memory}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(memory.created_at).toLocaleString()}
                    </p>
                  </div>
=======

              <div className="flex flex-wrap gap-2">
                {Object.keys(NODE_COLORS).map((type) => (
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
>>>>>>> 007607a (Describe your changes)
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon =
                        NODE_ICONS[selectedNode.type] || Sparkles;
                      return (
                        <div
                          className="p-2 rounded-xl"
                          style={{
                            backgroundColor:
                              (NODE_COLORS[selectedNode.type] ||
                                "#94a3b8") + "20",
                          }}
                        >
                          <Icon
                            size={20}
                            style={{
                              color:
                                NODE_COLORS[selectedNode.type] ||
                                "#94a3b8",
                            }}
                          />
                        </div>
                      );
                    })()}
                    <div>
                      <p className="text-sm font-bold text-white">
                        {selectedNode.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {selectedNode.type}
                      </p>
                    </div>
                  </div>

                  {selectedRelatedMemories &&
                    selectedRelatedMemories.edges.length > 0 && (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Relationships
                        </p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {selectedRelatedMemories.edges.map(
                            (edge: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-slate-800 px-3 py-2.5 text-xs rounded-lg border border-slate-700"
                              >
                                <span className="text-white">
                                  {edge.source_name}
                                </span>{" "}
                                <span className="text-violet-400 font-medium">
                                  {edge.type}
                                </span>{" "}
                                <span className="text-white">
                                  {edge.target_name}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

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
                                            "#94a3b8") + "20",
                                        color:
                                          NODE_COLORS[mem.type] ||
                                          "#94a3b8",
                                      }}
                                    >
                                      {mem.type}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      Importance:{" "}
                                      {mem.importance.toFixed(1)}
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
<<<<<<< HEAD
};

const MemoryGraphPage = () => {
  return (
    <ReactFlowProvider>
      <MemoryGraphPageContent />
    </ReactFlowProvider>
  );
};

export default MemoryGraphPage;
=======
}

export default function MemoryGraphPage() {
  return (
    <ReactFlowProvider>
      <MemoryGraphContent />
    </ReactFlowProvider>
  );
}
>>>>>>> 007607a (Describe your changes)
