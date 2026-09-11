"use client";

import ReactMarkdown from "react-markdown";

type AssistantMarkdownProps = { content?: string };

/** Safe, shared renderer for model-authored assistant content only. */
export function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  if (!content?.trim()) return null;
  return <ReactMarkdown skipHtml>{content}</ReactMarkdown>;
}
