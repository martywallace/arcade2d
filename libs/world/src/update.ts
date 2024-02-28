export class Update {
  constructor(
    public readonly previous: number,
    public readonly current: number,
  ) {}

  public get delta(): number {
    return Math.max(this.current - this.previous, 1);
  }
}
