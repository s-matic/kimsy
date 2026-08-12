export interface NotificationMessage {
  to: string;
  subject: string;
  actionUrl: string;
  actionLabel: string;
}

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<void>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
  async send(message: NotificationMessage) {
    if (process.env.NODE_ENV !== "production") {
      console.info("Notification queued", {
        to: message.to,
        subject: message.subject,
        actionLabel: message.actionLabel,
      });
    }
  }
}

// Email content intentionally excludes customer facts, evidence names, and risk findings.
export function safeTaskNotification(input: NotificationMessage): NotificationMessage {
  return {
    to: input.to,
    subject: input.subject,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel,
  };
}
