import type { Event } from '@events';
import type { User } from '@core';

/**
 * Listener that sends welcome email to newly registered users
 */
export class SendWelcomeEmail {
  async handle(event: Event<{ user: User }>): Promise<void> {
    const { user } = event.payload;

    console.log(`[Event] Sending welcome email to ${user.email}`);

    // In production, integrate with mail service
    // await Mail.send({
    //   to: user.email,
    //   subject: 'Welcome to Nara!',
    //   template: 'welcome'
    // });
  }
}
