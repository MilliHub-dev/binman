/**
 * Stand-in for the WhatsApp Cloud API transport.
 *
 * Records what the bot would have sent instead of calling Meta, so a test can
 * assert on the conversation itself — which prompt appeared, which options were
 * offered — rather than only on the database rows left behind.
 */

export interface SentMessage {
  to: string;
  kind: 'text' | 'list' | 'buttons';
  body: string;
  options?: Array<{ id: string; title: string; description?: string }>;
}

export const sent: SentMessage[] = [];

export const sendText = async (to: string, body: string): Promise<boolean> => {
  sent.push({ to, kind: 'text', body });
  return true;
};

export const sendList = async (
  to: string,
  body: string,
  _buttonLabel: string,
  options: Array<{ id: string; title: string; description?: string }>,
): Promise<boolean> => {
  sent.push({ to, kind: 'list', body, options });
  return true;
};

export const sendButtons = async (
  to: string,
  body: string,
  options: Array<{ id: string; title: string; description?: string }>,
): Promise<boolean> => {
  sent.push({ to, kind: 'buttons', body, options });
  return true;
};

export const isValidSignature = (): boolean => true;
export const computeBodySignature = (): string => 'test';
export const logInbound = (): void => undefined;

// --- Test helpers -----------------------------------------------------------

export const __reset = (): void => {
  sent.length = 0;
};

/** The most recent message the bot sent. */
export const last = (): SentMessage | undefined => sent[sent.length - 1];

/** Option ids offered in the most recent message. */
export const lastOptionIds = (): string[] => (last()?.options ?? []).map((option) => option.id);

/** Finds an offered option id by the prefix the machine uses. */
export const optionStartingWith = (prefix: string): string | undefined =>
  lastOptionIds().find((id) => id.startsWith(prefix));

/** Every message body sent so far, joined — for loose "did it mention X" checks. */
export const transcript = (): string => sent.map((message) => message.body).join('\n---\n');
