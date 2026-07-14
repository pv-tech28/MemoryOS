
import os
from dotenv import load_dotenv
from google import genai

def list_models():
    print("=== Listing available Gemini models ===")
    
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    print(f"\nAvailable models:")
    for model in client.models.list():
        print(f"- {model.name}")
        print(f"  Display name: {model.display_name}")
        print(f"  Description: {model.description}")
        print()

if __name__ == "__main__":
    list_models()
