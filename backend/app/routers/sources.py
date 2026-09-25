"""
Sources Integration Router
Handles fetching and processing data from Gmail, Google Drive, and Google Calendar.
"""

import os
import json
import base64
import traceback
from datetime import datetime, UTC
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from dotenv import load_dotenv
from ..services.pdf_parser import extract_text_from_pdf_bytes
from ..services.chunker import chunk_text
from ..services.embeddings import embed_texts
from ..services.vector_store import add_document
from ..services.memory_graph_builder import (
    get_graph_service,
    EntityNode
)
from app.database import SessionLocal, get_db
from app.repositories.document_repo import DocumentRepository
from app.repositories.auth_repo import AuthRepository
from app.dependencies import get_current_user
from app.models.db_models import User
from app.services.timeline_service import add_timeline_event

load_dotenv()

router = APIRouter(prefix="/api/sources", tags=["sources"])


def get_google_credentials(user_id: str, db) -> Credentials:
    print(f"[OAuth] Getting credentials for user {user_id}")
    creds_dict = AuthRepository.get_credentials(db, user_id)
    if not creds_dict or not creds_dict.get("token"):
        print(f"[OAuth] No credentials found for user {user_id}")
        raise HTTPException(
            status_code=401,
            detail="Not authenticated with Google. Please click 'Connect Google' to grant access to your Gmail and Drive."
        )
    
    expiry = None
    if creds_dict.get("expiry"):
        try:
            expiry = datetime.fromisoformat(creds_dict["expiry"])
        except Exception:
            pass

    client_id = creds_dict.get("client_id") or os.getenv("GOOGLE_CLIENT_ID")
    client_secret = creds_dict.get("client_secret") or os.getenv("GOOGLE_CLIENT_SECRET")
    token_uri = creds_dict.get("token_uri") or "https://oauth2.googleapis.com/token"
    
    google_creds = Credentials(
        token=creds_dict["token"],
        refresh_token=creds_dict.get("refresh_token"),
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=creds_dict.get("scopes") or [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/calendar.readonly",
        ],
        expiry=expiry,
    )

    # Automatically check/refresh if expired or about to expire
    now_dt = datetime.now(UTC).replace(tzinfo=None)
    expiry_past = expiry is not None and expiry.replace(tzinfo=None) < now_dt
    print(f"[OAuth] Checking token expiry: expiry_past={expiry_past}, google_creds.expired={google_creds.expired}")

    if google_creds.expired or expiry_past:
        if google_creds.refresh_token:
            from google.auth.transport.requests import Request as AuthRequest
            import google.auth.exceptions
            try:
                print("[OAuth] Token expired, attempting refresh...")
                google_creds.refresh(AuthRequest())
                print(f"[OAuth] Token refreshed successfully. New expiry: {google_creds.expiry}")
                try:
                    AuthRepository.save_credentials(
                        db=db,
                        user_id=user_id,
                        token=google_creds.token,
                        refresh_token=google_creds.refresh_token,
                        token_uri=google_creds.token_uri,
                        client_id=google_creds.client_id,
                        client_secret=google_creds.client_secret,
                        scopes=google_creds.scopes,
                        expiry=google_creds.expiry,
                    )
                    db.commit()
                    print("[OAuth] Refreshed credentials saved to database successfully.")
                except Exception as e:
                    db.rollback()
                    print(f"[OAuth] Error saving refreshed credentials to DB: {e}")
            except google.auth.exceptions.RefreshError as e:
                print(f"[OAuth] Refresh failed with error: {e}")
                print(f"[OAuth] Deleting invalid credentials for user {user_id}")
                try:
                    AuthRepository.delete_credentials(db, user_id)
                    db.commit()
                except Exception:
                    db.rollback()
                raise HTTPException(
                    status_code=401,
                    detail="Google authentication has expired or was revoked. Please click 'Connect Google' to log in again."
                )
            except Exception as e:
                print(f"[OAuth] Unexpected error during refresh: {e}")
                raise HTTPException(
                    status_code=401,
                    detail=f"Google authentication refresh failed: {str(e)}. Please reconnect."
                )
        else:
            print(f"[OAuth] Google token expired and no refresh token available for user {user_id}")
            try:
                AuthRepository.delete_credentials(db, user_id)
                db.commit()
            except Exception:
                db.rollback()
            raise HTTPException(
                status_code=401,
                detail="Google authentication token has expired. Please click 'Connect Google' to re-authenticate."
            )
            
    return google_creds


