import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Creem } from "creem";
import { buildAttributionEventProperties, normalizeAttributionSnapshot, type AttributionSnapshot } from "@/lib/analytics/attribution-snapshot";
import { appConfig } from "@/lib/config";
import {
  getBillingPackage,
  getBillingPackageByProductId,
  isBillingPackageId,
  normalizePricingVariant,
  requireBillingPackage,
  resolveProductIdForPackage,
  type BillingPackageId,
  type PricingVariant
} from "@/lib/billing/catalog";
import { IMAGE_UNLOCK_CURRENCY, IMAGE_UNLOCK_PACKAGE_ID, resolveImageUnlockPriceUsd } from "@/lib/billing/image-unlocks";

type CreateCheckoutParams = {
  userId: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
  generationResolutionExperimentKey?: string;
  generationResolutionExperimentVariant?: string;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  requestId?: string;
  discountCode?: string;
  checkoutTheme?: "dark" | "default";
  attribution?: AttributionSnapshot;
  checkoutType?: string;
};

type CreateImageUnlockCheckoutParams = {
  userId: string;
  assetId: string;
  jobId: string;
  pricingVariant?: PricingVariant;
  generationResolutionExperimentKey?: string;
  generationResolutionExperimentVariant?: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  requestId?: string;
  checkoutTheme?: "dark" | "default";
  attribution?: AttributionSnapshot;
};

type CreemWebhookEvent = {
  id?: string;
  eventType?: string;
  object?: unknown;
};

export type CompletedRechargePayload = {
  eventId: string;
  checkoutId?: string;
  subscriptionId?: string;
  orderId?: string;
  amountPaidUsd?: number;
  amountPaid?: number;
  currency?: string;
  packageId: BillingPackageId;
  pricingVariant?: PricingVariant;
  generationResolutionExperimentKey?: string;
  generationResolutionExperimentVariant?: string;
  userId: string;
  customerId?: string;
  idempotencyKey: string;
  transactionId?: string;
  subscriptionStatus?: CreemSubscriptionStatus;
  subscriptionStartedAt?: string;
  currentPeriodStartDate?: string;
  currentPeriodEndDate?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
  attribution?: AttributionSnapshot;
  testMode?: boolean;
  order?: Record<string, unknown>;
  checkoutType?: string;
};

export type VerifiedCreemRechargePayment = {
  transactionId: string;
  orderId?: string;
  customerId?: string;
  amount: number;
  amountPaid: number;
  taxAmount: number;
  currency: string;
  status: string;
  mode: string;
  type: string;
  createdAt?: number;
  raw: Record<string, unknown>;
};

type CompletedImageUnlockPayload = {
  eventId: string;
  userId: string;
  jobId: string;
  assetId: string;
  checkoutId?: string;
  transactionId?: string;
  orderId?: string;
  customerId?: string;
  amountUsd: number;
  amountPaid?: number;
  currency: string;
  pricingVariant?: PricingVariant;
  generationResolutionExperimentKey?: string;
  generationResolutionExperimentVariant?: string;
  idempotencyKey: string;
  attribution?: AttributionSnapshot;
  testMode?: boolean;
};

export type CreemSubscriptionStatus =
  | "none"
  | "active"
  | "paid"
  | "trialing"
  | "unpaid"
  | "paused"
  | "canceled"
  | "expired"
  | "scheduled_cancel";

export type SubscriptionAccessPayload = {
  eventId: string;
  subscriptionId: string;
  userId: string;
  customerId?: string;
  packageId?: BillingPackageId;
  pricingVariant?: PricingVariant;
  status: CreemSubscriptionStatus;
  subscriptionStartedAt?: string;
  currentPeriodStartDate?: string;
  currentPeriodEndDate?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
};

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
}

function metadataTestMode(metadata: Record<string, unknown> | null): boolean | undefined {
  return asBooleanLike(metadata?.creem_test_mode)
    ?? asBooleanLike(metadata?.test_mode)
    ?? (asString(metadata?.billing_environment)?.trim().toLowerCase() === "test" ? true : undefined);
}

function objectString(value: Record<string, unknown> | null, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const direct = asString(value?.[key]);
    if (direct) return direct;
  }
  return undefined;
}

function objectBoolean(value: Record<string, unknown> | null, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const direct = asBoolean(value?.[key]);
    if (typeof direct === "boolean") return direct;
  }
  return undefined;
}

function objectId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return asString(toObject(value)?.id);
}

function subscriptionPeriodIdempotencyKey(params: {
  subscriptionId?: string;
  currentPeriodStartDate?: string;
  currentPeriodEndDate?: string;
}): string | undefined {
  if (!params.subscriptionId || !params.currentPeriodEndDate) return undefined;
  return [
    "creem:subscription-period",
    params.subscriptionId,
    params.currentPeriodStartDate ?? "unknown-start",
    params.currentPeriodEndDate
  ].join(":");
}

function orderTransactionId(order: Record<string, unknown> | null): string | undefined {
  return objectString(order, "transaction", "transaction_id", "transactionId")
    ?? objectId(order?.transaction)
    ?? objectId(order?.transaction_id)
    ?? objectId(order?.transactionId);
}

