import assert from "node:assert/strict";
import test from "node:test";
import { buildHotelLobbySubmittedInputText, getHotelLobbyUploadError, normalizeHotelLobbyCast } from "../src/lib/socialmedia/hotel-lobby-input";
import { resolveGeneratorUseCaseContext } from "../src/lib/use-cases/generator-context";
import { isVideoGenerationSourceUseCase, isMiniMaxH3VideoFlowSourceUseCase, resolveVideoGenerationProviderForSourceUseCase } from "../src/lib/videos/source-use-case";
import { getPromoVideoScriptPlannerInstructions, resolvePromoVideoScriptPlannerInputMode } from "../src/lib/socialmedia/promo-video-script-planner";
import { resolveHomeAuthRedirectTarget } from "../src/lib/workbench/home-auth-redirect";
import { selectVideoAgentBootstrapJobs } from "../src/lib/socialmedia/video-intent-agent";
import { resolveVideoContinuationContextWithLlm } from "../src/lib/socialmedia/video-continuation-context";
import { findAppToolByPathname, resolveAppToolPublicHref } from "../src/app/app/_components/app-data";
import { getTemplateDirectoryWorkbenchBySourceUseCase, getTemplateGeneratorPath } from "../src/lib/templates/template-directory";
import { INDEXABLE_STATIC_PATHS } from "../src/lib/seo/indexing-policy";
import type { JobRecord } from "../src/lib/types/job";

const useCase = "hotel-lobby-ai";
const prompt = buildHotelLobbySubmittedInputText({ inputText: "", cast: "duet", isContinuation: false });
const refs = ["left", "right"].map((assetId) => ({ assetId, bucket: "socialmedia-input-assets", role: "reference_image" as const, url: `https://example.test/${assetId}.png` }));
const job = {
  id: "hotel-video-1", sessionId: "hotel-test", turnIndex: 1, revision: 0, mode: "generate", baseJobId: "hotel-video-1", status: "completed", progress: 100, stage: "completed", events: [], artifacts: [],
  payload: { workflow: "socialmedia", sourceUseCase: useCase, outputType: "video", inputText: prompt,
    socialmedia: { sourceUseCase: useCase, outputType: "video", inputText: prompt, sourceAssets: refs, targetAssets: [], aspectRatio: "9:16", videoDuration: 10 } },
  createdAt: "2026-09-30T00:00:00.000Z", updatedAt: "2026-09-30T00:00:00.000Z"
} as unknown as JobRecord;

test("Hotel Lobby retains its own attribution and uses existing H3 video execution", () => {
  assert.deepEqual(resolveGeneratorUseCaseContext(useCase), { sourceUseCase: useCase, publicPath: "/hotel-lobby-ai", brandHomePath: "/home", analyticsWorkflow: "hotel_lobby_ai", outputType: "video" });
  assert.equal(isVideoGenerationSourceUseCase(useCase), true);
  assert.equal(isMiniMaxH3VideoFlowSourceUseCase(useCase), true);
  assert.equal(resolveVideoGenerationProviderForSourceUseCase(useCase, "other", "apimart"), "apimart");
  assert.equal(resolvePromoVideoScriptPlannerInputMode(useCase, "pipeline"), "agent");
  assert.equal(resolveHomeAuthRedirectTarget(useCase), "/hotel-lobby-ai");
});

test("selected duet is executable with no optional description and stable casting", () => {
  assert.match(prompt, /first subject on the left.*second on the right/);
  assert.match(prompt, /orange studio/);
  assert.match(prompt, /original instrumental/i);
  assert.equal(getHotelLobbyUploadError("duet", 2), undefined);
  for (const n of [0, 1, 3]) assert.ok(getHotelLobbyUploadError("duet", n));
});

test("solo and pets have distinct casting and reference requirements", () => {
  assert.equal(normalizeHotelLobbyCast("unknown"), "duet");
  assert.equal(getHotelLobbyUploadError("solo", 1), undefined);
  assert.ok(getHotelLobbyUploadError("solo", 2));
  assert.ok(getHotelLobbyUploadError("pets", 1));
  assert.match(buildHotelLobbySubmittedInputText({ inputText: "", cast: "solo", isContinuation: false }), /solo music-performance/);
  assert.match(buildHotelLobbySubmittedInputText({ inputText: "", cast: "pets", isContinuation: false }), /natural anatomy/);
});

