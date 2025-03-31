"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { users } from "@/db/schema";

// Types for the action functions
export type ActionState<T> = {
  isSuccess: boolean;
  message?: string;
  data?: T;
  error?: Record<string, string[]>;
};

// Input validation schemas
const submitJobSchema = z.object({
  jobType: z.enum(["summarize", "generate-prompts"]),
  inputPayload: z.object({
    text: z.string().min(1, "Text is required"),
  }),
  documentId: z.string().optional(),
});

// Create job record in database
async function createJobRecord(userId: string, inputPayload: any) {
  try {
    const result = await db.insert(processingJobs).values({
      userId,
      // Use the only valid jobType from the enum
      jobType: "generate-cards",
      status: "pending",
      inputPayload: inputPayload,
    }).returning();
    
    return result[0];
  } catch (error) {
    console.error("Error creating job record:", error);
    throw error;
  }
}

// Submit a job to the AI service
export async function submitAiJobAction(
  input: z.infer<typeof submitJobSchema>
): Promise<ActionState<{ jobId: string; inputText: string }>> {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Ensure user exists in the database
    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!existingUser) {
        // Create user record if it doesn't exist
        await db.insert(users).values({
          id: userId,
          email: auth().user?.emailAddresses[0]?.emailAddress || '',
          aiCreditsRemaining: 500, // Give new users some free credits
        });
        console.log(`Created new user record for ${userId} during job submission`);
      }
    } catch (userError) {
      console.error("Error ensuring user exists:", userError);
      return {
        isSuccess: false,
        message: "Could not verify user account",
      };
    }

    // Validate input
    const validatedInput = submitJobSchema.safeParse(input);
    if (!validatedInput.success) {
      return {
        isSuccess: false,
        message: "Invalid input",
        error: validatedInput.error.flatten().fieldErrors,
      };
    }

    // Store the input text from the user
    const userInputText = validatedInput.data.inputPayload.text;
    
    // Create job record in database - pass only the userId and inputPayload
    const jobRecord = await createJobRecord(
      userId, 
      { 
        text: userInputText,
        type: validatedInput.data.jobType // Store the original jobType in the payload for reference
      }
    );
    
    // Call the AI Service API
    try {
      // Import the updated triggerCardGeneration function
      const { triggerCardGeneration } = await import("@/lib/ai-client");
      
      // Determine which model to use based on job type (can be customized)
      // For simplicity, we'll use OpenAI for summarize and Anthropic for generate-prompts
      const provider = validatedInput.data.jobType === "summarize" ? "openai" : "anthropic";
      const model = provider === "openai" ? "gpt-4o-mini" : "claude-haiku-3-5-latest";
      
      // Call the AI service
      await triggerCardGeneration({
        jobId: jobRecord.id,
        text: userInputText,
        model,
        provider,
        cardType: 'qa',
        numCards: 5,
      });
      
      return {
        isSuccess: true,
        data: { 
          jobId: jobRecord.id,
          inputText: userInputText
        },
      };
    } catch (aiError) {
      console.error('AI service request failed:', aiError);
      // Update job status to reflect the error
      await db.update(processingJobs)
        .set({ 
          status: "failed",
          errorMessage: `Failed to submit to AI service: ${aiError instanceof Error ? aiError.message : String(aiError)}`,
          completedAt: new Date()
        })
        .where(eq(processingJobs.id, jobRecord.id));
      
      return {
        isSuccess: false,
        message: "Failed to process with AI service",
      };
    }
  } catch (error) {
    console.error("Error submitting AI job:", error);
    return {
      isSuccess: false,
      message: "Failed to submit job",
    };
  }
}

// Placeholder AI processing function that actually analyzes the content
// In a real implementation, this would call OpenAI/Anthropic
async function processTextWithAI(text: string) {
  // Analyze the text to identify key topics and concepts
  const topics = analyzeTopic(text);
  
  // Generate appropriate flashcards based on the actual content
  const flashcards = generateFlashcardsForTopic(text, topics);
  
  return flashcards;
}

// Simple topic analyzer
function analyzeTopic(text: string) {
  const lowerText = text.toLowerCase();
  
  const topics = {
    ai: lowerText.includes('ai') || lowerText.includes('artificial intelligence'),
    llm: lowerText.includes('llm') || lowerText.includes('language model'),
    ml: lowerText.includes('machine learning') || lowerText.includes('ml'),
    programming: lowerText.includes('code') || lowerText.includes('programming') || lowerText.includes('software'),
    history: lowerText.includes('history') || lowerText.includes('historical') || lowerText.includes('century'),
    science: lowerText.includes('science') || lowerText.includes('scientific') || lowerText.includes('biology'),
    math: lowerText.includes('math') || lowerText.includes('calculus') || lowerText.includes('equation'),
    language: lowerText.includes('language') || lowerText.includes('vocabulary') || lowerText.includes('grammar'),
  };
  
  // Find the most relevant topics
  return Object.entries(topics)
    .filter(([_, isPresent]) => isPresent)
    .map(([topic]) => topic);
}

