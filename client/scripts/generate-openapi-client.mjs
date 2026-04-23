import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const SPEC_PATH = path.resolve(ROOT, "../server/openapi.json");
const OUTPUT_DIR = path.resolve(ROOT, "src/lib/api/generated");
const OUTPUT_PATH = path.resolve(OUTPUT_DIR, "openapi-client.ts");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];
const RESERVED_WORDS = new Set([
  "default",
  "delete",
  "export",
  "extends",
  "function",
  "import",
  "new",
  "return",
  "switch",
  "var",
]);

const PRIMITIVE_TYPE_MAP = {
  string: "string",
  integer: "number",
  number: "number",
  boolean: "boolean",
};

const toPascalCase = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

const toCamelCase = (value) => {
  const pascal = toPascalCase(value);
  return pascal ? pascal[0].toLowerCase() + pascal.slice(1) : "unnamedOperation";
};

const sanitizeIdentifier = (value) => {
  const normalized = value.replace(/[^a-zA-Z0-9_$]/g, "_");
  const safe = /^[a-zA-Z_$]/.test(normalized) ? normalized : `_${normalized}`;
  return RESERVED_WORDS.has(safe) ? `${safe}Value` : safe;
};

const refName = (ref) => ref.split("/").at(-1);

const indent = (value, spaces = 2) =>
  value
    .split("\n")
    .map((line) => (line.length ? `${" ".repeat(spaces)}${line}` : line))
    .join("\n");

const unique = (items) => [...new Set(items)];

const makeDocComment = (text) => {
  if (!text) return "";
  const lines = String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  return ["/**", ...lines.map((line) => ` * ${line}`), " */"].join("\n");
};

const schemaToTs = (schema, spec) => {
  if (!schema) return "unknown";

  if (schema.$ref) {
    return refName(schema.$ref);
  }

  if (schema.enum?.length) {
    const union = schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    return union || "string";
  }

  if (schema.allOf?.length) {
    return schema.allOf.map((part) => `(${schemaToTs(part, spec)})`).join(" & ");
  }

  if (schema.oneOf?.length) {
    return schema.oneOf.map((part) => `(${schemaToTs(part, spec)})`).join(" | ");
  }

  if (schema.anyOf?.length) {
    return schema.anyOf.map((part) => `(${schemaToTs(part, spec)})`).join(" | ");
  }

  if (schema.type === "array") {
    return `Array<${schemaToTs(schema.items, spec)}>`;
  }

  if (schema.type === "object" || schema.properties || schema.additionalProperties) {
    const required = new Set(schema.required ?? []);
    const lines = [];

    if (schema.properties) {
      for (const [name, propertySchema] of Object.entries(schema.properties)) {
        const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
        const optional = required.has(name) ? "" : "?";
        const type = schemaToTs(propertySchema, spec);
        const doc = makeDocComment(propertySchema.description);
        if (doc) lines.push(doc);
        lines.push(`${key}${optional}: ${type};`);
      }
    }

    if (schema.additionalProperties) {
      lines.push(`[key: string]: ${schemaToTs(schema.additionalProperties, spec)};`);
    }

    if (!lines.length) return "Record<string, unknown>";
    return `{\n${indent(lines.join("\n"))}\n}`;
  }

  if (schema.type && PRIMITIVE_TYPE_MAP[schema.type]) {
    return withNullable(PRIMITIVE_TYPE_MAP[schema.type], schema);
  }

  return schema.nullable ? "unknown | null" : "unknown";
};

const withNullable = (type, schema) => (schema?.nullable ? `${type} | null` : type);

const getJsonBodySchema = (requestBody) => {
  const json = requestBody?.content?.["application/json"];
  return json?.schema ?? null;
};

