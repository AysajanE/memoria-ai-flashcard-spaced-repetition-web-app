import asyncio
import time
from typing import List, Dict, Any, Callable, Optional
from app.core.text_processing import chunk_text, count_tokens
from app.core.ai_caller import generate_cards_with_ai
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class ChunkedProcessor:
    """Process long texts in chunks with progress tracking."""
    
    def __init__(self, progress_callback: Optional[Callable] = None):
        self.progress_callback = progress_callback
    
    async def process_long_text(
        self,
        text: str,
        model: str,
        card_type: str,
        num_cards: int,
        job_id: str
    ) -> List[Dict[str, Any]]:
        """Process long text in chunks with progress updates."""
        
        # Check if chunking is needed
        token_count = count_tokens(text, model)
        chunk_threshold = settings.TOKENS_PER_CARD_BUDGET * 20  # Threshold for chunking
        
        if token_count <= chunk_threshold:
            await self._update_progress(job_id, "generating", 50, "Generating cards...")
            # Use the existing generate_cards_with_ai function
            result = await generate_cards_with_ai(
                text=text,
                model_name=model,
                system_prompt=settings.DEFAULT_SYSTEM_PROMPT,
                card_type=card_type,
                num_cards=num_cards
            )
            # Parse and clean the result
            from app.core.json_parser import parse_ai_response
            from app.core.card_cleaner import card_cleaner
            
            raw_cards = parse_ai_response(result, card_type)
            return card_cleaner.clean_and_validate_cards(raw_cards, card_type)
        
        # Chunk the text
        await self._update_progress(job_id, "chunking", 10, "Splitting text into chunks...")
        chunks = chunk_text(text, max_tokens=chunk_threshold, model_name=model)
        
        # Allocate cards across chunks based on token weight
        chunk_allocations = self._allocate_cards_to_chunks(chunks, num_cards, model)
        
        all_cards = []
        for i, (chunk, allocated_cards) in enumerate(zip(chunks, chunk_allocations)):
            if allocated_cards == 0:
                continue
            
            progress = 20 + (i * 60 // len(chunks))
            await self._update_progress(
                job_id, 
                f"chunk_{i+1}_of_{len(chunks)}", 
                progress,
                f"Processing chunk {i+1} of {len(chunks)}..."
            )
            
            try:
                chunk_result = await generate_cards_with_ai(
                    text=chunk,
                    model_name=model,
                    system_prompt=settings.DEFAULT_SYSTEM_PROMPT,
                    card_type=card_type,
                    num_cards=allocated_cards
                )
                # Parse and clean the chunk result
                from app.core.json_parser import parse_ai_response
                from app.core.card_cleaner import card_cleaner
                
                raw_chunk_cards = parse_ai_response(chunk_result, card_type)
                cleaned_chunk_cards = card_cleaner.clean_and_validate_cards(raw_chunk_cards, card_type)
                all_cards.extend(cleaned_chunk_cards)
            except Exception as e:
                logger.warning(f"Chunk {i+1} failed: {e}", extra={"jobId": job_id})
                continue
        
        # Post-process cards
        await self._update_progress(job_id, "postprocessing", 85, "Finalizing cards...")
        final_cards = self._deduplicate_and_normalize(all_cards, num_cards)
        
        await self._update_progress(job_id, "completed", 100, f"Generated {len(final_cards)} cards")
        
        return final_cards
    
    def _allocate_cards_to_chunks(self, chunks: List[str], total_cards: int, model: str) -> List[int]:
        """Allocate cards to chunks based on token weight."""
        chunk_tokens = [count_tokens(chunk, model) for chunk in chunks]
        total_tokens = sum(chunk_tokens)
        
        allocations = []
        allocated = 0
        
        for i, tokens in enumerate(chunk_tokens):
            if i == len(chunk_tokens) - 1:  # Last chunk gets remainder
                allocations.append(total_cards - allocated)
            else:
                weight = tokens / total_tokens
                cards_for_chunk = max(1, int(total_cards * weight))
                allocations.append(cards_for_chunk)
                allocated += cards_for_chunk
        
        return allocations
    
    def _deduplicate_and_normalize(self, cards: List[Dict], target_count: int) -> List[Dict]:
        """Remove duplicates and normalize to target count."""
        seen_fronts = set()
        unique_cards = []
        
        for card in cards:
            front_normalized = card["front"].lower().strip()
            if front_normalized not in seen_fronts:
                seen_fronts.add(front_normalized)
                unique_cards.append(card)
        
        return unique_cards[:target_count]
    
    async def _update_progress(self, job_id: str, phase: str, progress_pct: int, message: str):
        """Send progress update if callback is provided."""
        if self.progress_callback and settings.ENABLE_PROGRESS_UPDATES:
            await self.progress_callback({
                "jobId": job_id,
                "status": "in_progress",
                "phase": phase,
                "progressPct": progress_pct,
                "message": message
            })