import { describe, expect, it } from 'vitest';
import {
  validateChannelForm,
  validateChannelName,
  validateDuration,
  validateRegistration,
  validateUsername,
  compactErrors,
} from '../utils/validation.js';

/**
 * These rules exist only to give immediate feedback; the server re-validates
 * everything. The point of this suite is that the two do not drift apart.
 */
describe('Client-side validation mirror', () => {
  describe('usernames', () => {
    it.each(['john', 'john123', 'user_name'])('accepts %s', (username) => {
      expect(validateUsername(username)).toBeNull();
    });

    it('explains why a username starting with a number is rejected', () => {
      expect(validateUsername('12john')).toMatch(/cannot start with a number/i);
    });

    it('explains a too-short username', () => {
      expect(validateUsername('jo')).toMatch(/at least 3/i);
    });

    it('explains a username containing a space', () => {
      expect(validateUsername('john doe')).toMatch(/spaces/i);
    });
  });

  describe('channel names', () => {
    it.each(['general', 'gaming', 'room123', 'my-channel'])('accepts %s', (name) => {
      expect(validateChannelName(name)).toBeNull();
    });

    it('treats a blank name as valid, since the server generates one', () => {
      expect(validateChannelName('')).toBeNull();
      expect(validateChannelName('   ')).toBeNull();
    });

    it.each([
      ['123room', /cannot start with a number/i],
      ['my room', /spaces/i],
      ['this-channel-name-is-too-long', /at most 20/i],
    ])('rejects %s', (name, expected) => {
      expect(validateChannelName(name)).toMatch(expected);
    });
  });

  describe('durations', () => {
    it.each([1, 30, 60])('accepts %s minutes', (minutes) => {
      expect(validateDuration(minutes)).toBeNull();
    });

    it.each([0, -1, 61, 1.5, 'ten'])('rejects %s', (minutes) => {
      expect(validateDuration(minutes)).not.toBeNull();
    });
  });

  describe('form level validation', () => {
    it('requires a password for a private channel and not for a public one', () => {
      const asPrivate = validateChannelForm({ name: 'x', type: 'private', password: '', durationMinutes: 10 });
      const asPublic = validateChannelForm({ name: 'x', type: 'public', password: '', durationMinutes: 10 });

      expect(asPrivate.password).toMatch(/password/i);
      expect(asPublic.password).toBeNull();
    });

    it('enforces the private channel password length window', () => {
      const tooShort = validateChannelForm({ type: 'private', password: 'short12', durationMinutes: 10 });
      const tooLong = validateChannelForm({ type: 'private', password: 'a'.repeat(21), durationMinutes: 10 });

      expect(tooShort.password).toMatch(/at least 8/i);
      expect(tooLong.password).toMatch(/at most 20/i);
    });

    it('reports every missing registration field', () => {
      const errors = compactErrors(
        validateRegistration({ firstName: '', lastName: '', username: '', password: '' }),
      );

      expect(Object.keys(errors).sort()).toEqual(['firstName', 'lastName', 'password', 'username']);
    });
  });
});
