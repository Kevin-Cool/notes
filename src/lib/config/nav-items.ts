import noteIcon from "$lib/assets/icons/note.svg";
import calendarIcon from "$lib/assets/icons/calendar_icon.svg";

export type NavItemIcon =
	| {
			type: "text";
			value: string;
	  }
	| {
			type: "image";
			value: string;
			alt: string;
	  };

export type NavItem = {
	id: string;
	label: string;
	icon: NavItemIcon;
	href: string;
	position: "main" | "middle" | "bottom";
};

export const navItems: NavItem[] = [
	{
		id: "new",
		label: "New",
		icon: { type: "text", value: "+" },
		href: "/note",
		position: "main",
	},
	{
		id: "search",
		label: "Search",
		icon: { type: "text", value: "⌕" },
		href: "/search",
		position: "middle",
	},
	{
		id: "notes",
		label: "Notes",
		icon: {
			type: "image",
			value: noteIcon,
			alt: "notes",
		},
		href: "/notes",
		position: "middle",
	},
	{
		id: "tasks",
		label: "Calendar",
		icon: {
			type: "image",
			value: calendarIcon,
			alt: "calendar",
		},
		href: "/tasks",
		position: "middle",
	},
	{
		id: "settings",
		label: "Settings",
		icon: { type: "text", value: "⚙" },
		href: "/settings",
		position: "bottom",
	},
];