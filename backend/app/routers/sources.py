"""
Sources Integration Router
Handles fetching and processing data from Gmail, Google Drive, and Google Calendar.
"""

import os
import json
import base64
import traceback
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from dotenv import load_dotenv
from .auth import user_credentials
from ..services.pdf_parser import extract_text_from_pdf_bytes
from ..services.chunker import chunk_text
from ..services.embeddings import embed_texts
from ..services.vector_store import add_document
from ..services.memory_graph_builder import (
    get_graph_service,
    EntityNode
)
from app.database import SessionLocal
from app.repositories.document_repo import DocumentRepository
from app.dependencies import get_current_user
from app.models.db_models import User

load_dotenv()

router = APIRouter(prefix="/api/sources", tags=["sources"])


def get_google_credentials(user_id: str) -> Credentials:
    if user_id not in user_credentials:
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    creds = user_credentials[user_id]
    expiry = None
    if creds.get("expiry"):
        from datetime import datetime
        expiry = datetime.fromisoformat(creds["expiry"])
    
    google_creds = Credentials(
        token=creds["token"],
        refresh_token=creds.get("refresh_token"),
        token_uri=creds["token_uri"],
        client_id=creds["client_id"],
        client_secret=creds["client_secret"],
        scopes=creds["scopes"],
        expiry=expiry,
    )

    # Automatically check/refresh if expired or about to expire
    from datetime import datetime, UTC
    now_dt = datetime.now(UTC).replace(tzinfo=None)
    expiry_past = expiry is not None and expiry.replace(tzinfo=None) < now_dt

    if google_creds.expired or expiry_past:
        from google.auth.transport.requests import Request as AuthRequest
        import google.auth.exceptions
        from app.repositories.auth_repo import AuthRepository
        try:
            print("[OAuth] Token expired, attempting refresh...")
            google_creds.refresh(AuthRequest())
            # Save refreshed credentials back to database
            db = SessionLocal()
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
                print("[OAuth] Token refreshed and saved successfully.")
            except Exception as e:
                db.rollback()
                print(f"[OAuth] Error saving refreshed credentials: {e}")
            finally:
                db.close()
        except google.auth.exceptions.RefreshError as e:
            # Token is revoked or expired and cannot be refreshed!
            print(f"[OAuth] Refresh failed, deleting expired credentials: {e}")
            db = SessionLocal()
            try:
                AuthRepository.delete_credentials(db, user_id)
                db.commit()
            except Exception as e2:
                db.rollback()
                print(f"[OAuth] Error deleting invalid credentials: {e2}")
            finally:
                db.close()
            raise HTTPException(
                status_code=401,
                detail="Google authentication has expired or was revoked. Please click 'Connect' to log in again."
            )
            
    return google_creds


@router.post("/gmail/sync")
async def sync_gmail(
    current_user: User = Depends(get_current_user)
):
    """Sync emails from Gmail to our vector DB and knowledge graph."""
    try:
        creds = get_google_credentials(current_user.id)
        service = build("gmail", "v1", credentials=creds)
        results = service.users().messages().list(userId="me", maxResults=10).execute()
        messages = results.get("messages", [])
        graph_service = get_graph_service()
        
        for msg in messages:
            msg_data = service.users().messages().get(userId="me", id=msg["id"], format="full").execute()
            headers = msg_data["payload"]["headers"]
            
            # Safely get headers
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            from_addr = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
            date = next((h["value"] for h in headers if h["name"] == "Date"), "")
            
            # Extract email body
            parts = msg_data["payload"].get("parts", [])
            body = ""
            # Check if payload has direct body data first
            if msg_data["payload"].get("body", {}).get("data"):
                body = msg_data["payload"]["body"]["data"]
                body = base64.urlsafe_b64decode(body).decode("utf-8")
            # Otherwise check parts
            else:
                for part in parts:
                    if part["mimeType"] == "text/plain" and part.get("body", {}).get("data"):
                        body = part["body"]["data"]
                        body = base64.urlsafe_b64decode(body).decode("utf-8")
                        break
            
            # Process and add to vector store
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
                    "chunk_index": i,
                    "source": "gmail",
                }
                for i, _ in enumerate(chunks)
            ]
            add_document(doc_id, chunk_texts, embeddings, metadatas)
            
            # Update metadata in PostgreSQL
            db = SessionLocal()
            try:
                DocumentRepository.create(
                    db=db,
                    doc_id=doc_id,
                    filename=f"Email - {subject}",
                    source="gmail",
                    page_count=1,
                    chunk_count=len(chunks),
                    file_size=len(content.encode("utf-8")),
                    status="ready",
                    metadata={},
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
                print(f"Error saving gmail doc metadata to DB: {e}")
            finally:
                db.close()
            
            # Add to knowledge graph with enhanced email node
            recipients = next((h["value"] for h in headers if h["name"] == "To"), "")
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
                source_node=email_node,
                context={"type": "email", "source": "gmail", "msg_id": msg["id"], "user_id": current_user.id},
                user_id=current_user.id
            )
        
        return {"status": "success", "message": f"Synced {len(messages)} emails from Gmail"}
    except Exception as e:
        print("Gmail sync error:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gmail sync failed: {str(e)}")


