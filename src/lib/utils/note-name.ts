export function extractNoteNameFromHtml(
    html: string,
    maxLength: number = 20,
): string {
    const parser: DOMParser = new DOMParser();
    const documentNode: Document = parser.parseFromString(html, "text/html");

    function findFirstText(node: Node): string | null {
        if (node.nodeType === Node.TEXT_NODE) {
            const value: string = node.textContent?.trim() ?? "";
            if (value.length > 0) {
                return value;
            }
        }

        for (const child of Array.from(node.childNodes)) {
            const result: string | null = findFirstText(child);
            if (result) {
                return result;
            }
        }

        return null;
    }

    const firstText: string | null = findFirstText(documentNode.body);

    if (!firstText) {
        return "Untitled note";
    }

    if (firstText.length <= maxLength) {
        return firstText;
    }

    return `${firstText.slice(0, maxLength).trim()}…`;
}