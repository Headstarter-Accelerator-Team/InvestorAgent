// Renders the small markdown subset the AI uses (paragraphs, "- " and "1. "
// lists, **bold**, "#" headings). Text is rendered as React children, so
// nothing is injected as HTML.

function inline(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
    );
}

export default function MarkdownLite({ text }) {
    const blocks = [];
    let list = null;
    const flush = () => {
        if (list) blocks.push(list);
        list = null;
    };
    for (const raw of text.split("\n")) {
        const line = raw.trimEnd();
        const bullet = line.match(/^\s*[-*•]\s+(.*)/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
        if (bullet || numbered) {
            const ordered = Boolean(numbered);
            if (!list || list.ordered !== ordered) {
                flush();
                list = { type: "list", ordered, items: [] };
            }
            list.items.push((bullet ?? numbered)[1]);
            continue;
        }
        flush();
        if (!line.trim()) continue;
        const heading = line.match(/^#{1,4}\s+(.*)/);
        blocks.push(heading ? { type: "heading", text: heading[1] } : { type: "p", text: line });
    }
    flush();

    return (
        <div className="space-y-2 text-sm leading-relaxed">
            {blocks.map((b, i) => {
                if (b.type === "heading") return <p key={i} className="font-semibold">{inline(b.text)}</p>;
                if (b.type === "p") return <p key={i}>{inline(b.text)}</p>;
                const List = b.ordered ? "ol" : "ul";
                return (
                    <List key={i} className={`${b.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
                        {b.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
                    </List>
                );
            })}
        </div>
    );
}
