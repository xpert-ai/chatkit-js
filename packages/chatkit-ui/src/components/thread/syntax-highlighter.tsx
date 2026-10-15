import { PrismAsyncLight as SyntaxHighlighterPrism } from "react-syntax-highlighter";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import { coldarkCold, coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { type FC } from "react";
import { useTheme } from "../../providers/Theme";

// Register languages you want to support
SyntaxHighlighterPrism.registerLanguage("js", tsx);
SyntaxHighlighterPrism.registerLanguage("jsx", tsx);
SyntaxHighlighterPrism.registerLanguage("ts", tsx);
SyntaxHighlighterPrism.registerLanguage("tsx", tsx);
SyntaxHighlighterPrism.registerLanguage("python", python);

interface SyntaxHighlighterProps {
  children: string;
  language: string;
  className?: string;
}

export const SyntaxHighlighter: FC<SyntaxHighlighterProps> = ({
  children,
  language,
  className,
}) => {
  const { isDarkMode } = useTheme();

  return (
    <SyntaxHighlighterPrism
      language={language}
      style={isDarkMode ? coldarkDark : coldarkCold}
      customStyle={{
        margin: 0,
        width: "100%",
        background: "transparent",
        color: "var(--foreground)",
        padding: "calc(var(--density-padding, 1rem) * 1.5) var(--density-padding, 1rem)",
      }}
      codeTagProps={{ style: { color: "inherit" } }}
      className={className}
    >
      {children}
    </SyntaxHighlighterPrism>
  );
};
