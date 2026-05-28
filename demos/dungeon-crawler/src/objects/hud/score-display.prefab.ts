import { FontAsset, Prefab, Text } from '@arcade2d/engine';
import { ui } from '../../assets';
import { ScoreDisplayController } from './score-display.controller.component';

export const ScoreDisplayPrefab = new Prefab({
  name: 'score-display',
  tags: ['hud'],
  components: {
    // Order matters here: the controller's onUpdate reads the sibling Text via
    // getComponentByType, so the Text must be added to the object too. The
    // controller is listed first because the camera sync should land on the
    // host before the per-frame transform sync in AbstractGraphics copies it
    // into the underlying display.
    controller: ({ object }) => new ScoreDisplayController(object),
    text: ({ assets, object }) => {
      const font = assets.use(ui).getAs('pressStart2P', FontAsset);
      return new Text(object, 'Score 0', {
        fontFamily: font,
        fontSize: 16,
        fill: 0xffffff,
        anchor: 0,
      });
    },
  },
});
