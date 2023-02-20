import type { IWGData } from "./Types/IWG.types.js";
import type { Vec3Array } from "divine-voxel-engine/Math";
import { ColumnDataTool } from "divine-voxel-engine/Tools/Data/WorldData/ColumnDataTool.js";
import { $2dMooreNeighborhood } from "divine-voxel-engine/Data/Constants/Util/CardinalNeighbors.js";
import { BuilderTool } from "divine-voxel-engine/Tools/Build/BuilderTool.js";
import { TaskTool } from "divine-voxel-engine/Tools/Tasks/TasksTool.js";
import { Distance3D } from "divine-voxel-engine/Math/Functions/Distance3d.js";
import { WorldSpaces } from "divine-voxel-engine/Data/World/WorldSpaces.js";
import { DataLoaderTool } from "divine-voxel-engine/Tools/Data/DataLoaderTool.js";
import { AnaylzerTool } from "divine-voxel-engine/Tools/Anaylzer/AnaylzerTool.js";
import { VisitedMap } from "divine-voxel-engine/Global/Util/VisistedMap.js";
import { Vec3ArrayDistanceSort } from "divine-voxel-engine/Math/Functions/DistnaceSort.js";
const getKey = (x: number, y: number, z: number) => {
 return WorldSpaces.column.getKeyXYZ(x, y, z);
};
class IWGTasks {
 queue: [x: number, y: number, z: number][] = [];
 map = new VisitedMap();
 waitingFor = 0;
 constructor(
  public tasksId: string,
  public run: (x: number, y: number, z: number, onDone: Function) => void,
  public iwg: IWG,
  public propagationBlocking = true
 ) {}

 add(x: number, y: number, z: number) {
  if (this.map.inMap(x, y, z)) return;
  this.queue.push([x, y, z]);
  this.map.add(x, y, z);
 }

 cancelAll() {
  this.queue = [];
  this.map.clear();
 }

 runTasks(max = 5) {
  if (this.waitingFor != 0) return;
  let i = max;
  Vec3ArrayDistanceSort(this.iwg._cachedPosition, this.queue);
  while (i--) {
   const node = this.queue.shift();
   if (!node) break;
   this.waitingFor++;
   const [x, y, z] = node;
   if (this.propagationBlocking) {
    this.iwg._inProgressMap.add(x, y, z, this.tasksId);
   }
   this.run(x, y, z, () => {
    this.map.remove(x, y, z);
    if (this.propagationBlocking) {
     this.iwg._inProgressMap.remove(x, y, z);
    }
    this.waitingFor--;
   });
  }
 }
}

const inProgressMap = {
 map: <Map<string, string>>new Map(),

 add(x: number, y: number, z: number, tasks: string) {
  this.map.set(getKey(x, y, z), tasks);
 },
 has(x: number, y: number, z: number) {
  return this.map.has(getKey(x, y, z));
 },
 remove(x: number, y: number, z: number) {
  return this.map.delete(getKey(x, y, z));
 },
};

/**# Infinite World Generator
 *
 */
export class IWG {
 _anaylzerDone = true;
 anaylzer = new AnaylzerTool();
 columnTool = new ColumnDataTool();
 nColumnTool = new ColumnDataTool();
 builder = new BuilderTool();
 dataLoader: DataLoaderTool;
 tasks = new TaskTool();
 dimension: string = "main";
 _cachedPosition: Vec3Array = [-Infinity, -Infinity, -Infinity];

 _inProgressMap = inProgressMap;
 _searchQueue: number[][] = [];

 _visitedMap: Map<string, boolean> = new Map();
 _activeColumns: Map<string, number[]> = new Map();

 _loadTaskss: IWGTasks;
 _generateTasks: IWGTasks;
 _worldSunTasks: IWGTasks;
 _propagationTasks: IWGTasks;
 _buildTasks: IWGTasks;
 _saveTasks: IWGTasks;
 _saveAndUnloadTasks: IWGTasks;

