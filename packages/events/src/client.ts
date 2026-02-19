import { Kafka } from 'kafkajs';
import type { Producer, Consumer, Admin } from 'kafkajs';

export type EventClientConfig = {
  brokers: string[];
  clientId?: string;
};

export type EventClient = {
  producer: Producer;
  consumer: (groupId: string) => Consumer;
  admin: Admin;
};

export const createEventClient = (config: EventClientConfig): EventClient => {
  const kafka = new Kafka({
    clientId: config.clientId ?? 'solagent',
    brokers: config.brokers,
  });

  return {
    producer: kafka.producer(),
    consumer: (groupId: string) => kafka.consumer({ groupId }),
    admin: kafka.admin(),
  };
};
