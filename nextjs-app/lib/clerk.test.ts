import { describe, it, expect } from 'vitest';
import { extractPrimaryEmail, type ClerkEmailAddress } from './clerk';

describe('extractPrimaryEmail', () => {
  const emails: ClerkEmailAddress[] = [
    { id: 'id_1', email_address: 'first@example.com' },
    { id: 'id_2', email_address: 'primary@example.com' },
  ];

  it('returns email matching primaryEmailAddressId', () => {
    const email = extractPrimaryEmail({ emailAddresses: emails, primaryEmailAddressId: 'id_2' });
    expect(email).toBe('primary@example.com');
  });

  it('falls back to first email when primary id missing', () => {
    const email = extractPrimaryEmail({ emailAddresses: emails, primaryEmailAddressId: null });
    expect(email).toBe('first@example.com');
  });

  it('returns null when list empty', () => {
    const email = extractPrimaryEmail({ emailAddresses: [], primaryEmailAddressId: 'id_2' });
    expect(email).toBeNull();
  });
});

