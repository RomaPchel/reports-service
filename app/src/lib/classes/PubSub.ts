import { PubSub, Topic, Subscription } from '@google-cloud/pubsub';
import { Log } from 'markly-ts-core';

const logger = Log.getInstance().extend('pub/sub');

export class PubSubWrapper {
    private static pubsub = new PubSub({ projectId: 'saas-452909' });

    static async publishMessage<T = any>(topicName: string, message: T): Promise<string> {
        const dataBuffer = Buffer.from(JSON.stringify(message));
        const topic: Topic = PubSubWrapper.pubsub.topic(topicName);

        try {
            const messageId = await topic.publishMessage({ data: dataBuffer });
            logger.info(`Published to ${topicName}: message ID ${messageId}`);
            return messageId;
        } catch (err: any) {
            logger.error(`Failed to publish to ${topicName}: ${err.message}`);
            throw err;
        }
    }

    static subscribe<T = any>(
        subscriptionName: string,
        onMessage: (msg: T) => Promise<void>,
        onError?: (err: Error) => void
    ): Subscription {
        const subscription: Subscription = this.pubsub.subscription(subscriptionName);

        subscription.on('message', async (message) => {
            try {
                const parsed = JSON.parse(message.data.toString()) as T;
                await onMessage(parsed);
                message.ack();
            } catch (err: any) {
                logger.error(`Error in message handler: ${err.message}`);
                message.nack();
                onError?.(err);
            }
        });

        subscription.on('error', (err) => {
            logger.error(`Subscription ${subscriptionName} failed: ${err.message}`);
            onError?.(err);
        });

        return subscription;
    }
}
