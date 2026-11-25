/**
 * AST-level security guard for MDX compilation (`compileMDX` with `blockJS: false`).
 *
 * Scientific articles in Scienta pass static data props to editorial components
 * (for example `<StatHighlight stats={[{ value: "100M K", label: "Core" }]} />`
 * and `<Timeline events={[...]} />`). Running regex checks alone over MDX text
 * can be bypassed with JS syntax tricks such as computed property access or
 * string concatenation (`[]["at"]["const"+"ructor"](...)`).
 *
 * This remark plugin inspects the exact MDAST + ESTree AST produced by the MDX
 * parser before JS code generation and strictly limits JSX attribute expressions
 * to pure JSON-like static literals while rejecting all executable expressions,
 * JSX spread attributes, ESM imports/exports, raw unsafe HTML tags, inline event
 * handlers, and executable URI schemes.
 */

const FORBIDDEN_JSX_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "base",
  "meta",
  "link",
  "style",
  "form",
  "input",
  "textarea",
  "select",
  "button",
]);

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const URL_ATTR_NAMES = new Set(["href", "src", "action", "formaction", "xlinkhref", "poster"]);
const EXECUTABLE_URI_RE = /^\s*(?:javascript|vbscript)\s*:|^\s*data\s*:\s*text\/html/i;

export interface EstreeNode {
  type: string;
  body?: EstreeNode[];
  expression?: EstreeNode;
  value?: unknown;
  regex?: unknown;
  operator?: string;
  argument?: EstreeNode;
  elements?: Array<EstreeNode | null>;
  properties?: EstreeNode[];
  key?: EstreeNode;
  name?: string;
  computed?: boolean;
  kind?: string;
  method?: boolean;
  shorthand?: boolean;
  expressions?: EstreeNode[];
}

export interface MdastNode {
  type: string;
  name?: string | null;
  value?: unknown;
  attributes?: MdastNode[];
  children?: MdastNode[];
  data?: {
    estree?: EstreeNode;
  };
}

function assertStaticLiteralValue(node: EstreeNode | null | undefined, depth = 0): void {
  if (!node || typeof node !== "object") {
    throw new Error("Unsafe MDX expression: empty or malformed AST node.");
  }
  if (depth > 16) {
    throw new Error("Unsafe MDX expression: nesting depth exceeds maximum allowed limit.");
  }

  switch (node.type) {
    case "Literal": {
      if (node.regex !== undefined) {
        throw new Error("Unsafe MDX expression: RegExp literals are not permitted in JSX props.");
      }
      const val = node.value;
      if (
        val !== null &&
        typeof val !== "string" &&
        typeof val !== "number" &&
        typeof val !== "boolean"
      ) {
        throw new Error("Unsafe MDX expression: unsupported literal type.");
      }
      return;
    }

    case "TemplateLiteral": {
      if (Array.isArray(node.expressions) && node.expressions.length > 0) {
        throw new Error("Unsafe MDX expression: template literal interpolation is forbidden.");
      }
      return;
    }

    case "UnaryExpression": {
      if (node.operator !== "-" && node.operator !== "+" && node.operator !== "!") {
        throw new Error(`Unsafe MDX expression: unary operator '${node.operator ?? ""}' is forbidden.`);
      }
      assertStaticLiteralValue(node.argument, depth + 1);
      return;
    }

    case "ArrayExpression": {
      for (const el of node.elements ?? []) {
        if (el === null) continue;
        if (el.type === "SpreadElement") {
          throw new Error("Unsafe MDX expression: array spread syntax is forbidden.");
        }
        assertStaticLiteralValue(el, depth + 1);
      }
      return;
    }

    case "ObjectExpression": {
      for (const prop of node.properties ?? []) {
        if (prop.type !== "Property") {
          throw new Error("Unsafe MDX expression: object spread syntax is forbidden.");
        }
        if (prop.computed || prop.method || prop.shorthand || prop.kind !== "init") {
          throw new Error("Unsafe MDX expression: computed properties, methods, and getters/setters are forbidden.");
        }
        const keyNode = prop.key;
        let keyName = "";
        if (keyNode?.type === "Identifier" && typeof keyNode.name === "string") {
          keyName = keyNode.name;
        } else if (keyNode?.type === "Literal" && (typeof keyNode.value === "string" || typeof keyNode.value === "number")) {
          keyName = String(keyNode.value);
        } else {
          throw new Error("Unsafe MDX expression: object property keys must be static identifiers or strings.");
        }
        if (FORBIDDEN_OBJECT_KEYS.has(keyName)) {
          throw new Error(`Unsafe MDX expression: forbidden property key '${keyName}'.`);
        }
        assertStaticLiteralValue(prop.value as EstreeNode | undefined, depth + 1);
      }
      return;
    }

    default:
      throw new Error(
        `Unsafe MDX expression: '${node.type}' is forbidden. Only static strings, numbers, booleans, arrays, and plain objects are allowed in JSX props.`
      );
  }
}

