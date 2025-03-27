import logging
from typing import List

import tiktoken

logger = logging.getLogger(__name__)

def count_tokens(text: str, model_name: str) -> int:
    """
    Count the number of tokens in a text string for a given model.
    
    Args:
        text: The input text to count tokens for
        model_name: The name of the model to use for tokenization
        
    Returns:
        int: Number of tokens in the text
        
    Raises:
        ValueError: If model_name is invalid or tokenization fails
    """
    try:
        encoding = tiktoken.encoding_for_model(model_name)
        return len(encoding.encode(text))
    except Exception as e:
        logger.error(f"Error counting tokens for model {model_name}: {str(e)}")
        raise ValueError(f"Failed to count tokens: {str(e)}")

def chunk_text(text: str, max_tokens_per_chunk: int, model_name: str) -> List[str]:
    """
    Split text into chunks that are within the token limit for the given model.
    Uses paragraph breaks as chunk boundaries where possible.
    
    Args:
        text: The input text to chunk
        max_tokens_per_chunk: Maximum tokens allowed per chunk
        model_name: The name of the model to use for tokenization
        
    Returns:
        List[str]: List of text chunks, each within the token limit
        
    Raises:
        ValueError: If text is empty or chunking fails
    """
    if not text or len(text.strip()) == 0:
        raise ValueError("Input text cannot be empty")
        
    try:
        # Split text into paragraphs
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for paragraph in paragraphs:
            paragraph_tokens = count_tokens(paragraph, model_name)
            
            # If a single paragraph exceeds the limit, split by sentences
            if paragraph_tokens > max_tokens_per_chunk:
                sentences = [s.strip() for s in paragraph.split('.') if s.strip()]
                for sentence in sentences:
                    sentence_tokens = count_tokens(sentence, model_name)
                    
                    if current_tokens + sentence_tokens > max_tokens_per_chunk:
                        if current_chunk:
                            chunks.append(' '.join(current_chunk))
                        current_chunk = [sentence]
                        current_tokens = sentence_tokens
                    else:
                        current_chunk.append(sentence)
                        current_tokens += sentence_tokens
            else:
                # If adding this paragraph would exceed the limit, start a new chunk
                if current_tokens + paragraph_tokens > max_tokens_per_chunk:
                    if current_chunk:
                        chunks.append(' '.join(current_chunk))
                    current_chunk = [paragraph]
                    current_tokens = paragraph_tokens
                else:
                    current_chunk.append(paragraph)
                    current_tokens += paragraph_tokens
        
        # Add the last chunk if it exists
        if current_chunk:
            chunks.append(' '.join(current_chunk))
            
        return chunks
        
    except Exception as e:
        logger.error(f"Error chunking text: {str(e)}")
        raise ValueError(f"Failed to chunk text: {str(e)}") 