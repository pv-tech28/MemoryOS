import os
from dotenv import load_dotenv
from typing import Optional
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SECRET_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
else:
    print("[Supabase] WARNING: SUPABASE_URL or SUPABASE_SECRET_KEY not set in environment variables")
