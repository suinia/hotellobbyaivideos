"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { captureAnalyticsEvent } from "@/lib/analytics/posthog";
import { SOCIALMEDIA_COMPOSER_MAX_CHARS } from "@/lib/socialmedia/input-limits";
import { orderAnimationInspirationTemplates, randomlyMixVideoInspirationTemplates } from "@/lib/socialmedia/video-inspiration";
import { isMiniMaxH3VideoFlowSourceUseCase } from "@/lib/videos/source-use-case";
import { Film, Image as ImageIcon, Play } from "lucide-react";
import styles from "./app.module.css";
import homeStyles from "./general-workspace.module.css";
import { getGeneralWorkspaceDraftKey } from "@/lib/app/workspace-draft";
import { findAppTool, appTools, type AppToolCard } from "./app-data";
import dynamic from "next/dynamic";
import { type AppExploreTemplate } from "./app-explore-store";
import { AppComposer } from "./app-composer";
import { spotifyCanvasComposerOptions, promoVideoComposerOptions, hotelLobbyComposerOptions, type AppVideoPreviewItem, type AppVideoPreviewState, shouldOpenVideoPreviewFullscreen, requestAppVideoFullscreen, AppVideoPreviewOverlay, PageHeading, RecentsSection, useTemplateCache, getTemplateImageUrl } from "./app-shared";

const InspirationPreview = dynamic(() => import("./inspiration-preview").then((module) => module.InspirationPreview));

const defaultHeroBackdropImages = [
  "/assets/socialmedia/reference-portrait.png",
  "/assets/socialmedia/reference-wide.png",
  "/assets/socialmedia/product-ad-og.png",
  "/assets/home/before.png",
  "/assets/home/after.png",
  "/assets/socialmedia/reference-portrait.png"
];

function normalizeBackdropImages(images?: string[]) {
  const source = images?.filter(Boolean) ?? [];
  return source.length ? source : defaultHeroBackdropImages;
}

// Match the CSS mobile breakpoint, but avoid creating hidden eager image nodes.
const DESKTOP_BACKDROP_QUERY = "(min-width: 761px)";
function subscribeDesktopBackdrop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_BACKDROP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function getDesktopBackdropSnapshot() {
  return window.matchMedia(DESKTOP_BACKDROP_QUERY).matches;
}
function getServerBackdropSnapshot() { return false; }

