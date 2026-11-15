import { dataService } from '../../../js/service/data/dataService';
import { stateService } from '../../../js/service/stateService';
import { GridElement } from '../../../js/model/GridElement';
import { gridUtil } from '../../../js/util/gridUtil';

// Mode 12 (and the modes built on it): the global board is drawn as its own layer, apart from the board.
//
// The preparation is the same as gridView's recalculateRenderGrid (the global board is merged into the
// board, so all positions and sizes are the usual ones). The only addition is that the merged board
// remembers which of its elements come from the global board, so the display can split them into two
// layers: the global layer stays mounted while the board layer is rebuilt for each board.
//
// prepareLayeredGrid() works on a local object and does not touch the view (it is also used to prepare
// boards in advance). The board is handed to Vue once, when it is complete.

// "noFillers": the original adds one invisible filler cell for every free place of the grid (and of the
// global board), and each filler goes through JSON copies, Vue reactivity and a mounted cell component
// that draws nothing. Here free places are simply left empty in the CSS grid.
function withoutFillers(grid) {
    if (!grid || !grid.gridElements) {
        return grid;
    }
    return Object.assign({}, grid, {
        gridElements: grid.gridElements.filter(element => element.type !== GridElement.ELEMENT_TYPE_UI_FILLER)
    });
}

// ctx: the grid view (reads metadata and globalGridData; like the original, it may complete globalGridData)
// options.skipFillers: don't create cells for the free places (see above)
export async function prepareLayeredGrid(ctx, gridData, options = {}) {
    let globalGrid = null;
    let renderGridData;
    if (options.skipFillers) {
        gridData = withoutFillers(gridData);
    } else {
        gridData = gridUtil.fillFreeSpaces(gridData, GridElement.ELEMENT_TYPE_UI_FILLER);
        if (gridUtil.hasDynamicGridPlaceholder(ctx.globalGridData)) {
            ctx.globalGridData = gridUtil.fillFreeSpaces(ctx.globalGridData, GridElement.ELEMENT_TYPE_UI_FILLER);
        }
    }
    let globalElementIds = [];
    let globalRevision = null;
    if (gridData.showGlobalGrid) {
        globalGrid = ctx.globalGridData;
        if (gridData.globalGridId) { // custom global grid
            globalGrid = await dataService.getGrid(gridData.globalGridId, false, true);
        }
        if (options.skipFillers) {
            globalGrid = withoutFillers(globalGrid);
        }
        if (globalGrid && globalGrid.gridElements && globalGrid.gridElements.length > 0) {
            globalElementIds = globalGrid.gridElements.map(e => e.id);
            globalRevision = globalGrid._rev || null;
        }
        renderGridData = gridUtil.mergeGrids(gridData, globalGrid, {
            globalGridHeightPercentage: ctx.metadata.globalGridHeightPercentage,
            noDeepCopy: true
        });
    } else {
        renderGridData = gridData;
    }
    renderGridData = gridUtil.adaptFirstRowHeight(renderGridData, ctx.metadata.firstRowHeightFactor);
    renderGridData.minColumnCount = gridUtil.getWidthWithBounds(renderGridData);
    renderGridData.rowCount = gridUtil.getHeightWithBounds(renderGridData);
    renderGridData.gridElements = renderGridData.gridElements.filter(e => !e.hidden);

    let effectiveLevel = gridUtil.getCurrentVocabularyLevel(ctx.metadata);
    if (effectiveLevel) {
        let globalGridElements = globalGrid ? globalGrid.gridElements : [];
        let globalGridElemIds = globalGridElements.map(e => e.id);
        let normalGridElements = renderGridData.gridElements.filter(e => !globalGridElemIds.includes(e.id));
        let shownElementIds = gridUtil.getElementsOfVocabularyLevel(normalGridElements, effectiveLevel).concat(gridUtil.getElementsOfVocabularyLevel(globalGridElements, effectiveLevel)).map(e => e.id);
        renderGridData.gridElements = renderGridData.gridElements.filter(e => shownElementIds.includes(e.id));
    }
    // extra information for the layered display (does not change the board itself)
    renderGridData.globalElementIds = globalElementIds;
    renderGridData.globalRevision = globalRevision;
    return renderGridData;
}

// "frozenCells": in view mode the cells never change, so Vue does not need to make every cell, action,
// word form and image reactive (Vue 2 skips frozen objects). The list itself stays reactive.
export function freezeCells(renderGridData) {
    renderGridData.gridElements.forEach(element => Object.freeze(element));
    return renderGridData;
}

function createRecalculate(options = {}) {
    return async function (gridData) {
        this.showGrid = false;
        let renderGridData = await prepareLayeredGrid(this, gridData, { skipFillers: options.skipFillers });
        if (options.freeze) {
            freezeCells(renderGridData);
        }
        this.renderGridData = renderGridData;
        this.showGrid = true;
        stateService.setCurrentGrid(this.renderGridData);
    };
}

export const recalculateTest12LayeredGrid = createRecalculate();
export const recalculateFrozenLayeredGrid = createRecalculate({ freeze: true });
export const recalculateFrozenNoFillersGrid = createRecalculate({ freeze: true, skipFillers: true });
