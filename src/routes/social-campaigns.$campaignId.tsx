import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import {
  getSocialCampaignFn,
  generateSocialPostsFn,
  updateSocialPostFn,
  updateSocialCampaignFn,
  scheduleCampaignPostsFn,
  generateSocialImageFn,
} from "@/lib/api/social-campaigns.functions";
import {
  ALL_VARIANTS,
  TEMPLATE_META,
  type TemplateVariant,
  type TemplateData,
  CarouselSlideTemplate,
  ScaledPreview,
  renderTemplate,
  downloadTemplateAsImage,
} from "@/components/social/SocialTemplates";
import { TopNav } from "@/components/talent/TopNav";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Sparkles,
  Check,
  CalendarDays,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/social-campaigns/$campaignId")({
  head: () => ({
    meta: [{ title: "Campaign · Social Campaigns · Talent Radar" }],
  }),
  component: SocialCampaignDetail,
});

// ── Types (light, inferred from DB) ──────────────────────────────────────────

type Post = {
  id: string;
  platform: "linkedin" | "instagram" | "twitter" | "reddit";
  content: string;
  content_variant: Record<string, unknown> | null;
  status: "draft" | "approved" | "posted";
  scheduled_date: string | null;
  subreddit: string | null;
};

// ── Platform metadata ─────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  linkedin:  { label: "LinkedIn",    color: "text-[#0A66C2]", bg: "bg-[#0A66C2]" },
  instagram: { label: "Instagram",   color: "text-pink-400",  bg: "bg-pink-500" },
  twitter:   { label: "Twitter / X", color: "text-sky-400",   bg: "bg-sky-500" },
  reddit:    { label: "Reddit",      color: "text-orange-400", bg: "bg-orange-500" },
};

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground border-border",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  posted:   "bg-green-500/10 text-green-400 border-green-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  draft:    "Draft",
  approved: "Approved",
  posted:   "Posted",
};

const CAMPAIGN_STATUS_OPTS = ["draft", "active", "completed", "archived"] as const;

const CAMPAIGN_STATUS_STYLES: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground border-border",
  active:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  archived:  "bg-muted/40 text-muted-foreground border-border",
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide",
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── LinkedIn post card ────────────────────────────────────────────────────────

