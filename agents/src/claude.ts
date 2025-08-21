/**
 * Claude AI service for agent integration
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeConfig, ClaudeTask, ClaudeResponse } from './types';
import { log } from './utils';

export class ClaudeService {
  private client: Anthropic;

  constructor(
    private config: ClaudeConfig,
    private agentId: string,
    private sharedDir: string
  ) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  /**
   * Initialize the Claude service
   */
  async initialize(): Promise<void> {
    try {
      await log(`Initializing Claude service with model: ${this.config.model}`, this.agentId, this.sharedDir);
      
      // Test the connection with a simple prompt
      const testResult = await this.generateText({
        prompt: 'Hello! Please respond with "Claude initialized successfully" to confirm you are working.',
        systemInstruction: `You are AI Agent ${this.agentId} running in a distributed agent system. Keep responses concise.`
      });

      await log(`Claude initialization test: ${testResult.text}`, this.agentId, this.sharedDir);
      await log(`Claude service initialized successfully for ${this.agentId}`, this.agentId, this.sharedDir);
    } catch (error: any) {
      await log(`Claude initialization failed for ${this.agentId}: ${error.message}`, this.agentId, this.sharedDir);
      throw error;
    }
  }

  /**
   * Generate text using Claude
   */
  async generateText(task: ClaudeTask): Promise<ClaudeResponse> {
    try {
      const startTime = Date.now();

      // Prepare messages for Claude API
      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: 'user',
          content: task.prompt
        }
      ];

      // Add context if provided
      if (task.context && messages[0]) {
        const currentContent = messages[0].content as string;
        messages[0].content = currentContent + `\n\nContext: ${JSON.stringify(task.context, null, 2)}`;
      }

      await log(`Generating text with prompt length: ${task.prompt.length} characters`, this.agentId, this.sharedDir);

      const createParams: Anthropic.Messages.MessageCreateParams = {
        model: this.config.model,
        max_tokens: this.config.maxTokens || 2048,
        temperature: this.config.temperature || 0.7,
        messages: messages
      };

      if (task.systemInstruction) {
        createParams.system = task.systemInstruction;
      }

      const response = await this.client.messages.create(createParams);
      const processingTime = Date.now() - startTime;

      // Extract text content from response
      let text = '';
      if (response.content && response.content.length > 0) {
        const textContent = response.content.find((content) => content.type === 'text');
        if (textContent && 'text' in textContent) {
          text = textContent.text;
        }
      }

      await log(`Claude response generated in ${processingTime}ms, length: ${text.length} characters`, this.agentId, this.sharedDir);

      // Extract usage information
      const usage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      };

      const claudeResponse: ClaudeResponse = {
        text: text.trim(),
        usage
      };

      return claudeResponse;
    } catch (error: any) {
      await log(`Claude generation error: ${error.message}`, this.agentId, this.sharedDir);
      throw error;
    }
  }

  /**
   * Process agent-specific tasks using Claude
   */
  async processAgentTask(taskData: any): Promise<ClaudeResponse> {
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
   * Get Claude service status
   */
  getStatus(): object {
    return {
      model: this.config.model,
      agentId: this.agentId,
      initialized: true,
      timestamp: new Date().toISOString()
    };
  }
}
