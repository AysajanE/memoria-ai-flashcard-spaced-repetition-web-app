export type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

export function extractPrimaryEmail(args: {
  emailAddresses: ClerkEmailAddress[] | undefined | null;
  primaryEmailAddressId: string | undefined | null;
}): string | null {
  const { emailAddresses, primaryEmailAddressId } = args;
  if (!emailAddresses || emailAddresses.length === 0) return null;

  // Prefer explicitly designated primary email
  if (primaryEmailAddressId) {
    const match = emailAddresses.find((e) => e.id === primaryEmailAddressId);
    if (match?.email_address) return match.email_address;
  }

  // Fallback: first email
  return emailAddresses[0]?.email_address ?? null;
}

