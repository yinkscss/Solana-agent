import { describe, it, expect } from 'vitest';
import { canTransition, getNextStates, isTerminal, transition } from '../src/state-machine/transaction-state';

describe('Transaction State Machine', () => {
  describe('canTransition', () => {
    it('allows pending → simulating', () => {
      expect(canTransition('pending', 'simulating')).toBe(true);
    });

    it('allows simulating → simulation_failed', () => {
      expect(canTransition('simulating', 'simulation_failed')).toBe(true);
    });

    it('allows simulating → policy_eval', () => {
      expect(canTransition('simulating', 'policy_eval')).toBe(true);
    });

    it('allows policy_eval → rejected', () => {
      expect(canTransition('policy_eval', 'rejected')).toBe(true);
    });

    it('allows policy_eval → awaiting_approval', () => {
      expect(canTransition('policy_eval', 'awaiting_approval')).toBe(true);
    });

    it('allows policy_eval → signing', () => {
      expect(canTransition('policy_eval', 'signing')).toBe(true);
    });

    it('allows awaiting_approval → signing', () => {
      expect(canTransition('awaiting_approval', 'signing')).toBe(true);
    });

    it('allows awaiting_approval → rejected (timeout)', () => {
      expect(canTransition('awaiting_approval', 'rejected')).toBe(true);
    });

    it('allows signing → signing_failed', () => {
      expect(canTransition('signing', 'signing_failed')).toBe(true);
    });

    it('allows signing → submitting', () => {
      expect(canTransition('signing', 'submitting')).toBe(true);
    });

    it('allows submitting → submitted', () => {
      expect(canTransition('submitting', 'submitted')).toBe(true);
    });

    it('allows submitted → confirmed', () => {
      expect(canTransition('submitted', 'confirmed')).toBe(true);
    });

    it('allows submitted → failed', () => {
      expect(canTransition('submitted', 'failed')).toBe(true);
    });

    it('allows failed → retrying', () => {
      expect(canTransition('failed', 'retrying')).toBe(true);
    });

    it('allows failed → permanently_failed', () => {
      expect(canTransition('failed', 'permanently_failed')).toBe(true);
    });

    it('allows retrying → submitting', () => {
      expect(canTransition('retrying', 'submitting')).toBe(true);
    });

    it('allows retrying → permanently_failed', () => {
      expect(canTransition('retrying', 'permanently_failed')).toBe(true);
    });

    it('rejects pending → confirmed (skip)', () => {
      expect(canTransition('pending', 'confirmed')).toBe(false);
    });

    it('rejects confirmed → pending (backward)', () => {
      expect(canTransition('confirmed', 'pending')).toBe(false);
    });

    it('rejects simulation_failed → simulating', () => {
      expect(canTransition('simulation_failed', 'simulating')).toBe(false);
    });
  });

  describe('getNextStates', () => {
    it('returns [simulating] for pending', () => {
      expect(getNextStates('pending')).toEqual(['simulating']);
    });

    it('returns empty array for terminal states', () => {
      expect(getNextStates('confirmed')).toEqual([]);
      expect(getNextStates('permanently_failed')).toEqual([]);
      expect(getNextStates('simulation_failed')).toEqual([]);
      expect(getNextStates('rejected')).toEqual([]);
      expect(getNextStates('signing_failed')).toEqual([]);
    });

    it('returns multiple options for policy_eval', () => {
      const states = getNextStates('policy_eval');
      expect(states).toContain('rejected');
      expect(states).toContain('awaiting_approval');
      expect(states).toContain('signing');
    });
  });

  describe('isTerminal', () => {
    it('marks confirmed as terminal', () => {
      expect(isTerminal('confirmed')).toBe(true);
    });

    it('marks permanently_failed as terminal', () => {
      expect(isTerminal('permanently_failed')).toBe(true);
    });

    it('marks simulation_failed as terminal', () => {
      expect(isTerminal('simulation_failed')).toBe(true);
    });

    it('marks rejected as terminal', () => {
      expect(isTerminal('rejected')).toBe(true);
    });

    it('marks signing_failed as terminal', () => {
      expect(isTerminal('signing_failed')).toBe(true);
    });

    it('does not mark pending as terminal', () => {
      expect(isTerminal('pending')).toBe(false);
    });

    it('does not mark submitting as terminal', () => {
      expect(isTerminal('submitting')).toBe(false);
    });
  });

  describe('transition', () => {
    it('returns target state on valid transition', () => {
      expect(transition('pending', 'simulating')).toBe('simulating');
    });

    it('throws on invalid transition', () => {
      expect(() => transition('pending', 'confirmed')).toThrow('Invalid transition');
    });

    it('throws on transition from terminal state', () => {
      expect(() => transition('confirmed', 'pending')).toThrow('Invalid transition');
    });
  });
});