function LinkedInCard({
  post,
  onSave,
  onStatusChange,
  roleTitle = "",
}: {
  post: Post;
  onSave: (id: string, content: string, variant: Record<string, unknown> | null) => void;
  onStatusChange: (id: string, status: "draft" | "approved" | "posted") => void;
  roleTitle?: string;
}) {
  const [content, setContent] = useState(post.content);
  const variant = post.content_variant ?? {};
  const initialSlides = (variant.carousel_slides as Array<{ headline: string; body: string }>) ?? [];
  const [slides, setSlides] = useState(initialSlides);
  const [slideIdx, setSlideIdx] = useState(0);

  const contentDirty = content !== post.content;
  const slidesDirty = JSON.stringify(slides) !== JSON.stringify(initialSlides);
  const dirty = contentDirty || slidesDirty;

  const updateSlide = (field: "headline" | "body", val: string) => {
    setSlides((prev) => prev.map((s, i) => (i === slideIdx ? { ...s, [field]: val } : s)));
  };

  const currentSlide = slides[slideIdx];
  const slideDownloadRef = useRef<HTMLDivElement>(null);
  const allSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleCarouselPdf = useCallback(async () => {
    if (slides.length === 0) return;
    setGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      await document.fonts.ready;
      const pdf = new jsPDF({ unit: "px", format: [1080, 1080] });
      for (let i = 0; i < slides.length; i++) {
        const el = allSlideRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, {
          useCORS: true, allowTaint: false, scale: 1,
          width: 1080, height: 1080, backgroundColor: "#1A1A1A", logging: false,
        });
        if (i > 0) pdf.addPage([1080, 1080]);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 1080, 1080);
      }
      const slug = roleTitle.toLowerCase().replace(/\s+/g, "-") || "role";
      pdf.save(`${slug}-carousel.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGeneratingPdf(false);
    }
  }, [slides, roleTitle]);

  const handleSlideDownload = useCallback(async () => {
    if (!slideDownloadRef.current || !currentSlide) return;
    const slug = roleTitle.toLowerCase().replace(/\s+/g, "-") || "role";
    await downloadTemplateAsImage(
      slideDownloadRef.current,
      `flytbase-${slug}-slide-${slideIdx + 1}.png`,
    );
  }, [currentSlide, slideIdx, roleTitle]);

  return (
    <div className="space-y-4">
      {/* Post text */}
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">
          Post Text
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60"
        />
        <p className={cn(
          "mt-1 text-right text-[10px] font-mono",
          content.length > 1000 ? "text-red-400" : content.length < 600 ? "text-amber-500" : "text-muted-foreground",
        )}>
          {content.length} / 1000 chars
          {content.length > 1000 && " — over limit"}
        </p>
      </div>

      {/* Carousel */}
      {slides.length > 0 && (
        <div className="border border-border rounded-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Carousel · Slide {slideIdx + 1} of {slides.length}
            </label>
            <div className="flex items-center gap-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIdx(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === slideIdx ? "w-4 bg-[#D95B28]" : "w-1.5 bg-border hover:bg-muted-foreground",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Branded slide preview */}
          {currentSlide && (
            <>
            <div className="flex items-start gap-4">
              {/* Scaled preview */}
              <div className="relative flex-shrink-0">
                <ScaledPreview size={280}>
                  <CarouselSlideTemplate
                    headline={currentSlide.headline || "Slide headline"}
                    body={currentSlide.body || ""}
                    slideNumber={slideIdx + 1}
                    totalSlides={slides.length}
                    roleTitle={roleTitle}
                  />
                </ScaledPreview>
                {/* Prev / Next overlays */}
                <button
                  onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                  disabled={slideIdx === 0}
                  className="absolute left-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card/90 hover:bg-muted disabled:opacity-30 backdrop-blur-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                  disabled={slideIdx === slides.length - 1}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card/90 hover:bg-muted disabled:opacity-30 backdrop-blur-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              {/* Download controls */}
              <div className="flex flex-col gap-2 pt-1">
                <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                  Slide {slideIdx + 1} of {slides.length}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs border-[#D95B28]/40 text-[#D95B28] hover:bg-[#D95B28]/5"
                  onClick={handleSlideDownload}
                >
                  <Image className="h-3 w-3" />
                  Download slide
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleCarouselPdf}
                  disabled={generatingPdf}
                >
                  {generatingPdf
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Image className="h-3 w-3" />
                  }
                  {generatingPdf ? "Building PDF…" : "Download all as PDF"}
                </Button>
              </div>
            </div>

            {/* Hidden all-slides container for PDF generation */}
            <div aria-hidden style={{ position: "fixed", left: -1100, top: 0, zIndex: -1 }}>
              {slides.map((slide, i) => (
                <div key={i} ref={(el) => { allSlideRefs.current[i] = el; }} style={{ width: 1080, height: 1080 }}>
                  <CarouselSlideTemplate
                    headline={slide.headline || "Slide headline"}
                    body={slide.body || ""}
                    slideNumber={i + 1}
                    totalSlides={slides.length}
                    roleTitle={roleTitle}
                  />
                </div>
              ))}
            </div>
            </>
          )}

          {/* Hidden full-size slide for download */}
          {currentSlide && (
            <div
              ref={slideDownloadRef}
              aria-hidden
              style={{ position: "fixed", left: -1100, top: 0, zIndex: -1, width: 1080, height: 1080 }}
            >
              <CarouselSlideTemplate
                headline={currentSlide.headline || "Slide headline"}
                body={currentSlide.body || ""}
                slideNumber={slideIdx + 1}
                totalSlides={slides.length}
                roleTitle={roleTitle}
              />
            </div>
          )}

          {/* Edit fields */}
          {currentSlide && (
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wide">
                  Headline
                </label>
                <input
                  value={currentSlide.headline}
                  onChange={(e) => updateSlide("headline", e.target.value)}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60"
                  placeholder="Slide headline (max 8 words)"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wide">
                  Body
                </label>
                <textarea
                  value={currentSlide.body}
                  onChange={(e) => updateSlide("body", e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60"
                  placeholder="1–2 sentences"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <PostActions
        post={post}
        dirty={dirty}
        onSave={() => onSave(post.id, content, { ...variant, carousel_slides: slides })}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

// ── Instagram post card ───────────────────────────────────────────────────────

function InstagramCard({
  post,
  onSave,
  onStatusChange,
}: {
  post: Post;
  onSave: (id: string, content: string, variant: Record<string, unknown> | null) => void;
  onStatusChange: (id: string, status: "draft" | "approved" | "posted") => void;
}) {
  const [content, setContent] = useState(post.content);
  const variant = post.content_variant ?? {};
  const hashtags = (variant.hashtags as string[]) ?? [];
  const dirty = content !== post.content;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">
          Caption
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60"
        />
        <p className={cn(
          "mt-1 text-right text-[10px] font-mono",
          content.length > 220 ? "text-red-400" : content.length < 150 ? "text-amber-500" : "text-muted-foreground",
        )}>
          {content.length} / 220 chars
          {content.length > 220 && " — over limit"}
        </p>
      </div>

      {hashtags.length > 0 && (
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-2">
            Hashtags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag, i) => (
              <span
                key={i}
                className="rounded-sm bg-pink-500/10 px-2 py-0.5 text-[11px] font-mono text-pink-400"
              >
                #{tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        </div>
      )}

      <PostActions
        post={post}
        dirty={dirty}
        onSave={() => onSave(post.id, content, post.content_variant)}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

// ── Twitter / X post card ─────────────────────────────────────────────────────

function TwitterCard({
  post,
  onSave,
  onStatusChange,
}: {
  post: Post;
  onSave: (id: string, content: string, variant: Record<string, unknown> | null) => void;
  onStatusChange: (id: string, status: "draft" | "approved" | "posted") => void;
}) {
  const variant = post.content_variant ?? {};
  const initial: string[] = (variant.tweets as string[]) ?? post.content.split("\n\n---\n\n");
  const [tweets, setTweets] = useState<string[]>(initial);

  const updateTweet = (i: number, val: string) => {
    setTweets((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  };

  const builtContent = tweets.join("\n\n---\n\n");
  const dirty = builtContent !== post.content;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {tweets.map((tweet, i) => (
          <div key={i}>
            <label className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">
              Tweet {i + 1} {i === 0 ? "— Hook" : i === tweets.length - 1 ? "— CTA" : ""}
            </label>
            <div className="relative">
              <textarea
                value={tweet}
                onChange={(e) => updateTweet(i, e.target.value)}
                rows={3}
                className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60"
              />
              <span
                className={cn(
                  "absolute bottom-2 right-2 text-[10px] font-mono",
                  tweet.length > 270 ? "text-red-400" : "text-muted-foreground",
                )}
              >
                {tweet.length} / 280
              </span>
            </div>
          </div>
        ))}
      </div>

      <PostActions
        post={post}
        dirty={dirty}
        onSave={() =>
          onSave(post.id, builtContent, { ...variant, tweets })
        }
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

// ── Reddit post card ──────────────────────────────────────────────────────────

function RedditCard({
  post,
  onSave,
  onStatusChange,
}: {
  post: Post;
  onSave: (id: string, content: string, variant: Record<string, unknown> | null) => void;
  onStatusChange: (id: string, status: "draft" | "approved" | "posted") => void;
}) {
  const [content, setContent] = useState(post.content);
  const variant = post.content_variant ?? {};
  const subreddits = (variant.subreddits as string[]) ?? [];
  const dirty = content !== post.content;

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-orange-500/20 bg-orange-500/5 px-3 py-2">
        <p className="text-[11px] text-orange-400 font-mono">
          ⚠ Reddit strategy: value-first content only. No outbound links in post body. Mention hiring as a soft closing line only.
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">
          Post Body
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60"
        />
        <p className="mt-1 text-right text-[10px] font-mono text-muted-foreground">
          {content.length} chars
        </p>
      </div>

      {subreddits.length > 0 && (
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-2">
            Suggested Subreddits
          </label>
          <div className="flex flex-wrap gap-1.5">
            {subreddits.map((sub, i) => (
              <span
                key={i}
                className="rounded-sm bg-orange-500/10 px-2 py-0.5 text-[11px] font-mono text-orange-400"
              >
                {sub}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Adapt your post for each subreddit's specific rules and tone before posting.
          </p>
        </div>
      )}

      <PostActions
        post={post}
        dirty={dirty}
        onSave={() => onSave(post.id, content, post.content_variant)}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

// ── Shared post actions bar ───────────────────────────────────────────────────

function PostActions({
  post,
  dirty,
  onSave,
  onStatusChange,
}: {
  post: Post;
  dirty: boolean;
  onSave: () => void;
  onStatusChange: (id: string, status: "draft" | "approved" | "posted") => void;
}) {
  return (
    <div className="flex items-center justify-between pt-1 border-t border-border">
      <div className="flex items-center gap-2">
        <StatusChip status={post.status} />

        {post.status === "draft" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onStatusChange(post.id, "approved")}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
        )}
        {post.status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs text-green-400 border-green-500/20 hover:bg-green-500/5"
            onClick={() => onStatusChange(post.id, "posted")}
          >
            <ExternalLink className="h-3 w-3" />
            Mark as Posted
          </Button>
        )}
        {post.status === "posted" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => onStatusChange(post.id, "draft")}
          >
            Reset to Draft
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {dirty && (
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs bg-[#D95B28] hover:bg-[#EC7D42] text-white border-0"
            onClick={onSave}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Image template preview panel ──────────────────────────────────────────────

type MediaItem = { id: string; file_name: string; signed_url: string | null };

function ImagePreviewPanel({
  roleTitle,
  hook,
  responsibilities,
  platform,
  campaignId,
  campaignName,
  mediaItems,
}: {
  roleTitle: string;
  hook: string;
  responsibilities?: string[];
  platform: "linkedin" | "instagram" | "twitter" | "reddit";
  campaignId: string;
  campaignName?: string;
  mediaItems?: MediaItem[];
}) {
  const [selected, setSelected] = useState<TemplateVariant>("dark-feature");
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedAiImage, setSelectedAiImage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiGenState, setAiGenState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const [imageInstructions, setImageInstructions] = useState("");
  const downloadRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const imageMedia = (mediaItems ?? []).filter((m) => !!m.signed_url);

  const selectedMediaUrl =
    selectedAiImage !== null
      ? selectedAiImage
      : selectedMediaId !== null
        ? (imageMedia.find((m) => m.id === selectedMediaId)?.signed_url ?? undefined)
        : undefined;

  const templateData: TemplateData = {
    roleTitle,
    hook,
    responsibilities,
    platform,
    campaignName,
    mediaUrl: selectedMediaUrl,
  };

  const handleDownload = useCallback(async () => {
    if (!downloadRef.current) return;
    setDownloading(true);
    try {
      const slug = roleTitle.toLowerCase().replace(/\s+/g, "-") || "role";
      await downloadTemplateAsImage(downloadRef.current, `flytbase-${slug}-${selected}.png`);
    } finally {
      setDownloading(false);
    }
  }, [roleTitle, selected, selectedMediaUrl]);

  const handleAiGenerate = useCallback(async () => {
    setAiGenState("loading");
    setAiGenError(null);
    try {
      const result = await generateSocialImageFn({
        data: { campaignId, platform, prompt: undefined, imageInstructions: imageInstructions || undefined },
      });
      setSelectedAiImage(result.signed_url);
      setAiGenState("done");
      // Refresh the campaign query so the new media item appears in Campaign Media
      qc.invalidateQueries({ queryKey: ["social_campaign"] });
    } catch (err) {
      setAiGenState("error");
      setAiGenError(err instanceof Error ? err.message : String(err));
    }
  }, [campaignId, platform, imageInstructions, qc]);

  return (
    <div className="mt-6 border border-dotted border-border rounded-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="h-3.5 w-3.5 text-[#D95B28]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Image Templates
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={handleAiGenerate}
            disabled={aiGenState === "loading"}
          >
            {aiGenState === "loading" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {aiGenState === "loading"
              ? "Generating..."
              : aiGenState === "done"
                ? "Regenerate AI"
                : "Generate AI Image"}
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs bg-[#D95B28] hover:bg-[#EC7D42] text-white border-0"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image className="h-3 w-3" />}
            Download PNG
          </Button>
        </div>
      </div>

      {/* AI generation errors */}
        {aiGenState === "error" && aiGenError && (
          <p className="text-xs text-red-400">
            AI image failed: {aiGenError}. You can still use the templates below.
          </p>
        )}
        {aiGenState === "done" && !selectedAiImage && (
          <p className="text-xs text-amber-500">
            AI image generated but could not load — template preview is still available.
          </p>
        )}

        {/* Custom image instructions */}
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1">
            Image instructions (optional)
          </label>
          <textarea
            value={imageInstructions}
            onChange={(e) => setImageInstructions(e.target.value)}
            rows={3}
            placeholder="e.g. no text in the image, drone silhouette, sunset orange background..."
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D95B28]/60 resize-y"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            These instructions are sent to the image model along with the role details. Use this to fix repeated issues like unwanted text.
          </p>
        </div>

      {/* Main layout: large preview + template picker */}
      <div className="flex gap-5 items-start">
        {/* Large live preview */}
        <div className="flex-shrink-0">
          <ScaledPreview size={320}>
            {renderTemplate(selected, templateData)}
          </ScaledPreview>
        </div>

        {/* Right column: thumbnail grid + media selector */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Template thumbnails */}
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_VARIANTS.map((variant) => {
              const meta = TEMPLATE_META[variant];
              const isSelected = selected === variant;
              const thumbData: TemplateData = {
                ...templateData,
                // Always show photo if selected for photo-capable variants
                mediaUrl: meta.supportsPhoto ? selectedMediaUrl : undefined,
              };
              return (
                <button
                  key={variant}
                  onClick={() => setSelected(variant)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-1.5 rounded-sm border transition-colors",
                    isSelected
                      ? "border-[#D95B28]/70 bg-[#D95B28]/5"
                      : "border-border hover:border-[#D95B28]/30",
                  )}
                >
                  <ScaledPreview size={120}>
                    {renderTemplate(variant, thumbData)}
                  </ScaledPreview>
                  <span className={cn(
                    "text-[9px] font-mono uppercase tracking-wide leading-none text-center",
                    isSelected ? "text-[#D95B28]" : "text-muted-foreground",
                  )}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Media selector */}
          {imageMedia.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5">
                Use Photo
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedMediaId(null)}
                  className={cn(
                    "h-10 w-10 rounded-sm border text-[9px] font-mono transition-colors",
                    selectedMediaId === null
                      ? "border-[#D95B28] bg-[#D95B28]/5 text-[#D95B28]"
                      : "border-border text-muted-foreground hover:border-[#D95B28]/40",
                  )}
                >
                  None
                </button>
                {imageMedia.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMediaId(m.id)}
                    className={cn(
                      "h-10 w-10 rounded-sm border overflow-hidden transition-colors flex-shrink-0",
                      selectedMediaId === m.id
                        ? "border-[#D95B28] ring-1 ring-[#D95B28]"
                        : "border-border hover:border-[#D95B28]/40",
                    )}
                    title={m.file_name}
                  >
                    <img src={m.signed_url!} alt={m.file_name} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              {selectedMediaId !== null && !TEMPLATE_META[selected].supportsPhoto && (
                <p className="mt-1 text-[9px] font-mono text-amber-500">
                  Switch to Dark Feature or Split Panel to use a photo
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden full-size element captured by html2canvas */}
      <div
        ref={downloadRef}
        aria-hidden
        style={{ position: "fixed", left: -1100, top: 0, zIndex: -1, width: 1080, height: 1080 }}
      >
        {renderTemplate(selected, templateData)}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function SocialCampaignDetail() {
  const { campaignId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [postIdx, setPostIdx] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["social_campaign", campaignId],
    queryFn: () => getSocialCampaignFn({ data: { campaignId } }),
    staleTime: 30_000,
  });

  const campaign = data?.campaign;
  const posts: Post[] = (data?.posts ?? []) as Post[];

  // Derive active tab once data loads
  const resolvedTab =
    activeTab ?? (campaign ? (campaign.platforms as string[])[0] ?? null : null);

  const platformPosts = posts.filter((p) => p.platform === resolvedTab);
  const clampedIdx = Math.min(postIdx, Math.max(0, platformPosts.length - 1));
  const activePost = platformPosts[clampedIdx] ?? null;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const generateMut = useMutation({
    mutationFn: () => generateSocialPostsFn({ data: { campaignId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_campaign", campaignId] });
    },
  });

  const savePostMut = useMutation({
    mutationFn: ({
      postId,
      content,
      variant,
    }: {
      postId: string;
      content: string;
      variant: Record<string, unknown> | null;
    }) =>
      updateSocialPostFn({
        data: {
          postId,
          content,
          content_variant: variant,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_campaign", campaignId] });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({
      postId,
      status,
    }: {
      postId: string;
      status: "draft" | "approved" | "posted";
    }) => updateSocialPostFn({ data: { postId, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_campaign", campaignId] });
    },
  });

  const campaignStatusMut = useMutation({
    mutationFn: (status: "draft" | "active" | "completed" | "archived") =>
      updateSocialCampaignFn({ data: { campaignId, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social_campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["social_campaigns"] });
      setStatusOpen(false);
    },
  });

  const scheduleMut = useMutation({
    mutationFn: () => scheduleCampaignPostsFn({ data: { campaignId } }),
    onSuccess: () => {
      navigate({ to: "/social-campaigns/calendar" });
    },
  });

  const handleSave = useCallback(
    (id: string, content: string, variant: Record<string, unknown> | null) => {
      savePostMut.mutate({ postId: id, content, variant });
    },
    [savePostMut],
  );

  const handleStatusChange = useCallback(
    (id: string, status: "draft" | "approved" | "posted") => {
      statusMut.mutate({ postId: id, status });
    },
    [statusMut],
  );

  // ── Loading / error states ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav hideCompetitions />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav hideCompetitions />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Campaign not found."}
          </p>
          <Link
            to="/social-campaigns"
            className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const platforms = campaign.platforms as string[];
  const hasContent = posts.some((p) => p.content.length > 0);

  const campaignStatusStyle =
    CAMPAIGN_STATUS_STYLES[campaign.status as string] ?? CAMPAIGN_STATUS_STYLES.draft;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav hideCompetitions />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back */}
        <Link
          to="/social-campaigns"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All campaigns
        </Link>

        {/* Campaign header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="h-2 w-2 bg-[#D95B28]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Life at FlytBase · {campaign.role_title}
              </span>
            </div>
            <h1 className="font-serif text-2xl tracking-tight text-foreground">
              {campaign.name}
            </h1>

            {/* Platform chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {platforms.map((p) => {
                const m = PLATFORM_META[p];
                return m ? (
                  <span
                    key={p}
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                      `${m.bg}/10`,
                      m.color,
                    )}
                  >
                    {m.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>

          {/* Campaign status dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setStatusOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wide transition-colors",
                campaignStatusStyle,
              )}
            >
              {campaign.status}
              <ChevronDown className="h-3 w-3" />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] border border-border bg-card rounded-sm shadow-lg py-1">
                {CAMPAIGN_STATUS_OPTS.map((s) => (
                  <button
                    key={s}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#D95B28]/5 font-mono uppercase tracking-wide text-muted-foreground"
                    onClick={() => campaignStatusMut.mutate(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate button */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {hasContent
              ? "Review and edit your generated posts below."
              : "Click Generate to create content for all platforms from the job description."}
          </p>
          <Button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="gap-1.5 bg-[#D95B28] hover:bg-[#EC7D42] text-white border-0"
          >
            {generateMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {hasContent ? "Regenerate All" : "Generate Content"}
          </Button>
        </div>

        {generateMut.isError && (
          <p className="mb-4 text-sm text-destructive">
            {generateMut.error instanceof Error
              ? generateMut.error.message
              : "Generation failed"}
          </p>
        )}

        {/* Platform tabs */}
        {posts.length > 0 && (
          <div>
            {/* Tab bar */}
            <div className="flex border-b border-border mb-6">
              {platforms.map((p) => {
                const m = PLATFORM_META[p];
                const post = posts.find((post) => post.platform === p);
                const pCount = posts.filter((post) => post.platform === p).length;
                const isActive = resolvedTab === p;
                return (
                  <button
                    key={p}
                    onClick={() => { setActiveTab(p); setPostIdx(0); }}
                    className={cn(
                      "relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                      isActive
                        ? "border-[#D95B28] text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m?.label ?? p}
                    {pCount > 1 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {pCount}
                      </span>
                    )}
                    {post && post.status !== "draft" && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          post.status === "approved"
                            ? "bg-blue-400"
                            : "bg-green-400",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active platform content */}
            {activePost && (
              <div className="border border-border rounded-sm bg-card p-5">
                {/* Platform header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        PLATFORM_META[activePost.platform]?.color ?? "",
                      )}
                    >
                      {PLATFORM_META[activePost.platform]?.label ?? activePost.platform}
                    </span>
                    {/* Post type label */}
                    {activePost.content_variant?.post_type && (
                      <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground border border-border px-2 py-0.5 rounded-sm">
                        {String(activePost.content_variant.post_type).replace(/_/g, " ")}
                      </span>
                    )}
                    {/* Post navigation (when multiple posts per platform) */}
                    {platformPosts.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPostIdx((i) => Math.max(0, i - 1))}
                          disabled={clampedIdx === 0}
                          className="flex h-6 w-6 items-center justify-center rounded-sm border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {clampedIdx + 1} / {platformPosts.length}
                        </span>
                        <button
                          onClick={() => setPostIdx((i) => Math.min(platformPosts.length - 1, i + 1))}
                          disabled={clampedIdx === platformPosts.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded-sm border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scheduled date */}
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="date"
                      defaultValue={activePost.scheduled_date ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value || null;
                        updateSocialPostFn({
                          data: {
                            postId: activePost.id,
                            scheduled_date: val,
                          },
                        }).then(() => {
                          qc.invalidateQueries({ queryKey: ["social_campaign", campaignId] });
                        });
                      }}
                      className="text-xs text-muted-foreground bg-transparent border-0 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Platform-specific editor */}
                {activePost.platform === "linkedin" && (
                  <LinkedInCard
                    key={activePost.id}
                    post={activePost}
                    onSave={handleSave}
                    onStatusChange={handleStatusChange}
                    roleTitle={campaign.role_title ?? ""}
                  />
                )}
                {activePost.platform === "instagram" && (
                  <InstagramCard
                    key={activePost.id}
                    post={activePost}
                    onSave={handleSave}
                    onStatusChange={handleStatusChange}
                  />
                )}
                {activePost.platform === "twitter" && (
                  <TwitterCard
                    key={activePost.id}
                    post={activePost}
                    onSave={handleSave}
                    onStatusChange={handleStatusChange}
                  />
                )}
                {activePost.platform === "reddit" && (
                  <RedditCard
                    key={activePost.id}
                    post={activePost}
                    onSave={handleSave}
                    onStatusChange={handleStatusChange}
                  />
                )}

                {/* Image template preview — linkedin & instagram only */}
                {(activePost.platform === "linkedin" || activePost.platform === "instagram") && (() => {
                  const jdParsed = (campaign.jd_parsed as Record<string, unknown>) ?? {};
                  const parsedHook = (jdParsed.hook as string) ?? "";
                  const parsedResponsibilities = (jdParsed.top_responsibilities as string[]) ?? [];
                  const campaignMedia = (data?.media ?? []) as Array<{
                    id: string;
                    file_name: string;
                    mime_type: string;
                    signed_url?: string | null;
                  }>;
                  return (
                    <ImagePreviewPanel
                      roleTitle={campaign.role_title ?? "Open Role"}
                      hook={parsedHook || activePost.content.split("\n")[0].slice(0, 180)}
                      responsibilities={parsedResponsibilities.length > 0 ? parsedResponsibilities : undefined}
                      platform={activePost.platform}
                      campaignId={campaignId}
                      campaignName={campaign.name}
                      mediaItems={campaignMedia.map((m) => ({
                        id: m.id,
                        file_name: m.file_name,
                        signed_url: m.signed_url ?? null,
                      }))}
                    />
                  );
                })()}
              </div>
            )}

            {/* No content yet */}
            {!activePost && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 border border-dashed border-border rounded-sm text-center">
                <p className="text-sm text-muted-foreground">
                  No content yet for this platform. Generate content to get started.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Media uploads */}
        {(data?.media ?? []).length > 0 && (
          <div className="mt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-3">
              Campaign Media
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {data!.media.map((m: { id: string; file_name: string; mime_type: string; signed_url?: string | null }) => (
                <div
                  key={m.id}
                  className="border border-border bg-card overflow-hidden"
                >
                  {m.signed_url && m.mime_type.startsWith("image/") ? (
                    <img
                      src={m.signed_url}
                      alt={m.file_name}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center bg-muted">
                      <p className="text-[10px] font-mono text-muted-foreground px-2 truncate">
                        {m.file_name}
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground truncate px-2 py-1 border-t border-border">
                    {m.file_name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-10 flex items-center justify-between">
          <Link
            to="/social-campaigns"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Link>

          <div className="flex items-center gap-3">
            {scheduleMut.isError && (
              <p className="text-xs text-destructive">
                {scheduleMut.error instanceof Error
                  ? scheduleMut.error.message
                  : "Schedule failed"}
              </p>
            )}
            {hasContent && campaign.start_date && campaign.end_date ? (
              <Button
                size="sm"
                className="gap-1.5 bg-[#D95B28] hover:bg-[#EC7D42] text-white border-0"
                onClick={() => scheduleMut.mutate()}
                disabled={scheduleMut.isPending}
              >
                {scheduleMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarDays className="h-3.5 w-3.5" />
                )}
                Schedule on Calendar
              </Button>
            ) : (
              <Link
                to="/social-campaigns/calendar"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <CalendarDays className="h-4 w-4" />
                View Calendar
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
