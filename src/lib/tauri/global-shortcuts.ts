import {
	register,
	unregister,
	isRegistered,
} from "@tauri-apps/plugin-global-shortcut";

import { toggleCustomChrome, toggleOpenOrMinimize } from "$lib/tauri/window-actions";
import { snapToRightMostMonitorTopLeft } from "$lib/tauri/window-positioning";

type ShortcutEvent = {
	state: "Pressed" | "Released";
};

type ShortcutHandler = (event: ShortcutEvent) => void;

type ShortcutDefinition = {
	key: string;
	handler: ShortcutHandler;
};

const shortcuts: ShortcutDefinition[] = [
	{
		key: "CommandOrControl+Alt+N",
		handler: (event: ShortcutEvent): void => {
			if (event.state === "Pressed") {
				toggleCustomChrome();
			}
		},
	},
	{
		key: "CommandOrControl+Alt+Numpad1",
		handler: (event: ShortcutEvent): void => {
			if (event.state === "Pressed") {
				void toggleOpenOrMinimize();
			}
		},
	},
	{
		key: "CommandOrControl+Shift+1",
		handler: (event: ShortcutEvent): void => {
			if (event.state === "Pressed") {
				void toggleOpenOrMinimize();
			}
		},
	},
	{
		key: "CommandOrControl+Alt+Numpad2",
		handler: (event: ShortcutEvent): void => {
			if (event.state === "Pressed") {
				void snapToRightMostMonitorTopLeft();
			}
		},
	},
	{
		key: "CommandOrControl+Shift+2",
		handler: (event: ShortcutEvent): void => {
			if (event.state === "Pressed") {
				void snapToRightMostMonitorTopLeft();
			}
		},
	},
];

let isRegisteredByApp: boolean = false;

export function registerGlobalShortcuts(): () => void {
	void registerShortcutsOnce();

	return (): void => {
		void unregisterGlobalShortcuts();
	};
}

async function registerShortcutsOnce(): Promise<void> {
	if (isRegisteredByApp) {
		return;
	}

	try {
		for (const shortcut of shortcuts) {
			const alreadyRegistered: boolean = await isRegistered(shortcut.key);

			if (alreadyRegistered) {
				await unregister(shortcut.key);
			}

			await register(shortcut.key, shortcut.handler);
		}

		isRegisteredByApp = true;
	} catch (error: unknown) {
		console.error("Failed to register global shortcuts:", error);
	}
}

async function unregisterGlobalShortcuts(): Promise<void> {
	if (!isRegisteredByApp) {
		return;
	}

	try {
		await unregister(shortcuts.map((shortcut: ShortcutDefinition): string => shortcut.key));
		isRegisteredByApp = false;
	} catch (error: unknown) {
		console.error("Failed to unregister global shortcuts:", error);
	}
}