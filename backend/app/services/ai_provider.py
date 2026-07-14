
"""
AI Provider Service
Reusable service for LLM calls via OpenRouter (OpenAI-compatible API)
"""
import os
import logging
from dotenv import load_dotenv
from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize OpenAI client for OpenRouter
_openrouter_client: OpenAI | None = None


def _get_openrouter_client() -> OpenAI:
    """Lazy-initialize the OpenRouter client."""
    global _openrouter_client
    print("KEY =", os.getenv("OPENROUTER_API_KEY"))
    print("MODEL =", os.getenv("OPENROUTER_MODEL"))
    if _openrouter_client is None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENROUTER_API_KEY not set. Please add your key to backend/.env\n"
                "Get one at: https://openrouter.ai/keys"
            )
        _openrouter_client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
    return _openrouter_client


def generate_response(
    prompt: str,
    system_prompt: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1024,
    model: str | None = None,
) -> str:
    """
    Generate a response from the LLM using OpenRouter.
    
    Args:
        prompt: The user prompt to send to the LLM
        system_prompt: Optional system prompt
        temperature: Sampling temperature (0.0-1.0)
        max_tokens: Maximum tokens in the response
        model: Optional model override (defaults to OPENROUTER_MODEL env var)
        
    Returns:
        The LLM's response text
    """
    client = _get_openrouter_client()
    model_name = model or os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat-v3")
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"[AIProvider] Error generating response: {e}")
        raise
