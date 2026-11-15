import { dataService } from '../../../js/service/data/dataService';
import { stateService } from '../../../js/service/stateService';
import { GridElement } from '../../../js/model/GridElement';
import { gridUtil } from '../../../js/util/gridUtil';

// Modes 2.1 to 2.4: boards whose global board has no "dynamic grid placeholder" (the old way) get one deduced.
//
// Original behavior without placeholder (gridUtil.mergeGrids, second branch): the board is drawn below or
// next to the global cells (the free corner with the smallest column + row, see gridUtil.getOffset) and it
// adds its own rows or columns to the total grid, so the size of the global board depends on the board
// that is shown. With a placeholder (the new way) the board is fitted into a fixed zone and the global
// board never changes.
//
// Here the zone is deduced from the global board alone, so the global board does not depend on the
// dynamic board any more (the goal of these modes is not speed, they prepare the separation of both boards).
// The size of the global board is the bigger of its cells and its configured minimum (columns / rows).
// The zone is then chosen with one of two rules:
//   "corner" (mode 2.1)      the free corner nearest to the origin (gridUtil.getOffset, same rule as before),
//                            from there to the border of that size; at least 1 column / 1 row
//   "largestArea" (mode 2.2) the biggest free rectangle that reaches the border (bottom right) of that size,
//                            i.e. the side with more free space. On equal area: the one furthest to the
//                            right, then (same column) the one lower down. No free space at all: one row
//                            added below the global board.
//   "largestEmptyRectangle" (mode 2.4) the biggest free rectangle anywhere in the global board, also in the
//                            middle (see largestEmptyRectangleZone). Same rules for ties and no free space.
// The deduced zone is added to the global board as a placeholder element, and gridUtil.mergeGrids then
// handles it like a placeholder drawn by the user. mergeGrids itself is not changed.

function cornerZone(globalGrid) {
    let width = gridUtil.getWidthWithBounds(globalGrid);
    let height = gridUtil.getHeightWithBounds(globalGrid);
    let corner = gridUtil.getOffset(globalGrid);
    return {
        x: corner.x,
        y: corner.y,
        width: Math.max(1, width - corner.x),
        height: Math.max(1, height - corner.y)
    };
}

function largestAreaZone(globalGrid) {
    let width = gridUtil.getWidthWithBounds(globalGrid);
    let height = gridUtil.getHeightWithBounds(globalGrid);
    let elements = globalGrid.gridElements.filter(e => e.type !== GridElement.ELEMENT_TYPE_UI_FILLER);
    let best = null;
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            // free corner: no cell reaches into the rectangle from (x, y) to the border
            let isFree = elements.every(e => y >= e.y + e.height || x >= e.x + e.width);
            if (!isFree) {
                continue;
            }
            let candidate = { x: x, y: y, width: width - x, height: height - y };
            let area = candidate.width * candidate.height;
            let bestArea = best ? best.width * best.height : 0;
            if (!best
                || area > bestArea
                || (area === bestArea && candidate.x > best.x)
                || (area === bestArea && candidate.x === best.x && candidate.y > best.y)) {
                best = candidate;
            }
        }
    }
    return best || { x: 0, y: height, width: Math.max(1, width), height: 1 };
}

// "largestEmptyRectangle" (mode 2.4): the biggest free rectangle anywhere in the global board (not only
// the ones reaching the bottom right border), e.g. a big free area on the left of cells placed at the
// right. On equal area: the one whose right edge is furthest to the right, then the one whose bottom edge
// is lowest. No free space at all: one row added below the global board.
function largestEmptyRectangleZone(globalGrid) {
    let width = gridUtil.getWidthWithBounds(globalGrid);
    let height = gridUtil.getHeightWithBounds(globalGrid);
    let elements = globalGrid.gridElements.filter(e => e.type !== GridElement.ELEMENT_TYPE_UI_FILLER);
    // occupied[y][x] is true if a cell covers that place of the grid; sums[y][x] counts the occupied places
    // in the rectangle from (0, 0) to (x - 1, y - 1), so any rectangle can be checked in one step
    let occupied = Array.from({ length: height }, () => new Array(width).fill(false));
    for (let element of elements) {
        for (let y = Math.max(0, element.y); y < Math.min(height, element.y + element.height); y++) {
            for (let x = Math.max(0, element.x); x < Math.min(width, element.x + element.width); x++) {
                occupied[y][x] = true;
            }
        }
    }
    let sums = Array.from({ length: height + 1 }, () => new Array(width + 1).fill(0));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            sums[y + 1][x + 1] = sums[y][x + 1] + sums[y + 1][x] - sums[y][x] + (occupied[y][x] ? 1 : 0);
        }
    }
    let isEmpty = (x, y, w, h) => sums[y + h][x + w] - sums[y][x + w] - sums[y + h][x] + sums[y][x] === 0;
    let best = null;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            for (let h = 1; y + h <= height; h++) {
                for (let w = 1; x + w <= width; w++) {
                    if (!isEmpty(x, y, w, h)) {
                        break; // a wider rectangle from the same corner would contain this occupied place too
                    }
                    let area = w * h;
                    let bestArea = best ? best.width * best.height : 0;
                    if (!best
                        || area > bestArea
                        || (area === bestArea && x + w > best.x + best.width)
                        || (area === bestArea && x + w === best.x + best.width && y + h > best.y + best.height)) {
                        best = { x: x, y: y, width: w, height: h };
                    }
                }
            }
        }
    }
    return best || { x: 0, y: height, width: Math.max(1, width), height: 1 };
}

