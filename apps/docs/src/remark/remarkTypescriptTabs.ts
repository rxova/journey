import { format } from "prettier";
import * as ts from "typescript";

type Node = {
  type: string;
};

type Parent = Node & {
  children: MdastNode[];
};

type Root = Parent & {
  type: "root";
};

type CodeNode = Node & {
  type: "code";
  lang?: string | null;
  meta?: string | null;
  value: string;
};

type MdxJsxAttribute = {
  type: "mdxJsxAttribute";
  name: string;
  value?: string | null;
};

type MdxJsxFlowElement = Parent & {
  type: "mdxJsxFlowElement";
  name: string;
  attributes: MdxJsxAttribute[];
};

type MdastNode = CodeNode | MdxJsxFlowElement | Parent | Node;

const TYPE_SCRIPT_LANGUAGES = new Set(["ts", "tsx", "typescript"]);
const LANGUAGE_TAB_GROUP_ID = "docs-code-language";

export default function remarkTypescriptTabs() {
  return async (tree: Root): Promise<void> => {
    await transformParent(tree, []);
  };
}

async function transformParent(parent: Parent, ancestors: MdastNode[]): Promise<void> {
  for (let index = 0; index < parent.children.length; index += 1) {
    const node = parent.children[index];

    if (isCodeNode(node) && shouldTransform(node, ancestors)) {
      parent.children[index] = await createLanguageTabs(node);
      continue;
    }

    if (isParentNode(node)) {
      await transformParent(node, [...ancestors, node]);
    }
  }
}

function shouldTransform(node: CodeNode, ancestors: MdastNode[]): boolean {
  if (!node.lang || !TYPE_SCRIPT_LANGUAGES.has(node.lang)) {
    return false;
  }

  if (node.meta?.includes("noLanguageTabs")) {
    return false;
  }

  return !ancestors.some(
    (ancestor) =>
      isMdxJsxFlowElement(ancestor) && (ancestor.name === "Tabs" || ancestor.name === "TabItem")
  );
}

async function createLanguageTabs(node: CodeNode): Promise<MdxJsxFlowElement> {
  const javascriptLang = node.lang === "tsx" ? "jsx" : "js";

  return {
    type: "mdxJsxFlowElement",
    name: "Tabs",
    attributes: [
      createAttribute("groupId", LANGUAGE_TAB_GROUP_ID),
      createAttribute("defaultValue", "typescript")
    ],
    children: [
      createTabItem({
        value: "typescript",
        label: "TypeScript",
        code: {
          ...node
        }
      }),
      createTabItem({
        value: "javascript",
        label: "JavaScript",
        code: {
          ...node,
          lang: javascriptLang,
          value: await transpileToJavascript(node.value, node.lang)
        }
      })
    ]
  };
}

function createTabItem({
  value,
  label,
  code
}: {
  value: string;
  label: string;
  code: CodeNode;
}): MdxJsxFlowElement {
  return {
    type: "mdxJsxFlowElement",
    name: "TabItem",
    attributes: [createAttribute("value", value), createAttribute("label", label)],
    children: [code]
  };
}

function createAttribute(name: string, value: string): MdxJsxAttribute {
  return {
    type: "mdxJsxAttribute",
    name,
    value
  };
}

async function transpileToJavascript(
  source: string,
  language: string | null | undefined
): Promise<string> {
  const fileName = language === "tsx" ? "snippet.tsx" : "snippet.ts";
  const normalizedSource = normalizeOutput(source);

  if (!containsTypeScriptOnlySyntax(source, fileName)) {
    return normalizedSource;
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve
    },
    fileName
  }).outputText;

  const normalizedOutput = stripTranspileArtifacts(transpiled);

  if (normalizedOutput.length > 0) {
    const formattedOutput = await formatJavascript(normalizedOutput);
    return preserveSourceStatementSpacing(source, formattedOutput, fileName);
  }

  // Type-only examples have no runtime JavaScript output.
  return "// No JavaScript equivalent. This example is type-only.";
}

async function formatJavascript(output: string): Promise<string> {
  try {
    const formatted = await format(output, {
      parser: "babel",
      tabWidth: 2
    });

    return normalizeOutput(formatted);
  } catch {
    return output;
  }
}

function stripTranspileArtifacts(output: string): string {
  const normalized = normalizeOutput(output);
  const withoutEmptyModuleMarker = normalized.replace(/^export \{\};?\n?/u, "").trim();

  return withoutEmptyModuleMarker;
}

