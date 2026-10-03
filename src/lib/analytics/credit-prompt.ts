export type CreditPromptAnalyticsTrigger = "auto_open" | "manual_click";

export type CreditPromptAnalyticsInput = {
  promptCase: string;
  action: "add_credits" | "create_account" | "upgrade" | "unlock";
  surface: "result" | "error" | "thread";
  trigger: CreditPromptAnalyticsTrigger;
  userId?: string;
  authMode?: string;
  plan?: string;
  creditBalance?: number;
  generationStatus?: string;
  jobId?: string;
};

export function buildCreditPromptAnalyticsEvent(input: CreditPromptAnalyticsInput): {
  event: "credit_prompt_auto_opened" | "credit_prompt_cta_clicked";
  properties: Record<string, unknown>;
} {
  return {
    event: input.trigger === "auto_open"
      ? "credit_prompt_auto_opened"
      : "credit_prompt_cta_clicked",
    properties: {
      userId: input.userId,
      user_id: input.userId,
      promptCase: input.promptCase,
      prompt_case: input.promptCase,
      action: input.action,
      stage: "billing_prompt",
      status: "started",
      surface: input.surface,
      billing_surface: input.surface,
      trigger: input.trigger,
      trigger_type: input.trigger,
      authMode: input.authMode,
      auth_mode: input.authMode,
      auth_state: input.authMode === "supabase" ? "signed_in" : input.authMode ?? "guest",
      plan: input.plan,
      account_plan: input.plan,
      creditBalance: input.creditBalance,
      credit_balance: input.creditBalance,
      generationStatus: input.generationStatus,
      generation_status: input.generationStatus,
      jobId: input.jobId,
      job_id: input.jobId,
      product_area: "socialmedia"
    }
  };
}
