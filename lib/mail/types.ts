export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailProvider {
  readonly name: string;
  sendMail(message: MailMessage): Promise<void>;
}
