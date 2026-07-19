"""
Sources Integration Router
Handles fetching and processing data from Gmail, Google Drive, and Google Calendar.
"""

import os
import json
import base64
import traceback
from datetime import datetime, UTC
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

load_dotenv()

router = APIRouter(prefix="/api/sources", tags=["sources"])


def get_google_credentials(user_id: str, db) -> Credentials:
    print(f"[OAuth] Getting credentials for user {user_id}")
    creds_dict = AuthRepository.get_credentials(db, user_id)
    if not creds_dict:
        print(f"[OAuth] No credentials found for user {user_id}")
        raise HTTPException(status_code=401, detail="Not authenticated with Google")
    
    print(f"[OAuth] Credentials dict found:")
    print(f"[OAuth]   - Has token: {bool(creds_dict.get('token'))}")
    print(f"[OAuth]   - Has refresh token: {bool(creds_dict.get('refresh_token'))}")
    print(f"[OAuth]   - Token URI: {creds_dict.get('token_uri')}")
    print(f"[OAuth]   - Client ID: {creds_dict.get('client_id')}")
    print(f"[OAuth]   - Scopes: {creds_dict.get('scopes')}")
    print(f"[OAuth]   - Expiry: {creds_dict.get('expiry')}")
    
    expiry = None
    if creds_dict.get("expiry"):
        expiry = datetime.fromisoformat(creds_dict["expiry"])
    
    google_creds = Credentials(
        token=creds_dict["token"],
        refresh_token=creds_dict.get("refresh_token"),
        token_uri=creds_dict["token_uri"],
        client_id=creds_dict["client_id"],
        client_secret=creds_dict["client_secret"],
        scopes=creds_dict["scopes"],
        expiry=expiry,
    )

    print(f"[OAuth] Google Credentials object created successfully")
    print(f"[OAuth]   - Valid: {google_creds.valid}")
    print(f"[OAuth]   - Expired: {google_creds.expired}")
    print(f"[OAuth]   - Has refresh token: {bool(google_creds.refresh_token)}")
    print(f"[OAuth]   - Scopes: {google_creds.scopes}")

    # Automatically check/refresh if expired or about to expire
    now_dt = datetime.now(UTC).replace(tzinfo=None)
    expiry_past = expiry is not None and expiry.replace(tzinfo=None) < now_dt
    print(f"[OAuth] Checking token expiry: expiry_past={expiry_past}, google_creds.expired={google_creds.expired}")

    if google_creds.expired or expiry_past:
        from google.auth.transport.requests import Request as AuthRequest
        import google.auth.exceptions
        try:
            print("[OAuth] Token expired, attempting refresh...")
            google_creds.refresh(AuthRequest())
            print(f"[OAuth] Token refreshed successfully. New expiry: {google_creds.expiry}")
            # Save refreshed credentials back to database
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
                traceback.print_exc()
        except google.auth.exceptions.RefreshError as e:
            # Token is revoked or expired and cannot be refreshed!
            print(f"[OAuth] Refresh failed with error: {e}")
            print(f"[OAuth] Deleting invalid credentials for user {user_id}")
            try:
                AuthRepository.delete_credentials(db, user_id)
                db.commit()
                print(f"[OAuth] Invalid credentials deleted successfully")
            except Exception as e2:
                db.rollback()
                print(f"[OAuth] Error deleting invalid credentials from DB: {e2}")
                traceback.print_exc()
            raise HTTPException(
                status_code=401,
                detail="Google authentication has expired or was revoked. Please click 'Connect' to log in again."
            )
            
    return google_creds

# Pydantic model for saving provider tokens
class SaveGoogleTokensRequest(BaseModel):
    provider_token: str
    provider_refresh_token: str
    scopes: list[str]