function preserveSourceStatementSpacing(
  source: string,
  output: string,
  sourceFileName: string
): string {
  const sourceFile = ts.createSourceFile(sourceFileName, source, ts.ScriptTarget.Latest, true);
  const outputFile = ts.createSourceFile(
    "snippet.js",
    output,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const sourceStatements = sourceFile.statements.filter(statementEmitsRuntime);
  const outputStatements = [...outputFile.statements];

  if (sourceStatements.length !== outputStatements.length) {
    return output;
  }

  const separators = sourceStatements
    .slice(1)
    .map((statement, index) => shouldPreserveBlankLine(source, sourceStatements[index], statement));

  let rebuilt = getStatementText(output, outputStatements[0]);

  for (let index = 1; index < outputStatements.length; index += 1) {
    rebuilt += separators[index - 1] ? "\n\n" : "\n";
    rebuilt += getStatementText(output, outputStatements[index]);
  }

  return rebuilt;
}

function shouldPreserveBlankLine(
  source: string,
  previous: ts.Statement,
  current: ts.Statement
): boolean {
  const sourceFile = previous.getSourceFile();
  const previousEndLine = sourceFile.getLineAndCharacterOfPosition(previous.end).line;
  const currentStartLine = sourceFile.getLineAndCharacterOfPosition(current.getStart()).line;

  return currentStartLine - previousEndLine > 1;
}

function getStatementText(source: string, statement: ts.Statement): string {
  return source.slice(statement.getStart(), statement.end).trimEnd();
}

function normalizeOutput(output: string): string {
  return output.replace(/\r\n/g, "\n").trim();
}

function containsTypeScriptOnlySyntax(source: string, fileName: string): boolean {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let hasTypeScriptSyntax = false;

  const visit = (node: ts.Node): void => {
    if (hasTypeScriptSyntax) {
      return;
    }

    if (isTypeScriptOnlyNode(node) || hasTypeScriptOnlyFlags(node)) {
      hasTypeScriptSyntax = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return hasTypeScriptSyntax;
}

function isTypeScriptOnlyNode(node: ts.Node): boolean {
  if (ts.isTypeNode(node)) {
    return true;
  }

  if (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isImportEqualsDeclaration(node) ||
    ts.isTypeParameterDeclaration(node)
  ) {
    return true;
  }

  if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ImplementsKeyword) {
    return true;
  }

  if (ts.isImportClause(node) && node.isTypeOnly) {
    return true;
  }

  if (ts.isImportSpecifier(node) && node.isTypeOnly) {
    return true;
  }

  if (ts.isExportDeclaration(node) && node.isTypeOnly) {
    return true;
  }

  if (ts.isExportSpecifier(node) && node.isTypeOnly) {
    return true;
  }

  return false;
}

function hasTypeScriptOnlyFlags(node: ts.Node): boolean {
  if ("questionToken" in node && node.questionToken) {
    return true;
  }

  if ("exclamationToken" in node && node.exclamationToken) {
    return true;
  }

  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  const modifiers = ts.getModifiers(node) ?? [];

  return modifiers.some((modifier) =>
    [
      ts.SyntaxKind.AbstractKeyword,
      ts.SyntaxKind.AccessorKeyword,
      ts.SyntaxKind.DeclareKeyword,
      ts.SyntaxKind.OverrideKeyword,
      ts.SyntaxKind.PrivateKeyword,
      ts.SyntaxKind.ProtectedKeyword,
      ts.SyntaxKind.PublicKeyword,
      ts.SyntaxKind.ReadonlyKeyword
    ].includes(modifier.kind)
  );
}

function statementEmitsRuntime(statement: ts.Statement): boolean {
  if (
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    return false;
  }

  if (ts.isImportDeclaration(statement)) {
    return importDeclarationEmitsRuntime(statement);
  }

  if (ts.isImportEqualsDeclaration(statement)) {
    return !statement.isTypeOnly;
  }

  if (ts.isExportDeclaration(statement)) {
    return !statement.isTypeOnly;
  }

  return true;
}

function importDeclarationEmitsRuntime(statement: ts.ImportDeclaration): boolean {
  const { importClause } = statement;

  if (!importClause) {
    return true;
  }

  if (importClause.isTypeOnly) {
    return false;
  }

  if (!importClause.namedBindings || !ts.isNamedImports(importClause.namedBindings)) {
    return true;
  }

  return importClause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function isCodeNode(node: MdastNode): node is CodeNode {
  return node.type === "code";
}

function isParentNode(node: MdastNode): node is Parent {
  return "children" in node && Array.isArray(node.children);
}

function isMdxJsxFlowElement(node: MdastNode): node is MdxJsxFlowElement {
  return node.type === "mdxJsxFlowElement" && "name" in node && typeof node.name === "string";
}
