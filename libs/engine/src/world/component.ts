import { Update } from './update';

export interface Component<T> {
  readonly owner: T;

  /**
   * Lifecycle hook that is called when the component is added to the parent
   * object. Should not be called directly.
   */
  onAdded(): void;

  /**
   * Lifecycle hook that is called when the parent object is updated. Should not
   * be called directly.
   *
   * @param update The `Update` instance containing metadata about the world
   * update that triggered this component to update.
   */
  onUpdate(update: Update): void;

  /**
   * Lifecycle hook that is called when the parent object is destroyed. Should
   * not be called directly.
   */
  onDestroy(): void;
}
