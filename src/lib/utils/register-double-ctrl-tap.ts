import { uiState } from "$lib/state/ui.svelte";

const doubleTapThresholdMs: number = 300;

export function registerDoubleCtrlTap(): () => void {
	let lastCtrlPressedAt: number = 0;

	const onKeyDown = (event: KeyboardEvent): void => {
		if (event.key !== "Control") {
			return;
		}

		if (event.repeat) {
			return;
		}

		const now: number = Date.now();
		const isDoubleTap: boolean =
			now - lastCtrlPressedAt <= doubleTapThresholdMs;

		lastCtrlPressedAt = now;

		if (isDoubleTap) {
			uiState.showCustomBar = !uiState.showCustomBar;
			lastCtrlPressedAt = 0;
		}
	};

	window.addEventListener("keydown", onKeyDown);

	return (): void => {
		window.removeEventListener("keydown", onKeyDown);
	};
}