import { Err, Ok, OkResult, type Result } from "./lib/Result";

class ChoiceManager<Choices extends Record<string, unknown>> {
  currentChoice: (string & keyof Choices) | null = null;
  private resolver: ((value: Choices[keyof Choices][]) => void) | null = null;

  private validValues?: Choices[keyof Choices][] | undefined;
  private numberOfValues: number = 1;

  async setChoice<K extends string & keyof Choices>(
    choice: K,
    validValues?: Choices[K][],
    numberOfValues = 1,
  ): Promise<Choices[K][]> {
    this.currentChoice = choice;
    this.validValues = validValues ?? undefined;
    this.numberOfValues = numberOfValues;

    const promise = new Promise<Choices[K][]>((res) => {
      this.resolver = res as (value: Choices[keyof Choices][]) => void;
    });

    if (validValues) {
      if (validValues.length <= this.numberOfValues) return validValues;
    }
    return await promise;
  }

  /**
   * Resolves the current choice with the provided value.
   * @param values The value to resolve the choice with.
   * @returns Whether the choice resolved successfully.
   */
  resolveChoice(
    choice: string & keyof Choices,
    values: Choices[keyof Choices][],
  ): Result {
    if (this.resolver) {
      if (this.currentChoice != choice)
        return Err(`Expected choice ${this.currentChoice} but got ${choice}`);

      if (
        this.validValues != undefined &&
        values.every((v) => !this.validValues!.includes(v))
      )
        return Err(`Choice ${values} is not valid`);

      if (values.length !== this.numberOfValues) {
        return Err(
          `Expected ${this.numberOfValues} responses but got ${values.length > this.numberOfValues ? "only" : ""} ${values.length}`,
        );
      }

      this.resolver(values);
      this.resolver = null;
      this.currentChoice = null;
      this.validValues = undefined;
      return Ok();
    }
    return Err("No active choice to resolve");
  }
}

export default ChoiceManager;
