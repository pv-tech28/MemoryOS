
import os
from typing import Optional
from .base import LLMProvider
from .openrouter_provider import OpenRouterProvider

def get_llm_provider() -> LLMProvider:
    provider_name = os.getenv("LLM_PROVIDER", "openrouter")
    
    if provider_name == "openrouter":
        return OpenRouterProvider()
    else:
        raise ValueError(f"Unsupported LLM provider: {provider_name}")
