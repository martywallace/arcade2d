import { Graphics as PixiGraphics } from 'pixi.js';
import { Scene } from '../graphics';
import {
  AbstractWorldComponent,
  World,
  WorldDependencyResolver,
  WorldUpdate,
} from '../world';
import { PhysicsWorld } from './physics-world';
import {
  DEBUG_OVERLAY_Z_INDEX,
  DEFAULT_DEBUG_LINE_WIDTH,
} from './physics-debug-renderer.constants';
import type { PhysicsDebugRendererOptions } from './physics-debug-renderer.types';

/**
 * The resolved dependencies of a {@link PhysicsDebugRenderer}: the world's
 * {@link Scene} (where the overlay is mounted) and its {@link PhysicsWorld}
 * (the simulation the outlines are read from), both located as world-tier
 * siblings.
 */
type PhysicsDebugRendererDeps = {
  readonly scene: Scene;
  readonly physics: PhysicsWorld;
};

/**
 * A world-scoped debugging overlay that draws the outline of every collider in
 * the {@link PhysicsWorld} on top of the scene. It exists to answer the
 * question that comes up constantly when wiring up physics — *"where does the
 * engine actually think this body is?"* — by making the otherwise-invisible
 * simulation geometry visible, so a collider that's the wrong size, offset from
 * its sprite, or rotated unexpectedly is obvious at a glance instead of
 * something you infer from misbehaviour.
 *
 * ## On/off at startup, not toggleable
 *
 * The renderer is **opt-in by registration**: add it to a world's component
 * factory and the overlay is on; leave it out and there is zero cost. There is
 * deliberately no runtime toggle — wire it in (or behind your own build flag)
 * when you want it. Like {@link PhysicsWorld}, it is never auto-attached.
 *
 * ## How it draws
 *
 * Each frame, in post-update — after {@link PhysicsWorld} has stepped the
 * simulation in pre-update, so every body's transform is settled — the renderer
 * asks Rapier for a fresh set of debug line segments (its built-in
 * `debugRender`, the same data Rapier's own debuggers use) and strokes them
 * into a single Pixi `Graphics` overlay. The overlay is a child of the
 * {@link Scene}, so it inherits the camera transform and the outlines stay
 * locked to the bodies as the camera pans, zooms, and rotates. It is given a
 * very high `zIndex` (and turns on the scene container's child sorting) so the
 * outlines sit above the *filled* body graphics they trace — including bodies
 * spawned at runtime after this component was added.
 *
 * By default the segments are tinted with Rapier's own per-collider colours,
 * which distinguish awake from sleeping bodies and sensors from solid
 * colliders. Pass {@link PhysicsDebugRendererOptions.color} to override them
 * with a single flat colour (and take the cheaper single-stroke draw path).
 *
 * @example
 * ```ts
 * import {
 *   Game, initPhysics, PhysicsWorld, PhysicsDebugRenderer,
 * } from '@arcade2d/engine';
 *
 * const game = await Game.bootstrap({ canvas: { fill: 'window' } });
 * await initPhysics();
 *
 * const DEBUG_PHYSICS = true; // flip per build/environment
 *
 * const world = game.createWorld({
 *   components: (world) => ({
 *     physics: () => new PhysicsWorld(world, { gravity: { x: 0, y: 980 } }),
 *     // Registering the component is the on switch; omit it and there's no cost.
 *     ...(DEBUG_PHYSICS
 *       ? { physicsDebug: () => new PhysicsDebugRenderer(world) }
 *       : {}),
 *   }),
 * });
 * ```
 *
 * @see {@link PhysicsWorld} — the simulation whose colliders are traced.
 * @see {@link RigidBody} — the per-object component that registers those colliders.
 */
export class PhysicsDebugRenderer extends AbstractWorldComponent<PhysicsDebugRendererDeps> {
  private readonly _display: PixiGraphics;
  private readonly _lineWidth: number;
  private readonly _color: number | undefined;

  // Captured in onAdded so onDestroy can detach the overlay without
  // re-resolving the dependency (mirrors RigidBody capturing its PhysicsWorld).
  private _scene: Scene | null = null;

