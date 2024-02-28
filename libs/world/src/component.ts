import { WorldObject } from './world-object';
import { Update } from './update';

/**
 * Component that is attached to a `WorldObject`. Components are used to add
 * functionality to objects in a world in a composable way.
 */
export abstract class Component {
  constructor(protected readonly object: WorldObject) {}

  /**
   * Lifecycle hook that is called when the component is added to the parent
   * object. Should not be called directly.
   */
  public abstract onAdded(): void;

  /**
   * Lifecycle hook that is called when the parent object is updated. Should not
   * be called directly.
   *
   * @param update The `Update` instance containing metadata about the world
   * update that triggered this component to update.
   */
  public abstract onUpdate(update: Update): void;

  /**
   * Lifecycle hook that is called when the parent object is destroyed. Should
   * not be called directly.
   */
  public abstract onDestroyed(): void;
}
