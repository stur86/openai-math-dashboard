import katex from "katex";
import { memo } from "react";

const cache = new Map<string, string>();

function renderTex(tex: string): string {
  let html = cache.get(tex);
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false, strict: "ignore" });
    cache.set(tex, html);
  }
  return html;
}

/** Renders text containing inline `$...$` LaTeX. Everything else is plain text. */
export const MathText = memo(function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith("$") && part.endsWith("$") ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(part.slice(1, -1)) }} />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
});