  /**
   * @param host The {@link World} whose physics simulation to visualise.
   * @param options Optional appearance tweaks — line width and a flat colour
   * override. See {@link PhysicsDebugRendererOptions}.
   */
  constructor(host: World, options: PhysicsDebugRendererOptions = {}) {
    super(host);

    this._display = new PixiGraphics();
    this._display.zIndex = DEBUG_OVERLAY_Z_INDEX;
    this._lineWidth = options.lineWidth ?? DEFAULT_DEBUG_LINE_WIDTH;
    this._color = options.color;
  }

  /**
   * Declares the world-tier dependencies on the {@link Scene} and the
   * {@link PhysicsWorld}.
   *
   * @param resolver The world-tier dependency resolver.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING} when the world has
   *   no {@link PhysicsWorld} to read colliders from. (The {@link Scene} is
   *   auto-attached, so only the physics dependency is realistically absent.)
   */
  public resolveDependencies(
    resolver: WorldDependencyResolver,
  ): PhysicsDebugRendererDeps {
    return {
      scene: resolver.requireSibling(Scene),
      physics: resolver.requireSibling(PhysicsWorld),
    };
  }

  /**
   * Direct access to the underlying Pixi `Graphics` overlay.
   *
   * **Use with care.** `raw` is an intentional escape hatch — for tuning the
   * overlay's blend mode, alpha, or filters beyond what this component models.
   * Code that touches `raw` is coupled to Pixi's public API; prefer
   * {@link PhysicsDebugRendererOptions} where it covers your need.
   */
  public get raw(): PixiGraphics {
    return this._display;
  }

  /**
   * Mounts the overlay into the scene and enables child sorting on the scene
   * container so the high-`zIndex` overlay reliably draws above the bodies it
   * traces.
   */
  public override onAdded({ scene }: PhysicsDebugRendererDeps): void {
    this._scene = scene;
    // Without sorting, Pixi falls back to insertion order and a body spawned
    // after this renderer would draw over the outlines. Opt the container into
    // zIndex sorting once so the overlay's index is honoured.
    scene.raw.sortableChildren = true;
    scene.addChild(this._display);
  }

  /**
   * Redraws every collider outline for the current, settled simulation state.
   * Runs in post-update so {@link PhysicsWorld}'s pre-update step has already
   * advanced the bodies this frame.
   */
  public onPostUpdate(
    _update: WorldUpdate,
    { physics }: PhysicsDebugRendererDeps,
  ): void {
    const { vertices, colors } = physics.raw.debugRender();

    this._display.clear();

    // A flat-colour override lets us build one path and stroke it once instead
    // of paying a stroke per segment for Rapier's per-collider colours.
    if (this._color !== undefined) {
      for (let i = 0; i + 3 < vertices.length; i += 4) {
        this._display
          .moveTo(vertices[i]!, vertices[i + 1]!)
          .lineTo(vertices[i + 2]!, vertices[i + 3]!);
      }

      this._display.stroke({ width: this._lineWidth, color: this._color });

      return;
    }

    // Each segment is four floats (two points); each point carries four colour
    // floats (RGBA, 0–1), so the colour for segment `s` starts at `s * 8`.
    for (let v = 0, c = 0; v + 3 < vertices.length; v += 4, c += 8) {
      const r = Math.round(colors[c]! * 255);
      const g = Math.round(colors[c + 1]! * 255);
      const b = Math.round(colors[c + 2]! * 255);
      const alpha = colors[c + 3]!;

      this._display
        .moveTo(vertices[v]!, vertices[v + 1]!)
        .lineTo(vertices[v + 2]!, vertices[v + 3]!)
        .stroke({
          width: this._lineWidth,
          color: (r << 16) | (g << 8) | b,
          alpha,
        });
    }
  }

  /**
   * Detaches and frees the overlay. Safe to call even if `onAdded` never ran.
   */
  public override onDestroy(): void {
    if (this._scene) {
      this._scene.removeChild(this._display);
    }

    this._display.destroy();
    this._scene = null;
  }
}
