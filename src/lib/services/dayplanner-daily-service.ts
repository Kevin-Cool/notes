import type { DayplannerDaily } from "$lib/types/dayplanner/dayplanner-daily";
import { invoke } from "@tauri-apps/api/core";

type DayplannerDailyPayload = {
    id?: string;
    title: string;
    orderNr: number;
    completed: number;
    target: number;
    completion_date?: string | null;
};

function toPayload(daily: DayplannerDaily): DayplannerDailyPayload {
    return {
        id: daily.id,
        title: daily.title ?? "",
        orderNr: daily.orderNr,
        completed: daily.completed,
        target: daily.target,
        completion_date: daily.completionDate ?? null,
    };
}

export async function getAllDayplannerDailies(): Promise<DayplannerDaily[]> {
    const dailies: DayplannerDaily[] = await invoke("get_all_dayplanner_dailies");

    return dailies;
}

export async function upsertDayplannerDaily(
    daily: DayplannerDaily,
): Promise<DayplannerDaily> {
    const savedDaily: DayplannerDaily = await invoke("upsert_dayplanner_daily", {
        daily: toPayload(daily),
    });

    return savedDaily;
}

export async function createDayplannerDaily(
    daily: Omit<DayplannerDaily, "id">,
): Promise<DayplannerDaily> {
    const savedDaily: DayplannerDaily = await invoke("upsert_dayplanner_daily", {
        daily: {
            title: daily.title ?? "",
            orderNr: daily.orderNr,
            completed: daily.completed,
            target: daily.target,
            completion_date: daily.completionDate ?? null,
        },
    });

    return savedDaily;
}

export async function deleteDayplannerDaily(dailyId: string): Promise<void> {
    await invoke("delete_dayplanner_daily", {
        dailyId: dailyId,
    });
}