# Arcade2D World

This library helps create and simulate a game world.

## Examples

```typescript
import { Point } from '@arcade2d/geometry';
import { World, Prefab } from '@arcade2d/world';

// Setup the world.
const world = new World();

// Define a prefab for a new type of object.
const playerPrefab = new Prefab({
  name: 'player',
  components: (world, object) => ({
    graphics: new GraphicsComponent(object),
    physics: new PhysicsComponent(object),
  })
});

// Create a new object in the world from the above prefab.
const player = world.create(playerPrefab, new Point(10, 40));

// Update the world.
world.update();

// Mark the object for removal.
player.destroy();

// Next update will remove the object.
world.update();
```