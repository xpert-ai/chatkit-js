import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import mermaid from "mermaid";
import { describe, beforeEach, expect, it, vi } from "vitest";

vi.mock("./syntax-highlighter", () => ({
  SyntaxHighlighter: ({ children }: { children: string }) => <pre>{children}</pre>,
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id: string, code: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" data-render-id="${id}"><g class="node default"><rect width="100" height="40"></rect><text>${code}</text></g></svg>`,
    })),
  },
}));

import { setLanguage } from "../../i18n";
import { ThemeProvider } from "../../providers/Theme";
import { MarkdownText } from "./markdown-text";

type MermaidModule = {
  initialize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
};

const mermaidMock = mermaid as unknown as MermaidModule;
const writeTextMock = vi.fn<() => Promise<void>>();

function renderMarkdown(markdown: string, theme = { colorScheme: "light" as const }) {
  return render(
    <ThemeProvider theme={theme}>
      <MarkdownText>{markdown}</MarkdownText>
    </ThemeProvider>,
  );
}

describe("MarkdownText", () => {
  beforeEach(() => {
    setLanguage("en-US");
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockClear();
    mermaidMock.render.mockImplementation(async (id: string, code: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg" data-render-id="${id}"><g class="node default"><rect width="100" height="40"></rect><text>${code}</text></g></svg>`,
    }));
  });

  it("keeps non-mermaid fenced code blocks on the regular code path", () => {
    const { container } = renderMarkdown("```ts\nconst answer = 42;\n```");

    expect(container).toHaveTextContent("const answer = 42;");
    expect(screen.queryByText("Mermaid")).not.toBeInTheDocument();
    expect(mermaidMock.render).not.toHaveBeenCalled();
  });

  it("renders mermaid fenced code blocks as diagrams", async () => {
    const { container } = renderMarkdown("```mermaid\ngraph TD; A-->B;\n```");

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Mermaid")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Download SVG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open full screen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="mermaid-diagram"] svg')).not.toBeNull();
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        theme: "base",
        securityLevel: "strict",
        secure: expect.arrayContaining(["theme", "themeVariables"]),
      }),
    );
    expect(
      container.querySelector('[data-slot="mermaid-block"]')?.closest(".bg-black"),
    ).toBeNull();
  });

  it("switches to the code tab and shows the mermaid source", async () => {
    renderMarkdown("```mermaid\ngraph TD; A-->B;\n```");

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.getByText("graph TD; A-->B;")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download SVG" })).not.toBeInTheDocument();
  });

  it("copies the mermaid source from the code tab", async () => {
    renderMarkdown("```mermaid\ngraph TD; A-->B;\n```");

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("graph TD; A-->B;"));
  });

  it("strips diagram-level mermaid config so host theme stays in control", async () => {
    renderMarkdown(`\`\`\`mermaid
---
config:
  theme: dark
---
%%{init: { "theme": "dark", "themeVariables": { "mainBkg": "#000000", "nodeBorder": "#000000" } }}%%
graph TD; A-->B;
\`\`\``);

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    expect(mermaidMock.render).toHaveBeenLastCalledWith(
      expect.any(String),
      "graph TD; A-->B;",
      expect.any(HTMLDivElement),
    );
  });

  it("falls back to the original mermaid source when rendering fails", async () => {
    mermaidMock.render.mockRejectedValueOnce(new Error("boom"));

    renderMarkdown("```mermaid\ngraph TD; A-->B;\n```");

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to render diagram");
    expect(screen.getByRole("tab", { name: "Code", selected: true })).toBeInTheDocument();
    expect(screen.getByText("graph TD; A-->B;")).toBeInTheDocument();
  });

  it("re-renders when the mermaid source changes", async () => {
    const { rerender } = render(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <MarkdownText>{"```mermaid\ngraph TD; A-->B;\n```"}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    rerender(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <MarkdownText>{"```mermaid\ngraph TD; B-->C;\n```"}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));
    expect(mermaidMock.render).toHaveBeenLastCalledWith(
      expect.any(String),
      "graph TD; B-->C;",
      expect.any(HTMLDivElement),
    );
  });

  it("re-renders when the theme changes", async () => {
    const { rerender } = render(
      <ThemeProvider theme={{ colorScheme: "light" }}>
        <MarkdownText>{"```mermaid\ngraph TD; A-->B;\n```"}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(1));

    rerender(
      <ThemeProvider theme={{ colorScheme: "dark" }}>
        <MarkdownText>{"```mermaid\ngraph TD; A-->B;\n```"}</MarkdownText>
      </ThemeProvider>,
    );

    await waitFor(() => expect(mermaidMock.render).toHaveBeenCalledTimes(2));
    expect(mermaidMock.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        securityLevel: "strict",
        theme: "base",
      }),
    );
  });
});