def extract_email_body(payload: dict, snippet: str = "") -> str:
    """Extract readable text body from Gmail message payload supporting multipart & HTML."""
    if not payload:
        return snippet or ""

    # 1. Direct body data
    body_data = payload.get("body", {}).get("data")
    if body_data:
        try:
            decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
            if decoded.strip():
                return decoded.strip()
        except Exception:
            pass

    # 2. Search parts (recursively for nested multiparts)
    def find_text_in_parts(parts):
        text_plain = ""
        text_html = ""
        for part in parts:
            mime = part.get("mimeType", "")
            part_data = part.get("body", {}).get("data")
            if mime == "text/plain" and part_data:
                try:
                    decoded = base64.urlsafe_b64decode(part_data).decode("utf-8", errors="replace")
                    if decoded.strip():
                        return decoded.strip()
                except Exception:
                    pass
            elif mime == "text/html" and part_data and not text_html:
                try:
                    raw_html = base64.urlsafe_b64decode(part_data).decode("utf-8", errors="replace")
                    import re
                    stripped = re.sub(r'<[^>]+>', ' ', raw_html)
                    stripped = re.sub(r'\s+', ' ', stripped).strip()
                    if stripped:
                        text_html = stripped
                except Exception:
                    pass
            if "parts" in part and part["parts"]:
                sub = find_text_in_parts(part["parts"])
                if sub:
                    return sub
        return text_plain or text_html

    extracted = find_text_in_parts(payload.get("parts", []))
    if extracted and extracted.strip():
        return extracted.strip()

    return snippet or ""


# Pydantic model for saving provider tokens
class SaveGoogleTokensRequest(BaseModel):
    provider_token: str
    provider_refresh_token: Optional[str] = None
    scopes: Optional[list[str]] = None

@router.post("/google/save-tokens")
async def save_google_tokens(
    request: SaveGoogleTokensRequest,
    current_user: User = Depends(get_current_user),
    db: SessionLocal = Depends(get_db)
):
    """Save Google provider tokens from Supabase to our database."""
    print(f"[Sources] Saving Google tokens for user {current_user.id}")
    try:
        from datetime import datetime, timedelta
        expiry = datetime.utcnow() + timedelta(hours=1)
        token_uri = "https://oauth2.googleapis.com/token"
        
        AuthRepository.save_credentials(
            db=db,
            user_id=current_user.id,
            token=request.provider_token,
            refresh_token=request.provider_refresh_token,
            token_uri=token_uri,
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            scopes=request.scopes or [
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/drive.readonly",
                "https://www.googleapis.com/auth/calendar.readonly",
            ],
            expiry=expiry,
        )
        db.commit()
        print(f"[Sources] Google tokens saved successfully for user {current_user.id}")
        return {"status": "success", "message": "Google tokens saved successfully"}
    except Exception as e:
        db.rollback()
        print(f"[Sources] Error saving Google tokens: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save Google tokens: {e}")


