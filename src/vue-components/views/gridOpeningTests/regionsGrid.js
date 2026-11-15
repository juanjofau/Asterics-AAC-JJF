import { dataService } from '../../../js/service/data/dataService';
import { stateService } from '../../../js/service/stateService';
import { GridElement } from '../../../js/model/GridElement';
import { gridUtil } from '../../../js/util/gridUtil';
import { dynamicZoneOf } from './deducedZoneGrid';
import { getPrepared, setPrepared, persistenceState } from './persistedBoards';

// Modes 3.1, 3.99 and group 4: the global board and the dynamic board are separate regions.
//
// The original merges both boards into one grid (gridUtil.mergeGrids) and draws one DOM for all of it.
// Here each board keeps its own grid and its own cells:
//   - the global region is the global board in its full size; the zone of the dynamic board (the dynamic
//     grid placeholder of the global board, drawn by the user or deduced as in mode 2.4) is left empty
//   - the dynamic region is the dynamic board, drawn over that zone with its own rows and columns, so it
//     always fits the zone, whatever its size
// The global region does not depend on the dynamic board, so it is prepared once and reused while the
// global board stays the same (it is prepared again only if the global board or the settings change).
//
// Mode 3.1 only separates the regions. Everything else is as in the original: the free places of the boards
// are filled with the same invisible cells, the cells are not frozen, and the metadata, the thumbnail and the
// texts are handled as always. Mode 3.99 is mode 3.1 plus the simple improvements of mode group 1; the two
// that work here (in the preparation of the boards) are the options of createRecalculateRegions():
//   skipFillers  no invisible cells for the free places (mode 1.2)
//   freeze       the cells are not watched deeply by Vue (mode 1.3)
// The others (texts, metadata, thumbnail) are switched on by the mode features, as in every mode.
// Group 4 adds the option persist: the prepared dynamic board of the last boards opened is kept (persistedBoards.js)
// and used again when the board is opened again with the same revision and settings.
//
// NOTE: this file is an exact copy of the version that was measured as fast for modes 3.1 and 3.99. Group 4 does not use
// it any more (it has its own copy, persistentRegionsGrid.js). Do not change it.
//
// The grid view still gets one board object (renderGridData) with all the cells (global cells first), because
// other services read the list of cells; the two regions are in renderGridData.regions.

// last prepared global region, reused while the key is the same
let cachedGlobalRegion = null;
let regionCounter = 0;

function keepShownElements(elements, level, options) {
    let shown = elements.filter(e => !e.hidden && !(options.skipFillers && e.type === GridElement.ELEMENT_TYPE_UI_FILLER));
    shown = level ? gridUtil.getElementsOfVocabularyLevel(shown, level) : shown;
    if (options.freeze) {
        shown.forEach(element => Object.freeze(element));
    }
    return shown;
}

