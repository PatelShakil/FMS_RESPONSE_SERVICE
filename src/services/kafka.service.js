/**
 * Kafka Service
 * Handle Kafka events (consumer message processing)
 */

const logger = require('../utils/logger');
const Response = require('../models/Response');

class KafkaService {
  /**
   * Handle incoming Kafka messages
   */
  async handleMessage(topic, message) {
    try {
      logger.info(`Processing Kafka message from topic: ${topic}`, {
        messagePreview: JSON.stringify(message).substring(0, 200),
      });

      switch (topic) {
        case 'feedback.form.created':
          await this.handleFormCreated(message);
          break;

        case 'feedback.form.deleted':
          await this.handleFormDeleted(message);
          break;

        case 'qr.generated':
          await this.handleQRGenerated(message);
          break;

        case 'org.suspended':
          await this.handleOrgSuspended(message);
          break;

        default:
          logger.warn(`Unhandled topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error processing Kafka message from ${topic}:`, error);
      // Don't throw - let Kafka consumer continue
    }
  }

  /**
   * Handle feedback.form.created event
   */
  async handleFormCreated(message) {
    try {
      const { formId, orgId, serviceId, formName } = message;

      logger.info('Processing form.created event', {
        formId,
        orgId,
        serviceId,
      });

      // Update metadata or prepare analytics
      // For now, just log the event
      logger.info(`New form created: ${formName} (${formId})`);

      // TODO: Initialize analytics document for this form (if needed)
    } catch (error) {
      logger.error('Error handling form.created event:', error);
    }
  }

  /**
   * Handle feedback.form.deleted event
   */
  async handleFormDeleted(message) {
    try {
      const { formId, orgId } = message;

      logger.info('Processing form.deleted event', {
        formId,
        orgId,
      });

      // Archive or mark related responses
      // For MVP, we keep responses even if form is deleted (audit trail)
      const responseCount = await Response.countDocuments({
        formId,
        deletedAt: null,
      });

      logger.info(`Form deleted. ${responseCount} responses exist for this form`, {
        formId,
      });

      // TODO: Optionally soft-delete all responses or mark as archived
    } catch (error) {
      logger.error('Error handling form.deleted event:', error);
    }
  }

  /**
   * Handle qr.generated event
   */
  async handleQRGenerated(message) {
    try {
      const { qrCodeId, formId, serviceId, assignedTo } = message;

      logger.info('Processing qr.generated event', {
        qrCodeId,
        formId,
        serviceId,
      });

      // Update metadata or analytics
      logger.info(`QR code generated: ${qrCodeId} for form ${formId}`);

      // TODO: Track QR metadata for analytics (if needed)
    } catch (error) {
      logger.error('Error handling qr.generated event:', error);
    }
  }

  /**
   * Handle org.suspended event
   */
  async handleOrgSuspended(message) {
    try {
      const { orgId, reason } = message;

      logger.info('Processing org.suspended event', {
        orgId,
        reason,
      });

      // Mark all pending responses for this org
      const result = await Response.updateMany(
        { orgId, status: 'PENDING', deletedAt: null },
        {
          $set: {
            status: 'REJECTED',
            resolutionNotes: `Organization suspended: ${reason}`,
          },
        }
      );

      logger.info(`Organization suspended. ${result.modifiedCount} pending responses rejected`, {
        orgId,
      });
    } catch (error) {
      logger.error('Error handling org.suspended event:', error);
    }
  }

  /**
   * Publish custom event (generic helper)
   */
  async publishEvent(topic, key, payload) {
    try {
      const kafkaManager = require('../config/kafka');
      await kafkaManager.publishEvent(topic, key, payload);
      
      logger.info(`Event published to ${topic}`, { key });
    } catch (error) {
      logger.error(`Error publishing event to ${topic}:`, error);
    }
  }
}

module.exports = new KafkaService();