 constructor(public data: IWGData) {
  if (!data.maxDistance) data.maxDistance = data.generateDistance + 100;
  if (!data.anaylzerDistance) data.anaylzerDistance = data.renderDistance;
  if (!DataLoaderTool.isEnabled()) {
   throw new Error("Data Loader must be enabled.");
  }
  this.dataLoader = new DataLoaderTool();

  this._loadTaskss = new IWGTasks(
   "#dve_iwg_load",
   (x, y, z, onDone) => {
    this.dataLoader
     .setLocation([this.dimension, x, y, z])
     .loadIfExists((exists) => {
      onDone();
      if (!exists) {
       this.builder.setXYZ(x, y, z).fillColumn();
       return;
      }
     });
   },
   this
  );

  this._generateTasks = new IWGTasks(
   "#dve_iwg_generate",
   (x, y, z, onDone) => {
    this.builder.setDimension(this.dimension).setXYZ(x, y, z).fillColumn();
    this.tasks.generate.deferred.run(x, y, z, [], () => {
     onDone();
     if (this.columnTool.loadInAt(x, y, z))
      return this.columnTool.setTagValue("#dve_is_world_gen_done", 1);
     console.error(`${x} ${y} ${z} could not be loaded after generted`);
    });
   },
   this
  );

  this._worldSunTasks = new IWGTasks(
   "#dve_iwg_world_sun",
   (x, y, z, onDone) => {
    this.tasks.light.worldSun.deferred.run(x, y, z, () => {
     onDone();
     if (this.columnTool.loadInAt(x, y, z))
      return this.columnTool.setTagValue("#dve_is_world_sun_done", 1);
    });
   },
   this
  );

  this._propagationTasks = new IWGTasks(
   "#dve_iwg_propagation",
   (x, y, z, onDone) => {
    this.tasks.anaylzer.propagation.run(x, y, z, () => {
     onDone();
     if (this.columnTool.loadInAt(x, y, z))
      return this.columnTool.setTagValue("#dve_is_world_propagation_done", 1);
    });
   },
   this
  );

  this._buildTasks = new IWGTasks(
   "#dve_iwg_build",
   (x, y, z, onDone) => {
    this._activeColumns.set(getKey(x, y, z), [x, y, z]);
    this.builder
     .setDimension(this.dimension)
     .setXYZ(x, y, z)
     .buildColumn((data) => {
      onDone();
     });
   },
   this,
   false
  );

  this._saveTasks = new IWGTasks(
   "#dve_iwg_save",
   (x, y, z, onDone) => {
    this.dataLoader
     .setLocation([this.dimension, x, y, z])
     .saveColumnIfNotStored(() => {
      onDone();
     });
   },
   this,
   false
  );

  this._saveAndUnloadTasks = new IWGTasks(
   "#dve_iwg_save_unload",
   (x, y, z, onDone) => {
    onDone();
    this.dataLoader
     .setLocation([this.dimension, x, y, z])
     .unLoadColumn(() => {});
   },
   this,
   false
  );
 }

 setDimension(id: string) {
  this.dimension = id;
 }

 saveUpdate() {
  this.dataLoader
   .setDimension(this.dimension)
   .getAllUnStoredColumns((dimension, cx, cy, cz) => {
    const distance = Distance3D(
     this._cachedPosition[0],
     this._cachedPosition[1],
     this._cachedPosition[2],
     cx,
     cy,
     cz
    );
    if (distance <= this.data.maxDistance!) {
     this._saveTasks.add(cx, cy, cz);
    }
   });
 }

 _logTasks() {
  return `
loading | queue :${this._loadTaskss.queue.length} waitng : ${this._loadTaskss.waitingFor} map: ${this._loadTaskss.map.size}
generaete | queue :${this._generateTasks.queue.length} waitng : ${this._generateTasks.waitingFor} map: ${this._generateTasks.map.size}
worldSun | queue :${this._worldSunTasks.queue.length} waitng : ${this._worldSunTasks.waitingFor} map: ${this._worldSunTasks.map.size}
propagation | queue :${this._propagationTasks.queue.length} waitng : ${this._propagationTasks.waitingFor} map: ${this._propagationTasks.map.size}
build | queue :${this._buildTasks.queue.length} waitng : ${this._buildTasks.waitingFor} map: ${this._buildTasks.map.size}
save | queue :${this._saveTasks.queue.length} waitng : ${this._saveTasks.waitingFor} map: ${this._saveTasks.map.size}
save and unload | queue :${this._saveAndUnloadTasks.queue.length} waitng : ${this._saveAndUnloadTasks.waitingFor} map: ${this._saveAndUnloadTasks.map.size}
  `;
 }

 anaylzerUpdate() {
  if (!this._anaylzerDone) return;
  this._anaylzerDone = false;
  this.anaylzer.runUpdate(this.data.anaylzerDistance!, () => {
   this._anaylzerDone = true;
  });
 }

 tasksUpdate() {
  this._loadTaskss.runTasks();
  this._generateTasks.runTasks();
  this._worldSunTasks.runTasks();
  this._propagationTasks.runTasks();
  this._buildTasks.runTasks();
  this._saveTasks.runTasks();
  this._saveAndUnloadTasks.runTasks();
 }

