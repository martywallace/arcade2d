import type { AbstractComponentHost } from '../abstract-component-host';
import type { Component } from '../components.types';
import { AbstractDependencyResolver } from './abstract-dependency-resolver';
import type {
  DependencyComponentConstructor,
  WorldDependencyResolver,
} from './dependencies.types';
import type { World } from './world';

/**
 * Concrete {@link WorldDependencyResolver} implementation. Constructed
 * per resolve call so the recorded `lookups` reflect a single component's
 * resolution.
 *
 * @internal
 */
export class WorldComponentDependencyResolver
  extends AbstractDependencyResolver<World>
  implements WorldDependencyResolver
{
  public get host(): World {
    return this._host;
  }

  public requireSibling<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T {
    return this._resolveRequired(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public optionalSibling<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T | null {
    return this._resolveOptional(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }
}
