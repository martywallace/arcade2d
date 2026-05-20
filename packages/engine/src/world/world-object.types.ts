/**
 * Metadata describing a {@link WorldObject}'s relationship with the world it
 * belongs to. Constructed by the engine during spawn (either through a
 * {@link Prefab} or {@link World.createEmpty}) and held read-only on the
 * object thereafter; users never construct this directly.
 */
export type WorldObjectMetadata = {
  /**
   * A globally unique identified assigned to this object. Factors in the
   * prefab the object was created from.
   */
  readonly id: string;

  /**
   * A set of tags to assign to the object.
   */
  readonly tags: Set<string>;

  /**
   * The name of the prefab that was used to create this object. Undefined
   * indicates the object was not created from a prefab.
   */
  readonly prefabName?: string;
};
