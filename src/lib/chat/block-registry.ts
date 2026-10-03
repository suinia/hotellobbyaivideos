export type AssistantBlockTone =
  | "generic"
  | "input"
  | "content"
  | "visual"
  | "asset"
  | "quality"
  | "message";

export type AssistantBlockDescriptor = {
  title: string;
  subtitle: string;
  pendingLabel?: string;
  tone: AssistantBlockTone;
  thought?: string;
  action?: string;
};

const STAGE_DESCRIPTORS: Record<string, AssistantBlockDescriptor> = {
  queued: {
    title: "Queued",
    subtitle: "Waiting for the task to begin.",
    pendingLabel: "Queued",
    tone: "generic",
    thought: "The task is waiting for execution to begin.",
    action: "Hold the request until processing starts."
  },
  starting: {
    title: "Preparing task",
    subtitle: "Setting up the pipeline and initial context.",
    pendingLabel: "Preparing task",
    tone: "generic",
    thought: "The run needs to initialize context and execution settings.",
    action: "Prepare the pipeline and execution context."
  },
  resolving_source: {
    title: "Reading source",
    subtitle: "Opening the link and extracting usable content.",
    pendingLabel: "Reading source",
    tone: "input",
    thought: "The link must be fetched and normalized before the rest of the pipeline can proceed.",
    action: "Fetch the source and extract the main readable content."
  },
  evaluating_source: {
    title: "Checking source quality",
    subtitle: "Verifying there is enough substance to generate a result.",
    pendingLabel: "Checking source quality",
    tone: "input",
    thought: "The source should contain enough detail and structure before generation starts.",
    action: "Assess whether the source is strong enough for generation."
  },
  quick_generate_started: {
    title: "Quick generate started",
    subtitle: "Tracking latency from kickoff to first draft.",
    pendingLabel: "Quick generate started",
    tone: "generic",
    thought: "Quick mode should return a usable first draft before optional refinement work.",
    action: "Start latency tracking for the first-pass generate run."
  },
  quick_generate_first_result_ready: {
    title: "First draft ready",
    subtitle: "The initial result is ready before any deferred refinements.",
    pendingLabel: "First draft ready",
    tone: "generic",
    thought: "The first usable draft is ready and should no longer wait on optional copy refinement.",
    action: "Mark the quick-generate first result timing checkpoint."
  },
  quick_generate_completed: {
    title: "Quick generate completed",
    subtitle: "The fast pipeline has fully finished.",
    pendingLabel: "Quick generate completed",
    tone: "generic",
    thought: "The quick pass has finished and the job can be finalized.",
    action: "Record the final quick-generate completion marker."
  },
  planning: {
    title: "Planning response",
    subtitle: "Figuring out the next action to take.",
    pendingLabel: "Planning response",
    tone: "message",
    thought: "The assistant should understand intent before responding or generating.",
    action: "Decide the next action based on the latest message."
  },
  agent_conversation: {
    title: "Composing reply",
    subtitle: "Preparing a direct response for the user.",
    pendingLabel: "Composing reply",
    tone: "message",
    thought: "A direct reply is more useful than starting a generation run here.",
    action: "Compose a conversational response."
  },
  revision_routing: {
    title: "Routing revision",
    subtitle: "Deciding which part of the result needs to change.",
    pendingLabel: "Routing revision",
    tone: "message",
    thought: "Only the affected parts should be regenerated during revision.",
    action: "Determine which artifacts and steps must rerun."
  },
  revision_planning: {
    title: "Planning revision",
    subtitle: "Choosing which generation steps should run again.",
    pendingLabel: "Planning revision",
    tone: "message",
    thought: "The revision should stay targeted so existing work can be reused.",
    action: "Build a rerun plan for the requested revision."
  },
  revision_executing: {
    title: "Applying revision",
    subtitle: "Updating the generated result with the new instructions.",
    pendingLabel: "Applying revision",
    tone: "message",
    thought: "The revised output should preserve unaffected parts whenever possible.",
    action: "Execute the revision plan and update the result."
  },
  completed: {
    title: "Completed",
    subtitle: "The task has finished successfully.",
    pendingLabel: "Completed",
    tone: "generic",
    thought: "The workflow has finished and the result is ready.",
    action: "Return the completed result."
  },
  failed: {
    title: "Stopped",
    subtitle: "The task ended before it could finish.",
    pendingLabel: "Stopped",
    tone: "generic",
    thought: "The workflow could not finish successfully.",
    action: "Stop execution and surface the failure."
  },
  skill_input_processor: {
    title: "Parse source",
    subtitle: "Normalizing pasted text, links, and mixed input.",
    pendingLabel: "Parsing source",
    tone: "input",
    thought: "The source must be normalized before downstream planning can work reliably.",
    action: "Parse text and URLs into one clean source payload."
  },
  skill_content_planner: {
    title: "Plan slides",
    subtitle: "Structuring hooks, cards, and story flow.",
    pendingLabel: "Planning slides",
    tone: "content",
    thought: "The source should become a compact slide narrative with clear hierarchy.",
    action: "Draft the title, caption, hashtags, and slide structure."
  },
  skill_visual_prompt_planner: {
    title: "Plan visuals",
    subtitle: "Drafting image prompts for each slide.",
    pendingLabel: "Planning visuals",
    tone: "visual",
    thought: "Each visual prompt should reinforce the copy and stay stylistically consistent.",
    action: "Write one image prompt per slide with layout guidance."
  },
  skill_asset_generator: {
    title: "Generate assets",
    subtitle: "Creating slide imagery and supporting visuals.",
    pendingLabel: "Generating assets",
    tone: "asset",
    thought: "Generated imagery should support the message without hurting readability.",
    action: "Create slide images and attach asset URLs."
  },
  skill_viral_optimizer: {
    title: "Optimize caption",
    subtitle: "Improving hooks, CTA, and shareability.",
    pendingLabel: "Optimizing caption",
    tone: "content",
    thought: "A stronger hook and CTA can improve saves, shares, and comments.",
    action: "Refine the caption and CTA for conversion."
  },
  skill_quality_post_copy_loop: {
    title: "Check copy quality",
    subtitle: "Reviewing clarity, consistency, and constraints.",
    pendingLabel: "Checking copy quality",
    tone: "quality",
    thought: "The draft should be checked for clarity and constraint alignment before delivery.",
    action: "Run a quality pass and apply safe rewrites where needed."
  },
  skill_quality_copy_polish: {
    title: "Polish final copy",
    subtitle: "Refining title, caption, and hashtags.",
    pendingLabel: "Polishing final copy",
    tone: "quality",
    thought: "Final copy should read smoothly without changing the original intent.",
    action: "Polish the title, caption, and hashtags."
  },
  skill_quality_final_audit: {
    title: "Final audit",
    subtitle: "Verifying the result is ready to ship.",
    pendingLabel: "Running final audit",
    tone: "quality",
    thought: "The result should pass one final quality gate before release.",
    action: "Audit the final output and recover from blocking issues."
  },
  llm_usage_summary: {
    title: "Usage summary",
    subtitle: "Summarizing model and token usage for the run.",
    pendingLabel: "Summarizing usage",
    tone: "generic",
    thought: "The run should expose how much model usage it consumed.",
    action: "Aggregate token and cost metrics."
  },
  direct_image_count: {
    title: "Plan images",
    subtitle: "Choosing how many images this carousel needs.",
    pendingLabel: "Planning images",
    tone: "visual",
    thought: "The request should map to the right number of standalone images.",
    action: "Choose the image count for this carousel."
  },
  direct_publish_copy: {
    title: "Write caption",
    subtitle: "Preparing platform-ready post copy.",
    pendingLabel: "Writing caption",
    tone: "content",
    thought: "The generated images need matching platform-ready copy.",
    action: "Write the title, caption, and hashtags for the post."
  },
  apimart_direct_n_planner: {
    title: "Plan images",
    subtitle: "Choosing how many images this carousel needs.",
    pendingLabel: "Planning images",
    tone: "visual",
    thought: "The request should map to the right number of standalone images.",
    action: "Choose the image count for this carousel."
  },
  apimart_direct_image_generator: {
    title: "Generate images",
    subtitle: "Creating standalone carousel images.",
    pendingLabel: "Generating images",
    tone: "asset",
    thought: "Each carousel image should be generated as its own standalone visual.",
    action: "Generate the carousel images."
  }
};