@router.post("/google/save-tokens")
async def save_google_tokens(
    request: SaveGoogleTokensRequest,
    current_user: User = Depends(get_current_user),
    db: SessionLocal = Depends(get_db)
):
    """Save Google provider tokens from Supabase to our database."""
    print(f"[Sources] Saving Google tokens for user {current_user.id}")
    try:
        # Calculate expiry (Google access tokens are usually valid for 1 hour)
        from datetime import datetime, timedelta
        expiry = datetime.now(UTC) + timedelta(hours=1)
        # Google's token URI
        token_uri = "https://oauth2.googleapis.com/token"
        
        # Save credentials to database
        AuthRepository.save_credentials(
            db=db,
            user_id=current_user.id,
            token=request.provider_token,
            refresh_token=request.provider_refresh_token,
            token_uri=token_uri,
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            scopes=request.scopes,
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
        results = service.users().messages().list(userId="me", maxResults=10).execute()
        print(f"[Gmail Sync] Gmail API response received: {results}")
        
        messages = results.get("messages", [])
        print(f"[Gmail Sync] Found {len(messages)} messages to sync")
        graph_service = get_graph_service()
        
        for i, msg in enumerate(messages):
            print(f"[Gmail Sync] Processing message {i+1}/{len(messages)} (ID: {msg['id']})")
            try:
                msg_data = service.users().messages().get(userId="me", id=msg["id"], format="full").execute()
                print(f"[Gmail Sync] Message data retrieved for ID {msg['id']}")
                headers = msg_data["payload"]["headers"]
                
                # Safely get headers
                subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
                from_addr = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
                date = next((h["value"] for h in headers if h["name"] == "Date"), "")
                print(f"[Gmail Sync]   Subject: {subject}")
                print(f"[Gmail Sync]   From: {from_addr}")
                print(f"[Gmail Sync]   Date: {date}")
                
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
                    print(f"[Gmail Sync] No chunks created for message {msg['id']}")
                    continue
                
                print(f"[Gmail Sync] Created {len(chunks)} chunks")
                chunk_texts = [c.text for c in chunks]
                embeddings = embed_texts(chunk_texts)
                print(f"[Gmail Sync] Created {len(embeddings)} embeddings")
                
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
                print(f"[Gmail Sync] Added document to vector store with ID {doc_id}")
                
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
                        user_id="default_user",
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
                    print(f"[Gmail Sync] Saved document metadata to PostgreSQL")
                except Exception as e:
                    db.rollback()
                    print(f"[Gmail Sync] Error saving doc metadata to DB: {e}")
                    traceback.print_exc()
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
                    context={"type": "email", "source": "gmail", "msg_id": msg["id"], "user_id": "default_user"},
                    user_id="default_user"
                )
                print(f"[Gmail Sync] Added email to knowledge graph")
            except Exception as e:
                print(f"[Gmail Sync] Error processing message {msg['id']}: {e}")
                traceback.print_exc()
                # Continue with next message even if one fails
                continue
        
        print(f"[Gmail Sync] Sync completed successfully! Synced {len(messages)} messages")
        return {"status": "success", "message": f"Synced {len(messages)} emails from Gmail"}
    except Exception as e:
        print("-" * 50)
        print("[Gmail Sync] ERROR: Sync failed!")
        print(f"[Gmail Sync] Exception type: {type(e).__name__}")
        print(f"[Gmail Sync] Exception message: {str(e)}")
        print("[Gmail Sync] Full traceback:")
        traceback.print_exc()
        print("-" * 50)
        raise HTTPException(status_code=500, detail=f"Gmail sync failed: {type(e).__name__} - {str(e)}")


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
        results = service.files().list(pageSize=10, fields="files(id, name, mimeType, createdTime, size)").execute()
        print(f"[Drive Sync] Drive API response received: {results}")
        
        files = results.get("files", [])
        print(f"[Drive Sync] Found {len(files)} files to process")
        graph_service = get_graph_service()
        
        for i, file in enumerate(files):
            print(f"[Drive Sync] Processing file {i+1}/{len(files)} (ID: {file['id']}, Name: {file['name']})")
            try:
                if file["mimeType"] == "application/pdf":
                    print(f"[Drive Sync]   It's a PDF, downloading...")
                    # Download PDF file
                    request = service.files().get_media(fileId=file["id"])
                    file_content = request.execute()
                    print(f"[Drive Sync]   Downloaded {len(file_content)} bytes")
                    
                    # Extract text from PDF
                    text = extract_text_from_pdf_bytes(file_content)
                    if not text.strip():
                        print(f"[Drive Sync]   No text found in PDF, skipping")
                        continue
                    
                    print(f"[Drive Sync]   Extracted {len(text)} characters of text")
                    
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
                    print(f"[Drive Sync]   Added document to vector store with ID {doc_id}")
                    
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
                            user_id="default_user",
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
                        print(f"[Drive Sync]   Saved document metadata to PostgreSQL")
                    except Exception as e:
                        db.rollback()
                        print(f"[Drive Sync]   Error saving doc metadata to DB: {e}")
                        traceback.print_exc()
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
                        context={"type": "document", "source": "drive", "drive_id": file["id"], "user_id": "default_user"},
                        user_id="default_user"
                    )
                    print(f"[Drive Sync]   Added document to knowledge graph")
                else:
                    print(f"[Drive Sync]   Not a PDF (mimeType: {file['mimeType']}), skipping")
            except Exception as e:
                print(f"[Drive Sync] Error processing file {file['id']}: {e}")
                traceback.print_exc()
                continue
        
        print(f"[Drive Sync] Sync completed! Processed {len(files)} files")
        return {"status": "success", "message": f"Synced {len(files)} files from Drive"}
    except Exception as e:
        print("-" * 50)
        print("[Drive Sync] ERROR: Sync failed!")
        print(f"[Drive Sync] Exception type: {type(e).__name__}")
        print(f"[Drive Sync] Exception message: {str(e)}")
        print("[Drive Sync] Full traceback:")
        traceback.print_exc()
        print("-" * 50)
        raise HTTPException(status_code=500, detail=f"Drive sync failed: {type(e).__name__} - {str(e)}")


