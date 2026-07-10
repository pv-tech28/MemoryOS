/**
 * EVOLVE AI — API Client
 * Functions for communicating with the FastAPI backend.
 */

const API_BASE = "/api";

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
  documentId?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      document_id: documentId || null,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Chat request failed");
  }

  return res.json();
}

/* ─── Health ─── */

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
