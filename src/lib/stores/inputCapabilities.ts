import { browser } from '$app/environment';
import { readable, type Readable } from 'svelte/store';

export interface InputCapabilities {
    hasFinePointer: boolean;
    hasHover: boolean;
    isTouchLike: boolean;
}

const defaultCapabilities: InputCapabilities = {
    hasFinePointer: true,
    hasHover: true,
    isTouchLike: false
};

function createInputCapabilities(): Readable<InputCapabilities> {
    return readable<InputCapabilities>(defaultCapabilities, (set): (() => void) => {
        if (!browser) {
            return (): void => { };
        }

        const finePointerQuery: MediaQueryList =
            window.matchMedia('(pointer: fine)');

        const hoverQuery: MediaQueryList =
            window.matchMedia('(hover: hover)');

        const updateCapabilities = (): void => {
            const hasFinePointer: boolean = finePointerQuery.matches;
            const hasHover: boolean = hoverQuery.matches;

            set({
                hasFinePointer,
                hasHover,
                isTouchLike: !hasFinePointer || !hasHover
            });
        };

        finePointerQuery.addEventListener('change', updateCapabilities);
        hoverQuery.addEventListener('change', updateCapabilities);

        updateCapabilities();

        return (): void => {
            finePointerQuery.removeEventListener('change', updateCapabilities);
            hoverQuery.removeEventListener('change', updateCapabilities);
        };
    });
}

export const inputCapabilities: Readable<InputCapabilities> = createInputCapabilities();