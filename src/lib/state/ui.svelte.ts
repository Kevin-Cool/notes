type UiState = {
    showCustomBar: boolean;
    isSearchOverlayOpen: boolean;
};

export const uiState: UiState = $state({
    showCustomBar: true,
    isSearchOverlayOpen: false,
});