const ZONE_RULES = {
    corner: cornerZone,
    largestArea: largestAreaZone,
    largestEmptyRectangle: largestEmptyRectangleZone
};

// the zone of the dynamic board in a global board (mode 3.1): the one drawn by the user, or else the one mode 2.4 deduces
export function dynamicZoneOf(globalGrid) {
    let placeholder = globalGrid.gridElements.find(e => e.type === GridElement.ELEMENT_TYPE_DYNAMIC_GRID_PLACEHOLDER);
    if (placeholder) {
        return { x: placeholder.x, y: placeholder.y, width: placeholder.width, height: placeholder.height };
    }
    return largestEmptyRectangleZone(globalGrid);
}

// zone to preview in the edit view (modes 2.3 and 2.4): the same zone the matching mode would use, or null if
// the global board already has a dynamic zone (the real element is shown then) or has no cells yet
export function previewDynamicZone(globalGrid, rule = 'largestArea') {
    if (!globalGrid || !globalGrid.gridElements || globalGrid.gridElements.length === 0 || gridUtil.hasDynamicGridPlaceholder(globalGrid)) {
        return null;
    }
    return ZONE_RULES[rule](globalGrid);
}

// the zone depends on the global board only, so it is calculated once per global board object (and rule)
const globalGridsWithZone = { corner: new WeakMap(), largestArea: new WeakMap(), largestEmptyRectangle: new WeakMap() };

export function withDeducedDynamicZone(globalGrid, rule = 'corner') {
    if (!globalGrid || !globalGrid.gridElements || globalGrid.gridElements.length === 0 || gridUtil.hasDynamicGridPlaceholder(globalGrid)) {
        return globalGrid;
    }
    let cache = globalGridsWithZone[rule];
    let cached = cache.get(globalGrid);
    if (cached && cached.elements === globalGrid.gridElements) {
        return cached.result;
    }
    let area = ZONE_RULES[rule](globalGrid);
    let zone = new GridElement({
        type: GridElement.ELEMENT_TYPE_DYNAMIC_GRID_PLACEHOLDER,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height
    });
    let result = Object.assign({}, globalGrid, {
        gridElements: globalGrid.gridElements.concat([zone])
    });
    cache.set(globalGrid, { elements: globalGrid.gridElements, result: result });
    return result;
}

// Same as gridView's recalculateRenderGrid (called with the grid view as "this"), except that the global
// board is given a deduced zone before it is merged with the board.
function createRecalculate(rule) {
    return async function (gridData) {
        this.showGrid = false;
        let globalGrid = null;
        gridData = gridUtil.fillFreeSpaces(gridData, GridElement.ELEMENT_TYPE_UI_FILLER);
        if (gridUtil.hasDynamicGridPlaceholder(this.globalGridData)) {
            this.globalGridData = gridUtil.fillFreeSpaces(this.globalGridData, GridElement.ELEMENT_TYPE_UI_FILLER);
        }
        if (gridData.showGlobalGrid) {
            globalGrid = this.globalGridData;
            if (gridData.globalGridId) { // custom global grid
                globalGrid = await dataService.getGrid(gridData.globalGridId, false, true);
            }
            this.renderGridData = gridUtil.mergeGrids(gridData, withDeducedDynamicZone(globalGrid, rule), {
                globalGridHeightPercentage: this.metadata.globalGridHeightPercentage,
                noDeepCopy: true
            });
        } else {
            this.renderGridData = gridData;
        }
        this.renderGridData = gridUtil.adaptFirstRowHeight(this.renderGridData, this.metadata.firstRowHeightFactor);
        this.renderGridData.minColumnCount = gridUtil.getWidthWithBounds(this.renderGridData);
        this.renderGridData.rowCount = gridUtil.getHeightWithBounds(this.renderGridData);
        this.renderGridData.gridElements = this.renderGridData.gridElements.filter(e => !e.hidden);

        let effectiveLevel = gridUtil.getCurrentVocabularyLevel(this.metadata);
        if (effectiveLevel) {
            let globalGridElements = globalGrid ? globalGrid.gridElements : [];
            let globalGridElemIds = globalGridElements.map(e => e.id);
            let normalGridElements = this.renderGridData.gridElements.filter(e => !globalGridElemIds.includes(e.id));
            let shownElementIds = gridUtil.getElementsOfVocabularyLevel(normalGridElements, effectiveLevel).concat(gridUtil.getElementsOfVocabularyLevel(globalGridElements, effectiveLevel)).map(e => e.id);
            this.renderGridData.gridElements = this.renderGridData.gridElements.filter(e => shownElementIds.includes(e.id));
        }
        this.showGrid = true;
        stateService.setCurrentGrid(this.renderGridData);
    };
}

export const recalculateDeducedZoneGrid = createRecalculate('corner');
export const recalculateLargestAreaZoneGrid = createRecalculate('largestArea');
export const recalculateLargestEmptyRectangleZoneGrid = createRecalculate('largestEmptyRectangle');
