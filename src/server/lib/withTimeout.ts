function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | undefined> {
  if (timeoutMs <= 0) {
    return promise;
  }
  return Promise.race([
    promise,
    wait(timeoutMs).then(() => {
      return undefined;
    }),
  ]);
}

export { wait, withTimeout };
