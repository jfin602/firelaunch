import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { ManagedMediaCoordinator } from './managed-media-coordinator.js';

/** IAM-scoped private queue. Only EventBridge supplies hints; coordinator re-reads GetJob. */
export class MediaConvertEventsQueue {
  private polling = false;
  constructor(private readonly coordinator: ManagedMediaCoordinator, private readonly queueUrl: string,
    private readonly client: SQSClient) {
    const url = new URL(queueUrl);
    if (url.protocol !== 'https:' || !/^sqs\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname) ||
      !/^\/[0-9]{12}\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash)
      throw new Error('Invalid private MediaConvert events queue URL');
  }

  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const result = await this.client.send(new ReceiveMessageCommand({ QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10, VisibilityTimeout: 120, WaitTimeSeconds: 0 }));
      for (const message of result.Messages ?? []) {
        if (!message.Body || !message.ReceiptHandle) continue;
        try {
          await this.coordinator.event(JSON.parse(message.Body));
          await this.client.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl,
            ReceiptHandle: message.ReceiptHandle }));
        } catch { /* redelivery; five failed receives move to the private DLQ */ }
      }
    } finally { this.polling = false; }
  }
}
