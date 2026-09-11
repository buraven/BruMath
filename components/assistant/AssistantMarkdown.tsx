"use client";

import ReactMarkdown from "react-markdown";

type AssistantMarkdownProps = {
  content?: string;
  className?: string;
};

/** Safe, shared renderer for model-authored assistant content only. */
export function AssistantMarkdown({
  content,
  className,
}: AssistantMarkdownProps) {
  if (!content?.trim()) return null;
  return (
    <div className={className}>
      <ReactMarkdown skipHtml>{content}</ReactMarkdown>
    </div>
  );
}
