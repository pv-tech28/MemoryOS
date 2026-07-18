/**
 * EVOLVE AI — API Client
 * Functions for communicating with the FastAPI backend.
 */
import { supabase } from "@/lib/supabase";

const API_BASE = "http://localhost:8000/api";

// Helper to get auth headers
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    return {
      "Authorization": `Bearer ${token}`,
    };
  }
  return {};
}

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

export interface RelatedEntity {
  name: string;
  type: string;
}

export interface ChatResponse {
  chat_id: string;
  answer: string;
  sources: SourceReference[];
  confidence: number;
  document_name: string;
  processing_time: number;
  related_entities?: RelatedEntity[];
  related_graph_nodes?: any[];
  memory_ids?: string[];
  related_documents?: any[];
  related_emails?: any[];
  related_calendar_events?: any[];
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
  const headers = await getAuthHeaders();

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
    // Set headers
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.send(formData);
  });
}

export async function getDocuments(): Promise<{
  documents: DocumentInfo[];
  total: number;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/documents`, { headers });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function getDocument(docId: string): Promise<DocumentInfo> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/documents/${docId}`, { headers });
  if (!res.ok) throw new Error("Document not found");
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/documents/${docId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

/* ─── Chat ─── */

export async function chatWithDocument(
  question: string,
  chatId?: string,
  documentId?: string
): Promise<ChatResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
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
  label?: string;
  category?: string;
  color?: string;
  radius?: number;
  name?: string;
  type?: string;
  description?: string | null;
  date?: string;
  owner?: string;
  connections?: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  label: string;
  relationship?: string;
  confidence?: number;
  animated?: boolean;
  markerEnd?: any;
  source_node_id?: string;
  target_node_id?: string;
  type?: string;
  description?: string | null;
  created_at?: string;
  source_name?: string;
  target_name?: string;
  [key: string]: any;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RelatedMemoriesResponse {
  node: GraphNode | null;
  edges: GraphEdge[];
  related_nodes: GraphNode[];
  memories: Memory[];
}

export interface MemoryGraphData {
  nodes: any[];
  edges: any[];
}

export async function getMemoryGraph(): Promise<MemoryGraphData> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/memory-graph`, { headers });
  if (!res.ok) throw new Error("Failed to fetch memory graph");
  return res.json();
}

export async function getRelatedMemories(entityName: string): Promise<RelatedMemoriesResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/memories/related/${encodeURIComponent(entityName)}`, { headers });
  if (!res.ok) throw new Error("Failed to get related memories");
  return res.json();
}

/* ─── Authentication ─── */

export async function loginWithGoogle(): Promise<void> {
  window.location.href = `${API_BASE}/auth/google/login`;
}

export async function checkAuthStatus(): Promise<{ authenticated: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/auth/status`, { headers });
  if (!res.ok) throw new Error("Failed to check auth status");
  return res.json();
}

/* ─── Sources Sync ─── */

export async function syncGmail(): Promise<{ status: string; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/sources/gmail/sync`, { method: "POST", headers });
  if (!res.ok) throw new Error("Failed to sync Gmail");
  return res.json();
}

export async function syncDrive(): Promise<{ status: string; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/sources/drive/sync`, { method: "POST", headers });
  if (!res.ok) throw new Error("Failed to sync Drive");
  return res.json();
}

export async function syncCalendar(): Promise<{ status: string; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/sources/calendar/sync`, { method: "POST", headers });
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
  const headers = await getAuthHeaders();
  let url = `${API_BASE}/memories`;
  if (chatId) {
    url += `?chat_id=${chatId}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Failed to fetch memories");
  return res.json();
}

export async function getRelevantMemories(query: string, chatId?: string): Promise<MemoryListResponse> {
  const headers = await getAuthHeaders();
  let url = `${API_BASE}/memories/relevant?query=${encodeURIComponent(query)}`;
  if (chatId) {
    url += `&chat_id=${chatId}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Failed to fetch relevant memories");
  return res.json();
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/memories/${memoryId}`, {
        method: "DELETE",
        headers,
    });
    if (!res.ok) throw new Error("Failed to delete memory");
}



export interface GraphStats {
    total_nodes: number;
    total_edges: number;
    node_counts: Record<string, number>;
    most_connected: {
        id: string;
        name: string;
        type: string;
        connection_count: number;
    } | null;
    newest_node: {
        id: string;
        name: string;
        type: string;
        created_at: string;
    } | null;
    avg_connections: number;
}

export async function getGraphStats(): Promise<GraphStats> {
  const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/memories/stats`, { headers });
    if (!res.ok) throw new Error("Failed to get graph stats");
    return res.json();
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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/timeline?limit=${limit}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function deleteTimelineEvent(eventId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/timeline/${eventId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete timeline event");
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
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/dashboard/stats`, { headers });
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

/* ─── Daily Summary ─── */

export interface DailySummaryStats {
  new_documents: number;
  emails_found: number;
  upcoming_meetings: number;
  connections_made: number;
  sources_active: number;
}

export interface DailySummaryHighlight {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

export interface DailySummaryResponse {
  stats: DailySummaryStats;
  highlights: DailySummaryHighlight[];
  insights: string[];
}

export async function getDailySummary(): Promise<DailySummaryResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/dashboard/daily-summary`, { headers });
  if (!res.ok) throw new Error("Failed to fetch daily summary");
  return res.json();
}

