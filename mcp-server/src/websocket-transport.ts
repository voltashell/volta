import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import WebSocket from 'ws';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export class WebSocketServerTransport implements Transport {
  private ws: WebSocket;
  private messageHandlers: ((message: any) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];

  constructor(ws: WebSocket) {
    this.ws = ws;
    
    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug('Received message:', message);
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        logger.error('Error parsing message:', error);
      }
    });

    this.ws.on('close', () => {
      logger.info('WebSocket connection closed');
      this.closeHandlers.forEach(handler => handler());
    });

    this.ws.on('error', (error: Error) => {
      logger.error('WebSocket error:', error);
      this.errorHandlers.forEach(handler => handler(error));
    });
  }

  async send(message: any): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      logger.debug('Sent message:', message);
    } else {
      throw new Error('WebSocket is not open');
    }
  }

  onMessage(handler: (message: any) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  async close(): Promise<void> {
    this.ws.close();
  }

  async start(): Promise<void> {
    // WebSocket server transport is already started when constructed
    // This method is required by the Transport interface but no action needed
    logger.info('WebSocketServerTransport started');
  }
}

export class WebSocketClientTransport implements Transport {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logger.info(`Connected to WebSocket server at ${this.url}`);
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.debug('Received message:', message);
          this.messageHandlers.forEach(handler => handler(message));
        } catch (error) {
          logger.error('Error parsing message:', error);
        }
      });

      this.ws.on('close', () => {
        logger.info('WebSocket connection closed');
        this.closeHandlers.forEach(handler => handler());
      });

      this.ws.on('error', (error: Error) => {
        logger.error('WebSocket error:', error);
        this.errorHandlers.forEach(handler => handler(error));
        reject(error);
      });
    });
  }

  async send(message: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.ws.send(JSON.stringify(message));
    logger.debug('Sent message:', message);
  }

  onMessage(handler: (message: any) => void): void {
    this.messageHandlers.push(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
  }

  async start(): Promise<void> {
    // For client transport, start means connect
    await this.connect();
  }
}