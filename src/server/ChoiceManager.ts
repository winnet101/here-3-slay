class ChoiceManager<Choices extends Record<string, unknown>> {
  currentChoice: keyof Choices | null = null;
  private resolver: ((value: Choices[keyof Choices]) => void) | null = null;
  private validator: <K extends keyof Choices>(
    choice: K,
    value: Choices[K]
  ) => boolean;

  constructor(
    validator: <K extends keyof Choices>(
      choice: K,
      value: Choices[K]
    ) => boolean
  ) {
    this.validator = validator;
  }

  async setChoice<K extends keyof Choices>(choice: K): Promise<Choices[K]> {
    this.currentChoice = choice;
    const promise = new Promise<Choices[K]>((res) => {
      this.resolver = res as (value: Choices[keyof Choices]) => void;
    });
    return await promise;
  }

  /**
   * Resolves the current choice with the provided value.
   * @param value The value to resolve the choice with.
   * @returns Whether the choice resolved successfully.
   */
  resolveChoice(value: Choices[keyof Choices]): boolean {
    if (this.resolver) {
      if (this.currentChoice && !this.validator(this.currentChoice, value)) {
        return false;
      }

      this.resolver(value);
      this.resolver = null;
      this.currentChoice = null;
      return true;
    }
    return false;
    // throw new Error("No choice to resolve");
  }
}

export default ChoiceManager;
