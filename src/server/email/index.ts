import type { ParsedGroup, ParsedMailbox } from "email-addresses";
import { parseOneAddress } from "email-addresses";
import type { MessageHeaders } from "emailjs";
import { SMTPClient, Message } from "emailjs";

import { getLogger } from "../../utils";

const logger = getLogger("email");

function isParsedMailbox(parsed: ParsedMailbox | ParsedGroup): parsed is ParsedMailbox {
  return parsed.type === "mailbox";
}

export interface SmtpConfig {
  from: string;
  host: string;
  port?: number;
  ssl?: boolean;
  tls?: boolean;
}

interface Address {
  name: string;
  address: string;
}

interface EmailMessage {
  from?: string | Partial<Address>;
  to: string;
  subject: string;
  content: string;
}

function buildFromAddress(mbox: ParsedMailbox, override: string | Partial<Address> = {}): string {
  if (typeof override == "string") {
    return override;
  }

  return `${override.name ?? mbox.name} <${override.address ?? mbox.address}>`;
}

export class Emailer {
  private client: SMTPClient;
  private from: ParsedMailbox;

  public constructor(private readonly config: SmtpConfig) {
    let from = parseOneAddress(config.from);
    if (!isParsedMailbox(from)) {
      throw new Error("From address must be a mailbox.");
    }
    this.from = from;

    this.client = new SMTPClient({
      host: config.host,
      port: config.port,
      ssl: config.ssl,
      tls: config.tls,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: (msg: any, ...args: any[]) => logger.trace(msg, ...args),
    });
  }

  private send(content: Partial<MessageHeaders>): Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      this.client.send(new Message(content), (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public sendMessage(message: EmailMessage): Promise<void> {
    return this.send({
      from: buildFromAddress(this.from, message.from),
      subject: message.subject,
      to: message.to,
      text: message.content,
    });
  }
}