test("user adjustments take priority; follow-ups never reset the scene preset", () => {
  const adjustment = "Use a blue room.\nAdd the exact title NIGHT SHIFT.";
  assert.ok(buildHotelLobbySubmittedInputText({ inputText: adjustment, cast: "duet", isContinuation: false }).endsWith(adjustment));
  assert.equal(buildHotelLobbySubmittedInputText({ inputText: adjustment, cast: "solo", isContinuation: true }), adjustment);
});

test("V1 recognizes Hotel Lobby history and uses performance-specific planning", () => {
  assert.deepEqual(selectVideoAgentBootstrapJobs([job]).map((item) => item.id), [job.id]);
  const instructions = getPromoVideoScriptPlannerInstructions(useCase).join("\n");
  assert.match(instructions, /music-performance workspace/);
  assert.doesNotMatch(instructions, /promotional timeline|campaign-ready visual beat/);
});

test("continuation retains both original subjects and prior performance direction", async () => {
  const continuation = await resolveVideoContinuationContextWithLlm({
    sessionJobs: [job], content: "Make it slower, keeping both performers.",
    rewritePrompt: async (input) => {
      assert.match(input.previous_prompt, /orange studio/);
      assert.deepEqual(input.reference_images.map((item) => item.asset_id), ["left", "right"]);
      return { action: "continue", prompt: input.previous_prompt + " Make the head nods slower." };
    }
  });
  assert.equal(continuation?.sourceJobId, job.id);
  assert.deepEqual(continuation?.sourceAssets.map((item) => item.assetId), ["left", "right"]);
  assert.match(continuation?.prompt ?? "", /orange studio/);
  assert.match(continuation?.prompt ?? "", /head nods slower/);
  assert.equal(continuation?.aspectRatio, "9:16");
});

test("public, app, SEO, and Library routes retain the Hotel Lobby destination", () => {
  assert.equal(findAppToolByPathname("/hotel-lobby-ai")?.slug, useCase);
  assert.equal(findAppToolByPathname("/app/hotel-lobby-ai")?.slug, useCase);
  assert.equal(resolveAppToolPublicHref(useCase), "/hotel-lobby-ai");
  assert.equal(getTemplateGeneratorPath(useCase), "/hotel-lobby-ai");
  assert.equal(getTemplateDirectoryWorkbenchBySourceUseCase(useCase)?.title, "Videos");
  assert.ok(INDEXABLE_STATIC_PATHS.includes("/hotel-lobby-ai"));
});

test("creative selections reach the request with written adjustments taking priority", () => {
  const request = buildHotelLobbySubmittedInputText({
    inputText: "Use cool light instead of warm light.", cast: "solo", isContinuation: false,
    selectedOptions: { "hotel-scene": "rooftop", "hotel-camera": "push-in", "hotel-style": "cinematic", "hotel-lighting": "warm", "hotel-energy": "playful" }
  });
  for (const direction of ["Scene: Rooftop", "Camera: Slow push-in", "Visual style: Cinematic", "Lighting: Warm light", "Performance energy: Playful"]) assert.ok(request.includes(direction));
  assert.match(request, /written description takes priority/);
  assert.ok(request.endsWith("Use cool light instead of warm light."));
});

test("auto and unrecognized creative settings add no instructions", () => {
  const input = { inputText: "", cast: "solo" as const, isContinuation: false };
  assert.equal(buildHotelLobbySubmittedInputText({ ...input, selectedOptions: { "hotel-scene": "auto", "hotel-camera": "untrusted-value", duration: "15s" } }), buildHotelLobbySubmittedInputText(input));
});

test("continuation sends selected adjustments without resetting cast or scene", () => {
  const request = buildHotelLobbySubmittedInputText({ inputText: "Keep both performers.", cast: "duet", isContinuation: true, selectedOptions: { "hotel-camera": "orbit" } });
  assert.match(request, /Camera: Slow orbit/);
  assert.ok(request.endsWith("Keep both performers."));
  assert.doesNotMatch(request, /seamless orange|original instrumental|Create a duet/);
});
