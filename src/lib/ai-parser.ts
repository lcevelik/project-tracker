import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import type { ParseResult, ParsedTask, ParsedGoal, ParsedRelease, TaskStatus } from "./parser";

// ---------------------------------------------------------------------------
// AI-powered fallback parser for repos without PROJECT.md
// Uses Claude to extract tasks, goals, and releases from arbitrary markdown
// ---------------------------------------------------------------------------

const AI_MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a project structure parser. Given markdown content from a project file (such as README.md, TODO.md, PLAN.md, or CHANGELOG.md), extract tasks, goals, and releases in the specified JSON format.

Rules:
- For tasks: infer status from context (checkbox unchecked = todo, checkbox checked = done, "in progress"/"WIP" = in_progress, "blocked"/"waiting" = blocked, "goal"/"objective"/"milestone" = goal)
- For goals: extract any objectives, milestones, or targets mentioned
- For releases: extract version numbers, dates, and release notes
- Be conservative — only extract items you're confident about
- If the content doesn't contain any structured project info, return empty arrays
- Return ONLY valid JSON, no markdown fences or explanation`;

const USER_PROMPT_TEMPLATE = `Parse the following content from "{filename}" and extract tasks, goals, and releases.

Return a JSON object with this exact structure:
{
  "tasks": [{ "title": "string", "status": "goal|todo|in_progress|blocked|done", "section": "string (the heading/section this task was found under)" }],
  "goals": [{ "title": "string", "description": "string|null", "targetDate": "YYYY-MM-DD|null" }],
  "releases": [{ "name": "string", "status": "planned|released", "date": "YYYY-MM-DD|null", "notes": "string|null" }]
}

Content:
---
{content}
---`;

function sha256(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

interface AITaskRaw {
  title: string;
  status: string;
  section?: string;
}

interface AIGoalRaw {
  title: string;
  description?: string | null;
  targetDate?: string | null;
}

interface AIReleaseRaw {
  name: string;
  status: string;
  date?: string | null;
  notes?: string | null;
}

interface AIRawResponse {
  tasks?: AITaskRaw[];
  goals?: AIGoalRaw[];
  releases?: AIReleaseRaw[];
}

const VALID_STATUSES: TaskStatus[] = ["goal", "todo", "in_progress", "blocked", "done"];

function normalizeStatus(raw: string): TaskStatus {
  const lower = raw.toLowerCase().trim();
  if (VALID_STATUSES.includes(lower as TaskStatus)) return lower as TaskStatus;
  // Common aliases
  if (lower.includes("progress") || lower === "wip" || lower === "active") return "in_progress";
  if (lower.includes("block") || lower.includes("wait") || lower.includes("hold")) return "blocked";
  if (lower.includes("done") || lower.includes("complete") || lower.includes("finish")) return "done";
  if (lower.includes("goal") || lower.includes("objective") || lower.includes("milestone")) return "goal";
  return "todo";
}

/**
 * Parse arbitrary markdown content using Claude AI to extract structured project data.
 * Used as a fallback when a repo doesn't have a PROJECT.md file.
 */
export async function parseWithAI(
  markdown: string,
  filename: string
): Promise<ParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — AI fallback is unavailable");
  }

  const client = new Anthropic({ apiKey });

  // Truncate very long content to stay within token limits
  const maxChars = 50_000;
  const truncated = markdown.length > maxChars
    ? markdown.slice(0, maxChars) + "\n\n[Content truncated...]"
    : markdown;

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace("{filename}", filename)
    .replace("{content}", truncated);

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text from response
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI returned no text content");
  }

  let raw: AIRawResponse;
  try {
    // Try to extract JSON from the response (may have markdown fences)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }
    raw = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `Failed to parse AI response as JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Convert to our standard ParseResult format with content hashes
  const tasks: ParsedTask[] = (raw.tasks ?? []).map((t) => {
    const title = t.title.trim();
    return {
      title,
      status: normalizeStatus(t.status),
      contentHash: sha256(title),
      lineRef: null,
      rawMarkdown: title,
    };
  });

  const goals: ParsedGoal[] = (raw.goals ?? []).map((g) => ({
    title: g.title.trim(),
    description: g.description?.trim() ?? null,
    targetDate: g.targetDate ?? null,
  }));

  const releases: ParsedRelease[] = (raw.releases ?? []).map((r) => ({
    name: r.name.trim(),
    status: r.status.toLowerCase() === "released" ? "released" : "planned",
    date: r.date ?? null,
    notes: r.notes?.trim() ?? null,
  }));

  return { tasks, goals, releases };
}
