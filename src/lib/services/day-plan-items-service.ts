// src/lib/services/day-plan-items-service.ts

import type { DayPlanItem } from "$lib/types/dayplanner/day-plan-item";
import { invoke } from "@tauri-apps/api/core";

type DayPlanItemPayload = {
    id?: string;
    title?: string | null;
    color: number;
    start: string;
    end: string;
};

type DayPlanItemRecord = {
    id: string;
    title?: string | null;
    color: number;
    start: string;
    end: string;
};

function normalizeDate(value: string | Date): string {
    if (value instanceof Date) {
        return value.toISOString();
    }

    return new Date(value).toISOString();
}

function getDayStart(value: string | Date): Date {
    const date: Date = value instanceof Date ? value : new Date(value);

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0,
    );
}

function getDayEnd(value: string | Date): Date {
    const dayStart: Date = getDayStart(value);

    return new Date(
        dayStart.getFullYear(),
        dayStart.getMonth(),
        dayStart.getDate() + 1,
        0,
        0,
        0,
        0,
    );
}

function toPayload(item: DayPlanItem): DayPlanItemPayload {
    return {
        id: item.id,
        title: item.title ?? null,
        color: item.color,
        start: normalizeDate(item.start),
        end: normalizeDate(item.end),
    };
}

function fromRecord(record: DayPlanItemRecord): DayPlanItem {
    return {
        id: record.id,
        title: record.title ?? undefined,
        color: record.color,
        start: new Date(record.start),
        end: new Date(record.end),
    };
}

export async function getDayPlanItemsForDay(day: string | Date): Promise<DayPlanItem[]> {
    const records: DayPlanItemRecord[] = await invoke("get_day_plan_items_for_day", {
        dayStart: normalizeDate(getDayStart(day)),
        dayEnd: normalizeDate(getDayEnd(day)),
    });

    const items: DayPlanItem[] = records.map((record: DayPlanItemRecord): DayPlanItem => {
        return fromRecord(record);
    });

    return items;
}

export async function upsertDayPlanItem(item: DayPlanItem): Promise<DayPlanItem> {
    const record: DayPlanItemRecord = await invoke("upsert_day_plan_item", {
        item: toPayload(item),
    });

    return fromRecord(record);
}

export async function createDayPlanItem(
    item: Omit<DayPlanItem, "id">,
): Promise<DayPlanItem> {
    const record: DayPlanItemRecord = await invoke("upsert_day_plan_item", {
        item: {
            title: item.title ?? null,
            color: item.color,
            start: normalizeDate(item.start),
            end: normalizeDate(item.end),
        },
    });

    return fromRecord(record);
}

export async function deleteDayPlanItem(itemId: string): Promise<void> {
    await invoke("delete_day_plan_item", {
        itemId,
    });
}