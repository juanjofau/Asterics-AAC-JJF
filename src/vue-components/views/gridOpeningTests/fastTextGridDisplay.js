import AppGridDisplay from '../../grid-display/appGridDisplay.vue';
import AppGridElement from '../../grid-display/appGridElement.vue';
import GridElementTextContainer from '../../grid-display/grid-elements/gridElementTextContainer.vue';
import { TextConfig } from '../../../js/model/TextConfig';
import { constants } from '../../../js/util/constants';
import $ from '../../../js/externals/jquery';

// "fastText": the cell text size is computed BEFORE the first render.
//
// The original text container renders with font size 0, then in mounted() measures the text
// (reading the computed font family from the DOM, once per cell, and the page width, which forces
// a layout) and renders a second time. Here the same calculation runs in created(): the computed
// font family is read only once per family (cached), the width is measured on a canvas, and the
// cell renders once, with its final size. Same formulas and same canvas measuring as the original.

const FONT_ADAPT_MAX_ROUNDS = 10;
const MOBILE_MAX_WIDTH = 480;
const TEXT_MARGIN = 5;

let computedFamilies = new Map();
let measureContext = null;

// the font family as the browser computes it for a cell with the given font family (read once per family)
function computedFontFamily(fontFamily) {
    if (!computedFamilies.has(fontFamily)) {
        let probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;';
        probe.style.fontFamily = fontFamily;
        document.body.appendChild(probe);
        let family = window.getComputedStyle(probe, null).getPropertyValue('font-family') || 'Times New Roman';
        document.body.removeChild(probe);
        computedFamilies.set(fontFamily, family);
    }
    return computedFamilies.get(fontFamily);
}

function textWidth(text, family, px) {
    measureContext = measureContext || document.createElement('canvas').getContext('2d');
    measureContext.font = 'bold ' + px + 'px ' + family;
    return measureContext.measureText(text).width;
}

// same algorithm as fontUtil.getFittingFontSize, measuring with the cached family
function fittingFontSize(text, family, options) {
    if (!text) {
        return 0;
    }
    let padding = options.padding === undefined ? 5 : options.padding;
    let maxLines = options.maxLines || 1;
    let containerPct = options.containerPct || 100;
    let maxSize = options.maxSize || Number.MAX_SAFE_INTEGER;
    let lineHeight = options.lineHeight || 1;
    let containerSize = options.containerSize;
    let tryPx = 14;
    let width = textWidth(text, family, tryPx);
    let maxWH = Math.max(width, tryPx);
    let containerWidth = Math.max(0, containerSize.width * (containerPct / 100) - 2 * padding) * maxLines;
    if (maxLines > 1) {
        let words = text.split(' ');
        let maxLength = Math.max.apply(null, words.map(word => word.length));
        let longestWord = words.find(word => word.length === maxLength);
        maxSize = Math.min(maxSize, fittingFontSize(longestWord, family, Object.assign({}, options, { maxLines: 1 })));
        containerWidth = containerWidth * 0.9;
    }
    for (let count = 0; count < FONT_ADAPT_MAX_ROUNDS && Math.abs(maxWH - containerWidth) > 1; count++) {
        let factor = maxWH / containerWidth;
        tryPx = tryPx / factor;
        width = textWidth(text, family, tryPx);
        maxWH = Math.max(width, tryPx);
    }
    if (maxWH > containerWidth) {
        tryPx -= 0.5;
        tryPx = Math.floor(tryPx);
    }
    return Math.min(maxSize, tryPx, (containerSize.height * containerPct / 100) / lineHeight);
}