@router.post("/gmail/sync")
async def sync_gmail(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Sync emails from Gmail to our vector DB and knowledge graph."""
    print("-" * 50)
    print(f"[Gmail Sync] Starting sync for user {current_user.id}")
    try:
        print("[Gmail Sync] Step 1: Getting Google credentials...")
        creds = get_google_credentials(current_user.id, db)
        
        print("[Gmail Sync] Step 2: Building Gmail service...")
        service = build("gmail", "v1", credentials=creds)
        print("[Gmail Sync] Gmail service built successfully")
        
        print("[Gmail Sync] Step 3: Making Gmail API request to list messages...")
        results = service.users().messages().list(userId="me", maxResults=20).execute()
        
        messages = results.get("messages", [])
        print(f"[Gmail Sync] Found {len(messages)} messages to sync")
        if not messages:
            return {"status": "success", "message": "Gmail is connected! No emails found in your inbox."}

        graph_service = get_graph_service()
        synced_count = 0
        
        for i, msg in enumerate(messages):
            print(f"[Gmail Sync] Processing message {i+1}/{len(messages)} (ID: {msg['id']})")
            try:
                msg_data = service.users().messages().get(userId="me", id=msg["id"], format="full").execute()
                payload = msg_data.get("payload", {})
                headers = payload.get("headers", [])
                
                subject = next((h["value"] for h in headers if h.get("name", "").lower() == "subject"), "No Subject")
                from_addr = next((h["value"] for h in headers if h.get("name", "").lower() == "from"), "Unknown Sender")
                date = next((h["value"] for h in headers if h.get("name", "").lower() == "date"), "")
                snippet = msg_data.get("snippet", "")

                body = extract_email_body(payload, snippet=snippet)
                content = f"Subject: {subject}\nFrom: {from_addr}\nDate: {date}\n\n{body}"
                
                chunks = chunk_text(content)
                if not chunks:
                    continue
                
                chunk_texts = [c.text for c in chunks]
                embeddings = embed_texts(chunk_texts)
                
                doc_id = f"gmail_{msg['id']}"
                metadatas = [
                    {
                        "document_name": f"Email - {subject}",
                        "page_number": 1,
                        "chunk_index": idx,
                        "source": "gmail",
                        "user_id": current_user.id,
                    }
                    for idx, _ in enumerate(chunks)
                ]
                add_document(doc_id, chunk_texts, embeddings, metadatas)
                
                try:
                    DocumentRepository.create(
                        db=db,
                        doc_id=doc_id,
                        filename=f"Email - {subject}",
                        source="gmail",
                        page_count=1,
                        chunk_count=len(chunks),
                        file_size=len(content.encode("utf-8", errors="replace")),
                        status="ready",
                        metadata={"subject": subject, "from": from_addr, "date": date, "msg_id": msg["id"]},
                        user_id=current_user.id,
                    )
                    db_chunks = [
                        {
                            "chunk_index": c.chunk_index,
                            "page_number": c.page_number or 1,
                            "content": c.text,
                        }
                        for c in chunks
                    ]
                    DocumentRepository.create_chunks(db, doc_id, db_chunks)
                    db.commit()
                except Exception as e:
                    db.rollback()
                    print(f"[Gmail Sync] Error saving doc metadata to DB: {e}")
                
                try:
                    recipients = next((h["value"] for h in headers if h.get("name", "").lower() == "to"), "")
                    email_node = EntityNode(
                        name=f"Email - {subject}",
                        type="Email",
                        description=f"From: {from_addr}\nTo: {recipients}\nDate: {date}",
                        metadata={
                            "source": "gmail",
                            "subject": subject,
                            "from": from_addr,
                            "to": recipients,
                            "date": date,
                            "msg_id": msg["id"]
                        }
                    )
                    graph_service.process_text(
                        text=content,
                        user_id=current_user.id,
                        source_node=email_node,
                        context={"type": "email", "source": "gmail", "msg_id": msg["id"], "user_id": current_user.id},
                        doc_id=doc_id,
                    )
                except Exception as graph_err:
                    print(f"[Gmail Sync] Knowledge graph extraction error for email {msg['id']}: {graph_err}")
                
                synced_count += 1
            except Exception as e:
                print(f"[Gmail Sync] Error processing message {msg['id']}: {e}")
                traceback.print_exc()
                continue
        
        print(f"[Gmail Sync] Sync completed successfully! Synced {synced_count} messages")
        if synced_count > 0:
            add_timeline_event(
                title="Gmail Synced",
                description=f"Successfully indexed {synced_count} emails into your memory vault.",
                event_type="gmail_sync",
                user_id=current_user.id
            )
        return {"status": "success", "message": f"Synced {synced_count} emails from Gmail"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Gmail Sync] Sync failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gmail sync failed: {str(e)}")


@router.post("/drive/sync")
async def sync_drive(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Sync documents from Google Drive to our vector DB and knowledge graph."""
    print("-" * 50)
    print(f"[Drive Sync] Starting sync for user {current_user.id}")
    try:
        print("[Drive Sync] Step 1: Getting Google credentials...")
        creds = get_google_credentials(current_user.id, db)
        
        print("[Drive Sync] Step 2: Building Drive service...")
        service = build("drive", "v3", credentials=creds)
        print("[Drive Sync] Drive service built successfully")
        
        print("[Drive Sync] Step 3: Making Drive API request to list files...")
        results = service.files().list(
            q="trashed = false and mimeType != 'application/vnd.google-apps.folder'",
            pageSize=25,
            fields="files(id, name, mimeType, createdTime, size)"
        ).execute()
        
        files = results.get("files", [])
        print(f"[Drive Sync] Found {len(files)} files to process")
        if not files:
            return {"status": "success", "message": "Google Drive is connected! No syncable files found."}

        graph_service = get_graph_service()
        synced_count = 0

        for i, file in enumerate(files):
            print(f"[Drive Sync] Processing file {i+1}/{len(files)} (ID: {file['id']}, Name: {file['name']})")
            try:
                mime = file.get("mimeType", "")
                text = ""
                file_size = 0

                # 1. Google Docs (export to text)
                if mime == "application/vnd.google-apps.document":
                    print(f"[Drive Sync]   Exporting Google Doc as text...")
                    req = service.files().export_media(fileId=file["id"], mimeType="text/plain")
                    content_bytes = req.execute()
                    text = content_bytes.decode("utf-8", errors="replace")
                    file_size = len(content_bytes)

                # 2. Google Sheets (export to csv)
                elif mime == "application/vnd.google-apps.spreadsheet":
                    print(f"[Drive Sync]   Exporting Google Sheet as CSV...")
                    req = service.files().export_media(fileId=file["id"], mimeType="text/csv")
                    content_bytes = req.execute()
                    text = content_bytes.decode("utf-8", errors="replace")
                    file_size = len(content_bytes)

                # 3. Google Slides (export to plain text)
                elif mime == "application/vnd.google-apps.presentation":
                    print(f"[Drive Sync]   Exporting Google Slides as text...")
                    req = service.files().export_media(fileId=file["id"], mimeType="text/plain")
                    content_bytes = req.execute()
                    text = content_bytes.decode("utf-8", errors="replace")
                    file_size = len(content_bytes)

                # 4. PDF Files
                elif mime == "application/pdf":
                    print(f"[Drive Sync]   Downloading PDF...")
                    req = service.files().get_media(fileId=file["id"])
                    file_content = req.execute()
                    file_size = int(file.get("size", len(file_content)))
                    text = extract_text_from_pdf_bytes(file_content)

                # 5. Plain Text, Markdown, CSV, JSON, or code files
                elif mime.startswith("text/") or mime in ("application/json", "application/csv"):
                    print(f"[Drive Sync]   Downloading text/data file...")
                    req = service.files().get_media(fileId=file["id"])
                    file_content = req.execute()
                    file_size = len(file_content)
                    text = file_content.decode("utf-8", errors="replace")

                else:
                    print(f"[Drive Sync]   Unsupported mimeType: {mime}, skipping")
                    continue

                if not text or not text.strip():
                    print(f"[Drive Sync]   No text found in file {file['name']}, skipping")
                    continue
                
                # Process and add to vector store
                chunks = chunk_text(text)
                if not chunks:
                    continue
                chunk_texts = [c.text for c in chunks]
                embeddings = embed_texts(chunk_texts)
                
                doc_id = f"drive_{file['id']}"
                metadatas = [
                    {
                        "document_name": file["name"],
                        "page_number": getattr(c, "page_number", 1) or 1,
                        "chunk_index": idx,
                        "source": "drive",
                        "user_id": current_user.id,
                    }
                    for idx, c in enumerate(chunks)
                ]
                add_document(doc_id, chunk_texts, embeddings, metadatas)
                
                # Update metadata in database
                try:
                    DocumentRepository.create(
                        db=db,
                        doc_id=doc_id,
                        filename=file["name"],
                        source="drive",
                        page_count=1,
                        chunk_count=len(chunks),
                        file_size=file_size,
                        status="ready",
                        metadata={"drive_id": file["id"], "mime_type": mime},
                        user_id=current_user.id,
                    )
                    db_chunks = [
                        {
                            "chunk_index": c.chunk_index,
                            "page_number": c.page_number or 1,
                            "content": c.text,
                        }
                        for c in chunks
                    ]
                    DocumentRepository.create_chunks(db, doc_id, db_chunks)
                    db.commit()
                except Exception as e:
                    db.rollback()
                    print(f"[Drive Sync]   Error saving doc metadata to DB: {e}")
                
                # Add to knowledge graph
                try:
                    doc_node = EntityNode(
                        name=file["name"],
                        type="Document",
                        description=f"Document from Google Drive\nMime Type: {mime}",
                        metadata={
                            "source": "drive",
                            "name": file["name"],
                            "mime_type": mime,
                            "drive_id": file["id"],
                            "created_time": file.get("createdTime", "")
                        }
                    )
                    graph_service.process_text(
                        text=text,
                        user_id=current_user.id,
                        source_node=doc_node,
                        context={"type": "document", "source": "drive", "drive_id": file["id"], "user_id": current_user.id},
                        doc_id=doc_id,
                    )
                except Exception as graph_err:
                    print(f"[Drive Sync]   Knowledge graph extraction error for file {file['id']}: {graph_err}")

                synced_count += 1
            except Exception as e:
                print(f"[Drive Sync] Error processing file {file['id']}: {e}")
                traceback.print_exc()
                continue
        
        print(f"[Drive Sync] Sync completed! Processed {synced_count} files")
        if synced_count > 0:
            add_timeline_event(
                title="Google Drive Synced",
                description=f"Successfully indexed {synced_count} files into your memory vault.",
                event_type="drive_sync",
                user_id=current_user.id
            )
        return {"status": "success", "message": f"Synced {synced_count} files from Drive"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Drive Sync] Sync failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Drive sync failed: {str(e)}")


@router.post("/calendar/sync")
async def sync_calendar(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Sync events from Google Calendar to our vector DB and knowledge graph."""
    print("-" * 50)
    print(f"[Calendar Sync] Starting sync for user {current_user.id}")
    try:
        from datetime import timedelta
        print("[Calendar Sync] Step 1: Getting Google credentials...")
        creds = get_google_credentials(current_user.id, db)
        
        print("[Calendar Sync] Step 2: Building Calendar service...")
        service = build("calendar", "v3", credentials=creds)
        print("[Calendar Sync] Calendar service built successfully")
        
        print("[Calendar Sync] Step 3: Making Calendar API request to list events...")
        start_time = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"
        events_result = service.events().list(
            calendarId="primary", timeMin=start_time, maxResults=25, singleEvents=True, orderBy="startTime"
        ).execute()
        
        events = events_result.get("items", [])
        print(f"[Calendar Sync] Found {len(events)} events to process")
        if not events:
            return {"status": "success", "message": "Google Calendar is connected! No recent events found."}

        graph_service = get_graph_service()
        synced_count = 0
        
        for i, event in enumerate(events):
            print(f"[Calendar Sync] Processing event {i+1}/{len(events)} (ID: {event['id']})")
            try:
                start = event["start"].get("dateTime", event["start"].get("date"))
                end = event["end"].get("dateTime", event["end"].get("date"))
                summary = event.get("summary", "No title")
                description = event.get("description", "")
                location = event.get("location", "")
                attendees = event.get("attendees", [])
                participants = [a.get("email", a.get("displayName", "")) for a in attendees] if attendees else []
                
                content = f"Event: {summary}\nStart: {start}\nEnd: {end}\n\n{description}"
                chunks = chunk_text(content)
                if not chunks:
                    continue

                chunk_texts = [c.text for c in chunks]
                embeddings = embed_texts(chunk_texts)
                
                doc_id = f"calendar_{event['id']}"
                metadatas = [
                    {
                        "document_name": f"Event - {summary}",
                        "page_number": 1,
                        "chunk_index": idx,
                        "source": "calendar",
                        "user_id": current_user.id,
                    }
                    for idx, _ in enumerate(chunks)
                ]
                add_document(doc_id, chunk_texts, embeddings, metadatas)
                
                try:
                    DocumentRepository.create(
                        db=db,
                        doc_id=doc_id,
                        filename=f"Event - {summary}",
                        source="calendar",
                        page_count=1,
                        chunk_count=len(chunks),
                        file_size=len(content.encode("utf-8", errors="replace")),
                        status="ready",
                        metadata={"start": start, "end": end, "location": location, "event_id": event["id"]},
                        user_id=current_user.id,
                    )
                    db_chunks = [
                        {
                            "chunk_index": c.chunk_index,
                            "page_number": c.page_number or 1,
                            "content": c.text,
                        }
                        for c in chunks
                    ]
                    DocumentRepository.create_chunks(db, doc_id, db_chunks)
                    db.commit()
                except Exception as e:
                    db.rollback()
                    print(f"[Calendar Sync] Error saving event metadata to DB: {e}")
                
                try:
                    event_node = EntityNode(
                        name=summary,
                        type="Event",
                        description=f"Calendar event\nStart: {start}\nEnd: {end}\nLocation: {location}",
                        metadata={
                            "source": "calendar",
                            "summary": summary,
                            "start": start,
                            "end": end,
                            "location": location,
                            "participants": participants,
                            "event_id": event["id"]
                        }
                    )
                    graph_service.process_text(
                        text=content,
                        user_id=current_user.id,
                        source_node=event_node,
                        context={"type": "event", "source": "calendar", "event_id": event["id"], "user_id": current_user.id},
                        doc_id=doc_id,
                    )
                except Exception as graph_err:
                    print(f"[Calendar Sync] Knowledge graph extraction error for event {event['id']}: {graph_err}")

                synced_count += 1
            except Exception as e:
                print(f"[Calendar Sync] Error processing event {event['id']}: {e}")
                traceback.print_exc()
                continue
        
        print(f"[Calendar Sync] Sync completed! Processed {synced_count} events")
        if synced_count > 0:
            add_timeline_event(
                title="Google Calendar Synced",
                description=f"Successfully indexed {synced_count} events into your timeline.",
                event_type="calendar_sync",
                user_id=current_user.id
            )
        return {"status": "success", "message": f"Synced {synced_count} events from Calendar"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Calendar Sync] Sync failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Calendar sync failed: {str(e)}")