const getJsonResponseSchema = (responses) => {
  const successCodes = Object.keys(responses ?? {})
    .filter((code) => /^2\d\d$/.test(code))
    .sort();

  for (const code of successCodes) {
    const response = responses[code];
    const schema = response?.content?.["application/json"]?.schema;
    if (schema) {
      return { status: Number(code), schema };
    }
  }

  const emptySuccess = successCodes.find((code) => Number(code) === 204);
  if (emptySuccess) {
    return { status: 204, schema: null };
  }

  return { status: null, schema: null };
};

const getOperationName = (operation) => {
  if (operation.operationId) return sanitizeIdentifier(toCamelCase(operation.operationId));
  return sanitizeIdentifier(toCamelCase(`${operation.method}_${operation.path}`));
};

const renderComponentTypes = (spec) => {
  const schemas = spec.components?.schemas ?? {};
  return Object.entries(schemas)
    .map(([name, schema]) => {
      const doc = makeDocComment(schema.description);
      const definition = `export type ${name} = ${schemaToTs(schema, spec)};`;
      return [doc, definition].filter(Boolean).join("\n");
    })
    .join("\n\n");
};

const renderOperationRequestType = (typeName, operation, spec) => {
  const pathParams = (operation.parameters ?? []).filter((parameter) => parameter.in === "path");
  const queryParams = (operation.parameters ?? []).filter((parameter) => parameter.in === "query");
  const bodySchema = getJsonBodySchema(operation.requestBody);

  const members = [];

  if (pathParams.length) {
    const pathFields = pathParams.map((parameter) => {
      const key = sanitizeIdentifier(parameter.name);
      const type = schemaToTs(parameter.schema, spec);
      const optional = parameter.required ? "" : "?";
      const doc = makeDocComment(parameter.description);
      return [doc, `${key}${optional}: ${type};`].filter(Boolean).join("\n");
    });
    members.push(`path: {\n${indent(pathFields.join("\n"))}\n};`);
  }

  if (queryParams.length) {
    const queryFields = queryParams.map((parameter) => {
      const key = sanitizeIdentifier(parameter.name);
      const type = schemaToTs(parameter.schema, spec);
      const optional = parameter.required ? "" : "?";
      const doc = makeDocComment(parameter.description);
      return [doc, `${key}${optional}: ${type};`].filter(Boolean).join("\n");
    });
    members.push(`query${queryParams.some((parameter) => parameter.required) ? "" : "?"}: {\n${indent(queryFields.join("\n"))}\n};`);
  }

  if (bodySchema) {
    members.push(`body${operation.requestBody?.required ? "" : "?"}: ${schemaToTs(bodySchema, spec)};`);
  }

  members.push("signal?: AbortSignal;");
  members.push("headers?: Record<string, string>;");

  return `export type ${typeName} = {\n${indent(members.join("\n"))}\n};`;
};

const renderPathTemplate = (rawPath) =>
  "`" +
  rawPath.replace(/{([^}]+)}/g, (_, name) => `\${encodePathSegment(params.path.${sanitizeIdentifier(name)})}`) +
  "`";

const renderOperationFunction = (operationName, requestTypeName, responseType, operation) => {
  const hasRequiredInput =
    (operation.parameters ?? []).some((parameter) => parameter.required) ||
    Boolean(operation.requestBody?.required);
  const hasAnyInput =
    Boolean((operation.parameters ?? []).length) || Boolean(operation.requestBody);

  const signature = hasAnyInput
    ? `${operationName}(params${hasRequiredInput ? "" : "?"}: ${requestTypeName})`
    : `${operationName}(params?: ${requestTypeName})`;

  const requestBody = getJsonBodySchema(operation.requestBody);
  const configAssignments = [];

  if ((operation.parameters ?? []).some((parameter) => parameter.in === "query")) {
    configAssignments.push("query: params?.query");
  }
  if (requestBody) {
    configAssignments.push("body: params?.body");
  }
  configAssignments.push("signal: params?.signal");
  configAssignments.push("headers: params?.headers");

  const pathValue =
    (operation.parameters ?? []).some((parameter) => parameter.in === "path")
      ? renderPathTemplate(operation.path)
      : JSON.stringify(operation.path);

  const docLines = unique([operation.summary, operation.description].filter(Boolean)).join("\n");
  const doc = makeDocComment(docLines);

  return [
    doc,
    `export async function ${signature}: Promise<${responseType}> {`,
    indent(
      `return request<${responseType}, ${requestBody ? schemaToTs(requestBody, null) : "unknown"}>(${JSON.stringify(
        operation.method.toUpperCase(),
      )}, ${pathValue}, buildRequestConfig({\n${indent(configAssignments.join(",\n"))}\n}));`,
    ),
    "}",
  ]
    .filter(Boolean)
    .join("\n");
};

