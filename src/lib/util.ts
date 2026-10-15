function range(end: number): Generator<number>;
function range(start: number, end: number): Generator<number>;
function range(start: number, end: number, step: number): Generator<number>;
function* range(
  param1: number,
  param2: number = param1,
  param3: number = 1,
): Generator<number> {
  const end = param2;
  const start = param2 === param1 ? 0 : param1;
  for (let i = start; i < end; i += param3 ?? 1) {
    yield i;
  }
}

export { range };
