import { AbstractComponentHost } from '../abstract-component-host';
import type { Component } from '../components.types';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import type {
  DependencyComponentConstructor,
  DependencyLookupRecord,
} from './dependencies.types';

/**
 * Common machinery used by both {@link WorldComponentDependencyResolver}
 * and {@link WorldObjectComponentDependencyResolver}. The two concrete
 * resolvers differ only in which lookup methods they expose; the lookup
 * logic itself is shared here.
 *
 * @internal
 */
export abstract class AbstractDependencyResolver<
  THost extends AbstractComponentHost<THost>,
> {
  /**
   * Record of every lookup performed during this resolve. Engine-internal
   * for now; will be surfaced to the devserver/editor later.
   */
  public readonly lookups: DependencyLookupRecord[] = [];

  constructor(
    protected readonly _host: THost,
    protected readonly _requester: Component<THost>,
    protected readonly _requesterKey: string,
  ) {}

  /**
   * Walks the host's components, returning every instance of `type`
   * except the requesting component itself. Self-matching would be
   * surprising — `requireSibling(MyType)` returning the caller is almost
   * never what users want.
   */
  protected _findSiblingMatches<T>(
    host: AbstractComponentHost<never>,
    type: DependencyComponentConstructor<T>,
    excludeSelf: boolean,
  ): { keys: string[]; instances: T[] } {
    const keys: string[] = [];
    const instances: T[] = [];

    for (const [key, component] of (
      host as unknown as { components: Map<string, unknown> }
    ).components) {
      if (excludeSelf && component === this._requester) {
        continue;
      }

      if (component instanceof type) {
        keys.push(key);
        instances.push(component);
      }
    }

    return { keys, instances };
  }

  /**
   * Shared required-lookup implementation. Builds rich error context so
   * the user sees which component asked for what and where.
   */
  protected _resolveRequired<T>(
    scope: 'sibling' | 'world',
    lookupHost: AbstractComponentHost<never>,
    type: DependencyComponentConstructor<T>,
  ): T {
    const excludeSelf = scope === 'sibling';
    const { keys, instances } = this._findSiblingMatches(
      lookupHost,
      type,
      excludeSelf,
    );

    if (instances.length === 0) {
      this.lookups.push({
        scope,
        mode: 'required',
        type: type as DependencyComponentConstructor<unknown>,
        resolved: null,
      });

      throwEngineError(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING,
        this._formatMissingMessage(scope, type),
        {
          requesterKey: this._requesterKey,
          requesterType: this._requester.constructor.name,
          requiredType: type.name,
          scope,
          host: this._host,
        },
      );
    }

    if (instances.length > 1) {
      this.lookups.push({
        scope,
        mode: 'required',
        type: type as DependencyComponentConstructor<unknown>,
        resolved: null,
      });

      throwEngineError(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS,
        this._formatAmbiguousMessage(scope, type, keys),
        {
          requesterKey: this._requesterKey,
          requesterType: this._requester.constructor.name,
          requiredType: type.name,
          scope,
          matchedKeys: keys,
          host: this._host,
        },
      );
    }

    const resolved = instances[0] as T;
    this.lookups.push({
      scope,
      mode: 'required',
      type: type as DependencyComponentConstructor<unknown>,
      resolved,
    });

    return resolved;
  }

  /**
   * Shared optional-lookup implementation. Returns `null` for both miss
   * and ambiguity, mirroring {@link AbstractComponentHost.getNullableComponentByType}.
   */
  protected _resolveOptional<T>(
    scope: 'sibling' | 'world',
    lookupHost: AbstractComponentHost<never>,
    type: DependencyComponentConstructor<T>,
  ): T | null {
    const excludeSelf = scope === 'sibling';
    const { instances } = this._findSiblingMatches(
      lookupHost,
      type,
      excludeSelf,
    );

    const resolved = instances.length === 1 ? (instances[0] as T) : null;

    this.lookups.push({
      scope,
      mode: 'optional',
      type: type as DependencyComponentConstructor<unknown>,
      resolved,
    });

    return resolved;
  }

  private _formatMissingMessage(
    scope: 'sibling' | 'world',
    type: DependencyComponentConstructor<unknown>,
  ): string {
    const requesterType = this._requester.constructor.name;
    const where = scope === 'sibling' ? 'sibling on the same host' : 'World';

    return (
      `${requesterType} (registered as "${this._requesterKey}") requires a ` +
      `${type.name} as a ${where}, but none was found. Register a ${type.name} ` +
      `on the ${
        scope === 'sibling' ? 'host' : 'World'
      } before this component, or use the optional resolver method ` +
      `if the dependency is genuinely optional.`
    );
  }

  private _formatAmbiguousMessage(
    scope: 'sibling' | 'world',
    type: DependencyComponentConstructor<unknown>,
    matchedKeys: readonly string[],
  ): string {
    const requesterType = this._requester.constructor.name;
    const where = scope === 'sibling' ? 'on the host' : 'on the World';
    const keys = matchedKeys.map((k) => `"${k}"`).join(', ');

    return (
      `${requesterType} (registered as "${this._requesterKey}") requires a ` +
      `single ${type.name} ${where}, but ${matchedKeys.length} matched ` +
      `(${keys}). Either register only one ${type.name}, or look it up by ` +
      `key inside an explicit lifecycle hook rather than as a dependency.`
    );
  }
}
