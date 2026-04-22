"use client";

import * as Dialog from "@radix-ui/react-dialog";
import mermaid from "mermaid";
import {
  CheckIcon,
  Code2Icon,
  CopyIcon,
  DownloadIcon,
  ExpandIcon,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import * as React from "react";

import { useChatkitTranslation } from "../../i18n/useChatkitTranslation";
import { cn } from "../../lib/utils";
import { useTheme } from "../../providers/Theme";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { TooltipIconButton } from "./tooltip-icon-button";

type MermaidBlockProps = {
  code: string;
};

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type MermaidPalette = {
  background: string;
  border: string;
  fontFamily: string;
  line: string;
  surface: string;
  surfaceAlt: string;
  text: string;
};

type MermaidThemeVariables = {
  background: string;
  clusterBkg: string;
  clusterBorder: string;
  edgeLabelBackground: string;
  fontFamily: string;
  lineColor: string;
  mainBkg: string;
  nodeBorder: string;
  nodeTextColor: string;
  primaryBorderColor: string;
  primaryColor: string;
  primaryTextColor: string;
  secondaryBorderColor: string;
  secondaryColor: string;
  secondaryTextColor: string;
  tertiaryBorderColor: string;
  tertiaryColor: string;
  tertiaryTextColor: string;
  textColor: string;
};

const HEX_COLOR_PATTERN = /^#([\da-f]{3,8})$/i;
const MERMAID_DIRECTIVE_PATTERN =
  /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi;
const MERMAID_FRONTMATTER_PATTERN = /^-{3}\s*[\n\r](.*?)[\n\r]-{3}\s*[\n\r]+/s;
const OKLCH_COLOR_PATTERN = /^oklch\((.+)\)$/i;
const RGB_COLOR_PATTERN = /^rgba?\((.+)\)$/i;
const MERMAID_SECURE_KEYS = [
  "fontFamily",
  "maxEdges",
  "maxTextSize",
  "securityLevel",
  "secure",
  "startOnLoad",
  "suppressErrorRendering",
  "theme",
  "themeVariables",
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeMermaidCode(code: string) {
  return code
    .replace(MERMAID_FRONTMATTER_PATTERN, "")
    .replace(MERMAID_DIRECTIVE_PATTERN, "")
    .trim();
}

function parseAlpha(value: string | undefined) {
  if (!value) return 1;

  const normalized = value.trim();
  if (!normalized) return 1;

  if (normalized.endsWith("%")) {
    return clamp(Number.parseFloat(normalized) / 100, 0, 1);
  }

  return clamp(Number.parseFloat(normalized), 0, 1);
}

function parseHexColor(value: string): RgbaColor | null {
  const match = value.trim().match(HEX_COLOR_PATTERN);
  if (!match) return null;

  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a = "f"] = hex.split("");

    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
      a: Number.parseInt(a + a, 16) / 255,
    };
  }

  if (hex.length === 6 || hex.length === 8) {
    const alphaHex = hex.length === 8 ? hex.slice(6, 8) : "ff";

    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: Number.parseInt(alphaHex, 16) / 255,
    };
  }

  return null;
}

function parseRgbChannel(value: string) {
  const normalized = value.trim();

  if (normalized.endsWith("%")) {
    return clamp(Math.round((Number.parseFloat(normalized) / 100) * 255), 0, 255);
  }

  return clamp(Math.round(Number.parseFloat(normalized)), 0, 255);
}

