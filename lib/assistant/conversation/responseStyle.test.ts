import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationResponseStyleInstructions,
  conversationResponseStylePolicy,
  responseModeInstructions,
} from "./responseStyle";

test("defines a provider-independent, adaptive response style", () => {
  assert.equal(conversationResponseStylePolicy.language, "pt-BR");
  assert.equal(conversationResponseStylePolicy.presentation.markdown, true);
  assert.equal(
    conversationResponseStylePolicy.incompleteData.forbidFreeBalanceInference,
    true,
  );
  assert.match(conversationResponseStyleInstructions, /Adapte a estrutura/);
});

test("keeps the Home preview compact without changing the financial source", () => {
  const compact = conversationResponseStylePolicy.presentation.compactPreview;
  assert.equal(compact.maxParagraphs, 2);
  assert.equal(compact.maxItems, 3);
  assert.equal(compact.headings, false);
  assert.match(
    responseModeInstructions("compact") ?? "",
    /informa..o principal/i,
  );
  assert.equal(responseModeInstructions("full"), undefined);
});
