import { dataService } from '../../../js/service/data/dataService';
import { stateService } from '../../../js/service/stateService';
import { GridElement } from '../../../js/model/GridElement';
import { gridUtil } from '../../../js/util/gridUtil';

function withoutGeneratedFillers(gridData) {
    if (!gridData) {
        return null;
    }
    return {
        ...gridData,
        gridElements: gridData.gridElements.filter(element => element.type !== GridElement.ELEMENT_TYPE_UI_FILLER)
    };
}

// Experimental path: keep the usual grid preparation but leave empty positions
// as CSS grid gaps instead of adding filler elements.
export async function recalculateTest1WithoutEmptyFillers(gridData) {
    this.showGrid = false;
    gridData = withoutGeneratedFillers(gridData);
    let globalGrid = null;

    if (gridData.showGlobalGrid) {
        globalGrid = gridData.globalGridId
            ? withoutGeneratedFillers(await dataService.getGrid(gridData.globalGridId, false, true))
            : withoutGeneratedFillers(this.globalGridData);
        gridData = gridUtil.mergeGrids(gridData, globalGrid, {
            globalGridHeightPercentage: this.metadata.globalGridHeightPercentage,
            noDeepCopy: true
        });
    }

    this.renderGridData = gridUtil.adaptFirstRowHeight(gridData, this.metadata.firstRowHeightFactor);
    this.renderGridData.minColumnCount = gridUtil.getWidthWithBounds(this.renderGridData);
    this.renderGridData.rowCount = gridUtil.getHeightWithBounds(this.renderGridData);
    this.renderGridData.gridElements = this.renderGridData.gridElements.filter(element => !element.hidden);

    let effectiveLevel = gridUtil.getCurrentVocabularyLevel(this.metadata);
    if (effectiveLevel) {
        let globalGridElements = globalGrid ? globalGrid.gridElements : [];
        let globalGridElemIds = globalGridElements.map(element => element.id);
        let normalGridElements = this.renderGridData.gridElements.filter(element => !globalGridElemIds.includes(element.id));
        let shownElementIds = gridUtil.getElementsOfVocabularyLevel(normalGridElements, effectiveLevel)
            .concat(gridUtil.getElementsOfVocabularyLevel(globalGridElements, effectiveLevel))
            .map(element => element.id);
        this.renderGridData.gridElements = this.renderGridData.gridElements.filter(element => shownElementIds.includes(element.id));
    }

    this.showGrid = true;
    stateService.setCurrentGrid(this.renderGridData);
}
