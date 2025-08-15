export class IDGenerator {
  private _lastId = 0;

  constructor(public readonly prefix?: string) {}

  public next(): string {
    const value = (++this._lastId).toString(36);

    return this.prefix ? this.prefix + '@' + value : value;
  }
}