const FastTextContainer = Object.assign({}, GridElementTextContainer, {
    name: 'FastTextGridElementTextContainer',
    created() {
        this.calcFontSize(); // before the first render: the cell is drawn once, with its final size
    },
    // same as the original mounted(), except that the size is not calculated again if created() already did it
    mounted() {
        if (!this.ready) {
            this.calcFontSize();
        }
        $(document).on(`${constants.EVENT_ELEM_TEXT_CHANGED}.${this.gridElement.id}`, this.externalUpdateFn);
        if (this.editable || this.watchForChanges) {
            this.$watch("metadata", () => {
                this.calcFontSize();
            }, { deep: true });
            this.$watch("gridElement", () => {
                this.calcFontSize();
            }, { deep: true });
        }
    },
    methods: Object.assign({}, GridElementTextContainer.methods, {
        calcFontSize() {
            if (!this.containerSize || !this.metadata) {
                return;
            }
            let size = this.containerSize;
            this.lineHeight = this.withImage ? this.metadata.textConfig.lineHeight : this.metadata.textConfig.onlyTextLineHeight;
            this.maxLines = this.withImage ? this.metadata.textConfig.maxLines : 100;
            this.fontSizePx = this.getFontSizePx(size);
            this.maxTextContainerHeight = this.withImage ? (this.fontSizePx * this.lineHeight * this.metadata.textConfig.maxLines) + 'px' : '100%';
            this.textOverflow = this.metadata.textConfig.fittingMode === TextConfig.TOO_LONG_ELLIPSIS ? 'ellipsis' : 'clip';
            this.whiteSpaceWrap = this.maxLines === 1 ? 'nowrap' : 'normal';
            this.ready = true;
        },
        getFontSizePx(size) {
            let label = this.calculateLabel;
            let family = computedFontFamily(this.metadata.textConfig.fontFamily);
            let fontSize = this.getBaseFontSize(size);
            let realWidth = textWidth(label, family, fontSize);
            let kbdContainerPct = 80;
            this.txtMargin = TEXT_MARGIN;
            if (window.innerWidth < MOBILE_MAX_WIDTH) { // innerWidth does not force a layout (clientWidth did, once per cell)
                this.txtMargin = 0;
                kbdContainerPct = 100;
            }
            if (this.metadata.textConfig.fittingMode === TextConfig.TOO_LONG_AUTO && realWidth > size.width - 2 * this.txtMargin) {
                let newFontSize = fittingFontSize(label, family, {
                    maxLines: this.maxLines,
                    padding: this.txtMargin,
                    maxSize: fontSize,
                    lineHeight: this.lineHeight,
                    containerSize: size
                });
                if (this.withImage && this.maxLines === 1) {
                    let factor = newFontSize / fontSize;
                    this.lineHeight /= factor;
                }
                fontSize = newFontSize;
            }
            if (!this.disableAutoSizeKeyboard && this.metadata.textConfig.autoSizeKeyboardLetters && !this.withImage &&
                (label.length === 1 || (label.length === 2 && new RegExp(constants.EMOJI_REGEX, '').test(label)))) {
                fontSize = fittingFontSize(label, family, {
                    containerPct: kbdContainerPct,
                    lineHeight: this.lineHeight,
                    padding: this.txtMargin,
                    containerSize: size
                });
            }
            return fontSize;
        }
    })
});
delete FastTextContainer._Ctor;

// Copies a component tree, replacing some components (the original components are not modified).
function withReplacements(component, replacements, done = new Map()) {
    if (!component || typeof component !== 'object') {
        return component;
    }
    if (replacements.has(component)) {
        return replacements.get(component);
    }
    if (done.has(component)) {
        return done.get(component);
    }
    done.set(component, component);
    let components = component.components || {};
    let newComponents = {};
    let changed = false;
    Object.keys(components).forEach(name => {
        newComponents[name] = withReplacements(components[name], replacements, done);
        changed = changed || newComponents[name] !== components[name];
    });
    if (!changed) {
        return component;
    }
    let copy = Object.assign({}, component, { components: newComponents });
    delete copy._Ctor;
    done.set(component, copy);
    return copy;
}

const fastAppGridElement = withReplacements(AppGridElement, new Map([[GridElementTextContainer, FastTextContainer]]));

// AppGridDisplay passes the cell component through its data, not through "components"
export const FastTextAppGridDisplay = Object.assign({}, AppGridDisplay, {
    name: 'FastTextAppGridDisplay',
    data() {
        return Object.assign({}, AppGridDisplay.data.call(this), { AppGridElement: fastAppGridElement });
    }
});
delete FastTextAppGridDisplay._Ctor;
