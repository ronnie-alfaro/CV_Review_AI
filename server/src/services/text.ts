export function normalizeText(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function splitLines(text: string): string[] {
  return normalizeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
}

export function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/:$/, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findSection(text: string, headings: string[]): string {
  const lines = splitLines(text);
  const normalizedHeadings = headings.map(normalizeHeading);
  const start = lines.findIndex((line) => {
    const heading = normalizeHeading(line);
    return normalizedHeadings.some((target) => heading === target || heading.endsWith(` ${target}`));
  });
  if (start === -1) return "";
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Z][A-Z\s/&-]{2,}:?$/.test(line) && collected.length > 0) break;
    collected.push(line);
  }
  return collected.join("\n");
}
