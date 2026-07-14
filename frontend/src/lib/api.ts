/**
 * EVOLVE AI — API Client
 * Functions for communicating with the FastAPI backend.
 */

const API_BASE = "http://localhost:8000/api";

/* ─── Types ─── */

export interface DocumentInfo {
  id: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  file_size: number;
  status: string;
  uploaded_at: string;
  metadata: Record<string, string>;
}

export interface SourceReference {
  content: string;
  page_number: number | null;
  chunk_index: number;
  relevance_score: number;
  document_name: string;
}

export interface ChatResponse {
  chat_id: string;
  answer: string;
  sources: SourceReference[];
  confidence: number;
  document_name: string;
  processing_time: number;
}

export interface UploadResponse {
  id: string;
  filename: string;
  status: string;
  message: string;
}

/* ─── Documents ─── */

export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.detail || "Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.open("POST", `${API_BASE}/documents/upload`);
    xhr.send(formData);
  });
}

export async function getDocuments(): Promise<{
  documents: DocumentInfo[];
  total: number;
}> {
  const res = await fetch(`${API_BASE}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function getDocument(docId: string): Promise<DocumentInfo> {
  const res = await fetch(`${API_BASE}/documents/${docId}`);
  if (!res.ok) throw new Error("Document not found");
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${docId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

/* ─── Chat ─── */

export async function chatWithDocument(
  question: string,
  chatId?: string,
  documentId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      chat_id: chatId || null,
      document_id: documentId || null,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Chat request failed");
  }

  return res.json();
}

/* ──────────────── Health ──────────────── */

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/* ──────────────── Memory Graph ──────────────── */

export interface GraphNode {
  id: string;
  label: string;
  category: string;
  color: string;
  radius: number;
  description?: string;
  date?: string;
  owner?: string;
  type?: string;
  connections?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface MemoryGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function getMemoryGraph(): Promise<MemoryGraphData> {
  const res = await fetch(`${API_BASE}/memory-graph`);
  if (!res.ok) throw new Error("Failed to fetch memory graph");
  return res.json();
}

export async function getRelatedMemories(
  entity: string,
  type?: string
): Promise<MemoryGraphData> {
  let url = `${API_BASE}/memory-graph/related?entity=${encodeURIComponent(entity)}`;
  if (type) {
    url += `&type=${encodeURIComponent(type)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch related memories");
  return res.json();
}

/* ─── Authentication ─── */

export async function loginWithGoogle(): Promise<void> {
  window.location.href = `${API_BASE}/auth/google/login`;
}

export async function checkAuthStatus(): Promise<{ authenticated: boolean }> {
  const res = await fetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error("Failed to check auth status");
  return res.json();
}

/* ─── Sources Sync ─── */

export async function syncGmail(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/sources/gmail/sync`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to sync Gmail");
  return res.json();
}

export async function syncDrive(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/sources/drive/sync`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to sync Drive");
  return res.json();
}

export async function syncCalendar(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/sources/calendar/sync`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to sync Calendar");
  return res.json();
}

/* ─── Memories ─── */

export interface Memory {
  id: string;
  chat_id: string;
  user_id: string;
  type: string;
  memory: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryListResponse {
  memories: Memory[];
  total: number;
}

export async function getMemories(chatId?: string): Promise<MemoryListResponse> {
  let url = `${API_BASE}/memories`;
  if (chatId) {
    url += `?chat_id=${chatId}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch memories");
  return res.json();
}

export async function getRelevantMemories(query: string, chatId?: string): Promise<MemoryListResponse> {
  let url = `${API_BASE}/memories/relevant?query=${encodeURIComponent(query)}`;
  if (chatId) {
    url += `&chat_id=${chatId}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch relevant memories");
  return res.json();
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/memories/${memoryId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete memory");
}

/* ─── Timeline ─── */

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  event_type: string;
  icon?: string;
  color?: string;
  related_document?: string;
  related_memory?: string;
  related_graph_node?: string;
}

export interface TimelineResponse {
  events_by_date: Record<string, TimelineEvent[]>;
}

export async function getTimeline(limit: number = 100): Promise<TimelineResponse> {
  const res = await fetch(`${API_BASE}/timeline?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

/* ─── Dashboard ─── */

export interface DashboardStats {
  total_memories: number;
  total_documents: number;
  total_emails: number;
  total_calendar: number;
  total_timeline_events: number;
  total_nodes: number;
  total_edges: number;
  clusters: number;
  today_memories: number;
  recent_activity: TimelineEvent[];
  connected_sources: any[];
  suggested_queries: string[];
  last_sync: string;
  todays_focus: string;
  upcoming_events_label: string;
  graph_has_data: boolean;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}
