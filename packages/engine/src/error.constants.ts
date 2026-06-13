/**
 * Stable string codes attached to every {@link EngineError} thrown by the
 * engine. Codes are part of the public contract — user code is expected to
 * branch on them when handling engine failures — so renumbering or removing
 * a code is a breaking change.
 *
 * Each value is prefixed with a short domain tag (`COMP`, `PREFAB`, `DEP`,
 * `GAME`, `WORLD`, `ASSET`, `RAND`, `GFX`, `AUDIO`, `PHYS`, `GRID`) followed by
 * a zero-padded
 * sequence number, so codes sort by domain and the wire format is stable
 * across catalog growth.
 */
export enum ErrorCode {
  /**
   * A component lookup by key found nothing. Thrown by the strict
   * `getComponent` accessors on a component host when the key is absent;
   * the nullable accessors return `null` instead. Context: `{ key }`.
   */
  COMPONENT_NOT_FOUND = 'COMP001_COMPONENT_NOT_FOUND',
  /**
   * A component was added under a key already in use, without replacement
   * being permitted. Context: `{ key }`.
   */
  COMPONENT_ALREADY_EXISTS = 'COMP002_COMPONENT_ALREADY_EXISTS',
  /**
   * A lookup by type matched more than one registered component, so the
   * engine can't pick one unambiguously. Look it up by key instead, use
   * `getComponentsByType` to retrieve them all, or register only one
   * component of the type. Context: `{ type }`.
   */
  COMPONENT_AMBIGUOUS_TYPE = 'COMP003_COMPONENT_AMBIGUOUS_TYPE',
  /**
   * A prefab name failed validation (empty, or otherwise malformed) at
   * registration time. Context: `{ name }`.
   */
  PREFAB_INVALID_NAME = 'PREFAB001_PREFAB_INVALID_NAME',
  /**
   * A prefab was registered under a name already taken in the registry.
   * Context: `{ name }`.
   */
  PREFAB_ALREADY_REGISTERED = 'PREFAB002_PREFAB_ALREADY_REGISTERED',
  /**
   * A prefab was requested by a name the registry doesn't know. Context:
   * `{ name }`.
   */
  PREFAB_NOT_FOUND = 'PREFAB003_PREFAB_NOT_FOUND',
  /**
   * A prefab operation needed a {@link PrefabRegistry} but none was attached
   * to the world.
   */
  PREFAB_REGISTRY_NOT_ATTACHED = 'PREFAB004_PREFAB_REGISTRY_NOT_ATTACHED',
  /**
   * `Prefab.buildObject` was called without the internal build token —
   * i.e. not via `World.createFromPrefab`/`createFromPrefabName`. The token
   * gates the build path so objects are always registered with the world.
   */
  PREFAB_BUILD_UNAUTHORIZED = 'PREFAB005_PREFAB_BUILD_UNAUTHORIZED',
  /**
   * A component's `resolveDependencies` required a sibling or world-tier
   * component that isn't registered. Context: identifies the requesting
   * component and the missing dependency.
   */
  WORLD_COMPONENT_DEPENDENCY_MISSING = 'DEP001_WORLD_COMPONENT_DEPENDENCY_MISSING',
  /**
   * A dependency lookup by type matched more than one candidate, so the
   * resolver can't bind it unambiguously.
   */
  WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS = 'DEP002_WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS',
  /**
   * A component's `resolveDependencies` re-entered dependency resolution
   * (e.g. by adding components mid-resolve), which would corrupt the
   * resolving state.
   */
  WORLD_COMPONENT_DEPENDENCY_REENTRANT = 'DEP003_WORLD_COMPONENT_DEPENDENCY_REENTRANT',
  /**
   * {@link Game.createWorld} was called while the game already has an active
   * world. Destroy the existing world first if you mean to replace it.
   * Context: `{ game }`.
   */
  GAME_WORLD_ALREADY_EXISTS = 'GAME001_GAME_WORLD_ALREADY_EXISTS',
  /**
   * A world operation (e.g. {@link Game.destroyWorld}) was attempted while
   * the {@link Game} has no active world. Context: `{ game }`.
   */
  GAME_WORLD_NOT_FOUND = 'GAME002_GAME_WORLD_NOT_FOUND',
  /**
   * An object was added to a {@link World} under an id already held by
   * another object. Object ids must be unique within a world so
   * {@link World.findById} resolves unambiguously. Context: `{ id }`.
   */
  WORLD_OBJECT_ID_CONFLICT = 'WORLD001_WORLD_OBJECT_ID_CONFLICT',
  /**
   * {@link WorldObject.setParent} was given a prospective parent that belongs
   * to a different {@link World}. The transform hierarchy is scoped to a
   * single world — a parent and child must share one. Context:
   * `{ child, parent }`.
   */
  WORLD_OBJECT_PARENT_FOREIGN = 'WORLD002_WORLD_OBJECT_PARENT_FOREIGN',
  /**
   * {@link WorldObject.setParent} would have created a cycle — the
   * prospective parent is the object itself or one of its descendants.
   * Parenting must form a tree, so a node can never be nested beneath its
   * own subtree. Context: `{ child, parent }`.
   */
  WORLD_OBJECT_HIERARCHY_CYCLE = 'WORLD003_WORLD_OBJECT_HIERARCHY_CYCLE',
  /**
   * An asset was requested by a key that isn't loaded in the
   * {@link AssetLibrary}.
   */
  ASSET_NOT_FOUND = 'ASSET001_ASSET_NOT_FOUND',
  /**
   * An asset failed to load — the underlying loader (PIXI, fetch/decode)
   * rejected. The original failure is attached as `cause`. Context:
   * `{ path, key, namespace, cause }`.
   */
  ASSET_LOAD_FAILED = 'ASSET002_ASSET_LOAD_FAILED',
  /**
   * An asset was retrieved via `getAs` with a type that doesn't match the
   * stored asset, or a load couldn't resolve the asset's type.
   */
  ASSET_TYPE_MISMATCH = 'ASSET003_ASSET_TYPE_MISMATCH',
  /**
   * An asset was stored under a `(namespace, key)` already holding a
   * different asset.
   */
  ASSET_KEY_CONFLICT = 'ASSET004_ASSET_KEY_CONFLICT',
  /**
   * A weighted/uniform random pick was asked to choose from an empty
   * collection. Context: identifies the calling method.
   */
  RANDOM_EMPTY_ITEMS = 'RAND001_RANDOM_EMPTY_ITEMS',
  /**
   * An {@link AnimatedSprite} was constructed with an empty `frames` array —
   * an animation with no frames has nothing to draw.
   */
  ANIMATED_SPRITE_EMPTY_FRAMES = 'GFX001_ANIMATED_SPRITE_EMPTY_FRAMES',
  /**
   * An {@link AnimatedSprite} was given a non-positive, non-finite, or `NaN`
   * `fps`. Frame duration is `1000 / fps`, so a zero/negative/`NaN` rate
   * yields an animation that never advances or spins without bound. Context:
   * `{ fps }`.
   */
  ANIMATED_SPRITE_INVALID_FPS = 'GFX002_ANIMATED_SPRITE_INVALID_FPS',
  /**
   * {@link defineLayers} (or the {@link LayerSet} constructor) was called with
   * no layer names — a layer set must declare at least one layer.
   */
  LAYER_SET_EMPTY = 'GFX003_LAYER_SET_EMPTY',
  /**
   * {@link defineLayers} was given the same layer name twice. Layer names are
   * the lookup key, so they must be unique within a set. Context: `{ name }`.
   */
  LAYER_DUPLICATE_NAME = 'GFX004_LAYER_DUPLICATE_NAME',
  /**
   * A layer was looked up that the set doesn't contain: {@link LayerSet.get}
   * with an unknown name, or {@link Scene.containerForLayer} / the
   * {@link AbstractGraphics.layer} setter with a {@link Layer} token minted by
   * a *different* {@link LayerSet}. Context: `{ name }`.
   */
  LAYER_NOT_IN_SET = 'GFX005_LAYER_NOT_IN_SET',
  /**
   * A graphics component was added to a world whose {@link Scene} has a
   * {@link LayerSet}, but the component named no {@link GraphicsOptions.layer}.
   * In a layered world every graphic must choose a layer — there is no implicit
   * default. Context identifies the host.
   */
  LAYER_UNSPECIFIED = 'GFX006_LAYER_UNSPECIFIED',
  /**
   * A graphics component named a {@link GraphicsOptions.layer}, but its world's
   * {@link Scene} has no {@link LayerSet} — most often a forgotten `layers:` on
   * the {@link Game.createWorld} call. Context identifies the host.
   */
  LAYER_SET_ABSENT = 'GFX007_LAYER_SET_ABSENT',
  /**
   * An audio operation was attempted while the {@link AudioEngine} is in
   * headless mode (no `AudioContext` — e.g. a test or server environment).
   */
  AUDIO_UNAVAILABLE = 'AUDIO001_AUDIO_UNAVAILABLE',
  /**
   * Playback was requested on something with no audio source to play.
   */
  AUDIO_NO_SOURCE = 'AUDIO002_AUDIO_NO_SOURCE',
  /**
   * An audio file failed to load — the `fetch` resolved with a non-OK HTTP
   * status. Context: `{ path, status, statusText }`.
   */
  AUDIO_LOAD_FAILED = 'AUDIO003_AUDIO_LOAD_FAILED',
  /**
   * A physics operation was attempted before {@link initPhysics} completed —
   * Rapier's WebAssembly module hasn't been initialised yet.
   */
  PHYSICS_NOT_INITIALISED = 'PHYS001_PHYSICS_NOT_INITIALISED',
  /**
   * A collider was described with a shape the physics layer can't translate
   * into a Rapier collider (e.g. a degenerate or unsupported shape).
   */
  PHYSICS_INVALID_SHAPE = 'PHYS002_PHYSICS_INVALID_SHAPE',
  /**
   * A {@link RigidBody} was constructed with no colliders — a body needs at
   * least one collider to participate in the simulation.
   */
  PHYSICS_NO_COLLIDER = 'PHYS003_PHYSICS_NO_COLLIDER',
  /**
   * A {@link RigidBody} operation needed the body to be attached to a
   * {@link PhysicsWorld}, but it wasn't (yet, or any longer).
   */
  PHYSICS_BODY_NOT_ATTACHED = 'PHYS004_PHYSICS_BODY_NOT_ATTACHED',
  /**
   * A {@link Grid} was constructed with a `width` or `height` that isn't a
   * positive integer. A grid's dimensions are its fixed cell counts, so a
   * fractional, zero, or negative size has no meaning. Context:
   * `{ width, height }`.
   */
  GRID_INVALID_SIZE = 'GRID001_GRID_INVALID_SIZE',
  /**
   * A write was attempted to a {@link Cell}'s `x` or `y` coordinate — directly
   * (`cell.x = …`) or via an inherited {@link Point} mutator (`add`, `scale`,
   * `forward`, …). A cell's coordinate is its identity within the
   * {@link Grid} index and is immutable; mutating it would desynchronise
   * lookups. Call {@link Point.clone} to obtain a detached, mutable point for
   * vector math. Context: `{ cell, axis }`.
   */
  GRID_CELL_IMMUTABLE = 'GRID002_GRID_CELL_IMMUTABLE',
}