/**
 * Pure validator verifying an MDX JSX attribute expression's ESTree Program
 * contains ONLY a single static JSON-like literal expression.
 */
export function validateMdxEstreeExpression(estree: EstreeNode | undefined): void {
  if (!estree || estree.type !== "Program" || !Array.isArray(estree.body)) {
    throw new Error("Unsafe MDX expression: missing or invalid AST.");
  }
  if (estree.body.length !== 1 || estree.body[0]?.type !== "ExpressionStatement") {
    throw new Error("Unsafe MDX expression: only a single static literal expression is allowed.");
  }
  assertStaticLiteralValue(estree.body[0].expression, 0);
}

function walkMdast(node: MdastNode | null | undefined): void {
  if (!node || typeof node !== "object") return;

  if (node.type === "mdxjsEsm") {
    throw new Error("Top-level MDX import/export statements are disabled for security.");
  }

  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    // Allow JSX comments `{/* ... */}` which parse as an empty ESTree Program (`body.length === 0`).
    const body = node.data?.estree?.body;
    if (!Array.isArray(body) || body.length > 0) {
      throw new Error("Executable inline MDX JavaScript expressions are disabled for security.");
    }
    return;
  }

  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    const tagName = typeof node.name === "string" ? node.name.trim() : "";
    if (tagName && FORBIDDEN_JSX_TAGS.has(tagName.toLowerCase())) {
      throw new Error(`Unsafe HTML/JSX tag <${tagName}> is forbidden in MDX content.`);
    }

    for (const attr of node.attributes ?? []) {
      if (attr.type === "mdxJsxExpressionAttribute") {
        throw new Error("JSX spread attributes ({...props}) are forbidden in MDX content.");
      }
      if (attr.type === "mdxJsxAttribute") {
        const attrName = typeof attr.name === "string" ? attr.name.trim() : "";
        const lowerAttr = attrName.toLowerCase();
        if (lowerAttr === "dangerouslysetinnerhtml" || /^on[a-z]/i.test(attrName)) {
          throw new Error(`Unsafe JSX attribute '${attrName}' is forbidden in MDX content.`);
        }

        if (typeof attr.value === "string") {
          if (URL_ATTR_NAMES.has(lowerAttr) && EXECUTABLE_URI_RE.test(attr.value)) {
            throw new Error(`Executable URI scheme in '${attrName}' is forbidden in MDX content.`);
          }
        } else if (attr.value && typeof attr.value === "object") {
          const exprNode = attr.value as MdastNode;
          if (exprNode.type === "mdxJsxAttributeValueExpression") {
            validateMdxEstreeExpression(exprNode.data?.estree);
            // If a URL attribute uses a literal expression like href={"javascript:..."}, validate its string value too.
            if (URL_ATTR_NAMES.has(lowerAttr)) {
              const expr = exprNode.data?.estree?.body?.[0]?.expression;
              if (expr?.type === "Literal" && typeof expr.value === "string" && EXECUTABLE_URI_RE.test(expr.value)) {
                throw new Error(`Executable URI scheme in '${attrName}' is forbidden in MDX content.`);
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkMdast(child);
    }
  }
}

/**
 * Remark plugin enforcing strict static-only MDX compilation before JS codegen.
 */
export function remarkStrictStaticMdx() {
  return (tree: MdastNode) => {
    walkMdast(tree);
  };
}