function HeroBackdrop({ images }: { images?: string[] }) {
  const uiLocale = useUiLocale();
  const visible = useSyncExternalStore(subscribeDesktopBackdrop, getDesktopBackdropSnapshot, getServerBackdropSnapshot);
  if (!visible) return null;
  const columns = Array.from({ length: 7 });
  const tiles = Array.from({ length: 18 });
  const backdropImages = normalizeBackdropImages(images);

  return localizeUiTree((
    <div className={styles.heroBackdrop} aria-hidden>
      <div className={styles.heroGlow} />
      <div className={styles.heroFilmMask}>
        <div className={styles.heroFilmRotator}>
          <div className={styles.heroFilmStage}>
            {columns.map((_, columnIndex) => (
              <div
                className={styles.heroFilmColumn}
                key={columnIndex}
                style={{
                  "--film-column-left": `${columnIndex * 252.8 - 33.8}px`,
                  "--film-column-offset": `${columnIndex % 2 === 0 ? -1802 : -3800}px`,
                  "--film-column-target": `${columnIndex % 2 === 0 ? -3800 : -1802}px`
                } as CSSProperties}
              >
                {tiles.map((__, tileIndex) => {
                  const src = backdropImages[(columnIndex + tileIndex) % backdropImages.length];
                  return (
                    <div className={styles.heroBackdropTile} key={`${columnIndex}-${tileIndex}-${src}`}>
                      <Image src={src} alt="" fill sizes="240px" loading="eager" fetchPriority="low" />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ), uiLocale);
}

export function AppHome() {
  const uiLocale = useUiLocale();
  const searchParams = useSearchParams();
  const [promptSuggestion, setPromptSuggestion] = useState<{ text: string; selection: number }>();
  const choosePrompt = (text: string) => setPromptSuggestion((current) => ({
    text, selection: (current?.selection ?? 0) + 1
  }));

  return localizeUiTree((
    <div className={homeStyles.workspace}>
      <section className={homeStyles.hero} aria-labelledby="workspace-title">
        <h1 id="workspace-title">What will you create today?</h1>
        <p className={homeStyles.subtitle}>Turn your ideas into images and videos.</p>
        <AppComposer
          hideOptions
          hideSafetyNotice
          className={`${styles.composer} ${styles.workbenchToolbarComposer} ${homeStyles.compactComposer}`}
          uploadButtonClassName={styles.workbenchUploadButton}
          uploadInToolbar
          allowImageOnlySubmit
          initialPrompt={searchParams.get("prompt") ?? ""}
          promptSuggestion={promptSuggestion}
          draftStorageKey={getGeneralWorkspaceDraftKey(searchParams.get("prompt"))}
          submitPathSlug="ai-image-maker"
          sourceUseCase="general"
          placeholder="Describe your idea or ask a question"
        />
      </section>
      <RecentsSection />
      <GeneralWorkspaceInspiration onChoosePrompt={choosePrompt} />
    </div>
  ), uiLocale);
}

function GeneralWorkspaceInspiration({ onChoosePrompt }: { onChoosePrompt: (prompt: string) => void }) {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const imageCache = useTemplateCache({ sourceUseCase: "ai-image-maker", category: "popular", limit: 12 });
  const videoCache = useTemplateCache({ sourceUseCase: "promo-video-maker", category: "inspired", limit: 12 });
  const aiVideoCache = useTemplateCache({ sourceUseCase: "ai-video-generator", category: "inspired", limit: 12 });
  const [preview, setPreview] = useState<AppExploreTemplate | null>(null);
  const mixedTemplates = useMemo(() => {
    const images = imageCache.templates.filter((item) => item.output_type !== "video");
    const videos = randomlyMixVideoInspirationTemplates({
      primary: videoCache.templates.map((item) => ({ ...item, output_type: "video" })),
      additions: [], limit: 4
    });
    const mixed: AppExploreTemplate[] = [];
    for (let index = 0; index < Math.max(Math.ceil(images.length / 2), videos.length); index += 1) {
      mixed.push(...images.slice(index * 2, index * 2 + 2));
      if (videos[index]) mixed.push(videos[index]!);
    }
    return mixed;
  }, [imageCache.templates, videoCache.templates]);
  const videoTemplates = useMemo(() => randomlyMixVideoInspirationTemplates({
    primary: aiVideoCache.templates,
    additions: videoCache.templates,
    limit: 12
  }).map((item) => ({ ...item, output_type: "video" })), [aiVideoCache.templates, videoCache.templates]);
  const templates = filter === "image" ? imageCache.templates : filter === "video" ? videoTemplates : mixedTemplates;
  const relevantCaches = filter === "image" ? [imageCache] : filter === "video" ? [aiVideoCache, videoCache] : [imageCache, videoCache];
  const isLoading = relevantCaches.some((cache) => cache.isLoading);
  const failed = relevantCaches.some((cache) => cache.status === "failed");

  return (
    <section className={homeStyles.inspiration} aria-labelledby="workspace-inspiration-title">
      <h2 id="workspace-inspiration-title">Made for your next idea</h2>
      <div className={homeStyles.filters} role="group" aria-label="Inspiration type">
        {([{ id: "all", label: "For you" }, { id: "image", label: "Images" }, { id: "video", label: "Videos" }] as const).map((item) => (
          <button type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} key={item.id}>{item.label}</button>
        ))}
      </div>
      <div className={homeStyles.gallery} aria-busy={isLoading}>
        {templates.map((template) => {
          const isVideo = template.output_type === "video";
          return (
            <article className={homeStyles.inspirationCard} key={template.id}>
              <button type="button" className={homeStyles.inspirationMedia} aria-label={`Preview ${template.title}`} onClick={() => setPreview(template)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getTemplateImageUrl(template)} alt={template.title} loading="lazy" decoding="async" />
                {isVideo ? <span className={homeStyles.playBadge}><Play size={15} fill="currentColor" aria-hidden /></span> : null}
              </button>
              <button className={homeStyles.inspirationTitle} type="button" onClick={() => setPreview(template)}>{template.title}</button>
              <span className={homeStyles.mediaType}>{isVideo ? <Film size={13} aria-hidden /> : <ImageIcon size={13} aria-hidden />}{isVideo ? "Video" : "Image"}</span>
            </article>
          );
        })}
        {isLoading && !templates.length ? Array.from({ length: 4 }, (_, index) => <div className={homeStyles.skeleton} key={index} aria-hidden />) : null}
      </div>
      {!isLoading && !templates.length ? <p className={homeStyles.empty} role="status">{failed ? "Couldn’t load inspiration. You can still start with your own idea above." : "More inspiration is on the way. Start with your own idea above."}</p> : null}
      {failed && templates.length > 0 ? <p className={homeStyles.empty} role="status">Some inspiration couldn’t be loaded.</p> : null}
      {preview ? <InspirationPreview
        key={preview.id}
        title={preview.title || "Inspiration"}
        imageUrl={preview.output_type === "video" ? getTemplateImageUrl(preview) : preview.background_image_url}
        videoUrl={preview.output_type === "video" ? preview.background_image_url : undefined}
        prompt={preview.starter_prompt?.trim() || preview.example_prompt?.trim() || ""}
        onTry={onChoosePrompt}
        onClose={() => setPreview(null)}
      /> : null}
    </section>
  );
}

export function AppCreate() {
  const uiLocale = useUiLocale();
  return localizeUiTree((
    <div className={styles.pageView}>
      <PageHeading
        eyebrow="Create"
        title="Choose a ready workflow"
        description="Start from an image, flyer, album cover, or product ad workflow. Each card carries a preset into the composer."
      />
      <div className={styles.toolGrid}>
        {appTools.map((tool) => (
          <ToolCard tool={tool} key={tool.slug} />
        ))}
      </div>
    </div>
  ), uiLocale);
}

export function AppTool({ slug, variant = "default" }: { slug: string; variant?: "default" | "image-to-video" }) {
  const uiLocale = useUiLocale();
  const [inspirationPrompt, setInspirationPrompt] = useState<{ text: string }>();
  const searchParams = useSearchParams();
  const tool = findAppTool(slug);
  if (!tool) return null;
  const isImageToVideo = tool.slug === "ai-video-generator" && variant === "image-to-video";
  const submissionSlug = isImageToVideo ? "ai-image-to-video" : tool.slug;
  const initialPrompt = searchParams.get("prompt")?.trim().slice(0, SOCIALMEDIA_COMPOSER_MAX_CHARS) ?? "";
  const heroKicker = tool.slug === "hotel-lobby-ai"
    ? "Turn your photos into a Hotel Lobby AI rap video."
    : tool.slug === "spotify-canvas-generator"
    ? "Create a 5-second video that Spotify plays on repeat"
    : tool.slug === "promo-video-maker"
      ? "Turn products and ideas into campaign-ready motion"
    : tool.slug === "ai-video-generator"
      ? "Bring your ideas to motion"
    : tool.slug === "ai-animation-generator"
      ? "Bring characters, art, and stories to motion"
    : tool.slug === "ai-album-cover-generator"
      ? "Describe the vibe. Create the cover."
      : "Ready in about a minute";
  const composerOptions = tool.slug === "hotel-lobby-ai"
    ? hotelLobbyComposerOptions.map(option => option.id === "hotel-lobby-cast" ? { ...option, defaultValue: ["solo", "pets"].includes(searchParams.get("cast") ?? "") ? searchParams.get("cast")! : "duet" } : option)
    : tool.slug === "spotify-canvas-generator"
    ? spotifyCanvasComposerOptions
    : isMiniMaxH3VideoFlowSourceUseCase(tool.slug)
      ? promoVideoComposerOptions
      : undefined;
  const usesToolbarUpload = tool.slug !== "ai-clothes-changer";

  return localizeUiTree((
    <div className={styles.homeView}>
      <HeroBackdrop images={tool.heroImages} />
      <section className={`${styles.heroPanel} ${isImageToVideo ? styles.imageToVideoHero : ""}`}>
        {isImageToVideo ? (
          <>
            <h1><span className={styles.heroTitleLine} data-i18n-skip>AI Image to Video</span></h1>
            <p className={`${styles.heroKickerLine} ${styles.imageToVideoKicker}`}>Bring a still image to life</p>
          </>
        ) : (
          <h1>
            <span className={styles.heroTitleLine}>{tool.workbenchTitle}</span>
            <span className={styles.heroKickerLine}>{heroKicker}</span>
          </h1>
        )}
        {isImageToVideo ? <p className={styles.imageToVideoIntro}>Upload a photo, describe how it should move, and turn it into a short AI video.</p> : null}
        {tool.slug === "hotel-lobby-ai" ? <p className={styles.imageToVideoIntro}>Choose Solo, Duet, or Pet duet below. Upload one photo per performer: first on the left, second on the right. Your description is optional.</p> : null}
        <AppComposer
          options={composerOptions}
          className={usesToolbarUpload ? `${styles.composer} ${styles.workbenchToolbarComposer}` : undefined}
          initialPrompt={initialPrompt}
          inspirationPrompt={inspirationPrompt}
          submitPathSlug={submissionSlug}
          sourceUseCase={submissionSlug}
          placeholder={isImageToVideo ? "Describe the movement, camera motion, and mood you want from your image..." : undefined}
          requireSourceImage={isImageToVideo}
          uploadButtonClassName={usesToolbarUpload ? styles.workbenchUploadButton : undefined}
          uploadInToolbar={usesToolbarUpload}
        />
      </section>
      {tool.slug === "hotel-lobby-ai" ? <section className={styles.hotelLobbyGuide} aria-label="Hotel Lobby preset">
        <div className={styles.hotelLobbyGuideImage}><Image src="/assets/hotel-lobby-ai/pets_thumb.webp" alt="Original concept: two cats sharing a microphone in an orange studio" width={480} height={320} /><span>Scene concept</span></div>
        <div><h2>One stage. Endless duets.</h2>
        <p>Friends, characters, or pets — bring your cast to the orange studio. Start with a clear photo of each performer.</p>
        <p className={styles.hotelLobbyFacts}>5–15 seconds · Vertical by default · MP4 download</p>
        <details><summary>View the preset direction</summary><p>Soft frontal light, one hanging microphone, a steady camera, and small natural gestures. The left performer leads before the right takes over. Preserve each subject throughout. Original instrumental hip-hop audio; no added captions or logos. Your description can change the preset.</p></details>
        <small>Generated motion and audio vary. The original song and exact choreography are not included.</small></div>
      </section> : null}
      <RecentsSection />
      {tool.slug === "spotify-canvas-generator" ? null : <InspirationSection sourceUseCase={tool.slug} onTryPrompt={(text) => setInspirationPrompt({ text })} />}
    </div>
  ), uiLocale);
}

function getVideoInspirationSortRank(template: AppExploreTemplate) {
  const title = template.title.trim().toLowerCase();
  if (title.includes("product ad")) return -1;
  if (title.includes("band performance")) return 1;
  return 0;
}

function sortVideoInspirationTemplates(templates: AppExploreTemplate[]) {
  return templates
    .map((template, index) => ({ template, index, rank: getVideoInspirationSortRank(template) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.template);
}

function VideoInspirationMedia({
  template,
  active
}: {
  template: AppExploreTemplate;
  active: boolean;
}) {
  const uiLocale = useUiLocale();
  const [isPlaying, setIsPlaying] = useState(false);
  const posterUrl = getTemplateImageUrl(template);

  return localizeUiTree((
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`${styles.videoInspirationPoster} ${isPlaying ? styles.videoInspirationPosterHidden : ""}`}
        src={posterUrl}
        alt=""
        decoding="async"
        aria-hidden="true"
        onError={(event) => {
          event.currentTarget.hidden = true;
        }}
      />
      <video
        className={`${styles.videoInspirationVideo} ${isPlaying ? styles.videoInspirationVideoPlaying : ""}`}
        src={active ? template.background_image_url : undefined}
        poster={posterUrl}
        autoPlay={active}
        muted
        loop
        playsInline
        preload={active ? "metadata" : "none"}
        aria-hidden="true"
        onPlaying={(event) => {
          const video = event.currentTarget;
          if (typeof video.requestVideoFrameCallback === "function") {
            video.requestVideoFrameCallback(() => {
              if (!video.paused && !video.ended) setIsPlaying(true);
            });
            return;
          }
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsPlaying(false)}
        onStalled={() => setIsPlaying(false)}
        onEmptied={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
    </>
  ), uiLocale);
}

function InspirationSection({
  title = "Inspiration",
  compact = false,
  sourceUseCase,
  onTryPrompt
}: {
  title?: string;
  compact?: boolean;
  sourceUseCase?: string;
  onTryPrompt: (prompt: string) => void;
}) {
  const uiLocale = useUiLocale();
  const isAnimationInspiration = sourceUseCase === "ai-animation-generator";
  const isHotelLobbyInspiration = sourceUseCase === "hotel-lobby-ai";
  const isVideoInspiration = sourceUseCase === "ai-video-generator"
    || isAnimationInspiration
    || sourceUseCase === "hotel-lobby-ai"
    || sourceUseCase === "promo-video-maker";
  const mixesPromoVideoInspiration = sourceUseCase === "ai-video-generator";
  const inspirationLimit = sourceUseCase === "ai-brochure-generator" ? 20 : 12;
  const primaryTemplateCache = useTemplateCache({
    sourceUseCase,
    category: isVideoInspiration ? "inspired" : "popular",
    limit: inspirationLimit
  });
  const promoVideoTemplateCache = useTemplateCache({
    sourceUseCase: "promo-video-maker",
    category: "inspired",
    limit: inspirationLimit,
    enabled: mixesPromoVideoInspiration
  });
  const [preview, setPreview] = useState<AppExploreTemplate | null>(null);
  const [videoPreview, setVideoPreview] = useState<AppVideoPreviewState | null>(null);
  const [activeVideoTemplateId, setActiveVideoTemplateId] = useState<string | null>(null);
  const visibleTemplates = useMemo(
    () => mixesPromoVideoInspiration
      ? randomlyMixVideoInspirationTemplates({
          primary: primaryTemplateCache.templates,
          additions: promoVideoTemplateCache.templates,
          limit: inspirationLimit
        })
      : isVideoInspiration
        ? isAnimationInspiration
          ? orderAnimationInspirationTemplates(primaryTemplateCache.templates)
          : sortVideoInspirationTemplates(primaryTemplateCache.templates)
        : primaryTemplateCache.templates,
    [
      inspirationLimit,
      isAnimationInspiration,
      isVideoInspiration,
      mixesPromoVideoInspiration,
      primaryTemplateCache.templates,
      promoVideoTemplateCache.templates
    ]
  );
  const isLoading = primaryTemplateCache.isLoading
    || (mixesPromoVideoInspiration && promoVideoTemplateCache.isLoading);
  const failedToLoad = primaryTemplateCache.status === "failed"
    && (!mixesPromoVideoInspiration || promoVideoTemplateCache.status === "failed");
  const videoPreviewItems = useMemo<AppVideoPreviewItem[]>(() => (
    visibleTemplates
      .filter((item) => item.background_image_url)
      .map((item) => ({
        url: item.background_image_url,
        title: item.title || "Video inspiration",
        posterUrl: getTemplateImageUrl(item),
        prompt: isAnimationInspiration || isHotelLobbyInspiration
          ? item.example_prompt?.trim() || item.starter_prompt?.trim()
          : undefined,
        tryHref: isAnimationInspiration && item.starter_prompt?.trim()
          ? `/app/ai-animation-generator?prompt=${encodeURIComponent(item.starter_prompt.trim())}`
          : undefined
      }))
  ), [isAnimationInspiration, isHotelLobbyInspiration, visibleTemplates]);
  const sectionTitle = isAnimationInspiration && title === "Inspiration"
    ? "Animation inspiration"
    : isVideoInspiration && title === "Inspiration"
      ? "Inspired"
      : title;

  return localizeUiTree((
    <section className={styles.inspirationSection}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionHeadingCopy}>
          <h2>{sectionTitle}</h2>
          {isAnimationInspiration ? (
            <p>Explore anime action, character motion, cinematic worlds, and camera-driven ideas.</p>
          ) : null}
        </div>
        <Link prefetch={false} href={isAnimationInspiration ? "/app/explore?source=ai-animation-generator" : "/app/explore"}>Explore</Link>
      </div>
      {isLoading ? (
        <div className={`${styles.inspirationGrid} ${compact ? styles.inspirationGridCompact : ""}`} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className={`${styles.inspirationCard} ${styles.inspirationSkeletonCard}`} key={index} />
          ))}
        </div>
      ) : visibleTemplates.length ? (
        <div className={`${styles.inspirationGrid} ${compact ? styles.inspirationGridCompact : ""}`}>
          {visibleTemplates.map((item) => {
            if (isVideoInspiration) {
              return (
                <button
                  className={`${styles.inspirationCard} ${styles.videoInspirationCard}`}
                  type="button"
                  key={item.id}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setActiveVideoTemplateId(item.id);
                  }}
                  onPointerLeave={() => setActiveVideoTemplateId((current) => current === item.id ? null : current)}
                  onClick={() => {
                    const videoIndex = videoPreviewItems.findIndex((previewItem) => previewItem.url === item.background_image_url);
                    const nextPreview = {
                      items: videoPreviewItems,
                      index: Math.max(0, videoIndex),
                      autoFullscreen: !isHotelLobbyInspiration && shouldOpenVideoPreviewFullscreen()
                    };
                    if (nextPreview.autoFullscreen) {
                      flushSync(() => setVideoPreview(nextPreview));
                      requestAppVideoFullscreen(document.querySelector<HTMLVideoElement>(`.${styles.appVideoPreviewStage} video`));
                      return;
                    }
                    setVideoPreview(nextPreview);
                  }}
                  aria-label={`Play ${item.title}`}
                >
                  <VideoInspirationMedia
                    key={`${item.id}:${activeVideoTemplateId === item.id}`}
                    template={item}
                    active={activeVideoTemplateId === item.id}
                  />
                  {isAnimationInspiration ? (
                    <span className={styles.animationInspirationCopy}>
                      <strong data-i18n-skip>{item.title}</strong>
                      <small data-i18n-skip>{item.example_prompt?.trim() || item.starter_prompt.trim()}</small>
                    </span>
                  ) : <span data-i18n-skip>{item.title}</span>}
                </button>
              );
            }
            return (
              <button
                className={styles.inspirationCard}
                type="button"
                key={item.id}
                onClick={() => setPreview(item)}
                aria-label={`Preview ${item.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTemplateImageUrl(item)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = item.background_image_url;
                  }}
                />
                <span data-i18n-skip>{item.title}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.listEmpty}>{failedToLoad ? "Failed to load prompt examples." : "No prompt examples yet."}</div>
      )}
      {preview && !isVideoInspiration ? (
        <InspirationPreview
          data-i18n-preserve="title"
          key={preview.id}
          title={preview.title || "Inspiration"}
          imageUrl={preview.background_image_url || getTemplateImageUrl(preview)}
          prompt={preview.starter_prompt || preview.example_prompt || ""}
          onTry={(prompt) => {
            onTryPrompt(prompt);
            try {
              captureAnalyticsEvent("inspiration_try_now_clicked", {
                source_use_case: sourceUseCase || "ai-image-maker",
                surface: sourceUseCase ? "workbench_inspiration" : "home_inspiration",
                template_id: preview.id,
                template_slug: preview.slug,
                template_title: preview.title,
                template_use_case: preview.use_case_slug,
                action: "prefill_prompt"
              });
            } catch {
              // Analytics must not interrupt filling the composer or closing the preview.
            }
          }}
          onClose={() => setPreview(null)}
        />
      ) : null}
      {videoPreview ? (
        <AppVideoPreviewOverlay
          preview={videoPreview}
          onTryPrompt={isHotelLobbyInspiration ? (prompt) => {
            onTryPrompt(prompt);
            setVideoPreview(null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } : undefined}
          onClose={() => setVideoPreview(null)}
        />
      ) : null}
    </section>
  ), uiLocale);
}

function ToolCard({ tool }: { tool: AppToolCard }) {
  const uiLocale = useUiLocale();
  const Icon = tool.icon;
  return localizeUiTree((
    <Link prefetch={false} className={`${styles.toolCard} ${styles[`accent_${tool.accent}`]}`} href={tool.href}>
      <div className={styles.toolCardMedia}>
        <Image src={tool.imageSrc} fill sizes="(max-width: 900px) 90vw, 280px" alt="" />
      </div>
      <div className={styles.toolCardCopy}>
        <span><Icon size={17} aria-hidden /> {tool.eyebrow}</span>
        <strong>{tool.title}</strong>
        <p>{tool.description}</p>
      </div>
    </Link>
  ), uiLocale);
}
