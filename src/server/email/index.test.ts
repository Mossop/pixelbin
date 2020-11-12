/* eslint-disable @typescript-eslint/naming-convention */
import { SMTPClient, Message } from "emailjs";

import { Emailer } from ".";
import { deferCall, mockedClass } from "../../test-helpers";

jest.mock("emailjs", () => {
  return {
    __esModule: true,
    Message: jest.fn(),
    SMTPClient: jest.fn(),
  };
});

const mockedSMTPClient = mockedClass(SMTPClient);
const mockedMessage = mockedClass(Message);

test("no email", async (): Promise<void> => {
  let emailer = new Emailer(null);
  await emailer.sendMessage({
    to: "someone@somewhere.com",
    subject: "Foo",
    content: "Bar",
  });

  expect(mockedSMTPClient).not.toHaveBeenCalled();
  expect(mockedMessage).not.toHaveBeenCalled();
});

test("configured email", async (): Promise<void> => {
  let sender = jest.fn<void, [Message, (err: Error | null, msg: Message) => void]>();

  // @ts-ignore
  mockedSMTPClient.mockReturnValueOnce({
    send: sender,
  });

  let emailer = new Emailer({
    from: "Host <someone@somewhere.com>",
    host: "anywhere.com",
    tls: true,
  });

  expect(mockedSMTPClient).toHaveBeenCalledTimes(1);
  expect(mockedSMTPClient).toHaveBeenLastCalledWith({
    host: "anywhere.com",
    port: undefined,
    ssl: undefined,
    tls: true,
    logger: expect.anything(),
  });

  // Successful message

  let deferred = deferCall(sender);
  let msg = {} as Message;
  mockedMessage.mockReturnValueOnce(msg);

  let sendPromise = emailer.sendMessage({
    to: "somebody@somewhere.com",
    subject: "My message",
    content: "My content",
  });

  let call = await deferred.call;
  expect(call[0]).toBe(msg);

  expect(mockedMessage).toHaveBeenCalledTimes(1);
  expect(mockedMessage).toHaveBeenLastCalledWith({
    from: "Host <someone@somewhere.com>",
    to: "somebody@somewhere.com",
    subject: "My message",
    text: "My content",
  });

  call[1](null, msg);

  await sendPromise;
  mockedMessage.mockClear();
  sender.mockClear();

  // Unsuccessful message

  deferred = deferCall(sender);
  msg = {} as Message;
  mockedMessage.mockReturnValueOnce(msg);

  sendPromise = emailer.sendMessage({
    from: { name: "Bob" },
    to: "somebody@somewhere.com",
    subject: "My message",
    content: "My content",
  });

  call = await deferred.call;
  expect(call[0]).toBe(msg);

  expect(mockedMessage).toHaveBeenCalledTimes(1);
  expect(mockedMessage).toHaveBeenLastCalledWith({
    from: "Bob <someone@somewhere.com>",
    to: "somebody@somewhere.com",
    subject: "My message",
    text: "My content",
  });

  call[1](new Error("Bad bad bad"), msg);

  await expect(sendPromise).rejects.toThrow("Bad bad bad");
});
