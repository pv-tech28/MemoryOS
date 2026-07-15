
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
  ReactFlowProvider,
  NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import {
  getMemoryGraph,
  getRelatedMemories,
  deleteMemory,
  getMemories,
  getGraphStats,
  Memory,
  GraphStats,
} from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

// --- Configuration: Node Types & Colors ---

const NODE_COLORS: Record<string, string> = {
  Person: "#60a5fa",
  Project: "#34d399",
  Company: "#f87171",
  Technology: "#a78bfa",
  Skill: "#c4b5fd",
  Language: "#fb923c",
  Framework: "#22d3ee",
  University: "#fbbf24",
  Organization: "#f97316",
  Document: "#f472b6",
  Email: "#ef4444",
  Task: "#facc15",
  Goal: "#fdba74",
  Preference: "#4ade80",
  Location: "#14b8a6",
  Date: "#94a3b8",
  Event: "#22c55e",
  Meeting: "#06b6d4",
  Certificate: "#eab308",
  Conversation: "#a855f7",
  Custom: "#94a3b8",
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
        backgroundColor: "#0f172a",
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
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedRelatedMemories, setSelectedRelatedMemories] =
    useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

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

      const initialNodes: Node[] = graphData.nodes.map((node: any, idx: number) => ({
        id: node.id,
        type: "custom",
        position: {
          x: 300 + (idx % 8) * 120,
          y: 200 + Math.floor(idx / 8) * 120,
        },
        data: { label: node.label, type: node.type },
      }));

      const initialEdges: Edge[] = graphData.edges.map((edge: any, idx: number) => ({
        id: `edge-${idx}`,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#a78bfa",
        },
        label: edge.label,
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

  // --- Derived State ---
  const { filteredNodes, filteredEdges } = useMemo(() => {
    // If no filters, return all
    if (!searchQuery && activeFilters.length === 0 && !selectedNode) {
      return { filteredNodes: nodes, filteredEdges: edges };
    }

    // First find which nodes to keep
    const keptNodeIds = new Set<string>();
    const filteredApiNodes = apiNodes.filter((node) => {
      let matches = true;
      if (searchQuery) {
        matches = node.label.toLowerCase().includes(searchQuery.toLowerCase());
      }
      if (matches && activeFilters.length > 0) {
        matches = activeFilters.includes(node.type);
      }
      return matches;
    });
    filteredApiNodes.forEach((n) => keptNodeIds.add(n.id));

    // Add selected node and neighbors
    if (selectedNode) {
      keptNodeIds.add(selectedNode.id);
      apiEdges.forEach((e) => {
        if (e.source === selectedNode.id) {
          keptNodeIds.add(e.target);
        }
        if (e.target === selectedNode.id) {
          keptNodeIds.add(e.source);
        }
      });
    }

    // Now filter nodes and edges
    const filteredNodes = nodes.map((node) => ({
      ...node,
      data: { ...node.data },
      style: {
        ...node.style,
        opacity: keptNodeIds.has(node.id) ? 1 : 0.1,
      },
    }));

    const filteredEdges = edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity:
          keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)
            ? 1
            : 0.1,
      },
    }));

    return { filteredNodes, filteredEdges };
  }, [nodes, edges, apiNodes, apiEdges, searchQuery, activeFilters, selectedNode]);

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <AppLayout>
      <div className="flex h-screen bg-[#020617]">
        {/* --- Main Graph Area --- */}
        <div className="flex-1 flex flex-col">
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
              </button>
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
              fitView
              className="bg-[#020617]"
              minZoom={0.2}
              maxZoom={4}
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
              </div>
            )}

            {/* 2. Filters Panel */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={16} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">Filters</h3>
              </div>

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
                        {selectedNode.label}
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
