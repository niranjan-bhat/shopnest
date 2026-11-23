/** The message a super admin sends a new owner on WhatsApp. */
export function inviteMessage(invite: {
  storeName: string;
  email: string;
  loginUrl: string;
}): string {
  return [
    `Hello! Your online store, ${invite.storeName}, is ready to set up on Zarify.`,
    '',
    `1. Open ${invite.loginUrl}`,
    `2. Enter your email: ${invite.email}`,
    '3. We email you a 6-digit code. Enter it to sign in.',
    '',
    'Then add your products and publish your storefront.',
  ].join('\n');
}
