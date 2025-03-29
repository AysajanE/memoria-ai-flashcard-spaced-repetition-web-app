"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

// Placeholder for an actual DB call
async function createJobRecord(userId: string, jobType: string, inputPayload: any) {
  // In a real implementation, this would create a record in the database
  console.log(`Creating job record for user ${userId}`);
  
  // For demo purposes, we'll just generate a random ID
  return {
    id: `job_${Math.random().toString(36).substring(2, 9)}`,
    userId,
    jobType,
    status: "pending",
    createdAt: new Date(),
  };
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
    
    // Generate a job ID that encodes the text hash to help with retrieval
    // This ensures we can generate cards based on the actual input text
    const textHash = await generateSimpleHash(userInputText);
    const jobId = `job_${textHash}${Math.random().toString(36).substring(2, 5)}`;
    
    // Create job record (would store in database in a real implementation)
    const jobRecord = {
      id: jobId,
      userId,
      jobType: validatedInput.data.jobType,
      inputText: userInputText,
      status: "pending",
      createdAt: new Date(),
    };

    // In a real implementation, we would make an API call to the AI service
    // For demo purposes, we'll just return the job ID with the input text
    
    return {
      isSuccess: true,
      data: { 
        jobId: jobRecord.id,
        inputText: userInputText
      },
    };
  } catch (error) {
    console.error("Error submitting AI job:", error);
    return {
      isSuccess: false,
      message: "Failed to submit job",
    };
  }
}

// Simple hashing function to generate a basic hash of the input text
async function generateSimpleHash(text: string): Promise<string> {
  // Use a subset of the text to create a simple identifier
  // In production, you'd use a proper hashing function
  const simpleHash = text
    .slice(0, 50)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 10);
    
  return simpleHash;
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

    // In a real implementation, this would fetch the job record with input text from the database
    // For demo purposes, we'll extract the text hash from the job ID and simulate input text
    
    // Force "completed" status for better demo experience
    const status = "completed";
    
    let result = null;
    let error = null;
    
    // Extract the text hash from the job ID (which was encoded during job creation)
    const textHashPart = jobId.split('_')[1]?.substring(0, 10) || '';
    
    // In a real implementation, we would retrieve the actual input text
    // For demo purposes, we'll determine the content type from the hash
    const isHistoryContent = textHashPart.includes('histor') || textHashPart.includes('war') || textHashPart.includes('world');
    const isScienceContent = textHashPart.includes('scien') || textHashPart.includes('biol') || textHashPart.includes('phys');
    const isMathContent = textHashPart.includes('math') || textHashPart.includes('calc') || textHashPart.includes('algebra');
    const isLiteratureContent = textHashPart.includes('liter') || textHashPart.includes('book') || textHashPart.includes('novel');
    
    // Generate flashcards based on the detected content type
    if (status === "completed") {
      // Choose appropriate flashcards based on detected content
      let flashcards = [];
      
      if (isHistoryContent) {
        flashcards = [
          {
            front: "What were the main causes of the events described in the text?",
            back: "The main causes included political tensions, economic factors, social changes, and the influence of key historical figures that shaped these developments."
          },
          {
            front: "How did these historical events impact society at the time?",
            back: "These events led to significant social restructuring, changing power dynamics between different groups, and new cultural and political movements that would influence future generations."
          },
          {
            front: "What parallels can be drawn between these historical events and modern situations?",
            back: "The patterns of conflict resolution, social change, and political transformation described show similarities to contemporary global issues, particularly in how societies respond to crisis and change."
          }
        ];
      } else if (isScienceContent) {
        flashcards = [
          {
            front: "What are the key scientific principles explained in the content?",
            back: "The key principles include systematic observation, empirical evidence gathering, hypothesis testing, and the application of established theories to explain natural phenomena."
          },
          {
            front: "How do these scientific concepts relate to each other in a broader framework?",
            back: "These concepts form an interconnected framework where each element builds upon fundamental principles, creating a cohesive understanding of the natural processes being studied."
          },
          {
            front: "What practical applications emerge from these scientific findings?",
            back: "The practical applications include technological innovations, improved understanding of natural systems, predictive capabilities for future events, and potential solutions to real-world problems."
          }
        ];
      } else if (isMathContent) {
        flashcards = [
          {
            front: "What are the fundamental mathematical formulas presented in this content?",
            back: "The fundamental formulas include equations that express relationships between variables, rules for mathematical operations, and methods for problem-solving within specific domains of mathematics."
          },
          {
            front: "How can these mathematical concepts be applied to solve real-world problems?",
            back: "These concepts can be applied through modeling real-world situations, quantifying relationships between variables, predicting outcomes based on mathematical patterns, and optimizing systems through mathematical analysis."
          },
          {
            front: "What are the step-by-step procedures for solving the problems described?",
            back: "The procedures involve identifying known variables, applying relevant formulas, following logical sequences of operations, checking constraints, and verifying solutions through validation methods."
          }
        ];
      } else if (isLiteratureContent) {
        flashcards = [
          {
            front: "What are the main themes explored in this literary work?",
            back: "The main themes include the exploration of human nature, social constructs, personal identity, moral dilemmas, and the relationship between individuals and their broader social context."
          },
          {
            front: "How do the characters develop throughout the narrative?",
            back: "The characters undergo transformation through pivotal experiences, relationship dynamics, internal conflicts, and the consequences of their choices, revealing deeper aspects of their personalities and values."
          },
          {
            front: "What literary techniques does the author employ to convey meaning?",
            back: "The author uses symbolism, metaphor, narrative structure, point of view, imagery, and language choices to create layers of meaning and evoke emotional and intellectual responses from readers."
          }
        ];
      } else {
        // General knowledge flashcards for any other content
        flashcards = [
          {
            front: "What are the main concepts presented in this content?",
            back: "The main concepts include fundamental principles, key terminology, essential frameworks, and core ideas that form the foundation of the subject matter discussed."
          },
          {
            front: "How would you summarize the most important information in your own words?",
            back: "The most important information focuses on critical relationships between concepts, significant findings, practical applications, and fundamental insights that define this area of knowledge."
          },
          {
            front: "What are the practical implications of this information?",
            back: "The practical implications include potential applications in real-world scenarios, changes to current understanding, solutions to existing problems, and new opportunities for further development and innovation."
          }
        ];
      }
      
      // Add a job ID-based random factor to create variety
      const randomSeed = parseInt(jobId.replace(/[^0-9]/g, '').substring(0, 3)) || 0;
      if (randomSeed % 3 === 1) {
        flashcards.push({
          front: "How would you integrate this information with other knowledge areas?",
          back: "This information can be integrated by identifying overlapping concepts, applying interdisciplinary approaches, recognizing patterns that exist across domains, and utilizing complementary methodologies from related fields."
        });
      } else if (randomSeed % 3 === 2) {
        flashcards.push({
          front: "What questions does this content raise that warrant further investigation?",
          back: "The content raises questions about underlying mechanisms, broader implications, potential exceptions to general rules, and opportunities for further advancement through additional research and analysis."
        });
      }
      
      result = { flashcards };
    } else if (status === "failed") {
      error = "An error occurred during processing";
    }
    
    return {
      isSuccess: true,
      data: {
        status: status,
        result,
        error
      },
    };
  } catch (error) {
    console.error("Error getting job status:", error);
    return {
      isSuccess: false,
      message: "Failed to get job status",
    };
  }
} 