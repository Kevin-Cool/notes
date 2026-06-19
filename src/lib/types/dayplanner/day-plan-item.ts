import { TaskColor } from "$lib/types/tasks/task-color";

export type DayPlanItem = {
    id: string;
    title?: string;
    color: TaskColor;
    start: Date;
    end: Date;
};