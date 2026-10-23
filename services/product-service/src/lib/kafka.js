const { Kafka, logLevel, Partitioners } = require('kafkajs');
const { randomUUID } = require('crypto');
const logger = require('./logger');

const SERVICE = process.env.SERVICE_NAME || 'service';
const kafka = new Kafka({
  clientId: SERVICE,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 500, retries: 15 },
});

const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
const consumers = [];
let producerReady = false;

/** Create topics if they don't exist (safe to call from every service). */
async function ensureTopics(topics) {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((t) => !existing.has(t));
    if (missing.length) {
      await admin.createTopics({
        waitForLeaders: true,
        topics: missing.map((topic) => ({
          topic,
          numPartitions: Number(process.env.KAFKA_PARTITIONS || 3),
          replicationFactor: Number(process.env.KAFKA_REPLICATION_FACTOR || 1),
        })),
      });
      logger.info('Kafka topics created', { topics: missing });
    }
  } catch (err) {
    // Another service may have created the same topic at the same moment.
    logger.warn('ensureTopics warning', { error: err.message });
  } finally {
    await admin.disconnect();
  }
}

async function connectProducer() {
  await producer.connect();
  producerReady = true;
  logger.info('Kafka producer connected');
}

/**
 * Publish an event. Every event has the same envelope:
 * { eventId, type, source, occurredAt, data }
 * `key` decides the partition -> events with the same key (e.g. orderId) stay in order.
 */
async function publish(topic, data, key) {
  const event = {
    eventId: randomUUID(),
    type: topic,
    source: SERVICE,
    occurredAt: new Date().toISOString(),
    data,
  };
  await producer.send({
    topic,
    messages: [{ key: key ? String(key) : undefined, value: JSON.stringify(event) }],
  });
  logger.info('Event published', { topic, eventId: event.eventId, key });
  return event;
}

/**
 * Subscribe a consumer group to topics.
 * handlers = { 'order.created': async (event) => {...}, ... }
 * Failed messages are retried 3 times, then sent to `<topic>.dlq` (dead-letter queue).
 */
async function subscribe(groupId, handlers) {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  for (const topic of Object.keys(handlers)) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let event;
      try {
        event = JSON.parse(message.value.toString());
      } catch {
        logger.error('Invalid JSON message skipped', { topic, partition });
        return;
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await handlers[topic](event);
          return;
        } catch (err) {
          logger.warn('Handler failed', { topic, eventId: event.eventId, attempt, error: err.message });
          await new Promise((r) => setTimeout(r, attempt * 500));
        }
      }

      logger.error('Sending event to DLQ', { topic, eventId: event.eventId });
      await producer.send({ topic: `${topic}.dlq`, messages: [{ value: message.value }] });
    },
  });

  consumers.push(consumer);
  logger.info('Kafka consumer running', { groupId, topics: Object.keys(handlers) });
}

const isKafkaReady = () => producerReady;

async function disconnectKafka() {
  await Promise.allSettled(consumers.map((c) => c.disconnect()));
  await producer.disconnect().catch(() => {});
}

module.exports = { ensureTopics, connectProducer, publish, subscribe, isKafkaReady, disconnectKafka };
