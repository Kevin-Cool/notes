export type DayplannerDaily = {
    id: string;
    title?: string;
    orderNr: number;
    completed: number;
    target: number;
    completionDate?: string | null;
};