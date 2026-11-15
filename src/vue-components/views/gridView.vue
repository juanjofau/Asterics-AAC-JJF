<template>
    <div class="box" id="gridView" v-cloak>
        <header class="srow header opening-test-compact-header" role="toolbar" v-if="metadata" v-show="!metadata.fullscreen && !metadata.locked">
            <header-icon class="left" v-show="!metadata.locked"></header-icon>
            <div class="btn-group left">
                <button tabindex="30" v-show="!metadata.locked" @click="toEditGrid()" class="spaced small" :aria-label="$t('editingOn')"><i class="fas fa-pencil-alt"/> <span class="hide-mobile">{{ $t('editingOn') }}</span></button>
                <button tabindex="31" id="inputConfigButton" v-show="!metadata.locked" class="small" :aria-label="$t('inputOptions')"><i class="fas fa-cog"></i> <span class="hide-mobile">{{ $t('inputOptions') }}</span></button>
            </div>
            <grid-opening-mode-selector v-model="gridOpeningMode" @mode-change="onGridOpeningModeChange" />
            <button tabindex="32" v-show="!metadata.locked" @click="lock()" class="small" :aria-label="$t('lock')"><i class="fas fa-lock"></i><span class="hide-mobile">{{ $t('lock') }}</span></button>
            <button tabindex="33" v-show="!metadata.locked" @click="MainVue.showSearchModal()" class="spaced small" :aria-label="$t('search')" :title="$t('searchBtnTitle')"><i class="fas fa-search"/> <span class="hide-mobile">{{ $t('search') }}</span></button>
            <button tabindex="34" @click="systemActionService.enterFullscreen()" class="small" :aria-label="$t('fullscreen')"><i class="fas fa-expand"/> <span class="hide-mobile">{{ $t('fullscreen') }}</span></button>
        </header>
        <div v-if="metadata && metadata.locked && !metadata.fullscreen" class="floating-controls">
            <button tabindex="30"
                    @click="systemActionService.enterFullscreen()"
                    class="floating-control-button"
                    :aria-label="$t('SYS_ENTER_FULLSCREEN')"
                    :title="$t('SYS_ENTER_FULLSCREEN')">
                <i class="fas fa-expand"></i>
            </button>
            <button tabindex="31"
                    @click="MainVue.showSearchModal()"
                    class="floating-control-button"
                    :aria-label="$t('search')"
                    :title="$t('searchBtnTitle')">
                <i class="fas fa-search"></i>
            </button>
            <button tabindex="32"
                    @click="unlock()"
                    class="floating-control-button"
                    :aria-label="$t('unlock')"
                    :title="$t('unlock')">
                <i class="fas fa-unlock"></i>
                <span v-if="unlockCounter !== unlockCount">{{unlockCounter}}</span>
            </button>
        </div>

        <div class="srow content text-content" v-show="!renderGridData">
            <div class="grid-container grid-mask">
                <i class="fas fa-4x fa-spinner fa-spin" style="position: relative;"/>
            </div>
        </div>

        <huffman-input-modal v-if="showModal === modalTypes.MODAL_HUFFMAN" @close="showModal = null; reloadInputMethods();" />
        <direction-input-modal v-if="showModal === modalTypes.MODAL_DIRECTION" @close="showModal = null; reloadInputMethods();"/>
        <mouse-modal v-if="showModal === modalTypes.MODAL_MOUSE" @close="showModal = null; reloadInputMethods();"/>
        <scanning-modal v-if="showModal === modalTypes.MODAL_SCANNING" @close="showModal = null; reloadInputMethods();"/>
        <sequential-input-modal v-if="showModal === modalTypes.MODAL_SEQUENTIAL" @close="showModal = null; reloadInputMethods();"/>
        <unlock-modal v-if="showModal === modalTypes.MODAL_UNLOCK" @unlock="unlock(true)" @close="showModal = null;"/>

        <div class="srow content spaced" v-if="renderGridData && renderGridData.gridElements.length === 0 && gridOpeningMode === 'original'">
            <div style="margin-top: 2em">
                <i18n path="noElementsClickToEnterEdit" tag="span">
                    <template v-slot:link>
                        <a :href="'#grid/edit/' + renderGridData.id">{{ $t('editingOn') }}</a>
                    </template>
                </i18n>
            </div>
        </div>
        <div class="srow content d-flex" v-if="showGrid && renderGridData && (renderGridData.gridElements.length > 0 || gridOpeningMode === 'test1')" style="min-height: 0">
            <app-grid-display v-if="displayKind === 'default'" id="grid-container" :grid-data="renderGridData" :metadata="metadata" :elem-css-fn="(elem) => gridUtil.getElemBackgroundCss(elem, renderGridData, globalGridData, metadata.colorConfig.gridBackgroundColor)"/>
            <component v-else-if="displayKind === 'customDisplay'" :is="gridDisplayComponent" id="grid-container" :grid-data="renderGridData" :metadata="metadata" :elem-css-fn="(elem) => gridUtil.getElemBackgroundCss(elem, renderGridData, globalGridData, metadata.colorConfig.gridBackgroundColor)"/>
            <regions-grid-host v-else-if="displayKind === 'regions'" id="grid-container" :grid-data="renderGridData" :metadata="metadata" :display-component="gridDisplayComponent" :keep-boards="keepsBoards" :max-boards="persistenceState.max"/>
            <persistent-regions-host v-else-if="displayKind === 'persistentRegions'" id="grid-container" :grid-data="renderGridData" :metadata="metadata" :display-component="gridDisplayComponent" :keep-boards="keepsBoards" :max-boards="persistenceState.max" ref="regionsHost"/>
        </div>
        <grid-opening-metrics :grid-name="openingMetric.gridName" :open-time-ms="openingMetric.openTimeMs" :was-cached="openingMetric.wasCached" :phases="openingMetric.phases" :board-info="openingMetric.boardInfo" :global-info="openingMetric.globalInfo" :uses-cache="persistsBoards" :memory-boards="persistsBoards ? persistenceState : null" />
    </div>
