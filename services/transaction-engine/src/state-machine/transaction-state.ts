import type { TransactionStatus } from '@solagent/common';
import { InvalidTransitionError } from '../types';

const TRANSITION_MAP: Record<TransactionStatus, TransactionStatus[]> = {
  pending: ['simulating'],
  simulating: ['simulation_failed', 'policy_eval'],
  simulation_failed: [],
  policy_eval: ['rejected', 'awaiting_approval', 'signing'],
  rejected: [],
  awaiting_approval: ['signing', 'rejected'],
  signing: ['signing_failed', 'submitting'],
  signing_failed: [],
  submitting: ['submitted'],
  submitted: ['confirmed', 'failed'],
  confirmed: [],
  failed: ['retrying', 'permanently_failed'],
  retrying: ['submitting', 'permanently_failed'],
  permanently_failed: [],
};

const TERMINAL_STATES: ReadonlySet<TransactionStatus> = new Set([
  'simulation_failed',
  'rejected',
  'signing_failed',
  'confirmed',
  'permanently_failed',
]);

export const canTransition = (from: TransactionStatus, to: TransactionStatus): boolean =>
  TRANSITION_MAP[from]?.includes(to) ?? false;

export const getNextStates = (current: TransactionStatus): TransactionStatus[] =>
  TRANSITION_MAP[current] ?? [];

export const isTerminal = (status: TransactionStatus): boolean =>
  TERMINAL_STATES.has(status);

export const transition = (current: TransactionStatus, target: TransactionStatus): TransactionStatus => {
  if (!canTransition(current, target)) {
    throw new InvalidTransitionError(current, target);
  }
  return target;
};
