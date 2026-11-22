/** Keep Chrome's response channel open explicitly, including versions that do
 * not support returning a Promise from runtime.onMessage listeners. */
export function runtimeHandler(
  handle: (
    message: unknown,
    sender: Browser.runtime.MessageSender,
  ) => Promise<unknown>,
) {
  return (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): true | undefined => {
    if (
      !message ||
      typeof message !== "object" ||
      !("workspace" in message) ||
      message.workspace !== 1
    )
      return;
    void Promise.resolve()
      .then(() => handle(message, sender))
      .then(sendResponse, () =>
        sendResponse({
          ok: false,
          error:
            "The background action failed. Reopen the extension and try again.",
        }),
      );
    return true;
  };
}
