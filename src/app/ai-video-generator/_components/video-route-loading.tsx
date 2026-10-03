"use client";

import { localizeUiTree, useUiLocale } from "@/lib/i18n/ui-locale";

import Image from "next/image";
import Link from "next/link";
import { PanelsTopLeft, Sparkles } from "lucide-react";
import OriginalThinkingLoader from "@/components/original-thinking-loader";
import socialStyles from "../../socialmedia/socialmedia.module.css";
import styles from "./video-generator.module.css";

type VideoRouteLoadingProps = {
  active: "create" | "boards" | "thread";
};

export default function VideoRouteLoading({ active }: VideoRouteLoadingProps) {
  const uiLocale = useUiLocale();
  const isBoards = active === "boards";
  const isThread = active === "thread";

  return localizeUiTree((
    <main className={`${isBoards ? styles.videoBoardsShell : styles.shell} ${isThread ? socialStyles.threadShell : ""}`}>
      {!isBoards && !isThread ? (
        <div className={styles.heroBackground} aria-hidden="true">
          <Image src="/assets/socialmedia/hero.avif" alt="" fill priority sizes="100vw" unoptimized />
        </div>
      ) : null}
      <aside className={socialStyles.sidebar} aria-label="Video navigation">
        <Link className={socialStyles.brand} href="/home" aria-label="Vismuse Home" prefetch>
          <Image src="/assets/socialmedia/logo.png" alt="" width={34} height={34} priority />
          <span>VISMUSE</span>
        </Link>
        <nav className={socialStyles.navList}>
          <Link className={!isBoards ? socialStyles.navActive : undefined} href="/ai-video-generator" prefetch>
            <Sparkles size={18} aria-hidden="true" />
            <span>Create</span>
          </Link>
          <Link className={isBoards ? socialStyles.navActive : undefined} href="/boards/video" prefetch>
            <PanelsTopLeft size={18} aria-hidden="true" />
            <span>Boards</span>
          </Link>
        </nav>
      </aside>

      {isBoards ? (
        <div className={styles.videoBoardsContent}>
          <section className={socialStyles.boardsView} aria-label="Loading video boards">
            <header className={socialStyles.boardsHeader}>
              <div>
                <h1>Video Boards</h1>
                <p>Loading your generated video results.</p>
              </div>
            </header>
            <div className={`${socialStyles.boardsGrid} ${styles.videoBoardsGrid}`} aria-hidden="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className={socialStyles.boardSkeletonCard} key={index} />
              ))}
            </div>
          </section>
        </div>
      ) : isThread ? (
        <div className={styles.main}>
          <div className={socialStyles.sessionSwitchToast} role="status" aria-live="polite">
            <span className={socialStyles.sessionSwitchSpinner} aria-hidden="true" />
            <span>Loading conversation...</span>
          </div>
          <div className={`${socialStyles.content} ${socialStyles.threadContent}`}>
            <section className={socialStyles.threadView} aria-label="Loading AI video conversation">
              <div className={socialStyles.threadMessages}>
                <article className={`${socialStyles.threadTurn} ${socialStyles.threadAssistantTurn}`}>
                  <div className={socialStyles.threadBubble}>
                    <p>Received your video request. I am getting things ready...</p>
                  </div>
                  <div className={socialStyles.threadImageResult}>
                    <div className={socialStyles.imageGenerationProgressCard} role="status" aria-live="polite">
                      <div className={socialStyles.imageGenerationProgressPreview}>
                        <div className={socialStyles.imageGenerationLogoLoader} aria-hidden="true">
                          <OriginalThinkingLoader size={112} />
                        </div>
                      </div>
                      <div className={socialStyles.imageGenerationProgressBody}>
                        <div className={socialStyles.imageGenerationProgressMeta}>
                          <span>Prompt understood</span>
                          <span className={socialStyles.imageGenerationProgressPill}>Text to video</span>
                        </div>
                        <div className={socialStyles.imageGenerationProgressTitleRow}>
                          <h3>Generating your video</h3>
                          <strong>5%</strong>
                        </div>
                        <div className={socialStyles.imageGenerationProgressTrack} aria-hidden="true">
                          <span style={{ width: "28%" }} />
                        </div>
                        <div className={socialStyles.imageGenerationStageRow}>
                          <div className={`${socialStyles.imageGenerationStage} ${socialStyles.imageGenerationStageCurrent}`}>
                            <span className={socialStyles.imageGenerationStageNode} />
                            <span>Prompt</span>
                          </div>
                          <div className={`${socialStyles.imageGenerationStage} ${socialStyles.imageGenerationStageNext}`}>
                            <span className={socialStyles.imageGenerationStageNode} />
                            <span>Generate</span>
                          </div>
                          <div className={`${socialStyles.imageGenerationStage} ${socialStyles.imageGenerationStageNext}`}>
                            <span className={socialStyles.imageGenerationStageNode} />
                            <span>Save</span>
                          </div>
                          <div className={`${socialStyles.imageGenerationStage} ${socialStyles.imageGenerationStageNext}`}>
                            <span className={socialStyles.imageGenerationStageNode} />
                            <span>Done</span>
                          </div>
                        </div>
                        <p>Creating a short AI video from your prompt...</p>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className={styles.main}>
          <section className={styles.hero} aria-label="Loading AI video generator">
            <h1 className={styles.heroTitle}>AI <span>Video</span> Generator</h1>
            <div className={styles.promptComposer} aria-hidden="true">
              <div className={styles.promptBar} />
            </div>
          </section>
          <section className={styles.recentGrid} aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className={`${styles.recentCard} ${styles.recentSkeletonCard}`} key={index} />
            ))}
          </section>
        </div>
      )}
    </main>
  ), uiLocale);
}