function parseRgbColor(value: string): RgbaColor | null {
  const match = value.trim().match(RGB_COLOR_PATTERN);
  if (!match) return null;

  const parts = match[1]
    .split(/[,\s/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;

  return {
    r: parseRgbChannel(parts[0]),
    g: parseRgbChannel(parts[1]),
    b: parseRgbChannel(parts[2]),
    a: parseAlpha(parts[3]),
  };
}

function parseOklchLightness(value: string) {
  const normalized = value.trim();

  if (normalized.endsWith("%")) {
    return clamp(Number.parseFloat(normalized) / 100, 0, 1);
  }

  return clamp(Number.parseFloat(normalized), 0, 1);
}

function parseHue(value: string) {
  const normalized = value.trim().toLowerCase();
  const numeric = Number.parseFloat(normalized);

  if (Number.isNaN(numeric)) return 0;
  if (normalized.endsWith("turn")) return numeric * 360;
  if (normalized.endsWith("rad")) return numeric * (180 / Math.PI);
  if (normalized.endsWith("grad")) return numeric * 0.9;

  return numeric;
}

function linearToSrgb(linear: number) {
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  }

  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function parseOklchColor(value: string): RgbaColor | null {
  const match = value.trim().match(OKLCH_COLOR_PATTERN);
  if (!match) return null;

  const [base, alphaSegment] = match[1].split("/");
  const parts = base
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;

  const lightness = parseOklchLightness(parts[0]);
  const chroma = Number.parseFloat(parts[1]);
  const hueRadians = (parseHue(parts[2]) * Math.PI) / 180;
  const alpha = parseAlpha(alphaSegment);

  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);

  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linearB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: clamp(Math.round(linearToSrgb(linearR) * 255), 0, 255),
    g: clamp(Math.round(linearToSrgb(linearG) * 255), 0, 255),
    b: clamp(Math.round(linearToSrgb(linearB) * 255), 0, 255),
    a: alpha,
  };
}

function parseCssColor(value: string): RgbaColor | null {
  const normalized = value.trim();
  if (!normalized) return null;

  return parseHexColor(normalized) ?? parseRgbColor(normalized) ?? parseOklchColor(normalized);
}

