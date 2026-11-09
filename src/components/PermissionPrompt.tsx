/** The tutor asking to step outside the book: one tool call, shown in full,
 *  allowed once, for the rest of the conversation, or denied. */

import type { PermissionEvent } from "../lib/types";

export function PermissionPrompt(props: {
  request: PermissionEvent;
  onAnswer: (allow: boolean, remember?: boolean) => void;
}) {
  const { request, onAnswer } = props;
  const { action, target } = describe(request);
  return (
    <div className="permit" role="group" aria-label="Permission request">
      <p className="permit-ask">Allow the tutor to {action}?</p>
      {target && <pre className="permit-target">{target}</pre>}
      <div className="permit-actions">
        <button className="link-btn" onClick={() => onAnswer(false)}>
          Deny
        </button>
        <button
          className="btn"
          onClick={() => onAnswer(true, true)}
          title="Don't ask again for this exact request in this conversation"
        >
          Allow in chat
        </button>
        <button className="btn primary" onClick={() => onAnswer(true)}>
          Allow once
        </button>
      </div>
    </div>
  );
}

/**
 * Identity of a request for "allow in chat": the tool and its input, minus
 * the model's free-text description of it, with keys in a stable order.
 */
export function approvalKey({ tool, input }: PermissionEvent): string {
  const { description: _, ...rest } = input;
  return JSON.stringify([tool, Object.entries(rest).sort(([a], [b]) => a.localeCompare(b))]);
}

function describe({ tool, input }: PermissionEvent): { action: string; target: string } {
  const str = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  switch (tool) {
    case "Read":
      return { action: "read a file", target: str("file_path") };
    case "Write":
      return { action: "write a file", target: str("file_path") };
    case "Edit":
    case "MultiEdit":
      return { action: "edit a file", target: str("file_path") };
    case "NotebookEdit":
      return { action: "edit a notebook", target: str("notebook_path") };
    case "Glob":
    case "Grep":
      return {
        action: "search your files",
        target: [str("pattern"), str("path")].filter(Boolean).join("\nin "),
      };
    case "Bash":
    case "PowerShell":
      return { action: "run a command", target: str("command") };
    default:
      return { action: `use ${tool}`, target: JSON.stringify(input, null, 2) };
  }
}
