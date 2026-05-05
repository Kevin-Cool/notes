import Image from "@tiptap/extension-image";
import { createMediaImageNodeView } from "./media-image-node-view";

export const MediaImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            mediaId: {
                default: null,
                parseHTML: (element: HTMLElement): string | null =>
                    element.getAttribute("data-media-id"),
                renderHTML: (attributes: { mediaId?: string | null }) => {
                    if (!attributes.mediaId) {
                        return {};
                    }

                    return {
                        "data-media-id": attributes.mediaId,
                    };
                },
            },
            mediaSrc: {
                default: null,
                parseHTML: (element: HTMLElement): string | null =>
                    element.getAttribute("data-media-src"),
                renderHTML: (attributes: { mediaSrc?: string | null }) => {
                    if (!attributes.mediaSrc) {
                        return {};
                    }

                    return {
                        "data-media-src": attributes.mediaSrc,
                    };
                },
            },
            width: {
                default: null,
                parseHTML: (element: HTMLElement): string | null =>
                    element.getAttribute("data-width"),
                renderHTML: (attributes: { width?: string | null }) => {
                    if (!attributes.width) {
                        return {};
                    }

                    return {
                        "data-width": attributes.width,
                    };
                },
            },
            height: {
                default: null,
                parseHTML: (element: HTMLElement): string | null =>
                    element.getAttribute("data-height"),
                renderHTML: (attributes: { height?: string | null }) => {
                    if (!attributes.height) {
                        return {};
                    }

                    return {
                        "data-height": attributes.height,
                    };
                },
            },
        };
    },

    addNodeView() {
        return (props) => createMediaImageNodeView(props);
    },
});