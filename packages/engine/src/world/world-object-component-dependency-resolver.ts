import type { AbstractComponentHost } from '../abstract-component-host';
import type { Component } from '../components.types';
import { AbstractDependencyResolver } from './abstract-dependency-resolver';
import type {
  DependencyComponentConstructor,
  WorldObjectDependencyResolver,
} from './dependencies.types';
import type { World } from './world';
import type { WorldObject } from './world-object';

/**
 * Concrete {@link WorldObjectDependencyResolver} implementation.
 *
 * @internal
 */
export class WorldObjectComponentDependencyResolver
  extends AbstractDependencyResolver<WorldObject>
  implements WorldObjectDependencyResolver
{
  public get host(): WorldObject {
    return this._host;
  }

  public requireSibling<T extends Component<WorldObject>>(
    type: DependencyComponentConstructor<T>,
  ): T {
    return this._resolveRequired(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public optionalSibling<T extends Component<WorldObject>>(
    type: DependencyComponentConstructor<T>,
  ): T | null {
    return this._resolveOptional(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public requireFromWorld<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T {
    return this._resolveRequired(
      'world',
      this._host.world as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public optionalFromWorld<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T | null {
    return this._resolveOptional(
      'world',
      this._host.world as unknown as AbstractComponentHost<never>,
      type,
    );
  }
}
