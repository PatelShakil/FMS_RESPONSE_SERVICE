/**
 * Kafka Configuration
 * Producer and Consumer setup with batch processing
 */

const { Kafka, logLevel } = require('kafkajs');
const config = require('./env');
const logger = require('../utils/logger');

class KafkaManager {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.consumer = null;
    this.isProducerConnected = false;
    this.isConsumerConnected = false;
    
    // Batch processing for response.submitted events
    this.submittedResponsesBatch = [];
    this.batchTimer = null;
  }

  /**
   * Initialize Kafka client
   */
  initialize() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: logLevel.INFO,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    logger.info('✅ Kafka client initialized');
  }

  /**
   * Connect Kafka Producer
   */
  async connectProducer() {
    if (this.isProducerConnected) {
      logger.info('Kafka Producer already connected');
      return;
    }

    try {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      this.isProducerConnected = true;
      logger.info('✅ Kafka Producer connected successfully');

      // Start batch processing timer
      this.startBatchProcessing();

      // Handle disconnection
      this.producer.on('producer.disconnect', () => {
        logger.warn('Kafka Producer disconnected');
        this.isProducerConnected = false;
      });
    } catch (error) {
      logger.error('❌ Kafka Producer connection error:', error);
      
      // Retry connection
      logger.info('Retrying Kafka Producer connection in 5 seconds...');
      setTimeout(() => this.connectProducer(), 5000);
    }
  }

  /**
   * Connect Kafka Consumer
   */
  async connectConsumer() {
    if (this.isConsumerConnected) {
      logger.info('Kafka Consumer already connected');
      return;
    }

    try {
      this.consumer = this.kafka.consumer({
        groupId: config.kafka.groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await this.consumer.connect();
      this.isConsumerConnected = true;
      logger.info('✅ Kafka Consumer connected successfully');

      // Subscribe to topics
      await this.subscribeToTopics();

      // Handle disconnection
      this.consumer.on('consumer.disconnect', () => {
        logger.warn('Kafka Consumer disconnected');
        this.isConsumerConnected = false;
      });
    } catch (error) {
      logger.error('❌ Kafka Consumer connection error:', error);
      
      // Retry connection
      logger.info('Retrying Kafka Consumer connection in 5 seconds...');
      setTimeout(() => this.connectConsumer(), 5000);
    }
  }

  /**
   * Subscribe to consumer topics
   */
  async subscribeToTopics() {
    const topics = [
      config.kafka.topics.formCreated,
      config.kafka.topics.formDeleted,
      config.kafka.topics.qrGenerated,
      config.kafka.topics.orgSuspended,
    ];

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      logger.info(`📥 Subscribed to Kafka topic: ${topic}`);
    }
  }

  /**
   * Start consuming messages
   */
  async startConsuming(messageHandler) {
    if (!this.isConsumerConnected) {
      logger.error('Cannot start consuming: Consumer not connected');
      return;
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value.toString();
          const parsedMessage = JSON.parse(value);

          logger.info(`📩 Received message from topic: ${topic}`, {
            partition,
            offset: message.offset,
          });

          // Pass to message handler
          await messageHandler(topic, parsedMessage);
        } catch (error) {
          logger.error('Error processing Kafka message:', error);
        }
      },
    });
  }

  /**
   * Publish single event (immediate)
   */
  async publishEvent(topic, key, value) {
    if (!this.isProducerConnected) {
      logger.error('Cannot publish event: Producer not connected');
      return false;
    }

    try {
      const message = {
        key: key || null,
        value: JSON.stringify(value),
        timestamp: Date.now().toString(),
      };

      await this.producer.send({
        topic,
        messages: [message],
      });

      logger.info(`📤 Published event to topic: ${topic}`, { key });
      return true;
    } catch (error) {
      logger.error(`Failed to publish event to ${topic}:`, error);
      return false;
    }
  }

  /**
   * Add response to batch (for response.submitted events)
   */
  addToBatch(responseData) {
    this.submittedResponsesBatch.push(responseData);
    logger.debug(`Added response to batch. Current batch size: ${this.submittedResponsesBatch.length}`);
  }

  /**
   * Start batch processing timer
   */
  startBatchProcessing() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(async () => {
      await this.flushBatch();
    }, config.kafka.batch.intervalMs);

    logger.info(`⏰ Batch processing started (interval: ${config.kafka.batch.intervalMs}ms, max size: ${config.kafka.batch.size})`);
  }

  /**
   * Flush batch to Kafka
   */
  async flushBatch() {
    if (this.submittedResponsesBatch.length === 0) {
      return;
    }

    const batchToSend = [...this.submittedResponsesBatch];
    this.submittedResponsesBatch = [];

    try {
      const messages = batchToSend.map((response) => ({
        key: response.responseId,
        value: JSON.stringify(response),
        timestamp: Date.now().toString(),
      }));

      await this.producer.send({
        topic: config.kafka.topics.responseSubmitted,
        messages,
      });

      logger.info(`📤 Flushed batch: ${messages.length} response.submitted events sent to Kafka`);
    } catch (error) {
      logger.error('Failed to flush batch to Kafka:', error);
      
      // Re-add to batch for retry
      this.submittedResponsesBatch.unshift(...batchToSend);
    }
  }

  /**
   * Publish response.reviewed event
   */
  async publishResponseReviewed(responseData) {
    return this.publishEvent(
      config.kafka.topics.responseReviewed,
      responseData.responseId,
      responseData
    );
  }

  /**
   * Publish response.resolved event
   */
  async publishResponseResolved(responseData) {
    return this.publishEvent(
      config.kafka.topics.responseResolved,
      responseData.responseId,
      responseData
    );
  }

  /**
   * Publish response.flagged event
   */
  async publishResponseFlagged(responseData) {
    return this.publishEvent(
      config.kafka.topics.responseFlagged,
      responseData.responseId,
      responseData
    );
  }

  /**
   * Disconnect all Kafka connections
   */
  async disconnect() {
    try {
      // Flush remaining batch before disconnect
      await this.flushBatch();

      if (this.batchTimer) {
        clearInterval(this.batchTimer);
      }

      if (this.producer && this.isProducerConnected) {
        await this.producer.disconnect();
        logger.info('Kafka Producer disconnected');
      }

      if (this.consumer && this.isConsumerConnected) {
        await this.consumer.disconnect();
        logger.info('Kafka Consumer disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Kafka:', error);
    }
  }

  /**
   * Health check
   */
  getHealthStatus() {
    return {
      producer: this.isProducerConnected ? 'up' : 'down',
      consumer: this.isConsumerConnected ? 'up' : 'down',
      batchSize: this.submittedResponsesBatch.length,
    };
  }
}

// Export singleton instance
module.exports = new KafkaManager();
