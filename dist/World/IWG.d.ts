import type { IWGData } from "./Types/IWG.types.js";
import type { Vec3Array } from "divine-voxel-engine/Math";
import { ColumnDataTool } from "divine-voxel-engine/Tools/Data/WorldData/ColumnDataTool.js";
import { BuilderTool } from "divine-voxel-engine/Tools/Build/BuilderTool.js";
import { TaskTool } from "divine-voxel-engine/Tools/Tasks/TasksTool.js";
import { DataLoaderTool } from "divine-voxel-engine/Tools/Data/DataLoaderTool.js";
import { AnaylzerTool } from "divine-voxel-engine/Tools/Anaylzer/AnaylzerTool.js";
import { VisitedMap } from "divine-voxel-engine/Global/Util/VisistedMap.js";
declare class IWGTasks {
    tasksId: string;
    run: (x: number, y: number, z: number, onDone: Function) => void;
    iwg: IWG;
    propagationBlocking: boolean;
    queue: [x: number, y: number, z: number][];
    map: VisitedMap;
    waitingFor: number;
    constructor(tasksId: string, run: (x: number, y: number, z: number, onDone: Function) => void, iwg: IWG, propagationBlocking?: boolean);
    add(x: number, y: number, z: number): void;
    cancelAll(): void;
    runTasks(max?: number): void;
}
/**# Infinite World Generator
 *
 */
export declare class IWG {
    data: IWGData;
    _anaylzerDone: boolean;
    anaylzer: AnaylzerTool;
    columnTool: ColumnDataTool;
    nColumnTool: ColumnDataTool;
    builder: BuilderTool;
    dataLoader: DataLoaderTool;
    tasks: TaskTool;
    dimension: string;
    _cachedPosition: Vec3Array;
    _inProgressMap: {
        map: Map<string, string>;
        add(x: number, y: number, z: number, tasks: string): void;
        has(x: number, y: number, z: number): boolean;
        remove(x: number, y: number, z: number): boolean;
    };
    _searchQueue: number[][];
    _visitedMap: Map<string, boolean>;
    _activeColumns: Map<string, number[]>;
    _loadTaskss: IWGTasks;
    _generateTasks: IWGTasks;
    _worldSunTasks: IWGTasks;
    _propagationTasks: IWGTasks;
    _buildTasks: IWGTasks;
    _saveTasks: IWGTasks;
    _saveAndUnloadTasks: IWGTasks;
    constructor(data: IWGData);
    setDimension(id: string): void;
    saveUpdate(): void;
    _logTasks(): string;
    anaylzerUpdate(): void;
    tasksUpdate(): void;
    searchUpdate(): void;
}
export {};
