<h1 align="center">
  IWG
</h1>

<p align="center">
<img src="https://divine-star-software.github.io/DigitalAssets/images/logo-small.png">
</p>

---

IWG is the offical infinite world generation plug-in for Divine Voxel Engine.

```ts
import { IWG } from "dve-plugins-iwg/World";
import { SimulationLoop } from "simloop";
const generator = new IWG({
  positionWatch: position,
  renderDistance: 100,
  generateDistance: 200,
});

SimulationLoop.registerInterval(0);
SimulationLoop.addToInterval(0, () => {
  WorldPlayer.update();
  position[0] = PlayerManager.physics.position.x;
  position[1] = PlayerManager.physics.position.y;
  position[2] = PlayerManager.physics.position.z;
  generator.searchUpdate();
});

SimulationLoop.registerInterval(100);
SimulationLoop.addToInterval(100, () => {
  UpdateManager.update();
  generator.tasksUpdate();
});

SimulationLoop.registerInterval(10_000);
SimulationLoop.addToInterval(10_000, () => {
  generator.saveUpdate();
});
SimulationLoop.run();
````