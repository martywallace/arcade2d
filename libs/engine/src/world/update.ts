export class Update {
  constructor(
    public readonly previous: number,
    public readonly current: number,
  ) {}

  public get delta(): number {
    if (this.previous === 0 || this.current === 0) {
      return 0;
    }

    return Math.max(this.current - this.previous, 1);
  }
}
