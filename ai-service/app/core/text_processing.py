import logging
from typing import List, Dict, Any, Optional

import tiktoken
from app.config import get_model_config

logger = logging.getLogger(__name__)

def count_tokens(text: str, model_name: Optional[str] = None) -> int:
    """
    Count tokens in a text string using the appropriate tokenizer for the model.
    
    Args:
        text: The text to count tokens for
        model_name: The name of the model to count tokens for. Uses default if None.
        
    Returns:
        int: The number of tokens in the text
    """
    if not text:
        return 0
        
    # Get model configuration
    model_config = get_model_config(model_name)
    provider = model_config["provider"]
    model = model_config["name"]
    
    try:
        # OpenAI models - use tiktoken
        if provider == "openai":
            # Select the appropriate encoding for the model
            if "gpt-4" in model:
                encoding = tiktoken.encoding_for_model("gpt-4")
            elif "gpt-3.5-turbo" in model:
                encoding = tiktoken.encoding_for_model("gpt-3.5-turbo")
            else:
                # Default to cl100k_base for newer models
                encoding = tiktoken.get_encoding("cl100k_base")
                
            # Count tokens
            token_count = len(encoding.encode(text))
            return token_count
            
        # Anthropic models - approximate token count
        elif provider == "anthropic":
            # Anthropic uses roughly 4 characters per token as a heuristic
            # This is an approximation - Claude uses BPEs but doesn't expose tokenizers directly
            # See: https://docs.anthropic.com/claude/docs/token-counting
            return len(text) // 4 + (1 if len(text) % 4 > 0 else 0)
            
        else:
            # Unknown provider, use a conservative estimate
            logger.warning(f"Unknown provider '{provider}' for token counting, using approximation")
            # Words ÷ 0.75 is a common approximation (4 tokens ≈ 3 words)
            words = len(text.split())
            return int(words / 0.75)
            
    except Exception as e:
        logger.error(f"Error counting tokens: {str(e)}")
        # Fallback to character-based approximation
        return len(text) // 4

def chunk_text(text: str, max_tokens: int = 4000, model_name: Optional[str] = None) -> List[str]:
    """
    Split text into chunks that don't exceed token limits.
    
    Args:
        text: The text to chunk
        max_tokens: Maximum tokens per chunk
        model_name: Model name to use for token counting
        
    Returns:
        List[str]: Text chunks
    """
    # If text is already small enough, return it as a single chunk
    if count_tokens(text, model_name) <= max_tokens:
        return [text]
        
    # Split into paragraphs
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    for paragraph in paragraphs:
        paragraph_tokens = count_tokens(paragraph, model_name)
        
        # If a single paragraph exceeds token limit, we need to split it
        if paragraph_tokens > max_tokens:
            # If we have content in current chunk, add it to chunks
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""
                current_tokens = 0
                
            # Split paragraph into sentences
            sentences = paragraph.replace(". ", ".\n").split("\n")
            sentence_chunk = ""
            sentence_tokens = 0
            
            for sentence in sentences:
                sentence_token_count = count_tokens(sentence, model_name)
                
                # If adding this sentence would exceed limit
                if sentence_tokens + sentence_token_count > max_tokens:
                    # Add current sentence chunk if not empty
                    if sentence_chunk:
                        chunks.append(sentence_chunk)
                        sentence_chunk = ""
                        sentence_tokens = 0
                    
                    # If a single sentence exceeds token limit, split by words
                    if sentence_token_count > max_tokens:
                        words = sentence.split()
                        word_chunk = ""
                        word_tokens = 0
                        
                        for word in words:
                            word_token_count = count_tokens(word + " ", model_name)
                            
                            if word_tokens + word_token_count > max_tokens:
                                chunks.append(word_chunk)
                                word_chunk = word + " "
                                word_tokens = word_token_count
                            else:
                                word_chunk += word + " "
                                word_tokens += word_token_count
                                
                        if word_chunk:
                            chunks.append(word_chunk)
                    else:
                        # Sentence fits in its own chunk
                        chunks.append(sentence)
                else:
                    # Add sentence to current sentence chunk
                    sentence_chunk += sentence + " "
                    sentence_tokens += sentence_token_count
                    
            # Add any remaining sentence chunk
            if sentence_chunk:
                chunks.append(sentence_chunk)
        
        # Check if adding paragraph would exceed token limit
        elif current_tokens + paragraph_tokens > max_tokens:
            # Add current chunk to chunks and start a new one
            chunks.append(current_chunk)
            current_chunk = paragraph + "\n\n"
            current_tokens = paragraph_tokens
        else:
            # Add paragraph to current chunk
            current_chunk += paragraph + "\n\n"
            current_tokens += paragraph_tokens
            
    # Add any remaining content
    if current_chunk:
        chunks.append(current_chunk)
        
    return chunks

def format_for_anki(cards: List[Dict[str, Any]], card_type: str = "qa") -> str:
    """
    Format flashcards for Anki import.
    
    Args:
        cards: List of card dictionaries with front/back fields
        card_type: Type of cards ("qa" or "cloze")
        
    Returns:
        str: Formatted text for Anki import
    """
    lines = []
    
    if card_type == "qa":
        # Basic Card format: question;answer
        for card in cards:
            front = card.get("front", "").replace(";", ",")
            back = card.get("back", "").replace(";", ",")
            lines.append(f"{front};{back}")
    else:
        # Cloze format: text with {{c1::cloze deletion}}
        for card in cards:
            front = card.get("front", "").replace(";", ",")
            back = card.get("back", "").replace(";", ",")
            
            # Convert [...] format to Anki cloze format
            if "[...]" in front:
                formatted = front.replace("[...]", f"{{{{c1::{back}}}}}")
            else:
                # Fallback if proper cloze format not found
                formatted = f"{front} {{{{c1::{back}}}}}"
                
            lines.append(formatted)
            
    return "\n".join(lines) 