</template>

<script>
    import $ from '../../js/externals/jquery.js';
    import {L} from "../../js/util/lquery.js";
    import {actionService} from "../../js/service/actionService";
    import {dataService} from "../../js/service/data/dataService";
    import {areService} from "../../js/service/areService";
    import {Router} from "./../../js/router.js";
    import {MetaData} from "../../js/model/MetaData.js";
    import {urlParamService} from "../../js/service/urlParamService";

    import {Scanner} from "../../js/input/scanning.js";
    import {Hover} from "../../js/input/hovering.js";
    import {Clicker} from "../../js/input/clicking.js";
    import {HuffmanInput} from "../../js/input/huffmanInput";
    import {DirectionInput} from "../../js/input/directionInput";
    import {SequentialInput} from "../../js/input/sequentialInput";

    import HeaderIcon from '../../vue-components/components/headerIcon.vue'
    import GridOpeningModeSelector from '../../vue-components/components/gridOpeningModeSelector.vue';
    import GridOpeningMetrics from '../../vue-components/components/gridOpeningMetrics.vue';
    import {constants} from "../../js/util/constants";
    import {i18nService} from "../../js/service/i18nService";
    import {util} from "../../js/util/util";
    import ScanningModal from '../../vue-components/modals/input/scanningModal.vue'
    import MouseModal from "../modals/input/mouseModal.vue";
    import DirectionInputModal from "../modals/input/directionInputModal.vue";
    import HuffmanInputModal from "../modals/input/huffmanInputModal.vue";
    import SequentialInputModal from "../modals/input/sequentialInputModal.vue";
    import {speechService} from "../../js/service/speechService";
    import {localStorageService} from "../../js/service/data/localStorageService";
    import {imageUtil} from "../../js/util/imageUtil";
    import {audioUtil} from "../../js/util/audioUtil.js";
    import UnlockModal from "../modals/unlockModal.vue";
    import {MainVue} from "../../js/vue/mainVue.js";
    import {stateService} from "../../js/service/stateService.js";
    import { systemActionService } from '../../js/service/systemActionService';
    import AppGridDisplay from '../grid-display/appGridDisplay.vue';
    import { gridUtil } from '../../js/util/gridUtil';
    import { collectElementService } from '../../js/service/collectElementService';
    import { predictionService } from '../../js/service/predictionService';
    import { liveElementService } from '../../js/service/liveElementService';
    import { GridElement } from '../../js/model/GridElement';
    import { gridOpeningMetrics } from '../../js/util/gridOpeningMetrics';
    import { recalculateTest1WithoutEmptyFillers } from './gridOpeningTests/test1WithoutEmptyFillers';
    import { scheduleTest8MetadataSave } from './gridOpeningTests/test8MetadataAfterPaint';
    import { recalculateDeducedZoneGrid, recalculateLargestAreaZoneGrid, recalculateLargestEmptyRectangleZoneGrid } from './gridOpeningTests/deducedZoneGrid';
    import { gridOpeningModeState } from '../../js/util/gridOpeningModeState';
    import RegionsGridHost from './gridOpeningTests/regionsGridHost.vue';
    import PersistentRegionsHost from './gridOpeningTests/persistentRegionsHost.vue';
    import { recalculateRegionsGrid, recalculateRegionsGridWithSimpleImprovements } from './gridOpeningTests/regionsGrid';
    import { recalculateRegionsGridPersistent, recalculateRegionsGridPersistentWithSimpleImprovements } from './gridOpeningTests/persistentRegionsGrid';
    import { clearPersistedBoards, persistenceState } from './gridOpeningTests/persistedBoards';
    import { recalculateFrozenLayeredGrid, recalculateFrozenNoFillersGrid } from './gridOpeningTests/test12LayeredGrid';
    import { modeHas } from './gridOpeningTests/modeFeatures';
    import { FastTextAppGridDisplay } from './gridOpeningTests/fastTextGridDisplay';
    import { createPhaseProfiler, groupPhases } from '../../js/util/gridOpeningPhaseProfiler';

    let vueApp = null;
    let UNLOCK_COUNT = 8;
    let modalTypes = {
        MODAL_SCANNING: 'MODAL_SCANNING',
        MODAL_MOUSE: 'MODAL_MOUSE',
        MODAL_DIRECTION: 'MODAL_DIRECTION',
        MODAL_HUFFMAN: 'MODAL_HUFFMAN',
        MODAL_SEQUENTIAL: 'MODAL_SEQUENTIAL',
        MODAL_UNLOCK: 'MODAL_UNLOCK'
    };

    let vueConfig = {
        props: {
            gridId: String,
            skipThumbnailCheck: Boolean,
            openingStartedAt: Number
        },
        data() {
            return {
                globalGridData: null,
                renderGridData: null,
                showGrid: false,
                metadata: null,
                updatedMetadataDoc: null,
                scanner: null,
                hover: null,
                clicker: null,
                directionInput: null,
                seqInput: null,
                huffmanInput: null,
                inputMethodsInitialized: false,
                showModal: null,
                modalTypes: modalTypes,
                unlockCount: UNLOCK_COUNT,
                unlockCounter: UNLOCK_COUNT,
                MainVue: MainVue,
                highlightTimeoutHandler: null,
                highlightedElementId: null,
                systemActionService: systemActionService,
                gridUtil: gridUtil,
                // Each experimental mode is dispatched separately; Original remains the default.
                // kept while the page stays loaded (e.g. coming back from the edit view); a reload starts with the original mode
                gridOpeningMode: gridOpeningModeState.mode,
                persistenceState: persistenceState,
                openingMetric: {
                    gridId: null,
                    gridName: '—',
                    openTimeMs: null,
                    wasCached: false,
                    phases: null,
                    boardInfo: null,
                    globalInfo: null
                },
            }
        },
        components: {
            AppGridDisplay,
            RegionsGridHost,
            PersistentRegionsHost,
            GridOpeningModeSelector,
            GridOpeningMetrics,
            UnlockModal,
            SequentialInputModal,
            HuffmanInputModal,
            DirectionInputModal,
            MouseModal,
            ScanningModal, HeaderIcon
        },
        computed: {
            // which display the template uses (modes 1 to 12 keep their own branches)
            displayKind() {
                let mode = this.gridOpeningMode;
                if (['test27', 'test28'].includes(mode)) {
                    return 'regions'; // group 3
                }
                if (['test29', 'test30', 'test31'].includes(mode)) {
                    return 'persistentRegions'; // group 4
                }
                if (this.modeHas('fastText')) {
                    return 'customDisplay';
                }
                return 'default';
            },
            // modes of group 4: the last boards opened are kept in memory (4.1: their prepared data; 4.2 and 4.99: also the mounted regions)
            persistsBoards() {
                return ['test29', 'test30', 'test31'].includes(this.gridOpeningMode);
            },
            keepsBoards() {
                return ['test30', 'test31'].includes(this.gridOpeningMode);
            },
            gridDisplayComponent() {
                return this.modeHas('fastText') ? FastTextAppGridDisplay : AppGridDisplay;
            }
        },
        methods: {
            // true if the selected opening mode includes the given feature (see gridOpeningTests/modeFeatures.js)
            modeHas(feature) {
                return modeHas(this.gridOpeningMode, feature);
            },
            openModal(modalType) {
                this.showModal = modalType;
                stopInputMethods();
            },
            lock() {
                let thiz = this;
                thiz.metadata.locked = true;
                thiz.unlockCounter = UNLOCK_COUNT;
                dataService.saveMetadata(thiz.metadata).then(() => {
                    this.setViewPropsLocked();
                });
            },
            unlock(force) {
                let thiz = this;
                if (!force && localStorageService.getAppSettings().unlockPasscode) {
                    thiz.showModal = modalTypes.MODAL_UNLOCK;
                    return;
                }
                thiz.unlockCounter--;
                util.debounce(function () {
                    thiz.unlockCounter = UNLOCK_COUNT;
                }, 3000);
                if (thiz.unlockCounter === 0 || force) {
                    thiz.metadata.locked = false;
                    dataService.saveMetadata(thiz.metadata).then(() => {
                        MainVue.restoreSidebar();
                        this.setViewPropsUnlocked();
                    });
                }
            },
            setViewPropsLocked() {
                $(document).trigger(constants.EVENT_SIDEBAR_CLOSE);
                $(document).trigger(constants.EVENT_UI_LOCKED);

                // prevent zoom
                $('#viewPortMeta').attr('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
                $('#gridView').on('touchmove', this.preventZoomHandler);
            },
            setViewPropsUnlocked() {
                $(document).trigger(constants.EVENT_UI_UNLOCKED);

                //enable zoom
                $('#viewPortMeta').attr('content', 'width=device-width, initial-scale=1');
                $('body').attr('touch-action', '');
                $('#gridView').off('touchmove', this.preventZoomHandler);
            },
            preventZoomHandler(event) {
                event.preventDefault();
            },
            reloadInputMethods() {
                this.initInputMethods({reload: true});
            },
            async initInputMethods(options = {}) {
                options.continueInputMethods = options.continueInputMethods || false;
                options.reload = options.reload || false;
                if (this.inputMethodsInitialized) {
                    stopInputMethods();
                }
                if (options.reload) {
                    let metadata = await dataService.getMetadata();
                    this.metadata = JSON.parse(JSON.stringify(metadata));
                    initContextmenu(); //in order to update visualization of active input methods in context menu
                }
                let thiz = this;
                let inputConfig = thiz.metadata.inputConfig;
                let selectionListener = (item) => {
                    this.stopHighlightElements();
                    L.removeAddClass(item, 'selected');
                    actionService.doAction(thiz.renderGridData, item.id);
                };
                let activeListener = (items, wrap, restarted) => {
                    if (!Array.isArray(items)) {
                        items = [items];
                    }
                    if (inputConfig.globalReadActive && items && items.length === 1 && items[0]) {
                        let text = items[0].ariaLabel || '';
                        let separatorIndex = text.indexOf(", ");
                        if (!inputConfig.globalReadAdditionalActions && separatorIndex !== -1 && separatorIndex !== 0) {
                            text = text.substring(0, separatorIndex);
                        }
                        speechService.speak(text, {
                            rate: inputConfig.globalReadActiveRate || 1
                        });
                    }

                    if (inputConfig.globalBeepFeedback) {
                        if (restarted) {
                            audioUtil.beepHighDouble();
                        } else if (wrap) {
                            audioUtil.beepHigh();
                        } else {
                            audioUtil.beep();
                        }
                    }
                };

                if (inputConfig.seqEnabled) {
                    thiz.seqInput = SequentialInput.getInstanceFromConfig(inputConfig, {
                        itemSelector: '.element-container:not([data-empty="true"])',
                        selectionListener: selectionListener,
                        activeListener: activeListener
                    });
                    thiz.seqInput.start(options.continueInputMethods);
                }

                if (inputConfig.dirEnabled) {
                    thiz.directionInput = DirectionInput.getInstanceFromConfig(inputConfig, '.element-container:not([data-empty="true"])', 'scanFocus', selectionListener);
                    thiz.directionInput.start();
                }

                if (inputConfig.huffEnabled) {
                    this.huffmanInput = HuffmanInput.getInstanceFromConfig(inputConfig, '.element-container', 'scanFocus', 'scanInactive', selectionListener);
                    this.huffmanInput.start();
                }

                if (inputConfig.scanEnabled) {
                    thiz.scanner = Scanner.getInstanceFromConfig(inputConfig, '.element-container:not([data-empty="true"])', 'scanFocus', 'scanInactive');
                    thiz.scanner.setSelectionListener(selectionListener);
                    thiz.scanner.setActiveListener(activeListener);
                    thiz.scanner.startScanning(options.continueInputMethods);
                }

                if (inputConfig.hoverEnabled) {
                    thiz.hover = Hover.getInstanceFromConfig(inputConfig, '.element-container', {
                        activeListener: activeListener,
                        containerClass: '.grid-container li'
                    });
                    thiz.hover.setSelectionListener(selectionListener);
                    thiz.hover.startHovering();
                } else {
                    $('#touchElement').hide();
                }

                if (inputConfig.mouseclickEnabled || inputConfig.mouseDoubleClickEnabled) {
                    thiz.clicker = Clicker.getInstanceFromConfig(inputConfig, '.element-container');
                    thiz.clicker.setSelectionListener(selectionListener);
                    thiz.clicker.startClickcontrol();
                }
                this.inputMethodsInitialized = true;
            },
            async onNavigateEvent(event, gridData, params, openingStartedAt) {
                await this.loadGridForCurrentMode(gridData, { continueInputMethods: true, openingStartedAt: openingStartedAt });
            },
            async loadGridForCurrentMode(gridData, options = {}) {
                if (this.gridOpeningMode === 'test1') {
                    return this.loadGrid(gridData, {
                        ...options,
                        recalculateRenderGrid: recalculateTest1WithoutEmptyFillers
                    });
                }
                let regionsRecalculate = {
                    test27: recalculateRegionsGrid, // 3.1: global board and dynamic board as separate regions
                    test28: recalculateRegionsGridWithSimpleImprovements, // 3.99: 3.1 + simple improvements (no fillers and frozen cells here, the rest by mode features)
                    test29: recalculateRegionsGridPersistent, // 4.1: 3.1 + prepared data of the last boards kept
                    test30: recalculateRegionsGridPersistent, // 4.2: 4.1 + the mounted regions kept (see the host)
                    test31: recalculateRegionsGridPersistentWithSimpleImprovements // 4.99: 4.2 + simple improvements
                }[this.gridOpeningMode];
                if (regionsRecalculate) {
                    return this.loadGrid(gridData, {
                        ...options,
                        recalculateRenderGrid: regionsRecalculate
                    });
                }
                if (this.modeHas('frozenCells') || this.modeHas('noFillers')) {
                    return this.loadGrid(gridData, {
                        ...options,
                        recalculateRenderGrid: this.modeHas('noFillers') ? recalculateFrozenNoFillersGrid : recalculateFrozenLayeredGrid
                    });
                }
                if (['test23', 'test24', 'test25', 'test26'].includes(this.gridOpeningMode)) {
                    // modes 2.1 to 2.4: global boards without a dynamic zone get a deduced one
                    // (2.1: free corner nearest to the origin, 2.2 and 2.3: biggest free rectangle reaching the border,
                    // 2.4: biggest free rectangle anywhere; 2.3 and 2.4 also preview the zone in the edit view)
                    return this.loadGrid(gridData, {
                        ...options,
                        recalculateRenderGrid: this.gridOpeningMode === 'test23'
                            ? recalculateDeducedZoneGrid
                            : (this.gridOpeningMode === 'test26' ? recalculateLargestEmptyRectangleZoneGrid : recalculateLargestAreaZoneGrid)
                    });
                }
                return this.loadGrid(gridData, options);
            },
            async onGridOpeningModeChange() {
                gridOpeningModeState.mode = this.gridOpeningMode;
                clearPersistedBoards();
                if (!this.renderGridData) {
                    return;
                }
                let openingStartedAt = performance.now();
                let gridData = await dataService.getGrid(this.renderGridData.id, false, true);
                await this.loadGridForCurrentMode(gridData, {
                    forceReload: true,
                    continueInputMethods: true,
                    openingStartedAt: openingStartedAt
                });
            },
            async loadGrid(gridData, options = {}) {
                options.continueInputMethods = options.continueInputMethods || false;
                options.forceReload = options.forceReload || false;
                let isAlreadyOpenWithoutReload = gridData
                    && this.renderGridData
                    && gridData.id === this.renderGridData.id
                    && !options.forceReload;
                let measurementStartedAt = options.openingStartedAt === undefined || isAlreadyOpenWithoutReload
                    ? null
                    : gridOpeningMetrics.start(options.openingStartedAt);
                // Phase breakdown for the metrics bar (measurement only, any mode).
                let profiler = measurementStartedAt !== null
                    ? createPhaseProfiler(measurementStartedAt)
                    : null;
                if (profiler) {
                    profiler.mark('lectura');
                }
                collectElementService.clearCollectElements();
                if (gridData && (options.forceReload || !this.renderGridData || this.renderGridData.id !== gridData.id)) {
                    if (gridUtil.hasAREModel(gridData)) {
                        let areModel = gridUtil.getAREModel(gridData);
                        areService.uploadAndStartModel(areModel.dataBase64, gridUtil.getAREURL(gridData), areModel.fileName);
                    }

                    // this line before recalculateRenderGrid since it changes gridData!
                    // mode 1.5: no thumbnail logic when opening a board (thumbnails are only seen in the board management view, which has its own update button)
                    let updateThumbnail = !this.modeHas('noThumbnailOnOpen') && gridUtil.hasOutdatedThumbnail(gridData) && !this.skipThumbnailCheck;

                    // Same calls as before, split in two statements only to time the synchronous
                    // data part ("datos") apart from the wait where Vue mounts the board ("montaje").
                    if (options.recalculateRenderGrid) {
                        let preparation = options.recalculateRenderGrid.call(this, gridData);
                        if (profiler) {
                            profiler.mark('datos');
                        }
                        await preparation;
                    } else {
                        let preparation = this.recalculateRenderGrid(gridData);
                        if (profiler) {
                            profiler.mark('datos');
                        }
                        await preparation;
                    }
                    if (profiler) {
                        profiler.mark('montaje');
                    }
                    Router.addToGridHistory(this.renderGridData.id);

                    if (updateThumbnail) {
                        imageUtil.allImagesLoaded().then(async () => {
                            let screenshot = await imageUtil.getScreenshot("#grid-container");
                            let thumbnail = {
                                data: screenshot,
                                shouldUpdate: false
                            };
                            dataService.saveThumbnail(this.renderGridData.id, thumbnail);
                        })
                    }

                    if (this.metadata.lastOpenedGridId !== gridData.id) {
                        this.metadata.lastOpenedGridId = gridData.id;
                        if (this.modeHas('metadataAfterPaint')) {
                            scheduleTest8MetadataSave(this.metadata, dataService.saveMetadata);
                        } else {
                            await dataService.saveMetadata(this.metadata);
                        }
                    }
                }

                if (profiler) {
                    profiler.mark('metadata');
                }
                await this.$nextTick();
                if (profiler) {
                    profiler.mark('nextTick');
                }
                initContextmenu();
                this.initInputMethods(options);
                this.highlightElements();
                await predictionService.initWithElements(this.renderGridData.gridElements);
                collectElementService.initWithGrid(this.renderGridData);
                liveElementService.initWithElements(this.renderGridData.gridElements);
                $(document).trigger(constants.EVENT_GRID_LOADED);
                if (profiler) {
                    profiler.mark('servicios');
                    // the total opening time ends when the browser has painted the board
                    let openedGridId = this.renderGridData.id;
                    let showPhases = this.showOpeningPhases(openedGridId);
                    profiler.finishAfterPaint((phases) => {
                        if (!this.renderGridData || this.renderGridData.id !== openedGridId) {
                            return; // another board was opened in the meantime
                        }
                        this.recordOpeningMetric(measurementStartedAt, gridData);
                        showPhases(phases);
                    });
                }
            },
            recordOpeningMetric(measurementStartedAt, openedGridData = null) {
                if (measurementStartedAt === null) {
                    return;
                }
                let label = this.renderGridData.label;
                let openTimeMs = gridOpeningMetrics.elapsed(measurementStartedAt);
                let gridId = this.renderGridData.id;
                this.openingMetric = {
                    gridId: gridId,
                    gridName: i18nService.getTranslation(label) || this.renderGridData.id,
                    openTimeMs: openTimeMs,
                    // Test 5 reports whether this board component was kept alive.
                    wasCached: this.persistsBoards && persistenceState.lastHit,
                    phases: null,
                    boardInfo: null,
                    globalInfo: null
                };
                // describe the board and the global board later, when the browser is idle (never in the opening path):
                // size (columns x rows) and number of images (embedded / from a URL) of each one on its own
                gridOpeningMetrics.whenIdle(async () => {
                    let renderedGrid = this.renderGridData;
                    if (!renderedGrid || renderedGrid.id !== gridId) {
                        return;
                    }
                    let describe = (grid) => {
                        if (!grid || !grid.gridElements) {
                            return null;
                        }
                        let counts = gridOpeningMetrics.countImages(grid.gridElements);
                        return {
                            name: i18nService.getTranslation(grid.label) || grid.id,
                            columns: gridUtil.getWidthWithBounds(grid),
                            rows: gridUtil.getHeightWithBounds(grid),
                            embedded: counts.embedded,
                            urls: counts.urls
                        };
                    };
                    let ownGrid = openedGridData || await dataService.getGrid(gridId, false, true);
                    let globalGrid = null;
                    if (renderedGrid.showGlobalGrid) {
                        globalGrid = renderedGrid.globalGridId
                            ? await dataService.getGrid(renderedGrid.globalGridId, false, true)
                            : this.globalGridData;
                    }
                    if (this.openingMetric.gridId === gridId && this.renderGridData === renderedGrid) {
                        this.openingMetric = {
                            ...this.openingMetric,
                            boardInfo: describe(ownGrid),
                            globalInfo: renderedGrid.showGlobalGrid ? describe(globalGrid) : false
                        };
                    }
                });
            },
            showOpeningPhases(gridId) {
                // returns a callback that shows the phase breakdown in the metrics bar,
                // unless another board was opened in the meantime
                return (phases) => {
                    if (this.openingMetric.gridId === gridId) {
                        this.openingMetric = { ...this.openingMetric, phases: groupPhases(phases) };
                    }
                };
            },
            highlightElements() {
                clearTimeout(this.highlightTimeoutHandler);
                let params = urlParamService.getSearchQueryParams();
                if (params.highlightIds) {
                    $(`#${params.highlightIds[0]}`).addClass('highlight');
                    this.highlightTimeoutHandler = setTimeout(() => {
                        this.stopHighlightElements();
                    }, 15000);
                    this.highlightedElementId = params.highlightIds[0];
                    params.highlightIds.shift();
                    params.highlightIds = params.highlightIds.length > 0 ? params.highlightIds : null;
                    urlParamService.setParamsToSearchQuery(params);
                }
            },
            stopHighlightElements() {
                if (this.highlightedElementId) {
                    $(`#${this.highlightedElementId}`).removeClass('highlight');
                    this.highlightedElementId = null;
                }
            },
            toEditGrid() {
                Router.toEditGrid(this.renderGridData.id);
            },
            toLogin() {
                Router.toLogin();
            },
            async onExternalUpdate(event, updatedIds, updatedDocs, deletedIds) {
                let thiz = this;
                if (!vueApp) {
                    setTimeout(() => {
                        thiz.onExternalUpdate(event, updatedIds, updatedDocs);
                    }, 500);
                    return;
                }
                if (deletedIds.includes(vueApp.gridId)) {
                    Router.toManageGrids();
                    return;
                }
                log.debug('got update event, ids updated:' + updatedIds);
                let updatedGridDoc = updatedDocs.filter(doc => (vueApp.renderGridData && doc.id === vueApp.renderGridData.id))[0];
                let hasUpdatedGlobalGrid = updatedDocs.filter(doc => (this.metadata && doc.id === this.metadata.globalGridId)).length > 0;
                this.updatedMetadataDoc = updatedDocs.filter(doc => (vueApp.metadata && doc.id === vueApp.metadata.id))[0] || this.updatedMetadataDoc;
                if (updatedGridDoc) {
                    let gridDoc = await dataService.getGrid(updatedGridDoc.id); // get again in order to be sure to have correct revision on conflicts
                    vueApp.loadGridForCurrentMode(gridDoc, { continueInputMethods: true, forceReload: true });
                } else if (hasUpdatedGlobalGrid) {
                    let gridData = await dataService.getGrid(vueApp.renderGridData.id, false, true);
                    this.globalGridData = await dataService.getGlobalGrid();
                    vueApp.loadGridForCurrentMode(gridData, { continueInputMethods: true, forceReload: true });
                }
                if (localStorageService.getAppSettings().syncNavigation) {
                    if (this.updatedMetadataDoc && this.updatedMetadataDoc.lastOpenedGridId !== vueApp.renderGridData.id) {
                        dataService.getGrid(this.updatedMetadataDoc.lastOpenedGridId).then(toGrid => {
                            if (!gridUtil.hasOutdatedThumbnail(toGrid)) {
                                Router.toLastOpenedGrid();
                            }
                        });
                        return;
                    }
                    if (this.updatedMetadataDoc && this.updatedMetadataDoc.fullscreen !== vueApp.metadata.fullscreen) {
                        if (this.updatedMetadataDoc.fullscreen) {
                            systemActionService.enterFullscreen(true);
                        } else {
                            MainVue.restoreSidebar();
                        }
                    }
                    if (this.updatedMetadataDoc && this.updatedMetadataDoc.locked !== vueApp.metadata.locked) {
                        if (this.updatedMetadataDoc.locked) {
                            vueApp.lock();
                        } else {
                            vueApp.unlock(true);
                        }
                    }
                }
                this.metadata = this.updatedMetadataDoc || this.metadata;
            },
            async recalculateRenderGrid(gridData) {
                // attention: gridData also changes because of "noDeepCopy: true"
                // just using this.renderGridData for clarity
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
                    this.renderGridData = gridUtil.mergeGrids(gridData, globalGrid, {
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
            },
            onSidebarOpen() {
                if (!vueApp || !vueApp.metadata) {
                    return;
                }
                vueApp.metadata.fullscreen = false;
                $(document).trigger(constants.EVENT_GRID_RESIZE);
            },
            resizeListener() {
                let thiz = this;
                util.debounce(function () {
                    if (thiz.huffmanInput) {
                        thiz.huffmanInput.reinit();
                    }
                }, 500);
            },
            contextMenuListener(event) {
                event.preventDefault();
            },
            async metadataUpdated() {
                this.metadata = await dataService.getMetadata();
            },
            async rerenderGrid() {
                if (this.renderGridData) {
                    // Reload the grid with fresh data without updating metadata
                    let freshGridData = await dataService.getGrid(this.renderGridData.id);
                    await this.loadGridForCurrentMode(freshGridData, { forceReload: true });
                }
            }
        },
        created() {
            $(document).on(constants.EVENT_DB_PULL_UPDATED, this.onExternalUpdate);
            $(document).on(constants.EVENT_SIDEBAR_OPEN, this.onSidebarOpen);
            $(document).on(constants.EVENT_NAVIGATE_GRID_IN_VIEWMODE, this.onNavigateEvent);
            document.addEventListener('contextmenu', this.contextMenuListener);
            window.addEventListener('resize', this.resizeListener, true);
            $(document).on(constants.EVENT_GRID_RESIZE, this.resizeListener);
            $(document).on(constants.EVENT_METADATA_UPDATED, this.metadataUpdated);
            $(document).on(constants.EVENT_GRID_RERENDER, this.rerenderGrid);
        },
        beforeDestroy() {
            clearPersistedBoards();
            $(document).off(constants.EVENT_DB_PULL_UPDATED, this.onExternalUpdate);
            $(document).off(constants.EVENT_SIDEBAR_OPEN, this.onSidebarOpen);
            $(document).off(constants.EVENT_NAVIGATE_GRID_IN_VIEWMODE, this.onNavigateEvent);
            document.removeEventListener('contextmenu', this.contextMenuListener);
            window.removeEventListener('resize', this.resizeListener, true);
            $(document).off(constants.EVENT_GRID_RESIZE, this.resizeListener);
            $(document).off(constants.EVENT_METADATA_UPDATED, this.metadataUpdated);
            $(document).off(constants.EVENT_GRID_RERENDER, this.rerenderGrid);
            stopInputMethods();
            this.setViewPropsUnlocked();
            $.contextMenu('destroy');
            liveElementService.stop();
            vueApp = null;
        },
        mounted: async function () {
            vueApp = this;
            let savedMetadata = await dataService.getMetadata();
            let metadata = JSON.parse(JSON.stringify(savedMetadata || new MetaData()));
            metadata.lastOpenedGridId = this.gridId;
            metadata.locked = metadata.locked === undefined ? urlParamService.isDemoMode() && dataService.getCurrentUser() === constants.LOCAL_DEMO_USERNAME : metadata.locked;
            if (metadata.locked) {
                $(document).trigger(constants.EVENT_UI_LOCKED);
            }
            metadata.fullscreen = metadata.fullscreen === undefined ? urlParamService.isDemoMode() && dataService.getCurrentUser() === constants.LOCAL_DEMO_USERNAME : metadata.fullscreen;
            metadata.fullscreen = urlParamService.isFullscreen(true) ? true : metadata.fullscreen;
            metadata.fullscreen = metadata.fullscreen && util.isFullscreen();
            metadata.locked = urlParamService.isLocked(true) ? true : metadata.locked;
            metadata.inputConfig.scanEnabled = urlParamService.isScanningEnabled() ? true : metadata.inputConfig.scanEnabled;
            metadata.inputConfig.dirEnabled = urlParamService.isDirectionEnabled() ? true : metadata.inputConfig.dirEnabled;
            metadata.inputConfig.huffEnabled = urlParamService.isHuffmanEnabled() ? true : metadata.inputConfig.huffEnabled;
            dataService.saveMetadata(metadata).then(() => {
                if (metadata.locked) {
                    this.setViewPropsLocked();
                }
            });
            this.metadata = metadata;
            this.globalGridData = await dataService.getGlobalGrid();
            let gridData = await dataService.getGrid(this.gridId, false, true);
            if (!gridData) {
                log.warn('grid not found! gridId: ' + this.gridId);
                let grids = await dataService.getGrids(false, true);
                if (grids && grids[0]) {
                    gridData = await dataService.getGrid(grids[0].id);
                } else {
                    return Router.toManageGrids();
                }
            }
            this.loadGridForCurrentMode(gridData, { openingStartedAt: this.openingStartedAt });
        }
    };

    function stopInputMethods() {
        if (!vueApp) {
            return;
        }
        if (vueApp.scanner) vueApp.scanner.destroy();
        if (vueApp.hover) vueApp.hover.destroy();
        if (vueApp.clicker) vueApp.clicker.destroy();
        if (vueApp.directionInput) vueApp.directionInput.destroy();
        if (vueApp.huffmanInput) vueApp.huffmanInput.destroy();
        if (vueApp.seqInput) vueApp.seqInput.destroy();
        vueApp.inputMethodsInitialized = false;
    }

    function initContextmenu() {
        $.contextMenu('destroy');
        let CONTEXT_MOUSE = "CONTEXT_MOUSE";
        let CONTEXT_SCANNING = "CONTEXT_SCANNING";
        let CONTEXT_DIRECTION = "CONTEXT_DIRECTION";
        let CONTEXT_HUFFMAN = "CONTEXT_HUFFMAN";
        let CONTEXT_SEQUENTIAL = "CONTEXT_SEQUENTIAL";

        function getName(i18nKey, isActive) {
            let translated = i18nService.t(i18nKey);
            let activeText = isActive ? ' ' + i18nService.t('activeBracket') : '';
            return `${translated}${activeText}`;
        }

        let inputConfig = vueApp.metadata.inputConfig;
        let mouseTouchEnabled = inputConfig.mouseclickEnabled || inputConfig.hoverEnabled;
        let contextItems = {
            CONTEXT_MOUSE: {
                name: getName('mousetouchInput', mouseTouchEnabled),
                icon: "fas fa-mouse-pointer",
                className: mouseTouchEnabled ? 'boldFont' : ''
            },
            CONTEXT_SCANNING: {
                name: getName('scanning', inputConfig.scanEnabled),
                icon: "fas fa-sort-amount-down",
                className: inputConfig.scanEnabled ? 'boldFont' : ''
            },
            CONTEXT_DIRECTION: {
                name: getName('directionInput', inputConfig.dirEnabled),
                icon: "fas fa-arrows-alt",
                className: inputConfig.dirEnabled ? 'boldFont' : ''
            },
            CONTEXT_HUFFMAN: {
                name: getName('huffmanInput', inputConfig.huffEnabled),
                icon: "fas fa-ellipsis-h",
                className: inputConfig.huffEnabled ? 'boldFont' : ''
            },
            CONTEXT_SEQUENTIAL: {
                name: getName('sequentialInput', inputConfig.seqEnabled),
                icon: "fas fa-arrow-right",
                className: inputConfig.seqEnabled ? 'boldFont' : ''
            }
        };

        $.contextMenu({
            selector: '#inputConfigButton',
            callback: function (key, options) {
                handleContextMenu(key);
            },
            trigger: 'left',
            items: contextItems,
            zIndex: 10
        });

        function handleContextMenu(key, elementId) {
            switch (key) {
                case CONTEXT_MOUSE: {
                    vueApp.openModal(modalTypes.MODAL_MOUSE);
                    break;
                }
                case CONTEXT_SCANNING: {
                    vueApp.openModal(modalTypes.MODAL_SCANNING);
                    break;
                }
                case CONTEXT_DIRECTION: {
                    vueApp.openModal(modalTypes.MODAL_DIRECTION);
                    break;
                }
                case CONTEXT_HUFFMAN: {
                    vueApp.openModal(modalTypes.MODAL_HUFFMAN);
                    break;
                }
                case CONTEXT_SEQUENTIAL: {
                    vueApp.openModal(modalTypes.MODAL_SEQUENTIAL);
                    break;
                }
            }
        }
    }

    export default vueConfig;
</script>

<style scoped>
    .floating-controls {
        position: fixed;
        top: 0.2em;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        display: inline-flex;
        gap: 0.3em;
    }

    .floating-control-button {
        height: 1.4em;
        min-width: 2.5em;
        padding: 0 0.55em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.25em;
        line-height: 1;
    }

    .floating-control-button:focus {
        outline: none;
    }

    .floating-control-button:focus:not(:hover):not(:active) {
        border-color: transparent;
        background-color: #f8f8f8;
    }

    @media (hover: none) {
        .floating-control-button:focus:not(:active) {
            border-color: transparent;
            background-color: #f8f8f8;
        }
    }

    .floating-control-button:focus-visible {
        outline: 2px solid #266697;
        outline-offset: 2px;
    }

    .floating-control-button i {
        font-size: 1em;
    }
</style>
