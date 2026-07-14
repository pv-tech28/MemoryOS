
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class LLMProvider(ABC):
    @abstractmethod
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate text using the LLM provider.
        
        Args:
            prompt: The user's input prompt
            system_prompt: Optional system prompt for the LLM
            temperature: Optional temperature for generation
            max_tokens: Optional maximum number of tokens to generate
            
        Returns:
            Dictionary with keys:
                'text': Generated text
                'latency': Latency in seconds
                'prompt_tokens': Number of prompt tokens (if available)
                'completion_tokens': Number of completion tokens (if available)
                'total_tokens': Total number of tokens (if available)
                'cost': Cost in USD (if available)
        """
        pass
