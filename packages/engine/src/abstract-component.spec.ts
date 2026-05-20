import { AbstractComponent } from './abstract-component';
import { AbstractComponentHost } from './abstract-component-host';

// Minimal concrete host so the abstract base can be instantiated in tests.
class TestHost extends AbstractComponentHost<TestHost> {
  protected getHostReference(): TestHost {
    return this;
  }

  protected _createDependencyResolver(): unknown {
    return {};
  }
}

describe('AbstractComponent', () => {
  // Minimal concrete subclass that satisfies the structural Component
  // contract by adding the lifecycle hooks the base intentionally omits.
  class Concrete extends AbstractComponent<TestHost> {
    public onAdded(): void {}
    public onUpdate(): void {}
    public onDestroy(): void {}
  }

  test('stores the host passed positionally to the constructor', () => {
    const host = new TestHost();
    const component = new Concrete(host);

    expect(component.host).toBe(host);
  });

  test('defaults enabled to true', () => {
    const host = new TestHost();
    const component = new Concrete(host);

    expect(component.enabled).toBe(true);
  });

  test('integrates with addComponent like any other Component', () => {
    const host = new TestHost();
    const component = new Concrete(host);

    host.addComponent('concrete', component);

    expect(host.getComponentByType(Concrete)).toBe(component);
  });
});
