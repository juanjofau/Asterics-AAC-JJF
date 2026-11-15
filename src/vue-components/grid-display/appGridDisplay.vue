<template>
    <div ref="mainContainer" :style="`flex: 1 1 auto; max-width: 100%; min-height: 0; cursor: ${cursorType}${previewZone ? '; position: relative' : ''}`">
        <grid-layout ref="gridLayout" v-if="gridData && oneElementSize" :key="gridData.id + gridData.gridElements.length + gridData.rowCount + gridData.minColumnCount"
                     :elements="gridData.gridElements" :render-component="AppGridElement"
                     :background-color="gridData.backgroundColor || metadata.colorConfig.gridBackgroundColor"
                     :rows="gridData.rowCount" :columns="gridData.minColumnCount"
                     :metadata="metadata" :one-element-size="oneElementSize" v-on="$listeners" v-bind="$attrs"
                     :show-resize-handle="editable" :editable="editable" :background-lines="editable"
                     :key-function="getKey" :elem-css-fn="elemCssFn">
        </grid-layout>
        <div v-if="previewZone && gridData" class="dynamic-zone-preview" :style="previewStyle"><span>Área de tableros dinámicos (automática)</span></div>
    </div>
</template>

<script>

import GridLayout from '../grid-layout/components/grid-layout.vue';
import GridElement from '../grid-layout/components/grid-element.vue';
import AppGridElement from './appGridElement.vue';
import { gridUtil } from '../../js/util/gridUtil';
import { util } from '../../js/util/util';
import { colorUtil } from '../../js/util/colorUtil';
import { GridElement as GridElementModel } from '../../js/model/GridElement';

export default {
    components: { GridElement, GridLayout, AppGridElement },
    props: ["gridData", "metadata", "editable", "elemCssFn", "previewZone"],
    data() {
        return {
            AppGridElement: AppGridElement,
            oneElementSize: null,
            resizeObserver: null
        }
    },
    watch: {
        gridData() {
            this.oneElementSize = null;
            this.recalculate();
        }
    },
    computed: {
        cursorType() {
            return gridUtil.getCursorType(this.metadata);
        },
        // position of the preview zone (mode 2.3) as percentages of the whole grid
        previewStyle() {
            let zone = this.previewZone;
            let columns = gridUtil.getWidthWithBounds(this.gridData);
            let rows = gridUtil.getHeightWithBounds(this.gridData);
            // text color and font like the real dynamic area, which is drawn inside a normal element (see appGridElement.vue)
            let placeholder = { type: GridElementModel.ELEMENT_TYPE_DYNAMIC_GRID_PLACEHOLDER };
            let fontColor = colorUtil.getFontColor(this.metadata, colorUtil.getBackgroundColor(placeholder, this.metadata));
            let fontFamily = this.metadata && this.metadata.textConfig ? this.metadata.textConfig.fontFamily : 'inherit';
            return `left: ${zone.x / columns * 100}%; top: ${zone.y / rows * 100}%; width: ${zone.width / columns * 100}%; height: ${zone.height / rows * 100}%; color: ${fontColor}; font-family: ${fontFamily};`;
        }
    },
    methods: {
        recalculate() {
            let containerSize = this.$refs.mainContainer.getBoundingClientRect(); // don't use async util.getElementSize since it leads to problems in gridView initializing input methods too early
            let oneElementSize = gridUtil.getOneElementSize(containerSize, this.gridData);
            if (!this.oneElementSize || this.oneElementSize.width !== oneElementSize.width || this.oneElementSize.height !== oneElementSize.height) {
                this.oneElementSize = oneElementSize;
            }
        },
        resizeListener() {
            util.debounce(() => {
                this.recalculate();
            }, 100, "WINDOW_RESIZE" + this.gridData.id);
        },
        getKey(elem) {
            if (this.editable) {
                return gridUtil.getElementHash(elem, { skipPosition: true, dontHash: true });
            } else {
                return elem.id;
            }
        }
    },
    mounted() {
        this.recalculate();
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.resizeListener();
            });
            this.resizeObserver.observe(this.$refs.mainContainer);
        } else {
            this.recalculate();
            window.addEventListener('resize', this.resizeListener);
        }
    },
    beforeDestroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        } else {
            window.removeEventListener('resize', this.resizeListener);
        }
    }
}
</script>

<style scoped>
.dynamic-zone-preview {
    position: absolute;
    box-sizing: border-box;
    z-index: 2;
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 2em; /* same as the real dynamic area (gridElementChildPlaceholder.vue) */
    border: 2px dashed rgba(0, 100, 200, 0.7);
    /* light layer, like the real dynamic area, so the text is readable over dark backgrounds too */
    background-color: rgba(245, 245, 245, 0.75);
    background-image: repeating-linear-gradient(
        45deg,
        rgba(0, 100, 200, 0.10),
        rgba(0, 100, 200, 0.10) 10px,
        transparent 10px,
        transparent 20px
    );
}
</style>