/* ─── Settings ─── */

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  username: string;
  bio: string | null;
  profile_picture_url: string | null;
  email_verified: boolean;
}

export interface UserSettings {
  theme: "dark" | "light" | "system";
  push_notifications: boolean;
  email_notifications: boolean;
  daily_summary_notifications: boolean;
  memory_update_notifications: boolean;
  sync_completion_notifications: boolean;
  ai_activity_notifications: boolean;
  sound_enabled: boolean;
  language: string;
  data_sharing_enabled: boolean;
  ai_training_consent: boolean;
  store_chat_history: boolean;
  memory_retention_period: string;
  auto_memory_extraction: boolean;
  auto_graph_building: boolean;
  auto_daily_summary: boolean;
  auto_source_sync: boolean;
  auto_ai_insights: boolean;
  ai_provider: "openrouter" | "deepseek" | "gemini";
  response_length: "short" | "medium" | "detailed";
  creativity_level: "low" | "medium" | "high";
}

export interface ConnectedSource {
  connected: boolean;
  last_sync: string | null;
  count: number;
}

export interface ConnectedSources {
  gmail: ConnectedSource;
  drive: ConnectedSource;
  calendar: ConnectedSource;
}

export interface StorageStats {
  documents_uploaded: number;
  memories_stored: number;
  memory_nodes: number;
  graph_connections: number;
  storage_used_bytes: number;
  storage_used_mb: number;
}

export async function getProfile(): Promise<Profile> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/profile`, { headers });
  if (!res.ok) throw new Error("Failed to get profile");
  return res.json();
}

export async function updateProfile(data: Partial<{
  display_name: string;
  username: string;
  bio: string;
}>): Promise<Profile> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export async function uploadProfilePicture(file: File): Promise<{ profile_picture_url: string }> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/settings/profile/picture`, {
    method: "POST",
    body: formData,
    headers,
  });
  if (!res.ok) throw new Error("Failed to upload profile picture");
  return res.json();
}

export async function getEmailSettings(): Promise<{ email: string; email_verified: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/email`, { headers });
  if (!res.ok) throw new Error("Failed to get email settings");
  return res.json();
}

export async function updateEmail(newEmail: string): Promise<{ email: string; email_verified: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/email`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ new_email: newEmail })
  });
  if (!res.ok) throw new Error("Failed to update email");
  return res.json();
}

export async function sendVerificationEmail(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/email/send-verification`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error("Failed to send verification email");
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/password/change`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
  });
  if (!res.ok) throw new Error("Failed to change password");
  return res.json();
}

export async function updateTwoFactor(enabled: boolean): Promise<{ two_factor_enabled: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/security/two-factor`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) throw new Error("Failed to update two-factor settings");
  return res.json();
}

export async function getAllSettings(): Promise<UserSettings> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/all`, { headers });
  if (!res.ok) throw new Error("Failed to get all settings");
  return res.json();
}

export async function updateAllSettings(data: Partial<UserSettings>): Promise<UserSettings> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  
  const res = await fetch(`${API_BASE}/settings/all?${params.toString()}`, {
    method: "PUT",
    headers,
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}

export async function getConnectedSources(): Promise<ConnectedSources> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/connected-sources`, { headers });
  if (!res.ok) throw new Error("Failed to get connected sources");
  return res.json();
}

export async function syncSource(source: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/connected-sources/${source}/sync`, {
    method: "POST",
    headers,
  });
  if (!res.ok) throw new Error(`Failed to sync ${source}`);
  return res.json();
}

export async function disconnectSource(source: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/connected-sources/${source}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`Failed to disconnect ${source}`);
  return res.json();
}

export async function deleteDocuments(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/documents`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete documents");
  return res.json();
}

export async function deleteMemoryGraph(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/memory-graph`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete memory graph");
  return res.json();
}

export async function deleteConversations(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/conversations`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete conversations");
  return res.json();
}

export async function deleteGmailData(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/gmail`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete Gmail data");
  return res.json();
}

export async function deleteDriveData(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/drive`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete Drive data");
  return res.json();
}

export async function deleteCalendarData(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/calendar`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete Calendar data");
  return res.json();
}

export async function deleteAllData(): Promise<{ message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/data/all`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete all data");
  return res.json();
}

export async function getStorageStats(): Promise<StorageStats> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/settings/storage/stats`, { headers });
  if (!res.ok) throw new Error("Failed to get storage stats");
  return res.json();
}
