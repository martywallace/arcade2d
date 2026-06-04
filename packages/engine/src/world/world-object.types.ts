/**
 * Metadata describing a {@link WorldObject}'s relationship with the world it
 * belongs to. Constructed by the engine during spawn (either through a
 * {@link Prefab} or {@link World.createEmpty}) and held read-only on the
 * object thereafter; users never construct this directly.
 */
export type WorldObjectMetadata = {
  /**
   * The object's identifier, unique within its {@link World} (the world
   * rejects a duplicate at add time). Objects built from a {@link Prefab}
   * carry an id derived from the prefab name; {@link World.createEmpty}
   * objects get a bare sequential id.
   */
  readonly id: string;

  /**
   * The tags assigned to this object, used by {@link World.findByTag} /
   * {@link World.findOneByTag}. Exposed as a `ReadonlySet`: tags are
   * fixed at spawn time, so mutating this set after construction is not
   * supported and would desync any tag-based lookups.
   */
  readonly tags: ReadonlySet<string>;

  /**
   * The name of the prefab that was used to create this object. Undefined
   * indicates the object was not created from a prefab.
   */
  readonly prefabName?: string;
};
