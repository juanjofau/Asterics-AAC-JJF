// The opening mode chosen in the mode selector of the grid view (see gridOpeningModeSelector.vue).
// It is kept here, outside the views, for two reasons: the grid view is created again after the edit view,
// and the edit view needs to know the mode (mode 2.3 shows a preview of the dynamic zone there).
// A page reload starts with the original mode again.
export const gridOpeningModeState = {
    mode: 'original'
};