const renderOperations = (spec) => {
  const operations = [];

  for (const [rawPath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const operationInfo = { ...operation, method, path: rawPath };
      const operationName = getOperationName(operationInfo);
      const requestTypeName = `${toPascalCase(operationName)}Request`;
      const response = getJsonResponseSchema(operation.responses);
      const responseType =
        response.status === 204 ? "void" : response.schema ? schemaToTs(response.schema, spec) : "unknown";

      operations.push(renderOperationRequestType(requestTypeName, operationInfo, spec));
      operations.push(renderOperationFunction(operationName, requestTypeName, responseType, operationInfo));
    }
  }

  return operations.join("\n\n");
};

const renderOperationMap = (spec) => {
  const entries = [];
  for (const [rawPath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const operationInfo = { ...operation, method, path: rawPath };
      const operationName = getOperationName(operationInfo);
      entries.push(`${JSON.stringify(operationName)}: ${operationName},`);
    }
  }

  return `export const openApiClient = {\n${indent(entries.join("\n"))}\n} as const;`;
};

const main = async () => {
  const spec = JSON.parse(await fs.readFile(SPEC_PATH, "utf8"));
  const componentTypes = renderComponentTypes(spec);
  const operations = renderOperations(spec);
  const operationMap = renderOperationMap(spec);

  const file = `/* eslint-disable */
/**
 * Generated from server/openapi.json.
 * Do not edit manually. Regenerate with: npm run generate:api
 *
 * Note:
 * The current OpenAPI spec contains request DTO schemas, but most responses are not typed.
 * Those endpoints are therefore generated with Promise<unknown> response types.
 */

import { request } from "@/lib/http/client";

const encodePathSegment = (value: string | number | boolean): string =>
  encodeURIComponent(String(value));

const buildRequestConfig = <TBody>(
  config: {
    query?: Record<string, unknown> | undefined;
    body?: TBody | undefined;
    signal?: AbortSignal | undefined;
    headers?: Record<string, string> | undefined;
  },
): {
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  signal?: AbortSignal;
  headers?: Record<string, string>;
} => {
  const next: {
    query?: Record<string, string | number | boolean | undefined>;
    body?: TBody;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {};

  if (config.query !== undefined) {
    const normalizedQuery: Record<string, string | number | boolean | undefined> = {};
    for (const [key, value] of Object.entries(config.query)) {
      if (value === undefined) {
        normalizedQuery[key] = undefined;
        continue;
      }
      if (Array.isArray(value)) {
        normalizedQuery[key] = value.join(",");
        continue;
      }
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        normalizedQuery[key] = value;
        continue;
      }
      normalizedQuery[key] = JSON.stringify(value);
    }
    next.query = normalizedQuery;
  }
  if (config.body !== undefined) next.body = config.body;
  if (config.signal !== undefined) next.signal = config.signal;
  if (config.headers !== undefined) next.headers = config.headers;

  return next;
};

${componentTypes}

${operations}

${operationMap}
`;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, file, "utf8");
  console.log(`Generated ${path.relative(ROOT, OUTPUT_PATH)}`);
};

await main();
