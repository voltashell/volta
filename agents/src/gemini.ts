/**
 * Gemini AI service for agent integration
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GeminiConfig, GeminiTask, GeminiResponse } from './types';
import { log } from './utils';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: GeminiConfig;
  private agentId: string;
  private sharedDir: string;

  constructor(config: GeminiConfig, agentId: string, sharedDir: string) {
    this.config = config;
    this.agentId = agentId;
    this.sharedDir = sharedDir;
    
    this.client = new GoogleGenerativeAI(config.apiKey);
    
    const modelParams: any = {
      model: config.model
    };
    
    if (config.generationConfig) {
      modelParams.generationConfig = config.generationConfig;
    }
    
    this.model = this.client.getGenerativeModel(modelParams);
  }

  /**
   * Initialize the Gemini service
   */
  async initialize(): Promise<void> {
    try {
      await log(`Initializing Gemini service with model: ${this.config.model}`, this.agentId, this.sharedDir);
      
      // Test the connection with a simple prompt
      const testResult = await this.generateText({
        prompt: 'Hello! Please respond with "Gemini initialized successfully" to confirm you are working.',
        systemInstruction: `You are AI Agent ${this.agentId} running in a distributed agent system. Keep responses concise.`
      });

      await log(`Gemini initialization test: ${testResult.text}`, this.agentId, this.sharedDir);
      await log(`Gemini service initialized successfully for ${this.agentId}`, this.agentId, this.sharedDir);
    } catch (error: any) {
      await log(`Gemini initialization failed for ${this.agentId}: ${error.message}`, this.agentId, this.sharedDir);
      throw error;
    }
  }

  /**
   * Generate text using Gemini
   */
  async generateText(task: GeminiTask): Promise<GeminiResponse> {
    try {
      const startTime = Date.now();
      
      // Prepare the prompt with system instruction if provided
      let fullPrompt = task.prompt;
      if (task.systemInstruction) {
        fullPrompt = `System: ${task.systemInstruction}\n\nHuman: ${task.prompt}`;
      }

      // Add context if provided
      if (task.context) {
        fullPrompt += `\n\nContext: ${JSON.stringify(task.context, null, 2)}`;
      }

      await log(`Generating text with prompt length: ${fullPrompt.length} characters`, this.agentId, this.sharedDir);

      const generateResult = await this.model.generateContent(fullPrompt);
      const response = generateResult.response;
      const text = response.text();

      const processingTime = Date.now() - startTime;
      await log(`Gemini response generated in ${processingTime}ms, length: ${text.length} characters`, this.agentId, this.sharedDir);

      // Extract usage information if available
      let usage;
      try {
        const usageMetadata = response.usageMetadata;
        if (usageMetadata) {
          usage = {
            promptTokens: usageMetadata.promptTokenCount || 0,
            completionTokens: usageMetadata.candidatesTokenCount || 0,
            totalTokens: usageMetadata.totalTokenCount || 0
          };
        }
      } catch (usageError) {
        // Usage metadata might not be available in all cases
      }

      const geminiResponse: GeminiResponse = {
        text: text.trim()
      };
      
      if (usage) {
        geminiResponse.usage = usage;
      }
      
      return geminiResponse;
    } catch (error: any) {
      await log(`Gemini generation error: ${error.message}`, this.agentId, this.sharedDir);
      throw error;
    }
  }

  /**
   * Process agent-specific tasks using Gemini
   */
  async processAgentTask(taskData: any): Promise<GeminiResponse> {
    const systemInstruction = `You are AI Agent ${this.agentId} in a distributed multi-agent system. 
    
Key capabilities:
- Process tasks independently and in parallel with other agents
- Communicate via NATS messaging system
- Access shared storage for coordination
- Maintain state and context across tasks

Current context:
- Agent ID: ${this.agentId}
- Timestamp: ${new Date().toISOString()}
- Task Type: ${taskData.type || 'unknown'}

Please process this task efficiently and provide a clear, actionable response.`;

    return this.generateText({
      prompt: typeof taskData === 'string' ? taskData : JSON.stringify(taskData),
      systemInstruction,
      context: {
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        taskId: taskData.id || 'unknown'
      }
    });
  }

  /**
   * Get Gemini service status
   */
  getStatus() {
    return {
      model: this.config.model,
      agentId: this.agentId,
      initialized: true,
      timestamp: new Date().toISOString()
    };
  }
}