 searchUpdate() {
  const position = this.data.positionWatch;
  let positionChanged = false;

  const worldColumnPOS = WorldSpaces.column
   .getPositionXYZ(position[0], 0, position[2])
   .copy();

  if (
   worldColumnPOS.x != this._cachedPosition[0] ||
   worldColumnPOS.y != this._cachedPosition[1] ||
   worldColumnPOS.z != this._cachedPosition[2]
  )
   positionChanged = true;
  if (positionChanged) {
   this._loadTaskss.cancelAll();
   this._generateTasks.cancelAll();
   this._worldSunTasks.cancelAll();
   this._propagationTasks.cancelAll();
   this._buildTasks.cancelAll();
   this.builder
    .setXYZ(worldColumnPOS.x, worldColumnPOS.y, worldColumnPOS.z)
    .removeColumnsOutsideRadius(this.data.renderDistance);
   this._cachedPosition[0] = worldColumnPOS.x;
   this._cachedPosition[1] = worldColumnPOS.y;
   this._cachedPosition[2] = worldColumnPOS.z;
   this._searchQueue = [];
   for (const [key, pos] of this._activeColumns) {
    const distance = Distance3D(
     worldColumnPOS.x,
     0,
     worldColumnPOS.z,
     pos[0],
     0,
     pos[2]
    );
    if (distance <= this.data.renderDistance) continue;
    this._activeColumns.delete(key);
   }

   this.dataLoader
    .setDimension(this.dimension)
    .setXYZ(worldColumnPOS.x, worldColumnPOS.y, worldColumnPOS.z)
    .unLoadAllOutsideRadius(this.data.maxDistance!, (column) => {
     const { x, y, z } = WorldSpaces.column.getPositionLocation(
      column.getLocationData()
     );
     if (this._inProgressMap.has(x, y, z)) return false;
     return true;
    });
  }

  this._searchQueue.push([
   worldColumnPOS.x,
   worldColumnPOS.y,
   worldColumnPOS.z,
  ]);

  while (this._searchQueue.length) {
   const node = this._searchQueue.shift();

   if (!node) break;
   const cx = node[0];
   const cy = 0;
   const cz = node[2];
   const columnKey = WorldSpaces.column.getKeyXYZ(cx, 0, cz);

   if (this._visitedMap.has(columnKey) || this._inProgressMap.has(cx, 0, cz))
    continue;
   this._visitedMap.set(columnKey, true);

   const distance = Distance3D(
    worldColumnPOS.x,
    0,
    worldColumnPOS.z,
    cx,
    0,
    cz
   );
   if (distance > this.data.generateDistance) continue;

   if (!this.columnTool.loadInAt(cx, cy, cz)) {
    this._loadTaskss.add(cx, cy, cz);
    continue;
   }

   if (!this.columnTool.getTagValue("#dve_is_world_gen_done")) {
    this._generateTasks.add(cx, cy, cz);
    continue;
   }

   let nWorldGenAllDone = true;
   let nSunAllDone = true;
   let nPropagtionAllDone = true;
   if (!this.columnTool.getTagValue("#dve_is_world_sun_done")) {
    nSunAllDone = false;
   }

   for (const n of $2dMooreNeighborhood) {
    const nx = cx + n[0] * WorldSpaces.column._bounds.x;
    const nz = cz + n[1] * WorldSpaces.column._bounds.z;
    const columnPOS = WorldSpaces.column.getPositionXYZ(nx, cy, nz),
     key = WorldSpaces.column.getKey();
    if (!this._visitedMap.has(key)) {
     this._searchQueue.push([columnPOS.x, cy, columnPOS.z]);
    }
    if (!this.nColumnTool.loadInAt(columnPOS.x, cy, columnPOS.z)) {
     nWorldGenAllDone = false;
     nSunAllDone = false;
     break;
    }
    if (!this.nColumnTool.getTagValue("#dve_is_world_gen_done")) {
     nWorldGenAllDone = false;
    }
    if (!this.nColumnTool.getTagValue("#dve_is_world_sun_done")) {
     nSunAllDone = false;
    }
    if (!this.nColumnTool.getTagValue("#dve_is_world_propagation_done")) {
     nPropagtionAllDone = false;
    }
   }

   if (
    nWorldGenAllDone &&
    !this.columnTool.getTagValue("#dve_is_world_sun_done")
   ) {
    this._worldSunTasks.add(cx, cy, cz);
    continue;
   }

   if (
    nSunAllDone &&
    !this.columnTool.getTagValue("#dve_is_world_propagation_done")
   ) {
    this._propagationTasks.add(cx, cy, cz);
    continue;
   }

   if (
    distance > this.data.renderDistance ||
    this._activeColumns.has(columnKey)
   )
    continue;
   if (
    nWorldGenAllDone &&
    nSunAllDone &&
    nPropagtionAllDone &&
    distance < this.data.renderDistance
   ) {
    this._buildTasks.add(cx, cy, cz);
   }
  }

  this._visitedMap.clear();
 }
}