const TOOL_DESCRIPTORS: Record<string, AssistantBlockDescriptor> = {
  content_task: {
    title: "Generating carousel",
    subtitle: "Preparing slides, visuals, and caption.",
    pendingLabel: "Generating carousel",
    tone: "message"
  },
  web_search: {
    title: "Web search",
    subtitle: "Searching links and opening source material.",
    pendingLabel: "Searching web",
    tone: "input"
  },
  content_analysis: {
    title: "Analyze request",
    subtitle: "Extracting the key angle and next move.",
    pendingLabel: "Analyzing request",
    tone: "content"
  },
  slide_planning: {
    title: "Plan generation",
    subtitle: "Preparing the generation workflow before the job starts.",
    pendingLabel: "Planning generation",
    tone: "message"
  },
  source_card: {
    title: "Source",
    subtitle: "Fetched source metadata and preview.",
    pendingLabel: "Source",
    tone: "input"
  },
  pipeline_step: {
    title: "Processing step",
    subtitle: "Working through the generation pipeline.",
    pendingLabel: "Processing step",
    tone: "generic"
  }
};

export function humanizeBlockToken(value: string): string {
  return value.replace(/^skill_/i, "").replace(/_/g, " ").trim();
}

export function getAssistantBlockDescriptor(params: {
  stage?: string;
  toolName?: string;
}): AssistantBlockDescriptor {
  const stage = String(params.stage ?? "").trim();
  if (stage && STAGE_DESCRIPTORS[stage]) {
    return STAGE_DESCRIPTORS[stage];
  }

  const toolName = String(params.toolName ?? "").trim();
  if (toolName && TOOL_DESCRIPTORS[toolName]) {
    return TOOL_DESCRIPTORS[toolName];
  }

  const fallbackTitle = humanizeBlockToken(stage || toolName || "processing");
  return {
    title: fallbackTitle ? fallbackTitle[0].toUpperCase() + fallbackTitle.slice(1) : "Processing",
    subtitle: "Working through the next step.",
    pendingLabel: fallbackTitle,
    tone: "generic",
    thought: "Process the next step in the workflow.",
    action: `Execute ${fallbackTitle || "the next step"}.`
  };
}

export function getAssistantStageNarration(stage: string): {
  title: string;
  thought: string;
  action: string;
} {
  const descriptor = getAssistantBlockDescriptor({ stage });
  return {
    title: descriptor.title,
    thought: descriptor.thought ?? "Process the next step in the workflow.",
    action: descriptor.action ?? `Execute ${descriptor.title}.`
  };
}
