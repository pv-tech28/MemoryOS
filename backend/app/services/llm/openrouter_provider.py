
import os
import time
import requests
from typing import Optional, Dict, Any
from .base import LLMProvider

class OpenRouterProvider(LLMProvider):
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat-v3-0324")
        self.timeout = int(os.getenv("LLM_TIMEOUT", "30"))
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not set")
            
        # Build messages
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        # Build payload
        payload = {
            "model": self.model,
            "messages": messages
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
            
        # Build headers
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "EVOLVE AI"
        }
        
        start_time = time.time()
        result = {
            "text": "",
            "latency": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "cost": 0.0
        }
        
        try:
            response = requests.post(
                self.base_url,
                json=payload,
                headers=headers,
                timeout=self.timeout
            )
            latency = time.time() - start_time
            result["latency"] = round(latency, 2)
            
            # Log request info
            print("=== OpenRouter Request ===")
            print(f"Model: {self.model}")
            print(f"Latency: {result['latency']}s")
            print(f"HTTP Code: {response.status_code}")
            
            if response.status_code != 200:
                print(f"Error Response: {response.json()}")
                result["text"] = f"Error: {response.status_code} - {response.text}"
                return result
                
            response_json = response.json()
            result["text"] = response_json["choices"][0]["message"]["content"]
            
            # Extract token usage
            usage = response_json.get("usage", {})
            result["prompt_tokens"] = usage.get("prompt_tokens", 0)
            result["completion_tokens"] = usage.get("completion_tokens", 0)
            result["total_tokens"] = usage.get("total_tokens", 0)
            
            # Extract cost if available
            if "usage" in response_json and "cost" in response_json["usage"]:
                result["cost"] = response_json["usage"]["cost"]
                
            print(f"Prompt Tokens: {result['prompt_tokens']}")
            print(f"Completion Tokens: {result['completion_tokens']}")
            print(f"Total Tokens: {result['total_tokens']}")
            if result["cost"]:
                print(f"Cost: ${result['cost']:.6f}")
            print("=============================")
            
        except Exception as e:
            latency = time.time() - start_time
            result["latency"] = round(latency, 2)
            result["text"] = f"Error: {str(e)}"
            print(f"OpenRouter Error: {str(e)}")
            
        return result