@router.post("/drive/sync")
async def sync_drive(
    current_user: User = Depends(get_current_user)
):
    """Sync documents from Google Drive to our vector DB and knowledge graph."""
    try:
        creds = get_google_credentials(current_user.id)
        service = build("drive", "v3", credentials=creds)
        results = service.files().list(pageSize=10, fields="files(id, name, mimeType, createdTime, size)").execute()
        files = results.get("files", [])
        graph_service = get_graph_service()
        
        for file in files:
            if file["mimeType"] == "application/pdf":
                # Download PDF file
                request = service.files().get_media(fileId=file["id"])
                file_content = request.execute()
                
                # Extract text from PDF
                text = extract_text_from_pdf_bytes(file_content)
                if not text.strip():
                    continue
                
                # Process and add to vector store
                chunks = chunk_text(text)
                chunk_texts = [c.text for c in chunks]
                embeddings = embed_texts(chunk_texts)
                
                doc_id = f"drive_{file['id']}"
                metadatas = [
                    {
                        "document_name": file["name"],
                        "page_number": 1,
                        "chunk_index": i,
                        "source": "drive",
                    }
                    for i, _ in enumerate(chunks)
                ]
                add_document(doc_id, chunk_texts, embeddings, metadatas)
                
                # Update metadata in PostgreSQL
                db = SessionLocal()
                try:
                    DocumentRepository.create(
                        db=db,
                        doc_id=doc_id,
                        filename=file["name"],
                        source="drive",
                        page_count=1,
                        chunk_count=len(chunks),
                        file_size=int(file.get("size", len(file_content))),
                        status="ready",
                        metadata={},
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
                    print(f"Error saving drive doc metadata to DB: {e}")
                finally:
                    db.close()
                
                # Add to knowledge graph with enhanced drive document node
                doc_node = EntityNode(
                    name=file["name"],
                    type="Document",
                    description=f"Document from Google Drive\nMime Type: {file['mimeType']}",
                    metadata={
                        "source": "drive",
                        "name": file["name"],
                        "mime_type": file["mimeType"],
                        "drive_id": file["id"],
                        "created_time": file.get("createdTime", "")
                    }
                )
                graph_service.process_text(
                    text=text,
                    source_node=doc_node,
                    context={"type": "document", "source": "drive", "drive_id": file["id"], "user_id": current_user.id},
                    user_id=current_user.id
                )
        
        return {"status": "success", "message": f"Synced {len(files)} files from Drive"}
    except Exception as e:
        print("Drive sync error:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Drive sync failed: {str(e)}")


@router.post("/calendar/sync")
async def sync_calendar(
    current_user: User = Depends(get_current_user)
):
    """Sync events from Google Calendar to our vector DB and knowledge graph."""
    try:
        creds = get_google_credentials(current_user.id)
        service = build("calendar", "v3", credentials=creds)
        now = datetime.utcnow().isoformat() + "Z"
        events_result = service.events().list(
            calendarId="primary", timeMin=now, maxResults=10, singleEvents=True, orderBy="startTime"
        ).execute()
        events = events_result.get("items", [])
        graph_service = get_graph_service()
        
        for event in events:
            start = event["start"].get("dateTime", event["start"].get("date"))
            end = event["end"].get("dateTime", event["end"].get("date"))
            summary = event.get("summary", "No title")
            description = event.get("description", "")
            
            # Process and add to vector store
            content = f"Event: {summary}\nStart: {start}\nEnd: {end}\n\n{description}"
            chunks = chunk_text(content)
            chunk_texts = [c.text for c in chunks]
            embeddings = embed_texts(chunk_texts)
            
            doc_id = f"calendar_{event['id']}"
            metadatas = [
                {
                    "document_name": f"Event - {summary}",
                    "page_number": 1,
                    "chunk_index": i,
                    "source": "calendar",
                }
                for i, _ in enumerate(chunks)
            ]
            add_document(doc_id, chunk_texts, embeddings, metadatas)
            
            # Update metadata in PostgreSQL
            db = SessionLocal()
            try:
                DocumentRepository.create(
                    db=db,
                    doc_id=doc_id,
                    filename=f"Event - {summary}",
                    source="calendar",
                    page_count=1,
                    chunk_count=len(chunks),
                    file_size=len(content.encode("utf-8")),
                    status="ready",
                    metadata={},
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
                print(f"Error saving calendar doc metadata to DB: {e}")
            finally:
                db.close()
            
            # Add to knowledge graph with enhanced calendar event node
            location = event.get("location", "")
            participants = [attendee.get("email", "") for attendee in event.get("attendees", [])]
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
                source_node=event_node,
                context={"type": "event", "source": "calendar", "event_id": event["id"], "user_id": current_user.id},
                user_id=current_user.id
            )
        
        return {"status": "success", "message": f"Synced {len(events)} events from Calendar"}
    except Exception as e:
        print("Calendar sync error:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Calendar sync failed: {str(e)}")