// the global region: all its cells (without the zone), its size and the zone (in the units of that size)
function prepareGlobalRegion(globalGrid, metadata, level, options) {
    let factor = metadata.firstRowHeightFactor || 1;
    let key = [globalGrid.id, globalGrid._rev, globalGrid.gridElements.length, level || '', factor, !!options.skipFillers, !!options.freeze].join('|');
    if (cachedGlobalRegion && cachedGlobalRegion.key === key) {
        return cachedGlobalRegion;
    }
    let copy = JSON.parse(JSON.stringify(globalGrid)); // own copy: it is adapted below, the global board in memory stays as it is
    if (!options.skipFillers && gridUtil.hasDynamicGridPlaceholder(copy)) {
        // like the original: a global board with a dynamic zone gets its free places filled (the zone is not free)
        copy = gridUtil.fillFreeSpaces(copy, GridElement.ELEMENT_TYPE_UI_FILLER);
    }
    let zone = dynamicZoneOf(copy);
    let columns = Math.max(gridUtil.getWidthWithBounds(copy), zone.x + zone.width);
    let rows = Math.max(gridUtil.getHeightWithBounds(copy), zone.y + zone.height);
    let elements = copy.gridElements.filter(e => e.type !== GridElement.ELEMENT_TYPE_DYNAMIC_GRID_PLACEHOLDER);
    if (factor !== 1) {
        // same adaptation of the height of the first row as the original (see gridUtil.adaptFirstRowHeight),
        // done together with the zone so the zone keeps its place
        let zoneElement = { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
        let adapted = gridUtil.adaptFirstRowHeight({ gridElements: elements.concat([zoneElement]) }, factor);
        zone = { x: zoneElement.x, y: zoneElement.y, width: zoneElement.width, height: zoneElement.height };
        rows = Math.max(...adapted.gridElements.map(e => e.y + e.height));
    }
    cachedGlobalRegion = {
        key: key,
        gridData: {
            id: copy.id,
            label: copy.label,
            backgroundColor: copy.backgroundColor,
            gridElements: keepShownElements(elements, level, options),
            minColumnCount: columns,
            rowCount: rows
        },
        // place of the zone as percentages of the whole area
        zonePercent: {
            left: zone.x / columns * 100,
            top: zone.y / rows * 100,
            width: zone.width / columns * 100,
            height: zone.height / rows * 100
        }
    };
    return cachedGlobalRegion;
}

// the dynamic region: the cells of the board and its size
function prepareDynamicRegion(gridData, level, hasGlobal, metadata, options) {
    if (!options.skipFillers) {
        gridData = gridUtil.fillFreeSpaces(gridData, GridElement.ELEMENT_TYPE_UI_FILLER);
    }
    // without a global board the first row of the dynamic board is the first row of everything
    if (!hasGlobal) {
        gridData = gridUtil.adaptFirstRowHeight(gridData, metadata.firstRowHeightFactor);
    }
    let elements = keepShownElements(gridData.gridElements, level, options);
    let grid = Object.assign({}, gridData, { gridElements: elements });
    grid.minColumnCount = gridUtil.getWidthWithBounds(grid);
    grid.rowCount = gridUtil.getHeightWithBounds(grid);
    return { grid: grid, elements: elements };
}

// Prepares what a board needs to be shown as regions: the global region, the dynamic region (from memory if the board was
// prepared before, see persistedBoards.js) and the place of the dynamic region. It is used when a board is opened and,
// with options.pinned, when a board is prepared in advance (mode 4.3). ctx is the grid view.
export async function prepareRegionsForBoard(ctx, gridData, options) {
    let level = gridUtil.getCurrentVocabularyLevel(ctx.metadata);
    let globalGrid = null;
    if (gridData.showGlobalGrid) {
        globalGrid = ctx.globalGridData;
        if (gridData.globalGridId) { // custom global grid
            globalGrid = await dataService.getGrid(gridData.globalGridId, false, true);
        }
        if (!globalGrid || !globalGrid.gridElements || globalGrid.gridElements.length === 0) {
            globalGrid = null;
        }
    }
    let globalRegion = globalGrid ? prepareGlobalRegion(globalGrid, ctx.metadata, level, options) : null;

    // with persistence, a board opened before (same id, revision and settings) is not prepared again
    let persistKey = null;
    let dynamic = null;
    if (options.persist && gridData._rev) {
        let factor = ctx.metadata.firstRowHeightFactor || 1;
        persistKey = [gridData.id, gridData._rev, level || '', globalRegion ? '' : factor, !!options.skipFillers, !!options.freeze, !!globalRegion].join('|');
        dynamic = getPrepared(persistKey);
    }
    let hit = !!dynamic;
    if (!dynamic) {
        dynamic = prepareDynamicRegion(gridData, level, !!globalRegion, ctx.metadata, options);
        if (persistKey) {
            setPrepared(gridData.id, persistKey, dynamic, !!options.pinned);
        }
    }
    let percent = globalRegion ? globalRegion.zonePercent : { left: 0, top: 0, width: 100, height: 100 };
    return {
        globalRegion: globalRegion,
        dynamic: dynamic,
        percent: percent,
        hit: hit,
        // identifies the region when regions are kept in memory (same board and same place on the screen)
        dynamicKey: (persistKey || 'unique' + (++regionCounter)) + '|' + [percent.left, percent.top, percent.width, percent.height].join(',')
    };
}

// returns the preparation of the boards, to be called with the grid view as "this" (like gridView's recalculateRenderGrid)
export function createRecalculateRegions(options = {}) {
    return async function (gridData) {
        // (the original sets showGrid to false here and to true at the end; with nothing in between that waits, the view
        // never draws that state. Here the preparation is awaited, so Vue would draw it and unmount the regions at every
        // opening, also the global region that should stay mounted. So showGrid is not touched until the end.)
        let prepared = await prepareRegionsForBoard(this, gridData, options);
        if (options.persist) {
            persistenceState.lastHit = prepared.hit;
        }
        let combinedElements = (prepared.globalRegion ? prepared.globalRegion.gridData.gridElements : []).concat(prepared.dynamic.elements);
        this.renderGridData = Object.assign({}, prepared.dynamic.grid, {
            gridElements: combinedElements,
            regions: {
                global: prepared.globalRegion,
                dynamic: {
                    gridData: prepared.dynamic.grid,
                    percent: prepared.percent,
                    key: prepared.dynamicKey
                }
            }
        });
        this.showGrid = true;
        stateService.setCurrentGrid(this.renderGridData);
    };
}

export const regionsOptionsOf = {
    // options of the preparation of each mode that keeps boards (the same ones for a board opened and a board prepared in advance)
    persistent: { persist: true },
    persistentWithSimpleImprovements: { persist: true, skipFillers: true, freeze: true }
};

export const recalculateRegionsGrid = createRecalculateRegions();
export const recalculateRegionsGridWithSimpleImprovements = createRecalculateRegions({ skipFillers: true, freeze: true });
export const recalculateRegionsGridPersistent = createRecalculateRegions(regionsOptionsOf.persistent);
export const recalculateRegionsGridPersistentWithSimpleImprovements = createRecalculateRegions(regionsOptionsOf.persistentWithSimpleImprovements);
