import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationResponseStyleInstructions,
  conversationResponseStylePolicy,
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
