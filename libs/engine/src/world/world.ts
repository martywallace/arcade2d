import { AbstractComponentHost, Component } from '../components';
import { Point } from '../geometry';
import { IDGenerator } from '../utils/id-generator';
import { Prefab } from './prefab';
import { Update } from './update';
import { WorldObject } from './world-object';

export type WorldOptions = {
  readonly components: (world: World) => Record<string, () => Component<World>>;
};

export class World extends AbstractComponentHost<World> {
  private _lastUpdate = 0;
  private _objects: WorldObject[] = [];

  private readonly _mappedObjects: Map<string, WorldObject> = new Map();
  private readonly _idGenerator = new IDGenerator();

  constructor(options: WorldOptions) {
    super();

    this.addComponentsFromFactories(options.components(this));
  }

  /**
   * Creates a new world object from a target prefab.
   *
   * @param prefab The prefab to create an object from.
   * @param position The starting position of the new object in the world.
   */
  public createFromPrefab(
    prefab: Prefab,
    position = Point.zero(),
  ): WorldObject {
    const object = prefab.buildObject(this, position);

    return this.add(object);
  }

  /**
   * Creates a new empty world object. Useful for creating one-off objects that
   * don't necessarily need to be based on a prefab definition.
   *
   * @param position The starting position of the new object in the world.
   * @param tags The tags to assign to the new object.
   */
  public createEmpty(
    position = Point.zero(),
    tags?: readonly string[],
  ): WorldObject {
    const object = new WorldObject(this, position, {
      id: this._idGenerator.next(),
      tags: new Set(tags ?? []),
    });

    return this.add(object);
  }

  protected add(object: WorldObject): WorldObject {
    this._objects.push(object);
    this._mappedObjects.set(object.metadata.id, object);

    return object;
  }

  public update(): Update {
    const update = new Update(this._lastUpdate, Date.now());

    // Update all components.
    for (const [_, component] of this.components) {
      component.onUpdate(update);
    }

    // Update all objects.
    for (const object of this._objects) {
      object.onUpdate(update);
    }

    const destroyedObjects = new Map<string, WorldObject>();

    for (const object of this._objects) {
      if (object.destroyed) {
        object.onDestroy();
        destroyedObjects.set(object.metadata.id, object);
      }
    }

    if (destroyedObjects.size > 0) {
      // Remove deleted ones.
      this._objects = this._objects.filter(
        (object) => !destroyedObjects.has(object.metadata.id),
      );

      for (const id of destroyedObjects.keys()) {
        this._mappedObjects.delete(id);
      }
    }

    // Update internal state.
    this._lastUpdate = Date.now();

    return update;
  }

  /**
   * Immediately destroys the world, all of its objects and any included
   * components.
   */
  public destroy(): void {
    for (const object of this._objects) {
      object.onDestroy();
    }

    this.removeAllComponents();

    this._objects = [];
    this._mappedObjects.clear();
  }

  /**
   * Finds an object in the world using its ID.
   *
   * @param id The ID of the object to find.
   *
   * @returns The object with the given ID, or `null` if it does not exist.
   */
  public findById(id: string): WorldObject | null {
    return this._mappedObjects.get(id) ?? null;
  }

  /**
   * Finds all objects in the world with the given tag.
   *
   * @param tag The tag to find objects by.
   *
   * @returns An array of objects with the given tag.
   */
  public findByTag(tag: string): readonly WorldObject[] {
    return this._objects.filter((object) => object.metadata.tags.has(tag));
  }

  /**
   * Finds a single object in the world with the given tag.
   *
   * @param tag The tag to find an object by.
   *
   * @returns The first object with the given tag, or `null` if no object is
   * found.
   */
  public findOneByTag(tag: string): WorldObject | null {
    return (
      this._objects.find((object) => object.metadata.tags.has(tag)) ?? null
    );
  }

  protected getHostReference(): World {
    return this;
  }
}
