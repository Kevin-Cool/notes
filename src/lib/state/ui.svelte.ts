type UiState = {
    showCustomBar: boolean;
    isSearchOverlayOpen: boolean;
    activeContextMenuKey: string | null;
};

export const uiState: UiState = $state({
    showCustomBar: true,
    isSearchOverlayOpen: false,
    activeContextMenuKey: null,
});


// Helpers
export function openContextMenu(key: string): void {
    uiState.activeContextMenuKey = key;
}

export function closeContextMenu(key: string): void {
    if (uiState.activeContextMenuKey !== key) {
        return;
    }

    uiState.activeContextMenuKey = null;
}

export function closeAllContextMenus(): void {
    uiState.activeContextMenuKey = null;
}