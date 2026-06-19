import type { TaskColor } from "../tasks/task-color";

export type DayPlanItemDraft = {
    title?: string;
    color: TaskColor;
    start: Date;
    end: Date;
};