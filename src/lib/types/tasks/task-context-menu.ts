// $lib/types/task-context-menu-state.ts
import type { CalendarTask } from "$lib/types/tasks/calendar-task";

export type TaskContextMenuState =
    | {
        mode: "empty";
        x: number;
        y: number;
        start: Date;
        end: Date;
    }
    | {
        mode: "task";
        x: number;
        y: number;
        task: CalendarTask;
    };