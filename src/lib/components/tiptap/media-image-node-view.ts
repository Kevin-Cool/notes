import type { MediaImageNodeViewProps } from "$lib/types/media-image-node-view-props";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";

export function createMediaImageNodeView({
    node,
    view,
    getPos,
}: MediaImageNodeViewProps): NodeView {
    const wrapper: HTMLDivElement = document.createElement("div");
    wrapper.className = "media-image-node";

    const image: HTMLImageElement = document.createElement("img");
    image.src = node.attrs.src;
    image.alt = node.attrs.alt ?? "";
    image.draggable = false;

    const resizeHandle: HTMLDivElement = document.createElement("div");
    resizeHandle.className = "media-image-resize-handle";
    resizeHandle.innerHTML = `
        <svg viewBox="0 0 16 16" width="16" height="16">
        <path d="M3 13 L13 3 M7 13 L13 7 M11 13 L13 11"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"/>
        </svg>
        `;
    resizeHandle.setAttribute("aria-label", "Resize image");

    wrapper.append(image, resizeHandle);

    const initialWidth: number | null =
        typeof node.attrs.width === "string" ? Number(node.attrs.width) : null;

    const initialHeight: number | null =
        typeof node.attrs.height === "string" ? Number(node.attrs.height) : null;

    if (initialWidth && initialHeight) {
        image.style.width = `${initialWidth}px`;
        image.style.maxWidth = "100%";
        image.style.height = "auto";
        image.style.aspectRatio = `${initialWidth} / ${initialHeight}`;
    } else {
        image.style.maxWidth = "100%";
        image.style.height = "auto";
    }

    let startX: number = 0;
    let startWidth: number = 0;
    let startHeight: number = 0;
    let aspectRatio: number = 1;

    const handleMouseMove = (event: MouseEvent): void => {
        const deltaX: number = event.clientX - startX;
        const nextWidth: number = Math.max(80, Math.round(startWidth + deltaX));
        const nextHeight: number = Math.round(nextWidth / aspectRatio);

        image.style.width = `${nextWidth}px`;
        image.style.height = `${nextHeight}px`;
    };

    const handleMouseUp = (): void => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        if (typeof getPos !== "function") {
            return;
        }

        const position: number | undefined = getPos();

        if (typeof position !== "number") {
            return;
        }

        const widthValue: string = String(parseInt(image.style.width, 10));
        const heightValue: string = String(parseInt(image.style.height, 10));

        const transaction = view.state.tr.setNodeMarkup(position, undefined, {
            ...node.attrs,
            width: widthValue,
            height: heightValue,
        });

        view.dispatch(transaction);
    };

    resizeHandle.addEventListener("mousedown", (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        const rect: DOMRect = image.getBoundingClientRect();

        startX = event.clientX;
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = rect.width / rect.height;

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    });

    return {
        dom: wrapper,
        update(updatedNode: ProseMirrorNode): boolean {
            if (updatedNode.type !== node.type) {
                return false;
            }

            image.src = updatedNode.attrs.src;
            image.alt = updatedNode.attrs.alt ?? "";

            const width: string | null = updatedNode.attrs.width ?? null;
            const height: string | null = updatedNode.attrs.height ?? null;

            if (width && height) {
                image.style.width = `${width}px`;
                image.style.maxWidth = "100%";
                image.style.height = "auto";
                image.style.aspectRatio = `${width} / ${height}`;
            } else {
                image.style.maxWidth = "100%";
                image.style.height = "auto";
                image.style.aspectRatio = "";
            }

            return true;
        },
    };
}