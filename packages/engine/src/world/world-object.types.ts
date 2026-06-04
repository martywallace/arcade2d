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

/**
 * Options controlling how {@link WorldObject.setParent} re-homes an object
 * within the transform hierarchy.
 */
export type SetParentOptions = {
  /**
   * Whether the object should stay visually put when its parent changes.
   *
   * - `true` (the default) — the object's **world** transform is preserved.
   *   Its local position/rotation/scale are recomputed relative to the new
   *   parent so it does not appear to move, the way dragging a node between
   *   folders in an editor leaves it on screen where it was. Because the
   *   recomputed local transform is derived by {@link Matrix.decompose}, a
   *   new parent carrying shear (rotation plus non-uniform scale) can only be
   *   compensated for approximately.
   * - `false` — the object keeps its existing local position/rotation/scale
   *   and is simply reinterpreted relative to the new parent, so it snaps to
   *   wherever those local values now place it. Cheaper, and what you want
   *   when you are about to set the local transform yourself anyway.
   */
  readonly keepWorldTransform?: boolean;
};
