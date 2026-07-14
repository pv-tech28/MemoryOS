
"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import {
  Filter,
  Maximize2,
  Clock,
  User,
  FolderOpen,
  GitCommit,
  Mail,
  FileText,
  MessageSquare,
  Calendar,
  Lightbulb,
  Loader2,
  Trash2,
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
import {
  getMemoryGraph,
  type MemoryGraphData,
  type GraphNode as APIGraphNode,
  type GraphEdge as APIGraphEdge,
  getMemories,
  deleteMemory,
  type Memory,
  getRelatedMemories
} from "@/lib/api";

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
};

const memoryTypeColors: Record<string, string> = {
  personal: "#4facfe",
  goal: "#00d68f",
  project: "#f0a500",
  preference: "#e84393",
  skill: "#34a853",
  deadline: "#f0f0f0",
  task: "#25d366",
  education: "#ea4335",
  career: "#4285F4",
  custom: "#A142F4",
};

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

  return (
    <AppLayout>
      <div className="flex h-screen">
        {/* Graph Area */}
        <div className="flex-1 flex flex-col">
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
              </button>
            </div>
          </div>

          {/* React Flow Canvas */}
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
          </div>
        </div>

        {/* Right Panel - Node Details & Memories */}
        <motion.div
          className="w-[360px] flex-shrink-0 overflow-y-auto p-6 flex flex-col gap-6"
          style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {/* Node Details */}
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white mb-5">Node Details</h2>

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
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Click on a node to see details
              </p>
            )}
          </div>

          {/* Memories List */}
          <div>
            <h2 className="text-sm font-bold text-white mb-5">Long-Term Memories</h2>
            {memoriesLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
              </div>
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
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

const MemoryGraphPage = () => {
  return (
    <ReactFlowProvider>
      <MemoryGraphPageContent />
    </ReactFlowProvider>
  );
};

export default MemoryGraphPage;