export function isCompletedCreemCheckoutPayment(checkout: unknown): boolean {
  const checkoutRecord = toObject(checkout);
  const order = toObject(checkoutRecord?.order);
  const transactionId = orderTransactionId(order);

  return asString(checkoutRecord?.status) === "completed"
    && asString(order?.status) === "paid"
    && Boolean(transactionId)
    && Boolean(order && transactionAmountPaid(order) > 0);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function subscriptionStatusFromEventType(eventType: string, objectStatus?: string): CreemSubscriptionStatus {
  if (objectStatus === "past_due") {
    return "unpaid";
  }
  if (
    objectStatus === "active"
    || objectStatus === "trialing"
    || objectStatus === "unpaid"
    || objectStatus === "paused"
    || objectStatus === "canceled"
    || objectStatus === "expired"
    || objectStatus === "scheduled_cancel"
  ) {
    return objectStatus;
  }
  if (eventType === "subscription.paused") return "paused";
  if (eventType === "subscription.canceled") return "canceled";
  if (eventType === "subscription.expired") return "expired";
  if (eventType === "subscription.scheduled_cancel") return "scheduled_cancel";
  if (eventType === "subscription.paid") return "paid";
  return "active";
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf-8");
  const rightBuffer = Buffer.from(right, "utf-8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function requireCreemConfig(): {
  apiKey: string;
  webhookSecret: string;
  testMode: boolean;
  imageUnlockProductId: string;
  imageUnlockProductIdV14: string;
  imageUnlockProductIdV19: string;
} {
  const apiKey = appConfig.billing.creem.apiKey;
  const webhookSecret = appConfig.billing.creem.webhookSecret;
  if (!apiKey) {
    throw new Error("CREEM_API_KEY is missing.");
  }

  return {
    apiKey,
    webhookSecret,
    testMode: appConfig.billing.creem.testMode,
    imageUnlockProductId: appConfig.billing.creem.productIdImageUnlock,
    imageUnlockProductIdV14: appConfig.billing.creem.productIdImageUnlockV14,
    imageUnlockProductIdV19: appConfig.billing.creem.productIdImageUnlockV19
  };
}

function createCreemClient(): Creem {
  const creem = requireCreemConfig();
  return new Creem({
    apiKey: creem.apiKey,
    serverIdx: creem.testMode ? 1 : 0
  });
}

export function getRechargeProductId(packageId: BillingPackageId): string {
  requireCreemConfig();
  return resolveProductIdForPackage(packageId);
}

function packageIdFromProductId(productId?: string): BillingPackageId | null {
  if (!productId) return null;

  requireCreemConfig();
  return getBillingPackageByProductId(productId)?.id ?? null;
}

function extractUserId(metadata: Record<string, unknown> | null): string | undefined {
  return asString(metadata?.referenceId) ?? asString(metadata?.user_id) ?? asString(metadata?.userId);
}

function extractPackageId(metadata: Record<string, unknown> | null, productId?: string): BillingPackageId | null {
  const metadataPackageId = asString(metadata?.package_id);
  if (isBillingPackageId(metadataPackageId)) {
    return metadataPackageId;
  }
  return packageIdFromProductId(productId);
}

function isImageUnlockMetadata(metadata: Record<string, unknown> | null, productId?: string): boolean {
  if (
    asString(metadata?.checkout_type) === "image_unlock"
    || asString(metadata?.package_id) === IMAGE_UNLOCK_PACKAGE_ID
  ) {
    return true;
  }
  if (isBillingPackageId(asString(metadata?.package_id))) {
    return false;
  }

  const { imageUnlockProductId, imageUnlockProductIdV14, imageUnlockProductIdV19 } = requireCreemConfig();
  return Boolean(productId && (
    (imageUnlockProductId && productId === imageUnlockProductId)
    || (imageUnlockProductIdV14 && productId === imageUnlockProductIdV14)
    || (imageUnlockProductIdV19 && productId === imageUnlockProductIdV19)
  ));
}

function buildCompletedPayload(params: {
  eventId: string;
  checkoutId?: string;
  userId?: string;
  packageId?: BillingPackageId | null;
  pricingVariant?: string;
  generationResolutionExperimentKey?: string;
  generationResolutionExperimentVariant?: string;
  subscriptionId?: string;
  orderId?: string;
  customerId?: string;
  transactionId?: string;
  idempotencyKey?: string;
  subscriptionStatus?: CreemSubscriptionStatus;
  subscriptionStartedAt?: string;
  currentPeriodStartDate?: string;
  currentPeriodEndDate?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  assetId?: string;
  jobId?: string;
  sessionId?: string;
  attribution?: AttributionSnapshot;
  testMode?: boolean;
  order?: Record<string, unknown>;
  checkoutType?: string;
}): CompletedRechargePayload | null {
  const stableChargeId = params.transactionId || params.orderId || params.idempotencyKey;
  const billingPackage = params.packageId ? getBillingPackage(params.packageId) : undefined;
  const subscriptionId = params.subscriptionId;
  if (!params.eventId || !params.userId || !params.packageId || !stableChargeId) {
    return null;
  }
  if (billingPackage?.kind === "subscription" && !subscriptionId) {
    return null;
  }

  return {
    eventId: params.eventId,
    ...(params.checkoutId ? { checkoutId: params.checkoutId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    packageId: params.packageId,
    pricingVariant: params.pricingVariant ? normalizePricingVariant(params.pricingVariant) : billingPackage?.pricingVariant,
    ...(params.generationResolutionExperimentKey ? { generationResolutionExperimentKey: params.generationResolutionExperimentKey } : {}),
    ...(params.generationResolutionExperimentVariant ? { generationResolutionExperimentVariant: params.generationResolutionExperimentVariant } : {}),
    userId: params.userId,
    customerId: params.customerId,
    ...(params.transactionId ? { transactionId: params.transactionId } : {}),
    ...(params.orderId ? { orderId: params.orderId } : {}),
    ...(params.subscriptionStatus ? { subscriptionStatus: params.subscriptionStatus } : {}),
    ...(params.subscriptionStartedAt ? { subscriptionStartedAt: params.subscriptionStartedAt } : {}),
    ...(params.currentPeriodStartDate ? { currentPeriodStartDate: params.currentPeriodStartDate } : {}),
    ...(params.currentPeriodEndDate ? { currentPeriodEndDate: params.currentPeriodEndDate } : {}),
    ...(typeof params.cancelAtPeriodEnd === "boolean" ? { cancelAtPeriodEnd: params.cancelAtPeriodEnd } : {}),
    ...(params.canceledAt ? { canceledAt: params.canceledAt } : {}),
    ...(params.assetId ? { assetId: params.assetId } : {}),
    ...(params.jobId ? { jobId: params.jobId } : {}),
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    ...(params.attribution ? { attribution: params.attribution } : {}),
    ...(typeof params.testMode === "boolean" ? { testMode: params.testMode } : {}),
    ...(params.order ? { order: params.order } : {}),
    ...(params.checkoutType ? { checkoutType: params.checkoutType } : {}),
    idempotencyKey: params.idempotencyKey ?? (params.transactionId
      ? `creem:transaction:${params.transactionId}`
      : `creem:order:${params.orderId}`)
  };
}

function withCreemCheckoutTheme(url: string, theme: "dark" | "default" = "dark"): string {
  const parsed = new URL(url);
  if (theme === "dark") {
    parsed.searchParams.set("theme", "dark");
  } else {
    parsed.searchParams.delete("theme");
  }
  return parsed.toString();
}

export async function createCreemCheckout(
  params: CreateCheckoutParams
): Promise<{ checkoutId: string; checkoutUrl: string; productId: string }> {
  if (params.pricingVariant === "2.5" || requireBillingPackage(params.packageId).pricingVariant === "2.5") {
    throw new Error("PRICING_VARIANT_STRIPE_ONLY");
  }
  const creem = createCreemClient();
  const creemConfig = requireCreemConfig();
  const billingPackage = requireBillingPackage(params.packageId);
  const productId = getRechargeProductId(params.packageId);

  const checkout = await creem.checkouts.create({
    requestId: params.requestId?.trim() || `recharge-${params.userId}-${params.packageId}-${randomUUID()}`,
    productId,
    ...(params.discountCode?.trim() ? { discountCode: params.discountCode.trim() } : {}),
    customer: params.customerEmail?.trim()
      ? {
          email: params.customerEmail.trim(),
          ...(params.customerName?.trim() ? { name: params.customerName.trim() } : {})
        }
      : undefined,
    successUrl: params.successUrl,
    metadata: {
      package_id: params.packageId,
      pricing_variant: params.pricingVariant ?? billingPackage.pricingVariant,
      package_kind: billingPackage.kind,
      credits: String(billingPackage.credits),
      ...(params.checkoutType?.trim() ? { checkout_type: params.checkoutType.trim() } : {}),
      creem_test_mode: creemConfig.testMode ? "true" : "false",
      billing_environment: creemConfig.testMode ? "test" : "live",
      ...(params.assetId?.trim() ? { asset_id: params.assetId.trim() } : {}),
      ...(params.jobId?.trim() ? { job_id: params.jobId.trim() } : {}),
      ...(params.sessionId?.trim() ? { session_id: params.sessionId.trim() } : {}),
      ...(params.generationResolutionExperimentKey?.trim()
        ? { generation_resolution_experiment_key: params.generationResolutionExperimentKey.trim() }
        : {}),
      ...(params.generationResolutionExperimentVariant?.trim()
        ? { generation_resolution_experiment_variant: params.generationResolutionExperimentVariant.trim() }
        : {}),
      ...(params.discountCode?.trim() ? { discount_code: params.discountCode.trim() } : {}),
      user_id: params.userId,
      referenceId: params.userId,
      ...buildAttributionEventProperties(params.attribution)
    }
  });

  if (!checkout.id || !checkout.checkoutUrl) {
    throw new Error("Creem checkout creation failed.");
  }

  return {
    checkoutId: checkout.id,
    checkoutUrl: withCreemCheckoutTheme(checkout.checkoutUrl, params.checkoutTheme),
    productId
  };
}

export async function createCreemImageUnlockCheckout(
  params: CreateImageUnlockCheckoutParams
): Promise<{ checkoutId: string; checkoutUrl: string; productId: string }> {
  if (params.pricingVariant === "2.5") throw new Error("PRICING_VARIANT_STRIPE_ONLY");
  const creem = createCreemClient();
  const { imageUnlockProductId, imageUnlockProductIdV14, imageUnlockProductIdV19, testMode } = requireCreemConfig();
  const checkoutProductId = params.pricingVariant === "1.9" || params.pricingVariant === "2.3"
    ? imageUnlockProductIdV19
    : params.pricingVariant === "1.4"
      ? imageUnlockProductIdV14
      : imageUnlockProductId;
  if (!checkoutProductId) {
    throw new Error("Creem product is not configured for image unlock.");
  }

  const checkout = await creem.checkouts.create({
    requestId: params.requestId?.trim() || `image-unlock-${params.userId}-${params.assetId}-${randomUUID()}`,
    productId: checkoutProductId,
    customer: params.customerEmail?.trim()
      ? {
          email: params.customerEmail.trim(),
          ...(params.customerName?.trim() ? { name: params.customerName.trim() } : {})
        }
      : undefined,
    successUrl: params.successUrl,
    metadata: {
      checkout_type: "image_unlock",
      package_id: IMAGE_UNLOCK_PACKAGE_ID,
      user_id: params.userId,
      referenceId: params.userId,
      job_id: params.jobId,
      asset_id: params.assetId,
      ...(params.pricingVariant ? { pricing_variant: params.pricingVariant } : {}),
      ...(params.generationResolutionExperimentKey?.trim()
        ? { generation_resolution_experiment_key: params.generationResolutionExperimentKey.trim() }
        : {}),
      ...(params.generationResolutionExperimentVariant?.trim()
        ? { generation_resolution_experiment_variant: params.generationResolutionExperimentVariant.trim() }
        : {}),
      creem_test_mode: testMode ? "true" : "false",
      billing_environment: testMode ? "test" : "live",
      ...buildAttributionEventProperties(params.attribution)
    }
  });

  if (!checkout.id || !checkout.checkoutUrl) {
    throw new Error("Creem image unlock checkout creation failed.");
  }

  return {
    checkoutId: checkout.id,
    checkoutUrl: withCreemCheckoutTheme(checkout.checkoutUrl, params.checkoutTheme),
    productId: checkoutProductId
  };
}

export async function fetchCompletedRechargeFromCheckout(checkoutId: string): Promise<CompletedRechargePayload | null> {
  const creem = createCreemClient();
  const checkout = await creem.checkouts.retrieve(checkoutId);

  if (!isCompletedCreemCheckoutPayment(checkout)) {
    return null;
  }

  const metadata = toObject(checkout.metadata);
  const order = toObject(checkout.order);
  const subscription = toObject(checkout.subscription);
  const subscriptionId = objectId(checkout.subscription);
  const currentPeriodStartDate = objectString(
    subscription,
    "current_period_start_date",
    "current_period_start",
    "currentPeriodStartDate",
    "currentPeriodStart"
  );
  const currentPeriodEndDate = objectString(
    subscription,
    "current_period_end_date",
    "current_period_end",
    "currentPeriodEndDate",
    "currentPeriodEnd"
  );

  return buildCompletedPayload({
    eventId: checkout.id,
    checkoutId: checkout.id,
    userId: extractUserId(metadata),
    packageId: extractPackageId(metadata, objectId(checkout.product)),
    pricingVariant: asString(metadata?.pricing_variant) as PricingVariant | undefined,
    generationResolutionExperimentKey: asString(metadata?.generation_resolution_experiment_key),
    generationResolutionExperimentVariant: asString(metadata?.generation_resolution_experiment_variant),
    subscriptionId,
    customerId: objectId(checkout.customer),
    transactionId: orderTransactionId(order),
    orderId: objectId(order),
    idempotencyKey: subscriptionPeriodIdempotencyKey({
      subscriptionId,
      currentPeriodStartDate,
      currentPeriodEndDate
    }),
    subscriptionStatus: subscriptionStatusFromEventType("checkout.completed", asString(subscription?.status)),
    subscriptionStartedAt: objectString(subscription, "created_at", "createdAt"),
    currentPeriodStartDate,
    currentPeriodEndDate,
    cancelAtPeriodEnd: objectBoolean(subscription, "cancel_at_period_end", "cancelAtPeriodEnd"),
    canceledAt: objectString(subscription, "canceled_at", "canceledAt"),
    assetId: asString(metadata?.asset_id),
    jobId: asString(metadata?.job_id),
    sessionId: asString(metadata?.session_id),
    attribution: normalizeAttributionSnapshot(metadata),
    testMode: metadataTestMode(metadata),
    order: order ?? undefined,
    checkoutType: asString(metadata?.checkout_type)
  });
}

function buildCompletedImageUnlockPayload(params: {
  eventId: string;
  userId?: string;
  jobId?: string;
  assetId?: string;
  checkoutId?: string;
  customerId?: string;
  transactionId?: string;
  orderId?: string;
  pricingVariant?: string;
  generationResolutionExperimentKey?: string;
  generationResolutionExperimentVariant?: string;
  attribution?: AttributionSnapshot;
  testMode?: boolean;
}): CompletedImageUnlockPayload | null {
  const stableChargeId = params.transactionId || params.orderId || params.checkoutId || params.eventId;
  if (!params.eventId || !params.userId || !params.jobId || !params.assetId || !stableChargeId) {
    return null;
  }

  return {
    eventId: params.eventId,
    userId: params.userId,
    jobId: params.jobId,
    assetId: params.assetId,
    checkoutId: params.checkoutId,
    customerId: params.customerId,
    transactionId: params.transactionId,
    orderId: params.orderId,
    amountUsd: resolveImageUnlockPriceUsd(params.pricingVariant),
    amountPaid: resolveImageUnlockPriceUsd(params.pricingVariant),
    currency: IMAGE_UNLOCK_CURRENCY,
    pricingVariant: params.pricingVariant ? normalizePricingVariant(params.pricingVariant) : undefined,
    ...(params.generationResolutionExperimentKey ? { generationResolutionExperimentKey: params.generationResolutionExperimentKey } : {}),
    ...(params.generationResolutionExperimentVariant ? { generationResolutionExperimentVariant: params.generationResolutionExperimentVariant } : {}),
    attribution: params.attribution,
    ...(typeof params.testMode === "boolean" ? { testMode: params.testMode } : {}),
    idempotencyKey: params.transactionId
      ? `creem:image-unlock:transaction:${params.transactionId}`
      : params.orderId
        ? `creem:image-unlock:order:${params.orderId}`
        : `creem:image-unlock:checkout:${stableChargeId}`
  };
}

export async function fetchCompletedImageUnlockFromCheckout(checkoutId: string): Promise<CompletedImageUnlockPayload | null> {
  const creem = createCreemClient();
  const checkout = await creem.checkouts.retrieve(checkoutId);

  const metadata = toObject(checkout.metadata);
  const productId = objectId(checkout.product);
  if (!isImageUnlockMetadata(metadata, productId) || !isCompletedCreemCheckoutPayment(checkout)) {
    return null;
  }

  const order = toObject(checkout.order);
  return buildCompletedImageUnlockPayload({
    eventId: checkout.id,
    checkoutId: checkout.id,
    userId: extractUserId(metadata),
    jobId: asString(metadata?.job_id),
    assetId: asString(metadata?.asset_id),
    customerId: objectId(checkout.customer),
    transactionId: orderTransactionId(order),
    orderId: objectId(order),
    pricingVariant: asString(metadata?.pricing_variant),
    generationResolutionExperimentKey: asString(metadata?.generation_resolution_experiment_key),
    generationResolutionExperimentVariant: asString(metadata?.generation_resolution_experiment_variant),
    attribution: normalizeAttributionSnapshot(metadata),
    testMode: metadataTestMode(metadata)
  });
}

export async function createCreemPortalLink(customerId: string): Promise<string> {
  const creem = createCreemClient();
  const links = await creem.customers.generateBillingLinks({ customerId });
  const portalLink = links.customerPortalLink?.trim();
  if (!portalLink) {
    throw new Error("Creem portal link is not available.");
  }
  return withCreemCheckoutTheme(portalLink);
}

export async function findCreemCustomerIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return null;

  const creem = createCreemClient();
  try {
    const customer = await creem.customers.retrieve(undefined, normalizedEmail);
    return customer.id?.trim() || null;
  } catch {
    return null;
  }
}

function centsFromUsd(value: number): number {
  return Math.round(value * 100);
}

function transactionAmountPaid(transaction: Record<string, unknown>): number {
  const amountPaid = Number(transaction.amountPaid ?? transaction.amount_paid);
  if (Number.isFinite(amountPaid)) return amountPaid;
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) ? amount : 0;
}

function transactionNumber(transaction: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = Number(transaction[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

export function isCreemRechargePaymentAmountValid(
  transaction: Record<string, unknown>,
  expectedAmountCents: number
): boolean {
  if (!Number.isFinite(expectedAmountCents) || expectedAmountCents <= 0) return false;

  const expectedAmount = Math.round(expectedAmountCents);
  const amount = transactionNumber(transaction, "amount");
  if (typeof amount === "number" && amount >= expectedAmount) {
    return true;
  }

  const amountPaid = transactionNumber(transaction, "amountPaid", "amount_paid");
  if (typeof amountPaid !== "number") {
    return false;
  }
  if (amountPaid >= expectedAmount) {
    return true;
  }

  const discountAmount = transactionNumber(transaction, "discountAmount", "discount_amount") ?? 0;
  const taxAmount = transactionNumber(transaction, "taxAmount", "tax_amount") ?? 0;
  const reconstructedGrossAmount = amountPaid + discountAmount;
  const reconstructedPreTaxAmount = reconstructedGrossAmount - taxAmount;

  return reconstructedGrossAmount >= expectedAmount || reconstructedPreTaxAmount >= expectedAmount;
}

function normalizeCurrency(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function buildVerifiedPaymentFromOrder(params: {
  completed: CompletedRechargePayload;
  order: Record<string, unknown>;
  packageId: BillingPackageId;
}): VerifiedCreemRechargePayment {
  const billingPackage = requireBillingPackage(params.packageId);
  const transactionId = params.completed.transactionId?.trim() || objectString(params.order, "transaction", "transaction_id", "transactionId");
  if (!transactionId) {
    throw new Error("CREEM_PAYMENT_TRANSACTION_NOT_FOUND");
  }

  const status = typeof params.order.status === "string" ? params.order.status : "";
  if (status !== "paid") {
    throw new Error("CREEM_PAYMENT_NOT_PAID");
  }

  const orderId = objectId(params.order) ?? params.completed.orderId;
  if (params.completed.orderId?.trim() && orderId && orderId !== params.completed.orderId.trim()) {
    throw new Error("CREEM_PAYMENT_ORDER_MISMATCH");
  }

  const customerId = objectString(params.order, "customer", "customer_id", "customerId") ?? params.completed.customerId;
  if (params.completed.customerId?.trim() && customerId && customerId !== params.completed.customerId.trim()) {
    throw new Error("CREEM_PAYMENT_CUSTOMER_MISMATCH");
  }

  const currency = normalizeCurrency(params.order.currency);
  if (currency !== billingPackage.currency.toUpperCase()) {
    throw new Error("CREEM_PAYMENT_CURRENCY_MISMATCH");
  }

  if (!isCreemRechargePaymentAmountValid(params.order, centsFromUsd(billingPackage.usdAmount))) {
    throw new Error("CREEM_PAYMENT_AMOUNT_MISMATCH");
  }

  const amountPaid = transactionAmountPaid(params.order);
  const amount = Number(params.order.amount);
  const taxAmount = Number(params.order.taxAmount ?? params.order.tax_amount);

  return {
    transactionId,
    orderId,
    customerId,
    amount: Number.isFinite(amount) ? amount : amountPaid,
    amountPaid,
    taxAmount: Number.isFinite(taxAmount) ? taxAmount : 0,
    currency,
    status,
    mode: typeof params.order.mode === "string" ? params.order.mode : "",
    type: typeof params.order.type === "string" ? params.order.type : "",
    createdAt: Number.isFinite(Number(params.order.createdAt ?? params.order.created_at))
      ? Number(params.order.createdAt ?? params.order.created_at)
      : undefined,
    raw: params.order
  };
}

export async function verifyCompletedRechargePayment(params: {
  completed: CompletedRechargePayload;
  packageId: BillingPackageId;
}): Promise<VerifiedCreemRechargePayment> {
  const billingPackage = requireBillingPackage(params.packageId);
  const creem = createCreemClient();

  let transaction: Record<string, unknown> | null = null;
  try {
    if (params.completed.transactionId?.trim()) {
      transaction = toRecord(await creem.transactions.getById(params.completed.transactionId.trim()));
    } else if (params.completed.orderId?.trim()) {
      const search = await creem.transactions.search(undefined, params.completed.orderId.trim(), undefined, 1, 10);
      const items = Array.isArray(search.items) ? search.items.map(toRecord) : [];
      transaction = items.find((item) => item.status === "paid") ?? items[0] ?? null;
    }
  } catch (error) {
    if (params.completed.order) {
      return buildVerifiedPaymentFromOrder({
        completed: params.completed,
        order: params.completed.order,
        packageId: params.packageId
      });
    }
    throw error;
  }

  if (!transaction?.id || typeof transaction.id !== "string") {
    if (params.completed.order) {
      return buildVerifiedPaymentFromOrder({
        completed: params.completed,
        order: params.completed.order,
        packageId: params.packageId
      });
    }
    throw new Error("CREEM_PAYMENT_TRANSACTION_NOT_FOUND");
  }

  const status = typeof transaction.status === "string" ? transaction.status : "";
  if (status !== "paid") {
    throw new Error("CREEM_PAYMENT_NOT_PAID");
  }

  const transactionOrderId = typeof transaction.order === "string" ? transaction.order.trim() : undefined;
  if (params.completed.orderId?.trim() && transactionOrderId && transactionOrderId !== params.completed.orderId.trim()) {
    throw new Error("CREEM_PAYMENT_ORDER_MISMATCH");
  }

  const transactionCustomerId = typeof transaction.customer === "string" ? transaction.customer.trim() : undefined;
  if (params.completed.customerId?.trim() && transactionCustomerId && transactionCustomerId !== params.completed.customerId.trim()) {
    throw new Error("CREEM_PAYMENT_CUSTOMER_MISMATCH");
  }

  const currency = normalizeCurrency(transaction.currency);
  if (currency !== billingPackage.currency.toUpperCase()) {
    throw new Error("CREEM_PAYMENT_CURRENCY_MISMATCH");
  }

  const amountPaid = transactionAmountPaid(transaction);
  if (!isCreemRechargePaymentAmountValid(transaction, centsFromUsd(billingPackage.usdAmount))) {
    throw new Error("CREEM_PAYMENT_AMOUNT_MISMATCH");
  }

  const amount = Number(transaction.amount);
  const taxAmount = Number(transaction.taxAmount ?? transaction.tax_amount);

  return {
    transactionId: transaction.id,
    orderId: transactionOrderId,
    customerId: transactionCustomerId,
    amount: Number.isFinite(amount) ? amount : amountPaid,
    amountPaid,
    taxAmount: Number.isFinite(taxAmount) ? taxAmount : 0,
    currency,
    status,
    mode: typeof transaction.mode === "string" ? transaction.mode : "",
    type: typeof transaction.type === "string" ? transaction.type : "",
    createdAt: Number.isFinite(Number(transaction.createdAt ?? transaction.created_at))
      ? Number(transaction.createdAt ?? transaction.created_at)
      : undefined,
    raw: transaction
  };
}

export function verifyCreemWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
}): boolean {
  const { webhookSecret } = requireCreemConfig();
  if (!webhookSecret) {
    throw new Error("CREEM_WEBHOOK_SECRET is missing.");
  }
  if (!params.signatureHeader) {
    return false;
  }

  const digest = createHmac("sha256", webhookSecret).update(params.rawBody).digest("hex");
  return secureEquals(digest, params.signatureHeader);
}

export function parseCreemWebhookEvent(rawBody: string): CreemWebhookEvent {
  return JSON.parse(rawBody) as CreemWebhookEvent;
}

export function parseCompletedRechargeEvent(event: CreemWebhookEvent): CompletedRechargePayload | null {
  const eventType = event.eventType;
  const eventId = event.id?.trim();
  const object = toObject(event.object);

  if (!eventId || !object) {
    return null;
  }

  if (eventType === "checkout.completed") {
    const subscription = toObject(object.subscription);
    const order = toObject(object.order);
    const metadata = toObject(object.metadata) ?? toObject(subscription?.metadata);
    const subscriptionId = objectId(object.subscription);
    const customerId = objectId(object.customer);
    const productId = objectId(object.product) ?? objectId(subscription?.product);
    if (isImageUnlockMetadata(metadata, productId)) {
      return null;
    }

    const transactionId = orderTransactionId(order);
    const subscriptionStartedAt = objectString(subscription, "created_at", "createdAt");
    const currentPeriodStartDate = objectString(
      subscription,
      "current_period_start_date",
      "current_period_start",
      "currentPeriodStartDate",
      "currentPeriodStart"
    );
    const currentPeriodEndDate = objectString(
      subscription,
      "current_period_end_date",
      "current_period_end",
      "currentPeriodEndDate",
      "currentPeriodEnd"
    );

    return buildCompletedPayload({
      eventId,
      checkoutId: objectId(object),
      userId: extractUserId(metadata),
      packageId: extractPackageId(metadata, productId),
      pricingVariant: asString(metadata?.pricing_variant) as PricingVariant | undefined,
      generationResolutionExperimentKey: asString(metadata?.generation_resolution_experiment_key),
      generationResolutionExperimentVariant: asString(metadata?.generation_resolution_experiment_variant),
      subscriptionId,
      customerId,
      transactionId,
      orderId: objectId(order),
      idempotencyKey: subscriptionPeriodIdempotencyKey({
        subscriptionId,
        currentPeriodStartDate,
        currentPeriodEndDate
      }),
      subscriptionStatus: subscriptionStatusFromEventType("checkout.completed", asString(subscription?.status)),
      subscriptionStartedAt,
      currentPeriodStartDate,
      currentPeriodEndDate,
      cancelAtPeriodEnd: objectBoolean(subscription, "cancel_at_period_end", "cancelAtPeriodEnd"),
      canceledAt: objectString(subscription, "canceled_at", "canceledAt"),
      assetId: asString(metadata?.asset_id),
      jobId: asString(metadata?.job_id),
      sessionId: asString(metadata?.session_id),
      attribution: normalizeAttributionSnapshot(metadata),
      testMode: metadataTestMode(metadata),
      order: order ?? undefined,
      checkoutType: asString(metadata?.checkout_type)
    });
  }

  // Creem sends subscription.paid for both the initial successful payment and renewals.
  // Use a subscription-period key when possible so checkout.completed and subscription.paid converge.
  if (eventType === "subscription.paid") {
    const metadata = toObject(object.metadata);
    const userId = extractUserId(metadata);
    const packageId = extractPackageId(metadata, objectId(object.product));
    const subscriptionId = objectId(object);
    const customerId = objectId(object.customer);
    const transactionId =
      objectString(object, "lastTransactionId", "last_transaction_id")
      ?? objectId(object.lastTransaction)
      ?? objectId(object.last_transaction);

    const subscriptionStartedAt = objectString(object, "created_at", "createdAt");
    const currentPeriodStartDate = objectString(
      object,
      "current_period_start_date",
      "current_period_start",
      "currentPeriodStartDate",
      "currentPeriodStart"
    );
    const currentPeriodEndDate = objectString(
      object,
      "current_period_end_date",
      "current_period_end",
      "currentPeriodEndDate",
      "currentPeriodEnd"
    );

    return buildCompletedPayload({
      eventId,
      userId,
      packageId,
      pricingVariant: asString(metadata?.pricing_variant) as PricingVariant | undefined,
      generationResolutionExperimentKey: asString(metadata?.generation_resolution_experiment_key),
      generationResolutionExperimentVariant: asString(metadata?.generation_resolution_experiment_variant),
      subscriptionId,
      customerId,
      transactionId,
      idempotencyKey: subscriptionPeriodIdempotencyKey({
        subscriptionId,
        currentPeriodStartDate,
        currentPeriodEndDate
      }),
      subscriptionStatus: "paid",
      subscriptionStartedAt,
      currentPeriodStartDate,
      currentPeriodEndDate,
      cancelAtPeriodEnd: objectBoolean(object, "cancel_at_period_end", "cancelAtPeriodEnd"),
      canceledAt: objectString(object, "canceled_at", "canceledAt"),
      assetId: asString(metadata?.asset_id),
      jobId: asString(metadata?.job_id),
      sessionId: asString(metadata?.session_id),
      attribution: normalizeAttributionSnapshot(metadata),
      testMode: metadataTestMode(metadata),
      checkoutType: asString(metadata?.checkout_type)
    });
  }

  return null;
}

export function parseCompletedImageUnlockEvent(event: CreemWebhookEvent): CompletedImageUnlockPayload | null {
  if (event.eventType !== "checkout.completed") {
    return null;
  }

  const eventId = event.id?.trim();
  const object = toObject(event.object);
  if (!eventId || !object) {
    return null;
  }

  const metadata = toObject(object.metadata);
  const productId = objectId(object.product);
  if (!isImageUnlockMetadata(metadata, productId)) {
    return null;
  }

  const order = toObject(object.order);
  return buildCompletedImageUnlockPayload({
    eventId,
    checkoutId: objectId(object) ?? eventId,
    userId: extractUserId(metadata),
    jobId: asString(metadata?.job_id),
    assetId: asString(metadata?.asset_id),
    customerId: objectId(object.customer),
    transactionId: orderTransactionId(order),
    orderId: objectId(order),
    pricingVariant: asString(metadata?.pricing_variant),
    generationResolutionExperimentKey: asString(metadata?.generation_resolution_experiment_key),
    generationResolutionExperimentVariant: asString(metadata?.generation_resolution_experiment_variant),
    attribution: normalizeAttributionSnapshot(metadata),
    testMode: metadataTestMode(metadata)
  });
}

export function parseSubscriptionAccessEvent(event: CreemWebhookEvent): SubscriptionAccessPayload | null {
  const eventType = event.eventType;
  if (
    eventType !== "checkout.completed"
    && eventType !== "subscription.active"
    && eventType !== "subscription.update"
    && eventType !== "subscription.updated"
    && eventType !== "subscription.paid"
    && eventType !== "subscription.canceled"
    && eventType !== "subscription.expired"
    && eventType !== "subscription.scheduled_cancel"
    && eventType !== "subscription.paused"
  ) {
    return null;
  }

  const object = toObject(event.object);
  const subscriptionValue = eventType === "checkout.completed" ? object?.subscription : object;
  const subscription = toObject(subscriptionValue);
  const orderValue = eventType === "checkout.completed" ? object?.order : undefined;
  const metadata =
    eventType === "checkout.completed"
      ? toObject(object?.metadata) ?? toObject(subscription?.metadata)
      : toObject(subscriptionValue && toObject(subscriptionValue)?.metadata);
  const productValue = eventType === "checkout.completed" ? object?.product : subscriptionValue && toObject(subscriptionValue)?.product;
  const customerValue = eventType === "checkout.completed" ? object?.customer : subscriptionValue && toObject(subscriptionValue)?.customer;
  const productId = objectId(productValue);
  const metadataPackageId = asString(metadata?.package_id);
  if (eventType === "checkout.completed") {
    if (isImageUnlockMetadata(metadata, productId)) {
      return null;
    }
    if (metadataPackageId && !isBillingPackageId(metadataPackageId)) {
      return null;
    }
  }
  const packageId = extractPackageId(metadata, productId);
  const billingPackage = getBillingPackage(packageId);
  if (billingPackage && billingPackage.kind !== "subscription") {
    return null;
  }
  if (eventType === "checkout.completed" && (!subscriptionValue || !packageId)) {
    return null;
  }

  const eventId = event.id?.trim();
  const subscriptionId = objectId(subscriptionValue);
  const userId = extractUserId(metadata);
  if (!eventId || !subscriptionId || !userId) {
    return null;
  }

  return {
    eventId,
    subscriptionId,
    userId,
    customerId: objectId(customerValue),
    packageId: packageId ?? undefined,
    pricingVariant: billingPackage?.pricingVariant,
    status: subscriptionStatusFromEventType(eventType, asString(subscription?.status)),
    subscriptionStartedAt: objectString(subscription, "created_at", "createdAt"),
    currentPeriodStartDate: objectString(
      subscription,
      "current_period_start_date",
      "current_period_start",
      "currentPeriodStartDate",
      "currentPeriodStart"
    ),
    currentPeriodEndDate: objectString(
      subscription,
      "current_period_end_date",
      "current_period_end",
      "currentPeriodEndDate",
      "currentPeriodEnd"
    ),
    cancelAtPeriodEnd: objectBoolean(
      subscription,
      "cancel_at_period_end",
      "cancelAtPeriodEnd",
      "canceled_at_period_end",
      "canceledAtPeriodEnd"
    ),
    canceledAt: objectString(subscription, "canceled_at", "canceledAt", "canceled_date", "canceledDate")
  };
}
