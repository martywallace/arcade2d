export class Circle {
  constructor(public readonly radius: number) {}

  public getDiameter(): number {
    return this.radius * 2;
  }

  public getCircumference(): number {
    return this.radius * 2 * Math.PI;
  }
}