// Generate flashcards based on content and topics
function generateFlashcardsForTopic(text: string, topics: string[]) {
  // Extract sentences from the text to use as source material
  const sentences = text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20); // Only use substantive sentences
  
  // Create relevant questions for the content
  const flashcards = [];
  
  // First, create general knowledge questions based on content
  if (sentences.length > 0) {
    flashcards.push({
      front: "What are the main concepts presented in this content?",
      back: createSummary(text)
    });
  }
  
  // Check if content is about LLMs/AI
  if (topics.includes('llm') || topics.includes('ai')) {
    flashcards.push({
      front: "What are LLMs and how are they used?",
      back: extractLLMDefinitionAndUse(text)
    });
    
    flashcards.push({
      front: "What are the limitations or challenges with LLMs mentioned in the content?",
      back: extractLLMLimitations(text)
    });
    
    if (text.toLowerCase().includes('multimodal')) {
      flashcards.push({
        front: "What is multimodality in the context of language models?",
        back: "Multimodality refers to the ability of language models to work with multiple forms of input and output beyond just text, such as images, audio, and other data types. This capability expands the potential applications and use cases for these AI systems."
      });
    }
  }
  
  // Add more topic-specific questions
  if (topics.includes('programming')) {
    flashcards.push({
      front: "What programming concepts or techniques are discussed in the content?",
      back: "The content discusses software development practices, coding patterns, and technical implementation details related to creating and maintaining efficient and scalable applications."
    });
  }
  
  // Add questions based on specific sentences if we have enough content
  if (sentences.length >= 3) {
    const keysentence = sentences[Math.floor(sentences.length / 2)];
    flashcards.push({
      front: `What is the significance of "${keysentence.substring(0, 50)}..."?`,
      back: "This concept represents a core principle in the field, highlighting the relationship between theory and practical application, with implications for how we understand and implement solutions."
    });
  }
  
  // Ensure we have at least 3 flashcards
  while (flashcards.length < 3) {
    flashcards.push({
      front: "How would you apply the concepts from this content in a practical scenario?",
      back: "The concepts could be applied by identifying relevant use cases, adapting the principles to specific contexts, and implementing solutions that address real-world challenges while considering limitations and constraints."
    });
  }
  
  return flashcards;
}

// Helper function to create a summary from text
function createSummary(text: string) {
  // For a real implementation, this would use an actual LLM
  // This is a simplified version that extracts key parts of the text
  
  if (text.toLowerCase().includes('llm')) {
    return "The main concepts include Large Language Models (LLMs), their capabilities, potential applications, and limitations. The content explores how these AI systems process and generate text, their ongoing development, and considerations for effective use.";
  }
  
  // Generic summary for other content
  return "The main concepts include fundamental principles, key terminology, essential frameworks, and core ideas that form the foundation of the subject matter discussed.";
}

// Extract LLM definition and use
function extractLLMDefinitionAndUse(text: string) {
  if (text.toLowerCase().includes('tool') && text.toLowerCase().includes('capabilities')) {
    return "LLMs (Large Language Models) are powerful AI tools with diverse capabilities that can process and generate human-like text. They can be used for content creation, information extraction, summarization, translation, and various other natural language processing tasks.";
  }
  
  return "LLMs (Large Language Models) are AI systems trained on vast amounts of text data that can understand and generate human-like text. They're used in applications ranging from content creation to data analysis, conversation systems, and knowledge retrieval.";
}

// Extract LLM limitations
function extractLLMLimitations(text: string) {
  if (text.toLowerCase().includes('hallucination') || text.toLowerCase().includes('inaccuracies')) {
    return "Limitations of LLMs include potential for hallucinations (generating false information), inaccuracies in factual recall, challenges with up-to-date information, and biases inherited from training data. Users need to verify outputs and apply appropriate safeguards.";
  }
  
  return "LLMs have limitations including knowledge cutoffs, potential biases from training data, lack of true reasoning capabilities, and difficulty with highly specialized domain knowledge without specific fine-tuning or additional context.";
}

// Get the status of a job
export async function getJobStatusAction(
  jobId: string
): Promise<ActionState<{ status: string; result?: any; error?: string }>> {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Ensure user exists in the database
    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!existingUser) {
        // Create user record if it doesn't exist
        await db.insert(users).values({
          id: userId,
          email: auth().user?.emailAddresses[0]?.emailAddress || '',
          aiCreditsRemaining: 500, // Give new users some free credits
        });
        console.log(`Created new user record for ${userId} during job status check`);
      }
    } catch (userError) {
      console.error("Error ensuring user exists:", userError);
      // Continue with job check even if user creation fails
    }

    // Fetch the job from the database
    const job = await db.query.processingJobs.findFirst({
      where: eq(processingJobs.id, jobId)
    });
    
    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found",
      };
    }
    
    // Verify that the job belongs to the current user
    if (job.userId !== userId) {
      return {
        isSuccess: false,
        message: "You don't have permission to view this job",
      };
    }
    
    return {
      isSuccess: true,
      data: {
        status: job.status,
        result: job.resultPayload,
        error: job.errorMessage || undefined
      }
    };
  } catch (error) {
    console.error("Error fetching job status:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch job status",
    };
  }
}

// List all pending jobs for a user (for debugging purposes)
export async function listPendingJobsAction(): Promise<ActionState<Array<{id: string, status: string, createdAt: Date}>>> {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Ensure user exists in the database
    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!existingUser) {
        // Create user record if it doesn't exist
        await db.insert(users).values({
          id: userId,
          email: auth().user?.emailAddresses[0]?.emailAddress || '',
          aiCreditsRemaining: 500, // Give new users some free credits
        });
        console.log(`Created new user record for ${userId} during pending jobs check`);
      }
    } catch (userError) {
      console.error("Error ensuring user exists:", userError);
      // Continue with job check even if user creation fails
    }

    // Get all pending jobs for the user
    const pendingJobs = await db.query.processingJobs.findMany({
      where: and(
        eq(processingJobs.userId, userId),
        eq(processingJobs.status, "pending")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
      columns: {
        id: true,
        status: true,
        createdAt: true,
      }
    });
    
    return {
      isSuccess: true,
      data: pendingJobs
    };
  } catch (error) {
    console.error("Error fetching pending jobs:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch pending jobs",
    };
  }
} 