// Ingredients of the opening modes that combine simple improvements (mode group 1, mode 3.99 and mode 4.99).
// A mode is a list of features, so modes can be combined without new conditions in gridView.
//   metadataAfterPaint  save "last opened board" after the board is painted (mode 1.4)
//   fastText            text size of each cell computed before its first render, no second render (mode 1.1)
//   frozenCells         cells are not made deeply reactive by Vue, they don't change in view mode (mode 1.3)
//   noThumbnailOnOpen   opening a board never captures its thumbnail; thumbnails are only seen in the board
//                       management view, which has its own update button (mode 1.5)
//   noFillers           no invisible filler cell is created for the free places of the grid (mode 1.2)
// The CSS containment of each cell was dropped: it changes anti-aliasing.
const ALL_SIMPLE_IMPROVEMENTS = ['metadataAfterPaint', 'fastText', 'frozenCells', 'noThumbnailOnOpen', 'noFillers'];

export const MODE_FEATURES = {
    test8: ['metadataAfterPaint'],
    test15: ['fastText'],
    test16: ['frozenCells'],
    test17: ['noThumbnailOnOpen'],
    // mode 1.99: all the simple improvements together
    test22: ALL_SIMPLE_IMPROVEMENTS,
    // mode 3.99: mode 3.1 (separate regions) with the same simple improvements as mode 1.99
    test28: ALL_SIMPLE_IMPROVEMENTS,
    // mode 4.99: mode 4.2 (last boards kept in memory) with the same simple improvements as mode 1.99
    test31: ALL_SIMPLE_IMPROVEMENTS
};

export function modeHas(mode, feature) {
    let features = MODE_FEATURES[mode];
    return !!features && features.includes(feature);
}
