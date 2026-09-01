export type Result<K = undefined> = K extends undefined
  ? EmptyOk | Err
  : OkResult<K> | Err;

export class EmptyOk {
  kind = "ok" as const;
}

export class OkResult<K> {
  kind = "ok" as const;
  result: K;

  constructor(result: K) {
    this.result = result;
  }
}

export type Err = {
  kind: "err";
  message: string;
};

export function Ok(): EmptyOk;
export function Ok<K>(result: K): OkResult<K>;
export function Ok<K>(result?: K): EmptyOk | OkResult<K> {
  if (result === undefined) {
    return new EmptyOk();
  }
  return new OkResult(result);
}

export function Err(message: string): Err {
  return {
    kind: "err",
    message: message,
  };
}
