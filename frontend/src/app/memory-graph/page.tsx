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
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { getMemoryGraph, type MemoryGraphData, type GraphNode as APIGraphNode, type GraphEdge as APIGraphEdge } from "@/lib/api";

/* ──────────────── Graph Data ──────────────── */

interface GraphNode extends APIGraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge extends APIGraphEdge {}

const categories: Record<string, string> = {
  Person: "#4facfe",
  Project: "#00d68f",
  Meeting: "#f0a500",
  Document: "#e84393",
  Event: "#6c5ce7",
  Code: "#f0f0f0",
  Chat: "#25d366",
};

/* ──────────────── Force Simulation ──────────────── */

function initNodesFromAPI(apiNodes: APIGraphNode[], width: number, height: number): GraphNode[] {
  const cx = width / 2;
  const cy = height / 2;
  return apiNodes.map((n, i) => {
    const angle = (i / apiNodes.length) * Math.PI * 2;
    const dist = i === 0 ? 0 : 140 + Math.random() * 80;
    return {
      ...n,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
    };
  });
}

function simulate(nodes: GraphNode[], edgeList: GraphEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = 3000 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[i].vx -= fx;
      nodes[i].vy -= fy;
      nodes[j].vx += fx;
      nodes[j].vy += fy;
    }
  }

  // Attraction along edges
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edgeList) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const force = (dist - 180) * 0.004;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Center gravity
  for (const node of nodes) {
    node.vx += (cx - node.x) * 0.001;
    node.vy += (cy - node.y) * 0.001;
  }

  // Apply velocity with damping
  for (const node of nodes) {
    node.vx *= 0.85;
    node.vy *= 0.85;
    node.x += node.vx;
    node.y += node.vy;
    // Bounds
    node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
    node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
  }
}

/* ──────────────── Component ──────────────── */

const detailIcons: Record<string, React.ElementType> = {
  Person: User,
  Project: FolderOpen,
  Meeting: Calendar,
  Document: FileText,
  Commit: GitCommit,
  Email: Mail,
  Chat: MessageSquare,
  Idea: Lightbulb,
  Event: Lightbulb,
};

export default function MemoryGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [graphData, setGraphData] = useState<MemoryGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({
    node: null,
    offsetX: 0,
    offsetY: 0,
  });

  // Initialize size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Fetch graph data from backend
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const data = await getMemoryGraph();
        setGraphData(data);
        edgesRef.current = data.edges;
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch memory graph:", err);
        setLoading(false);
      }
    };
    fetchGraph();
  }, []);

  // Initialize nodes when dimensions or graph data change
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      nodesRef.current = initNodesFromAPI(graphData.nodes, dimensions.width, dimensions.height);
      // Default select the central node (first node)
      setSelectedNode(nodesRef.current[0]);
    }
  }, [dimensions, graphData]);

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (!nodes || nodes.length === 0 || !edges) return;
    simulate(nodes, edges, dimensions.width, dimensions.height);

    // Clear
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = "rgba(108,92,231,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Edge label
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.font = "9px Inter, sans-serif";
      ctx.fillStyle = "rgba(136,136,170,0.6)";
      ctx.textAlign = "center";
      ctx.fillText(edge.label, mx, my - 4);
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = selectedNode?.id === node.id;

      // Glow
      if (isSelected) {
        const glow = ctx.createRadialGradient(
          node.x, node.y, node.radius * 0.5,
          node.x, node.y, node.radius * 2
        );
        glow.addColorStop(0, node.color + "40");
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node circle
      const gradient = ctx.createRadialGradient(
        node.x - node.radius * 0.3,
        node.y - node.radius * 0.3,
        node.radius * 0.1,
        node.x,
        node.y,
        node.radius
      );
      gradient.addColorStop(0, node.color + "cc");
      gradient.addColorStop(1, node.color + "55");

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? node.color : node.color + "44";
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.stroke();

      // Label
      const lines = node.label.split("\n");
      ctx.font = `${node.radius > 35 ? "bold 11" : "10"}px Inter, sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((line, li) => {
        const yOffset = (li - (lines.length - 1) / 2) * 13;
        ctx.fillText(line, node.x, node.y + yOffset);
      });
    }

    animRef.current = requestAnimationFrame(draw);
  }, [dimensions, selectedNode]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Mouse interaction
  const getNodeAt = (mx: number, my: number): GraphNode | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const dx = mx - n.x;
      const dy = my - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return n;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) {
      dragRef.current = { node, offsetX: mx - node.x, offsetY: my - node.y };
      setSelectedNode(node);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !dragRef.current.node) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragRef.current.node.x = mx - dragRef.current.offsetX;
    dragRef.current.node.y = my - dragRef.current.offsetY;
    dragRef.current.node.vx = 0;
    dragRef.current.node.vy = 0;
  };

  const handleMouseUp = () => {
    dragRef.current.node = null;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) setSelectedNode(node);
  };

  const DetailIcon = selectedNode
    ? detailIcons[selectedNode.type || selectedNode.category] || FolderOpen
    : FolderOpen;

  return (
    <AppLayout>
      <div className="flex h-screen">
        {/* Graph Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div
            className="flex items-center justify-between px-8 py-5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <h1 className="text-xl font-bold text-white">Memory Graph</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Visualize connections between people, projects, documents and events
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.03]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Filter size={14} />
                Filters
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.03]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <Maximize2 size={14} />
                Fit View
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={48} className="animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{ width: "100%", height: "100%" }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
              />
            )}

            {/* Category Legend */}
            <div
              className="absolute bottom-6 left-6 flex gap-3 px-4 py-2.5 rounded-xl"
              style={{
                background: "rgba(10,10,24,0.85)",
                border: "1px solid var(--border)",
                backdropFilter: "blur(8px)",
              }}
            >
              {Object.entries(categories).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Node Details */}
        <motion.div
          className="w-[320px] flex-shrink-0 overflow-y-auto p-6"
          style={{
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h2 className="text-sm font-bold text-white mb-5">Node Details</h2>

          {selectedNode ? (
            <div>
              {/* Node Identity */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: selectedNode.color + "22" }}
                >
                  <DetailIcon size={20} style={{ color: selectedNode.color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {selectedNode.label.replace("\n", " ")}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Type: {selectedNode.type || selectedNode.category}
                  </p>
                </div>
              </div>

              {/* Details */}
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
              {selectedNode.connections && (
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Connected To ({selectedNode.connections.length})
                  </p>
                  <div className="space-y-2">
                    {selectedNode.connections.map((conn, i) => (
                      <div
                        key={i}
                        className="card px-3 py-2.5 flex items-center gap-2.5 cursor-pointer"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            background:
                              Object.values(categories)[
                                i % Object.values(categories).length
                              ],
                          }}
                        />
                        <p className="text-xs text-white">{conn}</p>
                      </div>
                    ))}
                    <button
                      className="text-[11px] font-medium mt-2"
                      style={{ color: "var(--accent)" }}
                    >
                      +2 more
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Click on a node to see details
            </p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