@router.post("/calendar/sync")
async def sync_calendar(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Sync events from Google Calendar to our vector DB and knowledge graph."""
    print("-" * 50)
    print(f"[Calendar Sync] Starting sync for user {current_user.id}")
    try:
        print("[Calendar Sync] Step 1: Getting Google credentials...")
        creds = get_google_credentials(current_user.id, db)
        
        print("[Calendar Sync] Step 2: Building Calendar service...")
        service = build("calendar", "v3", credentials=creds)
        print("[Calendar Sync] Calendar service built successfully")
        
        print("[Calendar Sync] Step 3: Making Calendar API request to list events...")
        now = datetime.utcnow().isoformat() + "Z"
        events_result = service.events().list(
            calendarId="primary", timeMin=now, maxResults=10, singleEvents=True, orderBy="startTime"
        ).execute()
        print(f"[Calendar Sync] Calendar API response received: {events_result}")
        
        events = events_result.get("items", [])
        print(f"[Calendar Sync] Found {len(events)} events to process")
        graph_service = get_graph_service()
        
        for i, event in enumerate(events):
            print(f"[Calendar Sync] Processing event {i+1}/{len(events)} (ID: {event['id']})")
            try:
                start = event["start"].get("dateTime", event["start"].get("date"))
                end = event["end"].get("dateTime", event["end"].get("date"))
                summary = event.get("summary", "No title")
                description = event.get("description", "")
                print(f"[Calendar Sync]   Summary: {summary}")
                print(f"[Calendar Sync]   Start: {start}")
                print(f"[Calendar Sync]   End: {end}")
                
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
                print(f"[Calendar Sync]   Added event to vector store with ID {doc_id}")
                
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
                        user_id="default_user",
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
                    print(f"[Calendar Sync]   Saved event metadata to PostgreSQL")
                except Exception as e:
                    db.rollback()
                    print(f"[Calendar Sync]   Error saving event metadata to DB: {e}")
                    traceback.print_exc()
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
                    context={"type": "event", "source": "calendar", "event_id": event["id"], "user_id": "default_user"},
                    user_id="default_user"
                )
                print(f"[Calendar Sync]   Added event to knowledge graph")
            except Exception as e:
                print(f"[Calendar Sync] Error processing event {event['id']}: {e}")
                traceback.print_exc()
                continue
        
        print(f"[Calendar Sync] Sync completed! Processed {len(events)} events")
        return {"status": "success", "message": f"Synced {len(events)} events from Calendar"}
    except Exception as e:
        print("-" * 50)
        print("[Calendar Sync] ERROR: Sync failed!")
        print(f"[Calendar Sync] Exception type: {type(e).__name__}")
        print(f"[Calendar Sync] Exception message: {str(e)}")
        print("[Calendar Sync] Full traceback:")
        traceback.print_exc()
        print("-" * 50)
        raise HTTPException(status_code=500, detail=f"Calendar sync failed: {type(e).__name__} - {str(e)}")
