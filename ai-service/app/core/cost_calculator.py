from typing import Dict, Any, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class CostCalculator:
    """Calculate costs for AI API usage."""
    
    def __init__(self):
        # Pricing per 1K tokens (update as needed)
        self.pricing = {
            "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-4-turbo": {"input": 0.01, "output": 0.03},
            "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "claude-3-opus": {"input": 0.015, "output": 0.075},
            "claude-haiku-3-5-latest": {"input": 0.0008, "output": 0.004},
            "claude-sonnet-3-5-latest": {"input": 0.003, "output": 0.015}
        }
    
    def calculate_cost(self, model: str, usage: Dict[str, int]) -> Optional[float]:
        """Calculate cost in USD for the given usage."""
        if not settings.ENABLE_COST_ACCOUNTING:
            return None
        
        model_lower = model.lower()
        pricing_key = None
        
        # Find matching pricing
        for key in self.pricing:
            if key in model_lower:
                pricing_key = key
                break
        
        if not pricing_key:
            logger.warning(f"No pricing data for model: {model}")
            return None
        
        pricing = self.pricing[pricing_key]
        
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        
        input_cost = (input_tokens / 1000) * pricing["input"]
        output_cost = (output_tokens / 1000) * pricing["output"]
        
        total_cost = input_cost + output_cost
        
        logger.info("Cost calculated", extra={
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost_usd": input_cost,
            "output_cost_usd": output_cost,
            "total_cost_usd": total_cost
        })
        
        return round(total_cost, 6)
    
    def get_pricing_info(self) -> Dict[str, Any]:
        """Get current pricing information."""
        return {
            "pricing_per_1k_tokens": self.pricing,
            "last_updated": "2024-01-01",  # Update this when prices change
            "currency": "USD"
        }

# Global calculator instance
cost_calculator = CostCalculator()