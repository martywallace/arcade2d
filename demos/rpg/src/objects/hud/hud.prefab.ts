import { Prefab } from '@arcade2d/engine';
import { HudController } from './hud.controller.component';

/**
 * The heads-up display: a player HP bar and kill count, kept pinned to the
 * canvas's top-left corner. The root is a bare anchor; the
 * {@link HudController} both follows the camera and builds the bar and label as
 * child objects. Spawn it last so it parents above the gameplay in the scene
 * graph and draws on top.
 */
export const HudPrefab = new Prefab({
  name: 'hud',
  tags: ['hud'],
  components: {
    controller: ({ object }) => new HudController(object),
  },
});