function compositeColor(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.a + background.a * (1 - foreground.a);

  if (alpha <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const r =
    (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha;
  const g =
    (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha;
  const b =
    (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha;

  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
    a: clamp(alpha, 0, 1),
  };
}

function toHexChannel(value: number) {
  return value.toString(16).padStart(2, "0");
}

function rgbaToHex(value: RgbaColor) {
  return `#${toHexChannel(value.r)}${toHexChannel(value.g)}${toHexChannel(value.b)}`;
}

function getFallbackPalette(isDarkMode: boolean): MermaidPalette {
  if (isDarkMode) {
    return {
      background: "#171717",
      border: "#52525b",
      fontFamily: "Inter Variable, sans-serif",
      line: "#a1a1aa",
      surface: "#262626",
      surfaceAlt: "#3f3f46",
      text: "#fafafa",
    };
  }

  return {
    background: "#ffffff",
    border: "#e4e4e7",
    fontFamily: "Inter Variable, sans-serif",
    line: "#71717a",
    surface: "#ffffff",
    surfaceAlt: "#f4f4f5",
    text: "#18181b",
  };
}

function resolveColor(
  styles: CSSStyleDeclaration,
  property: string,
  fallback: string,
  background?: RgbaColor | null,
) {
  const parsed = parseCssColor(styles.getPropertyValue(property));
  if (!parsed) return fallback;

  if (parsed.a < 1 && background) {
    return rgbaToHex(compositeColor(parsed, background));
  }

  return rgbaToHex(parsed);
}

function resolvePalette(element: HTMLElement, isDarkMode: boolean): MermaidPalette {
  const fallback = getFallbackPalette(isDarkMode);
  const styles = window.getComputedStyle(element);

  const backgroundColor =
    parseCssColor(styles.getPropertyValue("--card")) ??
    parseCssColor(styles.getPropertyValue("--background")) ??
    parseCssColor(fallback.surface);

  return {
    background: resolveColor(styles, "--background", fallback.background, backgroundColor),
    border: resolveColor(styles, "--border", fallback.border, backgroundColor),
    fontFamily: styles.getPropertyValue("font-family").trim() || fallback.fontFamily,
    line: resolveColor(styles, "--muted-foreground", fallback.line, backgroundColor),
    surface: resolveColor(styles, "--card", fallback.surface, backgroundColor),
    surfaceAlt: resolveColor(styles, "--muted", fallback.surfaceAlt, backgroundColor),
    text: resolveColor(styles, "--foreground", fallback.text, backgroundColor),
  };
}

function buildThemeVariables(palette: MermaidPalette): MermaidThemeVariables {
  return {
    background: palette.background,
    clusterBkg: palette.surfaceAlt,
    clusterBorder: palette.border,
    edgeLabelBackground: palette.surface,
    fontFamily: palette.fontFamily,
    lineColor: palette.line,
    mainBkg: palette.surface,
    nodeBorder: palette.border,
    nodeTextColor: palette.text,
    primaryBorderColor: palette.border,
    primaryColor: palette.surfaceAlt,
    primaryTextColor: palette.text,
    secondaryBorderColor: palette.border,
    secondaryColor: palette.surface,
    secondaryTextColor: palette.text,
    tertiaryBorderColor: palette.border,
    tertiaryColor: palette.surface,
    tertiaryTextColor: palette.text,
    textColor: palette.text,
  };
}

async function renderMermaidDiagram({
  code,
  host,
  id,
  palette,
}: {
  code: string;
  host: HTMLDivElement;
  id: string;
  palette: MermaidPalette;
}) {
  host.innerHTML = "";

  mermaid.initialize({
    flowchart: {
      htmlLabels: false,
      useMaxWidth: true,
    },
    fontFamily: palette.fontFamily,
    secure: [...MERMAID_SECURE_KEYS],
    securityLevel: "strict",
    startOnLoad: false,
    theme: "base",
    themeVariables: buildThemeVariables(palette),
  });

  const { svg } = await mermaid.render(id, code, host);
  host.innerHTML = "";

  return svg;
}

function MermaidPreviewDialog({
  closeLabel,
  onOpenChange,
  open,
  svgMarkup,
  title,
}: {
  closeLabel: string;
  onOpenChange: (nextOpen: boolean) => void;
  open: boolean;
  svgMarkup: string;
  title: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-[5vh] z-50 flex flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-foreground">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
                <span className="sr-only">{closeLabel}</span>
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-auto bg-card p-6">
            <div
              data-slot="mermaid-preview"
              className="min-h-full rounded-[calc(var(--radius)+0.5rem)] border border-border bg-background p-6 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const { t } = useChatkitTranslation();
  const { theme, isDarkMode } = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const renderHostRef = React.useRef<HTMLDivElement>(null);
  const renderSequenceRef = React.useRef(0);
  const copyResetTimeoutRef = React.useRef<number | null>(null);
  const diagramId = React.useId().replace(/:/g, "");
  const [activeTab, setActiveTab] = React.useState<"diagram" | "code">("diagram");
  const [isCopied, setIsCopied] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isRendering, setIsRendering] = React.useState(true);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = React.useState<string | null>(null);
  const normalizedCode = React.useMemo(() => normalizeMermaidCode(code), [code]);

  const clearCopyResetTimeout = React.useCallback(() => {
    if (copyResetTimeoutRef.current === null) return;

    window.clearTimeout(copyResetTimeoutRef.current);
    copyResetTimeoutRef.current = null;
  }, []);

  React.useEffect(() => {
    let isActive = true;

    async function runRender() {
      const container = containerRef.current;
      const renderHost = renderHostRef.current;
      if (!container || !renderHost) return;

      setIsRendering(true);
      setRenderError(null);

      try {
        renderSequenceRef.current += 1;

        const svg = await renderMermaidDiagram({
          code: normalizedCode,
          host: renderHost,
          id: `mermaid-${diagramId}-${renderSequenceRef.current}`,
          palette: resolvePalette(container, isDarkMode),
        });

        if (!isActive) return;
        setSvgMarkup(svg);
      } catch (error) {
        if (!isActive) return;

        setSvgMarkup(null);
        setRenderError(error instanceof Error ? error.message : "render_failed");
        setActiveTab((currentTab) => (currentTab === "diagram" ? "code" : currentTab));
      } finally {
        if (isActive) {
          setIsRendering(false);
          renderHost.innerHTML = "";
        }
      }
    }

    void runRender();

    return () => {
      isActive = false;

      if (renderHostRef.current) {
        renderHostRef.current.innerHTML = "";
      }
    };
  }, [diagramId, isDarkMode, normalizedCode, theme]);

  React.useEffect(() => {
    clearCopyResetTimeout();
    setIsCopied(false);
  }, [activeTab, clearCopyResetTimeout, code]);

  React.useEffect(
    () => () => {
      clearCopyResetTimeout();
    },
    [clearCopyResetTimeout],
  );

  const handleDownload = React.useCallback(() => {
    if (!svgMarkup) return;

    const blob = new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `mermaid-diagram-${diagramId}.svg`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, [diagramId, svgMarkup]);

  const handleCopyCode = React.useCallback(() => {
    if (!code || isCopied) return;

    navigator.clipboard
      .writeText(code)
      .then(() => {
        setIsCopied(true);
        clearCopyResetTimeout();
        copyResetTimeoutRef.current = window.setTimeout(() => {
          setIsCopied(false);
          copyResetTimeoutRef.current = null;
        }, 3000);
      })
      .catch(() => {});
  }, [clearCopyResetTimeout, code, isCopied]);

  const hasRenderedDiagram = svgMarkup !== null && !renderError;
  const statusMessage = isRendering
    ? t("markdown.mermaid.rendering")
    : t("markdown.mermaid.failed");

  return (
    <>
      <Tabs
        className="w-full"
        onValueChange={(value) => setActiveTab(value as "diagram" | "code")}
        value={activeTab}
      >
        <div
          ref={containerRef}
          data-slot="mermaid-block"
          className="relative overflow-hidden text-card-foreground"
        >
          <div
            ref={renderHostRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-0"
            data-slot="mermaid-render-host"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <Code2Icon className="size-4" />
              </span>
              <span className="truncate text-base font-semibold text-foreground">
                {t("markdown.mermaid.title")}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1">
                {activeTab === "diagram" && hasRenderedDiagram ? (
                  <TooltipIconButton
                    onClick={handleDownload}
                    tooltip={t("markdown.mermaid.download")}
                  >
                    <DownloadIcon className="size-4" />
                  </TooltipIconButton>
                ) : null}
                {activeTab === "diagram" && hasRenderedDiagram ? (
                  <TooltipIconButton
                    onClick={() => setIsPreviewOpen(true)}
                    tooltip={t("markdown.mermaid.fullScreen")}
                  >
                    <ExpandIcon className="size-4" />
                  </TooltipIconButton>
                ) : null}
                {activeTab === "code" ? (
                  <TooltipIconButton
                    onClick={handleCopyCode}
                    tooltip={t("markdown.copy")}
                  >
                    {isCopied ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </TooltipIconButton>
                ) : null}
              </div>

              <TabsList>
                <TabsTrigger value="diagram">{t("markdown.mermaid.diagram")}</TabsTrigger>
                <TabsTrigger value="code">{t("markdown.mermaid.code")}</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            {renderError ? (
              <p role="alert" className="mb-4 text-sm font-medium text-destructive">
                {t("markdown.mermaid.failed")}
              </p>
            ) : null}

            <TabsContent value="diagram" className="mt-0 space-y-4">
              <div
                className={cn(
                  "relative overflow-auto rounded-[calc(var(--radius)+0.5rem)] border border-border bg-background p-4",
                  hasRenderedDiagram
                    ? "[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none"
                    : "min-h-[14rem]",
                )}
              >
                {hasRenderedDiagram ? (
                  <div
                    data-slot="mermaid-diagram"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                ) : (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    {isRendering ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <TriangleAlert className="size-5 text-destructive" />
                    )}
                    <p
                      className={cn("text-sm font-medium", !isRendering && "text-destructive")}
                      role={renderError ? "alert" : undefined}
                    >
                      {statusMessage}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="code" className="mt-0">
              <pre
                data-slot="mermaid-code"
                className="overflow-x-auto rounded-[calc(var(--radius)+0.5rem)] border border-border bg-zinc-950 px-4 py-4 text-sm text-zinc-50"
              >
                <code className="block whitespace-pre font-mono">{code}</code>
              </pre>
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {svgMarkup ? (
        <MermaidPreviewDialog
          closeLabel={t("sheet.close")}
          onOpenChange={setIsPreviewOpen}
          open={isPreviewOpen}
          svgMarkup={svgMarkup}
          title={t("markdown.mermaid.title")}
        />
      ) : null}
    </>
  );
}
