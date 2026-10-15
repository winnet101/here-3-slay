import { Err, Ok, type Result } from "./lib/Result";

export type KeyOf<Choices> = string & keyof Choices;

/** Each choice name determines the type of its allowed values. */
export type ChoiceDefinition<Choices extends Record<string, unknown>> = {
  [K in KeyOf<Choices>]: {
    readonly choice: K;
    readonly validValues?: readonly Choices[K][];
    readonly numberOfValues?: number;
  };
}[KeyOf<Choices>];

export type ResultsOf<
  Choices extends Record<string, unknown>,
  K extends KeyOf<Choices> = KeyOf<Choices>,
> = { [Key in K]: Choices[Key][] };

class ChoiceManager<Choices extends Record<string, unknown>> {
  private pendingChoices: readonly ChoiceDefinition<Choices>[] = [];
  private responses: Partial<ResultsOf<Choices>> = {};
  private resolver: ((values: Partial<ResultsOf<Choices>>) => void) | null =
    null;

  get currentChoices(): readonly ChoiceDefinition<Choices>[] {
    return this.pendingChoices;
  }

  /**
   * Collect independently validated responses, in any order. The promise resolves
   * only after every choice has a response, keyed by the requested choice names.
   * Choice names must be unique within a batch.
   * Unlike setChoice(), batches always wait for explicit responses.
   *
   * @example
   * const result = manager.setChoices([
   *   { choice: "chooseCards", validValues: ["card1", "card2"] },
   *   { choice: "takeAction" },
   * ]);
   * manager.resolveChoice("chooseCards", ["card1"]);
   * manager.resolveChoice("takeAction", [{ actionType: "passTurn" }]);
   * const { chooseCards, takeAction } = await result;
   */
  async setChoices<const Requests extends readonly ChoiceDefinition<Choices>[]>(
    choices: Requests,
  ): Promise<ResultsOf<Choices, Requests[number]["choice"]>> {
    if (this.resolver) throw new Error("There are already active choices");

    const names = new Set<KeyOf<Choices>>();
    for (const { choice, numberOfValues = 1 } of choices) {
      if (names.has(choice)) throw new Error(`Duplicate choice ${choice}`);
      if (!Number.isInteger(numberOfValues) || numberOfValues < 0) {
        throw new Error(`Invalid numberOfValues for choice ${choice}`);
      }
      names.add(choice);
    }

    // Snapshot the definitions so callers cannot change validation mid-request.
    this.pendingChoices = Object.freeze(
      choices.map((entry) =>
        Object.freeze({
          ...entry,
          validValues:
            entry.validValues && Object.freeze([...entry.validValues]),
        }),
      ),
    );
    this.responses = {};

    const promise = new Promise<Partial<ResultsOf<Choices>>>((resolve) => {
      this.resolver = resolve;
    });
    if (choices.length === 0) this.finish();

    // finish() runs only once every requested key has a validated response.
    return (await promise) as ResultsOf<Choices, Requests[number]["choice"]>;
  }

  /** Compatibility helper for a single choice, including forced selections. */
  async setChoice<K extends KeyOf<Choices>>(
    choice: K,
    validValues?: readonly Choices[NoInfer<K>][],
    numberOfValues = 1,
  ): Promise<Choices[K][]> {
    if (this.resolver) throw new Error("There are already active choices");
    if (!Number.isInteger(numberOfValues) || numberOfValues < 0) {
      throw new Error(`Invalid numberOfValues for choice ${choice}`);
    }
    const automatic =
      validValues !== undefined && validValues.length <= numberOfValues;
    const results = this.setChoices([
      {
        choice,
        validValues,
        numberOfValues: automatic ? validValues.length : numberOfValues,
      },
    ]);
    if (automatic) this.resolveChoice(choice, validValues);
    return (await results)[choice];
  }

  /** Accept one response without resolving the batch until all are valid. */
  resolveChoice<K extends KeyOf<Choices>>(
    choice: K,
    values: readonly Choices[K][],
  ): Result {
    if (!this.resolver) return Err("No active choice to resolve");

    const entry = this.pendingChoices.find((entry) => entry.choice === choice);
    if (!entry) return Err(`Choice ${choice} is not active`);
    if (Object.hasOwn(this.responses, choice)) {
      return Err(`Choice ${choice} has already been answered`);
    }

    const numberOfValues = entry.numberOfValues ?? 1;
    if (values.length !== numberOfValues) {
      return Err(
        `Expected ${numberOfValues} responses but got ${values.length}`,
      );
    }
    if (
      entry.validValues !== undefined &&
      values.some((value) => !entry.validValues!.includes(value))
    ) {
      return Err(`Choice ${choice} contains an invalid value`);
    }

    Object.defineProperty(this.responses, choice, {
      value: [...values],
      enumerable: true,
    });
    if (
      this.pendingChoices.every((entry) =>
        Object.hasOwn(this.responses, entry.choice),
      )
    ) {
      this.finish();
    }
    return Ok();
  }

  private finish(): void {
    const resolve = this.resolver!;
    const responses = this.responses;
    this.resolver = null;
    this.pendingChoices = [];
    this.responses = {};
    resolve(responses);
  }
}

export default ChoiceManager;
