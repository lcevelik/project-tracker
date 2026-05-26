import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, Heading, List, ListItem, Paragraph, Text, PhrasingContent } from "mdast";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Types returned by the parser
// ---------------------------------------------------------------------------

export type TaskStatus = "goal" | "todo" | "in_progress" | "blocked" | "done";

export interface ParsedTask {
  title: string;
  status: TaskStatus;
  contentHash: string;
  lineRef: number | null;
  rawMarkdown: string;
}

export interface ParsedGoal {
  title: string;
  description: string | null;
  targetDate: string | null; // ISO date string YYYY-MM-DD
}

export interface ParsedRelease {
  name: string;
  status: "planned" | "released";
  date: string | null; // ISO date string YYYY-MM-DD
  notes: string | null;
}

export interface ParseResult {
  tasks: ParsedTask[];
  goals: ParsedGoal[];
  releases: ParsedRelease[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADING_STATUS_MAP: Record<string, TaskStatus> = {
  "goals": "goal",
  "in progress": "in_progress",
  "to do": "todo",
  "done": "done",
  "blocked": "blocked",
};

function headingText(node: Heading): string {
  return node.children
    .map((c: PhrasingContent) => {
      if (c.type === "text") return c.value;
      if ("children" in c) {
        return (c.children as PhrasingContent[])
          .map((gc: PhrasingContent) => (gc.type === "text" ? gc.value : ""))
          .join("");
      }
      return "";
    })
    .join("")
    .trim();
}

function paragraphText(node: Paragraph): string {
  return node.children
    .map((c: PhrasingContent) => {
      if (c.type === "text") return c.value;
      if (c.type === "link") return c.children.map((gc: PhrasingContent) => (gc.type === "text" ? gc.value : "")).join("");
      if ("children" in c) {
        return (c.children as PhrasingContent[])
          .map((gc: PhrasingContent) => (gc.type === "text" ? gc.value : ""))
          .join("");
      }
      return "";
    })
    .join("")
    .trim();
}

function sha256(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

// ---------------------------------------------------------------------------
// Parse checkbox items from a list node
// ---------------------------------------------------------------------------

function parseCheckboxItems(
  list: List,
  status: TaskStatus,
  markdown: string,
  lineOffset: number
): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  for (const item of list.children) {
    // Each ListItem in remark has a checked property when it's a checkbox
    // In mdast, ListItem has: checked: boolean | null
    // We only care about checkbox items
    if (item.checked === null || item.checked === undefined) continue;

    // Extract the text content of the first paragraph child
    let text = "";
    for (const child of item.children) {
      if (child.type === "paragraph") {
        text = paragraphText(child);
        break;
      }
    }

    if (!text) continue;

    const lineRef = item.position?.start?.line
      ? item.position.start.line + lineOffset
      : null;
    const rawMarkdown = text;
    const contentHash = sha256(text);

    tasks.push({
      title: text,
      status,
      contentHash,
      lineRef,
      rawMarkdown,
    });
  }

  return tasks;
}

// ---------------------------------------------------------------------------
// Parse Goals section
// ---------------------------------------------------------------------------

function parseGoalsSection(list: List): ParsedGoal[] {
  const goals: ParsedGoal[] = [];

  for (const item of list.children) {
    let text = "";
    for (const child of item.children) {
      if (child.type === "paragraph") {
        text = paragraphText(child);
        break;
      }
    }
    if (!text) continue;

    // Look for optional (target: YYYY-MM-DD) in the text
    const targetMatch = text.match(/\(target:\s*(\d{4}-\d{2}-\d{2})\)/i);
    const targetDate = targetMatch ? targetMatch[1] : null;

    // Strip the target annotation from title
    const title = text
      .replace(/\s*\(target:\s*\d{4}-\d{2}-\d{2}\)\s*/gi, "")
      .trim();

    goals.push({
      title,
      description: null,
      targetDate,
    });
  }

  return goals;
}

// ---------------------------------------------------------------------------
// Parse Releases section
// Format: vX.Y.Z — planned|released YYYY-MM-DD — description
// ---------------------------------------------------------------------------

function parseReleasesSection(list: List): ParsedRelease[] {
  const releases: ParsedRelease[] = [];

  for (const item of list.children) {
    let text = "";
    for (const child of item.children) {
      if (child.type === "paragraph") {
        text = paragraphText(child);
        break;
      }
    }
    if (!text) continue;

    // Pattern: vX.Y.Z — status date — notes
    // Also handle: vX.Y.Z - status date - notes
    // And: vX.Y.Z — status — notes (no date)
    const match = text.match(
      /^(v?\d+\.\d+[\.\d]*)\s*[—–-]\s*(planned|released)\s*(?:(\d{4}-\d{2}-\d{2}))?\s*(?:[—–-]\s*(.+))?$/i
    );

    if (match) {
      releases.push({
        name: match[1],
        status: match[2].toLowerCase() as "planned" | "released",
        date: match[3] ?? null,
        notes: match[4]?.trim() ?? null,
      });
    } else {
      // Fallback: treat as a planned release with just the name
      releases.push({
        name: text,
        status: "planned",
        date: null,
        notes: null,
      });
    }
  }

  return releases;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export function parseProjectMd(markdown: string): ParseResult {
  const tree: Root = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;

  const tasks: ParsedTask[] = [];
  const goals: ParsedGoal[] = [];
  const releases: ParsedRelease[] = [];

  // Walk through top-level nodes looking for H2 headings followed by lists
  const children = tree.children;
  let i = 0;

  while (i < children.length) {
    const node = children[i];

    // We only care about level-2 headings
    if (node.type === "heading" && node.depth === 2) {
      const sectionTitle = headingText(node);
      const sectionKey = sectionTitle.toLowerCase().replace(/^\d+\.\s*/, "");

      // Determine the status mapping
      const mappedStatus = HEADING_STATUS_MAP[sectionKey];

      // Look for the next list node after this heading
      let j = i + 1;
      while (
        j < children.length &&
        !(children[j].type === "heading" && (children[j] as Heading).depth <= 2)
      ) {
        if (children[j].type === "list") {
          const list = children[j] as List;

          if (sectionKey === "goals") {
            goals.push(...parseGoalsSection(list));
          } else if (sectionKey === "releases") {
            releases.push(...parseReleasesSection(list));
          } else if (mappedStatus) {
            tasks.push(...parseCheckboxItems(list, mappedStatus, markdown, 0));
          }

          break;
        }
        j++;
      }
    }

    i++;
  }

  return { tasks, goals, releases };
}
