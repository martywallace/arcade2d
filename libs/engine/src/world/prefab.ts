import { ComponentFactoryMap } from '../components';
import { Point } from '../geometry';
import { IDGenerator } from '../utils/id-generator';
import { World } from './world';
import { WorldObject } from './world-object';

export type PrefabComponentContext = {
  /**
   * The `World` that the object is being created in.
   */
  readonly world: World;

  /**
   * The `WorldObject` that is being created from this prefab.
   */
  readonly object: WorldObject;
};

export type PrefabOptions = {
  readonly name: string;
  readonly tags?: readonly string[];
  readonly components: (
    context: PrefabComponentContext,
  ) => ComponentFactoryMap<WorldObject>;
};

/**
 * Defines a prefab that can be used to create new objects in the world. Defines
 * the starting components that will be added to the object.
 */
export class Prefab {
  private readonly _idGenerator: IDGenerator;

  constructor(private readonly options: PrefabOptions) {
    this._idGenerator = new IDGenerator(
      options.name + (Math.random() + 1).toString(36).substring(2, 5),
    );
  }

  /**
   * Builds a new object from this prefab.
   *
   * @param world The world that the object will be added to.
   * @param position The starting position of the new object in the world.
   */
  public buildObject(world: World, position = Point.zero()): WorldObject {
    const object = new WorldObject(world, position, {
      id: this._idGenerator.next(),
      prefabName: this.options.name,
      tags: new Set(this.options.tags ?? []),
    });

    object.addComponentsFromFactories(
      this.options.components({ world, object }),
    );

    return object;
  }
}
