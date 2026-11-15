<template>
    <!-- (no regions while the board shown is still the one prepared by another mode, right after choosing this mode) -->
    <div v-if="regions" class="persistent-regions-board">
        <!-- global region: stays mounted while the global board and the settings are the same -->
        <div v-show="regions.global" class="persistent-regions-region persistent-regions-global">
            <maybe-keep-alive :keep="keepBoards" :max="2">
                <kept-region v-if="regions.global" :key="regions.global.key" :display-component="displayComponent || defaultDisplayComponent" :grid-data="regions.global.gridData" :metadata="stableMetadata" :elem-css-fn="cssFnFor(regions.global.gridData)"/>
            </maybe-keep-alive>
        </div>
        <!-- dynamic region: over the zone of the global board, or the whole area without a global board.
             Without keeping boards (mode 4.1) the same region is reused for every board; keeping boards (modes 4.2 and 4.99)
             every board has its own mounted region, and the ones of the last boards opened are kept in memory (keep-alive). -->
        <div class="persistent-regions-region" :style="dynamicStyle">
            <maybe-keep-alive :keep="keepBoards" :max="maxBoards">
                <kept-region :key="keepBoards ? regions.dynamic.key : undefined" :display-component="displayComponent || defaultDisplayComponent" :grid-data="regions.dynamic.gridData" :metadata="stableMetadata" :elem-css-fn="cssFnFor(regions.dynamic.gridData)"/>
            </maybe-keep-alive>
        </div>
    </div>
</template>

<script>
// Host of the regions of group 4. It is independent of the host of group 3 (regionsGridHost.vue).
import AppGridDisplay from '../../grid-display/appGridDisplay.vue';
import { gridUtil } from '../../../js/util/gridUtil';
import { stateService } from '../../../js/service/stateService';

// cell background functions are shared between renders: a new function would make the region render again
const cssFunctions = new Map();

// the settings the cells are drawn with (not the "last opened board" or the revision, which change at every opening)
function metadataSignature(metadata) {
    return JSON.stringify(metadata, (key, value) => (key === '_rev' || key === 'lastOpenedGridId') ? undefined : value);
}

// keep-alive (keeps the mounted regions of the last boards, at most "max") or nothing at all
const MaybeKeepAlive = {
    functional: true,
    props: ['keep', 'max'],
    render(h, context) {
        return context.props.keep ? h('keep-alive', { props: { max: context.props.max } }, context.children) : context.children;
    }
};

// a region (the display of one board). When a region kept in memory is shown again, its cells may be out of date
const KeptRegion = {
    name: 'KeptRegion',
    props: ['displayComponent', 'gridData', 'metadata', 'elemCssFn'],
    render(h) {
        return h(this.displayComponent, {
            ref: 'display',
            props: { gridData: this.gridData, metadata: this.metadata, elemCssFn: this.elemCssFn }
        });
    },
    deactivated() {
        // The cells keep the classes of the last interactions (the original does not remove them, because it destroys the
        // cells when the board is left). When the region is put back in the document the browser starts their CSS
        // animations again, so the cells clicked before would flash again: "selected" (click animation), "highlight"
        // (search highlight, which could not be removed while the region was away) and "mouseentered" (hover).
        if (this.$el && this.$el.querySelectorAll) {
            this.$el.querySelectorAll('.selected, .highlight, .mouseentered').forEach(element => {
                element.classList.remove('selected', 'highlight', 'mouseentered');
            });
        }
    },
    activated() {
        if (!this.activatedBefore) { // the first time is the normal mounting
            this.activatedBefore = true;
            return;
        }
        // the window may have changed its size while the region was away
        if (this.$refs.display && this.$refs.display.recalculate) {
            this.$refs.display.recalculate();
        }
        // grammatical changes (masculine, plural...) chosen while the region was away
        if (stateService.getCurrentWordFormTags().length > 0) {
            stateService.applyWordFormsToUI();
        }
    }
};

export default {
    components: { MaybeKeepAlive, KeptRegion },
    props: ['gridData', 'metadata', 'elemCssFn', 'displayComponent', 'keepBoards', 'maxBoards'],
    data() {
        return {
            defaultDisplayComponent: AppGridDisplay,
            stableMetadata: this.metadata,
            signature: metadataSignature(this.metadata)
        };
    },
    computed: {
        regions() {
            return this.gridData && this.gridData.regions ? this.gridData.regions : null;
        },
        dynamicStyle() {
            let percent = this.regions.dynamic.percent;
            return {
                left: percent.left + '%',
                top: percent.top + '%',
                width: percent.width + '%',
                height: percent.height + '%'
            };
        }
    },
    watch: {
        // the metadata object is replaced after every opening: the regions only get a new one if a setting changed,
        // otherwise the global region would be drawn again at every opening
        metadata: {
            deep: true,
            handler(newMetadata) {
                let signature = metadataSignature(newMetadata);
                if (signature !== this.signature) {
                    this.signature = signature;
                    this.stableMetadata = newMetadata;
                }
            }
        }
    },
    methods: {
        cssFnFor(grid) {
            let defaultBackground = this.metadata.colorConfig.gridBackgroundColor;
            let key = grid.backgroundColor + '|' + defaultBackground;
            if (!cssFunctions.has(key)) {
                let region = { backgroundColor: grid.backgroundColor };
                cssFunctions.set(key, (elem) => gridUtil.getElemBackgroundCss(elem, region, null, defaultBackground));
            }
            return cssFunctions.get(key);
        }
    }
}
</script>

<style>
/* the dynamic region is over the global region; both have their own rows and columns */
.persistent-regions-board {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    max-width: 100%;
    min-height: 0;
}

.persistent-regions-region {
    position: absolute;
    display: flex;
}

.persistent-regions-region.persistent-regions-global {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}
</style>
