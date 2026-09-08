/**
 * AUTO-GENERATED — do not edit by hand.
 * Bundled from apps/compiler/src/modules/code-gen via apps/compiler/scripts/bundle-gen-types.mjs
 * Regenerate: pnpm --filter @blockscom/compiler run bundle:gen-types
 */

// src/modules/code-gen/schema-based-types-generator.ts
var SchemaBasedTypesGenerator = class _SchemaBasedTypesGenerator {
  constructor(options) {
    this.generatedTypes = /* @__PURE__ */ new Map();
    this.visitedRefs = /* @__PURE__ */ new Set();
    this.options = options;
    this.mainTypeName = "";
  }
  static convert(schema, options = { skipReadOnlyProps: false }) {
    return new _SchemaBasedTypesGenerator(options).convertSchema(schema);
  }
  static formatTypeName(name) {
    return new _SchemaBasedTypesGenerator({}).formatTypeName(name);
  }
  /**
   * The name under which `convert` declares a schema's main type.
   * Object-shaped schemas become `export interface I<Name>`; arrays, enums,
   * unions, and primitives become `export type <Name>` (no `I` prefix).
   * Schemas whose root `processType` declares nothing — a `$ref` root (only
   * the definitions are emitted), `type: 'null'`, or an array with
   * tuple/boolean `items` — resolve to `any`. References emitted elsewhere
   * must use this, or they point at a name that was never declared.
   */
  static declaredTypeName(schema) {
    return _SchemaBasedTypesGenerator.referenceNameFor(
      _SchemaBasedTypesGenerator.formatTypeName(schema.title || "Root"),
      schema
    );
  }
  /**
   * The reference matching what `processType` declares for `schema` under the
   * (already formatted) `name`: `I<name>` for object shapes, `name` for the
   * alias forms, `any` where `processType` declares nothing.
   */
  static referenceNameFor(name, schema) {
    if (schema.$ref || schema.type === "null") {
      return "any";
    }
    if (_SchemaBasedTypesGenerator.isObjectShaped(schema)) {
      return `I${name}`;
    }
    if (schema.type === "array" && schema.items && (typeof schema.items === "boolean" || Array.isArray(schema.items))) {
      return "any";
    }
    return name;
  }
  /** The dispatch test for `processObjectType` — single source, shared with `processType`. */
  static isObjectShaped(schema) {
    return schema.type === "object" || schema.properties !== void 0 && Object.keys(schema.properties).length > 0;
  }
  convertSchema(schema) {
    this.visitedRefs = /* @__PURE__ */ new Set();
    this.generatedTypes.clear();
    this.rootDefinitions = schema.definitions;
    if (schema.definitions) {
      for (const [name, definition] of Object.entries(schema.definitions)) {
        this.processDefinition(name, definition);
      }
    }
    const mainTypeName = schema.title || "Root";
    this.mainTypeName = this.formatTypeName(mainTypeName);
    this.processType(this.mainTypeName, schema);
    let output = "";
    for (const [, code] of this.generatedTypes) {
      output += `${code}

`;
    }
    return output;
  }
  processDefinition(name, definition) {
    if (typeof definition === "boolean" || Array.isArray(definition)) {
      return;
    }
    this.processType(name, definition);
  }
  processType(name, schema) {
    if (schema.$ref) {
      const refName = this.getRefName(schema.$ref);
      if (!this.visitedRefs.has(refName)) {
        this.visitedRefs.add(refName);
      }
      return;
    }
    if (schema.type === "null") {
      return;
    }
    const typeName = this.formatTypeName(name);
    if (_SchemaBasedTypesGenerator.isObjectShaped(schema)) {
      this.processObjectType(typeName, schema);
    } else if (schema.type === "array" && schema.items) {
      this.processArrayType(typeName, schema);
    } else if (schema.enum && schema.enum.length > 0) {
      this.processEnumType(typeName, schema);
    } else if (schema.oneOf || schema.anyOf || schema.allOf) {
      this.processCompositeType(typeName, schema);
    } else {
      this.generateSimpleType(typeName, schema);
    }
  }
  processObjectType(name, schema) {
    if (this.generatedTypes.has(name)) {
      return;
    }
    let typeCode = `
/**
* ${schema.description}
*/
export interface I${name} {
`;
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (typeof propSchema === "boolean" || Array.isArray(propSchema)) {
          continue;
        }
        if (propSchema.readOnly && this.options.skipReadOnlyProps) {
          continue;
        }
        const propType = this.getTypeForProperty(propName, propSchema);
        if (propType === "null") {
          continue;
        }
        const isRequired = schema.required?.includes(propName) ?? false;
        const optionalMark = isRequired ? "" : "?";
        const textPropName = propName || propSchema.title;
        if (textPropName?.includes(".")) {
          this.options.onWarn?.(
            `Property name ${textPropName} contains a dot, which is not allowed. skipping...`
          );
          continue;
        }
        let propDefault;
        if (propSchema.default) {
          if (typeof propSchema.default === "string") {
            propDefault = `(default: "${propSchema.default}")`;
          } else {
            propDefault = `(default: ${propSchema.default})`;
          }
        }
        if (propSchema.description || propDefault) {
          typeCode += `  /** ${propSchema.description || ""} ${propDefault || ""} */
`;
        }
        if (textPropName?.startsWith("@")) {
          typeCode += `  "${textPropName}"${optionalMark}: ${propType};
`;
        } else {
          typeCode += `  ${textPropName}${optionalMark}: ${propType};
`;
        }
      }
    }
    typeCode += "}\n";
    this.generatedTypes.set(name, typeCode);
  }
  processArrayType(name, schema) {
    if (this.generatedTypes.has(name)) {
      return;
    }
    const itemsSchema = schema.items;
    if (!itemsSchema || typeof itemsSchema === "boolean" || Array.isArray(itemsSchema)) {
      return;
    }
    const itemType = this.getTypeForProperty(`${name}Item`, itemsSchema);
    const typeCode = `export type ${name} = ${itemType}[];`;
    this.generatedTypes.set(name, typeCode);
  }
  processEnumType(name, schema) {
    if (this.generatedTypes.has(name) || !schema.enum?.length) {
      return;
    }
    let typeCode;
    if (schema.enum.every((item) => typeof item === "string")) {
      typeCode = `export type ${name} = ${schema.enum.map((value) => JSON.stringify(value)).join(" | ")};`;
    } else {
      const unionValues = schema.enum.map((value) => {
        if (typeof value === "string") {
          return JSON.stringify(value);
        }
        if (value === null) {
          return "null";
        }
        return String(value);
      }).join(" | ");
      typeCode = `export type ${name} = ${unionValues};`;
    }
    this.generatedTypes.set(name, typeCode);
  }
  processCompositeType(name, schema) {
    if (this.generatedTypes.has(name)) {
      return;
    }
    let compositeSchema;
    let operator = "|";
    if (schema.oneOf) {
      compositeSchema = schema.oneOf.filter(
        (s) => typeof s !== "boolean" && !Array.isArray(s)
      );
    } else if (schema.anyOf) {
      compositeSchema = schema.anyOf.filter(
        (s) => typeof s !== "boolean" && !Array.isArray(s)
      );
    } else if (schema.allOf) {
      compositeSchema = schema.allOf.filter(
        (s) => typeof s !== "boolean" && !Array.isArray(s)
      );
      operator = "&";
    } else {
      return;
    }
    const typeNames = [];
    for (let i = 0; i < compositeSchema.length; i++) {
      const subSchema = compositeSchema[i];
      const subName = `${name}Item${i + 1}`;
      if (subSchema.$ref) {
        typeNames.push(this.refReferenceName(subSchema.$ref));
      } else if (subSchema.type === "null") {
        typeNames.push("null");
      } else {
        this.processType(subName, subSchema);
        typeNames.push(
          _SchemaBasedTypesGenerator.referenceNameFor(
            this.formatTypeName(subName),
            subSchema
          )
        );
      }
    }
    const typeCode = `export type ${name} = ${typeNames.join(` ${operator} `)};`;
    this.generatedTypes.set(name, typeCode);
  }
  generateSimpleType(name, schema) {
    if (this.generatedTypes.has(name)) {
      return;
    }
    let tsType;
    switch (schema.type) {
      case "string":
        tsType = "string";
        break;
      case "integer":
      case "number":
        tsType = "number";
        break;
      case "boolean":
        tsType = "boolean";
        break;
      case "null":
        tsType = "null";
        break;
      default:
        tsType = "any";
    }
    this.generatedTypes.set(name, `export type ${name} = ${tsType};`);
  }
  getTypeForProperty(name, schema) {
    if (!schema) {
      return "any";
    }
    if (schema.$ref) {
      return this.refReferenceName(schema.$ref);
    }
    if (name !== this.mainTypeName) {
      name = `${this.mainTypeName}${this.formatTypeName(name)}`;
    }
    if (schema.oneOf) {
      return schema.oneOf.filter(
        (s) => typeof s !== "boolean" && !Array.isArray(s)
      ).map((v) => this.getTypeForProperty(`${name}Item`, v)).join(" | ");
    }
    if (schema.anyOf) {
      return schema.anyOf.filter(
        (s) => typeof s !== "boolean" && !Array.isArray(s)
      ).map((v) => this.getTypeForProperty(`${name}Item`, v)).join(" | ");
    }
    if (schema.allOf) {
      return schema.allOf.filter(
        (s) => typeof s !== "boolean" && !Array.isArray(s)
      ).map((v) => this.getTypeForProperty(`${name}Item`, v)).join(" & ");
    }
    if (schema.enum?.length) {
      const subName = this.formatTypeName(`${name}Enum`);
      this.processEnumType(subName, schema);
      return subName;
    }
    if (schema.type === "array") {
      if (schema.items && typeof schema.items !== "boolean" && !Array.isArray(schema.items)) {
        return `${this.getTypeForProperty(`${name}Item`, schema.items)}[]`;
      }
      return "any[]";
    }
    if (schema.type === "object") {
      const subName = this.formatTypeName(`${name}Object`);
      this.processObjectType(subName, schema);
      return `I${subName}`;
    }
    switch (schema.type) {
      case "string":
        return "string";
      case "integer":
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      default:
        return "any";
    }
  }
  getRefName(ref) {
    const parts = ref.split("/");
    return this.formatTypeName(parts[parts.length - 1]);
  }
  /**
   * Reference for a `$ref`: definitions are declared by `convertSchema` under
   * their own name with the same object-shaped `I` prefix rule, so the bare
   * ref name is dangling for object definitions. Unresolvable refs get `any` —
   * nothing is declared for them.
   */
  refReferenceName(ref) {
    const rawName = ref.split("/").pop() ?? "";
    const definition = this.rootDefinitions?.[rawName];
    if (!definition || typeof definition === "boolean" || Array.isArray(definition)) {
      return "any";
    }
    return _SchemaBasedTypesGenerator.referenceNameFor(
      this.formatTypeName(rawName),
      definition
    );
  }
  formatTypeName(name) {
    return name.replace(/[^\w\s-]/g, "").split(/[-\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  }
};

// src/modules/code-gen/artifact-reserved-columns.ts
var RESERVED_ARTIFACT_COLUMN_NAMES = [
  "id",
  "userId",
  "accountId",
  "appId",
  "tableId",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "updatedByAgentId",
  "deletedAt",
  "deletedBy",
  "isDeleted",
  "metadata",
  "tenantId"
];
function normalizeColumnName(name) {
  return name.toLowerCase().replaceAll("_", "").replace("-", "");
}
var RESERVED_COLUMN_NAME_SET = new Set(
  RESERVED_ARTIFACT_COLUMN_NAMES.map(normalizeColumnName)
);
function isReservedArtifactColumnName(name) {
  return RESERVED_COLUMN_NAME_SET.has(normalizeColumnName(name));
}

// src/modules/code-gen/artifact-to-describe-core.ts
import fs from "fs/promises";
import path from "path";

// src/modules/code-gen/codegen-constants.ts
var ARTIFACTS_DIR_NAME = "artifacts";
var ARTIFACT_SUBDIRS = {
  tables: "tables",
  actions: "actions",
  workflows: "workflows",
  views: "views",
  roles: "roles",
  agents: "agents",
  agentChats: "agent-chats",
  skills: "skills"
};
var APP_FILENAME = "app.json";
var SRC_DIR_NAME = "src";
var PAGES_DIR_NAME = "pages";
var PAGE_FILE_EXTENSION = ".tsx";
var ARTIFACT_PLACEHOLDER_PREFIX = "artifact:";
var CHAT_COMPONENTS_DIR_NAME = "chat-components";
var CHAT_COMPONENT_META_FILENAME = "meta.json";
var PAGE_CONST_PATTERN = /export const (\w+Page)\s*=\s*(?:\{[\s\S]*?\}\s*as const|"[^"]*");/g;

// src/modules/code-gen/artifact-to-describe-core.ts
function artifactActionPlaceholderId(name) {
  return `${ARTIFACT_PLACEHOLDER_PREFIX}action:${name.replace(/\s+/g, "")}`;
}
function columnTypeToJsonSchema(col) {
  const desc = col.description ?? "";
  const base = { description: desc };
  let schema;
  switch (col.type) {
    case "string": {
      const enumValues = col.enum ?? [];
      schema = {
        type: "string",
        enum: enumValues.length ? enumValues : void 0,
        ...base
      };
      break;
    }
    case "number":
      schema = { type: "number", ...base };
      break;
    case "boolean":
      schema = { type: "boolean", ...base };
      break;
    // JSON Schema has no temporal types: the column type survives only in
    // `format`, so emit the exact one (matches data-service's describe —
    // getSchemaForColumn — and the seed-artifacts reverse mapping).
    case "date":
      schema = { type: "string", format: "date", ...base };
      break;
    case "time":
      schema = { type: "string", format: "time", ...base };
      break;
    case "datetime":
      schema = { type: "string", format: "date-time", ...base };
      break;
    case "object":
      schema = col.schema ? { ...col.schema, ...base } : { type: "object", additionalProperties: true, ...base };
      break;
    default:
      schema = { type: "string", ...base };
  }
  if (isReservedArtifactColumnName(col.name)) {
    schema.readOnly = true;
  }
  return schema;
}
function artifactTableToTableDescribe(table) {
  const title = table.name.replace(/\s+/g, "");
  const properties = {};
  for (const col of table.columns) {
    properties[col.name] = columnTypeToJsonSchema(col);
  }
  return {
    schema: {
      $id: `${ARTIFACT_PLACEHOLDER_PREFIX}table:${title}`,
      title,
      description: table.description,
      type: "object",
      properties,
      ...table.legacyName ? { legacyName: table.legacyName } : {}
    }
  };
}
function resolveActionInputSchema(action) {
  if (action.inputSchema) {
    return action.inputSchema;
  }
  return { type: "object", properties: {} };
}
function resolveActionOutputSchema(action) {
  if (action.type === "code" && action.outputSchema) {
    return action.outputSchema;
  }
  if (action.output && typeof action.output === "object" && "type" in action.output) {
    return action.output;
  }
  return { type: "object", properties: {} };
}
function artifactActionToActionDescribe(action) {
  const name = action.name.replace(/\s+/g, "");
  const entry = {
    actionTypeId: artifactActionPlaceholderId(action.name),
    actionTypeName: name,
    actionTypeDescription: action.description ?? name,
    actionSetId: "app",
    isCurrentAppAction: true,
    input: resolveActionInputSchema(action),
    output: resolveActionOutputSchema(action)
  };
  if (action.type === "dag") {
    entry.actionNodes = action.actionNodes ?? [];
    entry.conditionNodes = action.conditionNodes;
    entry.mergeNodes = action.mergeNodes;
    entry.edges = action.edges;
    if (typeof action.output === "string") {
      entry.outputNode = action.output;
    }
  }
  return entry;
}
function artifactViewToViewDescribe(view) {
  const title = view.name.replace(/\s+/g, "");
  const properties = {};
  for (const col of view.calculatedColumns) {
    const schema = col.type === "string" ? { type: "string", description: col.description } : col.type === "number" ? { type: "number", description: col.description } : col.type === "boolean" ? { type: "boolean", description: col.description } : col.type === "date" || col.type === "time" || col.type === "datetime" ? {
      type: "string",
      format: "date-time",
      description: col.description
    } : { type: "string", description: col.description };
    if (isReservedArtifactColumnName(col.name)) {
      schema.readOnly = true;
    }
    properties[col.name] = schema;
  }
  return {
    schema: {
      $id: `${ARTIFACT_PLACEHOLDER_PREFIX}view:${title}`,
      title,
      type: "object",
      properties,
      ...view.legacyName ? { legacyName: view.legacyName } : {}
    }
  };
}
function normalizeAgentRef(value) {
  return value.replace(/\s+/g, "").toLowerCase();
}
function artifactAgentPlaceholderId(key) {
  return `${ARTIFACT_PLACEHOLDER_PREFIX}agent:${key}`;
}
function artifactAgentChatPlaceholderId(key) {
  return `${ARTIFACT_PLACEHOLDER_PREFIX}agentChat:${key}`;
}
function artifactAgentToAgentDescribe(key, agent) {
  return {
    agentId: artifactAgentPlaceholderId(key),
    agentName: agent.name,
    title: agent.title,
    jobTitle: agent.jobTitle ?? "",
    harness: "deep_agent",
    instructions: agent.instructions ?? "",
    memoryEnabled: agent.memoryEnabled,
    photoUrl: agent.photoUrl,
    avatarUrl: agent.avatarUrl,
    tools: (agent.tools ?? []).map((tool) => ({
      actionTypeId: tool.actionTypeId
    }))
  };
}
function resolveAgentIdForArtifactChat(chat, manifest) {
  const agents = manifest.agents ?? {};
  if (chat.agentId) {
    if (chat.agentId.startsWith(ARTIFACT_PLACEHOLDER_PREFIX)) {
      return chat.agentId;
    }
    if (agents[chat.agentId]) {
      return artifactAgentPlaceholderId(chat.agentId);
    }
    const byName = Object.entries(agents).find(
      ([, agent]) => normalizeAgentRef(agent.name) === normalizeAgentRef(chat.agentId)
    );
    if (byName) {
      return artifactAgentPlaceholderId(byName[0]);
    }
    return chat.agentId;
  }
  const entries = Object.entries(agents);
  if (entries.length === 1) {
    return artifactAgentPlaceholderId(entries[0][0]);
  }
  return void 0;
}
function artifactAgentChatToAgentChatDescribe(key, chat, manifest) {
  return {
    agentChatId: artifactAgentChatPlaceholderId(key),
    agentChatName: chat.name,
    agentId: resolveAgentIdForArtifactChat(chat, manifest)
  };
}
function buildDescribeFromArtifacts(manifest) {
  const tables = {};
  for (const [key, table] of Object.entries(manifest.tables ?? {})) {
    tables[key] = artifactTableToTableDescribe(table);
  }
  const views = {};
  for (const [key, view] of Object.entries(manifest.views ?? {})) {
    views[key] = artifactViewToViewDescribe(view);
  }
  const actions = {};
  for (const [key, action] of Object.entries(manifest.actions ?? {})) {
    actions[key] = artifactActionToActionDescribe(action);
  }
  const agents = {};
  for (const [key, agent] of Object.entries(manifest.agents ?? {})) {
    agents[key] = artifactAgentToAgentDescribe(key, agent);
  }
  const agentChats = {};
  for (const [key, chat] of Object.entries(manifest.agentChats ?? {})) {
    agentChats[key] = artifactAgentChatToAgentChatDescribe(key, chat, manifest);
  }
  return { tables, views, actions, agents, agentChats };
}
async function readChatComponentsFromDirectory(projectRoot) {
  const chatComponentsDir = path.join(projectRoot, CHAT_COMPONENTS_DIR_NAME);
  let entries;
  try {
    entries = await fs.readdir(chatComponentsDir, { withFileTypes: true });
  } catch {
    return {};
  }
  const chatComponents = {};
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const metaPath = path.join(
      chatComponentsDir,
      entry.name,
      CHAT_COMPONENT_META_FILENAME
    );
    let name = entry.name;
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
      if (typeof meta.name === "string" && meta.name.trim()) {
        name = meta.name.trim();
      }
    } catch {
    }
    chatComponents[name] = {
      chatComponentId: `${ARTIFACT_PLACEHOLDER_PREFIX}chatComponent:${name.replace(/\s+/g, "")}`
      // resolved to real block ids post-sync
    };
  }
  return chatComponents;
}
async function readPagesFromDirectory(projectRoot) {
  const pagesDir = path.join(projectRoot, SRC_DIR_NAME, PAGES_DIR_NAME);
  const walk = async (dir) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const files2 = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files2.push(...await walk(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(PAGE_FILE_EXTENSION)) {
        files2.push(fullPath);
      }
    }
    return files2;
  };
  const files = (await walk(pagesDir)).sort();
  const pages = {};
  for (const file of files) {
    const relFromPages = path.relative(pagesDir, file).split(path.sep).join("/").replace(/\.tsx$/, "");
    pages[relFromPages] = { id: relFromPages, name: relFromPages };
  }
  return pages;
}
async function readArtifactsFromDirectory(compilerDir) {
  const artifactsDir = path.join(compilerDir, ARTIFACTS_DIR_NAME);
  const manifest = {};
  try {
    await fs.access(artifactsDir);
  } catch {
    return manifest;
  }
  const readJsonDir = async (subdir) => {
    const dir = path.join(artifactsDir, subdir);
    try {
      await fs.access(dir);
    } catch {
      return {};
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out = {};
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) {
        continue;
      }
      const key = e.name.slice(0, -5);
      const content = await fs.readFile(path.join(dir, e.name), "utf-8");
      try {
        out[key] = JSON.parse(content);
      } catch (err) {
        console.warn(
          `Skipping invalid artifact JSON in ${subdir}/${e.name}: ${err.message}`
        );
      }
    }
    return out;
  };
  manifest.tables = await readJsonDir(ARTIFACT_SUBDIRS.tables);
  manifest.actions = await readJsonDir(
    ARTIFACT_SUBDIRS.actions
  );
  manifest.workflows = await readJsonDir(ARTIFACT_SUBDIRS.workflows);
  manifest.views = await readJsonDir(ARTIFACT_SUBDIRS.views);
  manifest.roles = await readJsonDir(ARTIFACT_SUBDIRS.roles);
  manifest.agents = await readJsonDir(ARTIFACT_SUBDIRS.agents);
  manifest.agentChats = await readJsonDir(
    ARTIFACT_SUBDIRS.agentChats
  );
  manifest.skills = await readJsonDir(ARTIFACT_SUBDIRS.skills);
  const appPath = path.join(artifactsDir, APP_FILENAME);
  try {
    manifest.app = JSON.parse(await fs.readFile(appPath, "utf-8"));
  } catch {
  }
  return manifest;
}

// src/modules/code-gen/generate-product-types.ts
import fs2 from "fs/promises";
import path2 from "path";
var GENERATED_EXPORT_PATTERN = /^export (interface|type|const) ([A-Za-z_][\w]*)/gm;
function aliasGeneratedExportName(name, actualEntity, legacyEntity) {
  const actualInterface = `I${actualEntity}`;
  const legacyInterface = `I${legacyEntity}`;
  if (name === actualEntity) {
    return legacyEntity;
  }
  if (name === actualInterface) {
    return legacyInterface;
  }
  if (name.startsWith(actualInterface)) {
    return `${legacyInterface}${name.slice(actualInterface.length)}`;
  }
  if (name.startsWith(actualEntity)) {
    return `${legacyEntity}${name.slice(actualEntity.length)}`;
  }
  return void 0;
}
function collectExportNames(code) {
  const names = /* @__PURE__ */ new Set();
  const pattern = new RegExp(GENERATED_EXPORT_PATTERN.source, "gm");
  let match;
  while ((match = pattern.exec(code)) !== null) {
    names.add(match[2]);
  }
  return names;
}
function emitLegacyTypeAliases(code, actualEntity, legacyName, reserved) {
  const legacyEntity = SchemaBasedTypesGenerator.formatTypeName(
    `${legacyName}Entity`
  );
  if (!legacyEntity || legacyEntity === actualEntity) {
    return "";
  }
  const aliases = [];
  const pattern = new RegExp(GENERATED_EXPORT_PATTERN.source, "gm");
  let match;
  while ((match = pattern.exec(code)) !== null) {
    const kind = match[1];
    const name = match[2];
    const aliased = aliasGeneratedExportName(name, actualEntity, legacyEntity);
    if (!aliased || aliased === name || reserved.has(aliased)) {
      continue;
    }
    reserved.add(aliased);
    if (kind === "const") {
      aliases.push(`export const ${aliased} = ${name};`);
    } else {
      aliases.push(`export type ${aliased} = ${name};`);
    }
  }
  return aliases.length ? `
${aliases.join("\n")}
` : "";
}
function extractPageConstBlocks(source) {
  if (!source) {
    return [];
  }
  const blocks = [];
  const pattern = new RegExp(PAGE_CONST_PATTERN.source, "g");
  let match;
  while ((match = pattern.exec(source)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}
function generateCodeFromDescribe(appDescribe, options = {}) {
  const types = [];
  const tableDescribes = Object.values(appDescribe.tables || {});
  const viewDescribes = Object.values(appDescribe.views || {});
  const schemas = [...tableDescribes, ...viewDescribes].map(
    (describe) => describe.schema
  );
  const legacyAliasRequests = [];
  for (const tableDescribe of schemas) {
    if (!tableDescribe.title) {
      continue;
    }
    const tableBlockId = tableDescribe.title;
    const legacyName = tableDescribe.legacyName;
    tableDescribe.title = `${tableDescribe.title}Entity`;
    let code = SchemaBasedTypesGenerator.convert(tableDescribe, {
      skipReadOnlyProps: true
    });
    const instanceTypeName = SchemaBasedTypesGenerator.formatTypeName(
      tableDescribe.title
    );
    code += `
export const ${instanceTypeName} = {
    tableBlockId: "${tableBlockId}",
    instanceType: {} as ${SchemaBasedTypesGenerator.declaredTypeName(tableDescribe)}
} as const;
`;
    types.push(code);
    if (legacyName) {
      legacyAliasRequests.push({ code, instanceTypeName, legacyName });
    }
  }
  if (options.pageConstBlocks?.length) {
    for (const pageConst of options.pageConstBlocks) {
      types.push(`
${pageConst}
`);
    }
  } else {
    for (const key of Object.keys(appDescribe.pages || {})) {
      const pageConstName = SchemaBasedTypesGenerator.formatTypeName(
        `${key}Page`
      );
      types.push(`export const ${pageConstName} = ${JSON.stringify(key)};
`);
    }
  }
  const actionsDescribes = Object.values(appDescribe.actions || {});
  for (const actionDescribe of actionsDescribes) {
    if (!actionDescribe.actionTypeName) {
      continue;
    }
    const actionTypeName = actionDescribe.actionTypeName;
    actionDescribe.actionTypeName = `${actionDescribe.actionTypeName}Action`;
    const wfInputDesc = actionDescribe.input || {
      type: "object",
      properties: {}
    };
    const wfOutputDesc = actionDescribe.output || {
      type: "object",
      properties: {}
    };
    wfInputDesc.title = `${actionDescribe.actionTypeName}Input`;
    types.push(SchemaBasedTypesGenerator.convert(wfInputDesc));
    wfOutputDesc.title = `${actionDescribe.actionTypeName}Output`;
    types.push(SchemaBasedTypesGenerator.convert(wfOutputDesc));
    const inputType = SchemaBasedTypesGenerator.declaredTypeName(wfInputDesc);
    let outputType = SchemaBasedTypesGenerator.declaredTypeName(wfOutputDesc);
    if (wfOutputDesc.type == "object" && (!wfOutputDesc.properties || Object.keys(wfOutputDesc.properties).length == 0)) {
      outputType = "any";
    }
    const actionBlockId = actionTypeName.replace(/\s+/g, "");
    const toolSetId = actionDescribe.actionTypeId.split("&")[1] || void 0;
    const toolId = actionDescribe.actionTypeId.split("&")[2] || void 0;
    types.push(`
/**
* ${actionDescribe.actionTypeName}
* ${actionDescribe.actionTypeDescription}
*/
export const ${SchemaBasedTypesGenerator.formatTypeName(actionDescribe.actionTypeName)} = {
  actionBlockId: "${actionBlockId}",
  ${toolSetId ? `toolSetId: "${toolSetId}",` : ""}
  ${toolId ? `toolId: "${toolId}",` : ""}
  inputInstanceType: {} as ${inputType},
  outputInstanceType: {} as ${outputType},
} as const;
`);
  }
  const agentDescribes = Object.entries(appDescribe.agents || {});
  const agentIdsToAgentDescribes = /* @__PURE__ */ new Map();
  for (const [key, agentDescribe] of agentDescribes) {
    agentIdsToAgentDescribes.set(agentDescribe.agentId, agentDescribe);
    const title = `${key}Agent`;
    const agentBlockId = agentDescribe.agentName;
    const agentConstName = SchemaBasedTypesGenerator.formatTypeName(title);
    types.push(`
export const ${agentConstName} = {
        id: "${agentBlockId}",
        name: ${JSON.stringify(agentDescribe.agentName)},
        title: ${agentDescribe.title ? JSON.stringify(agentDescribe.title) : "undefined"},
        jobTitle: ${JSON.stringify(agentDescribe.jobTitle)},
        photoUrl: ${agentDescribe.photoUrl ? JSON.stringify(agentDescribe.photoUrl) : "undefined"},
        avatarUrl: ${agentDescribe.avatarUrl ? JSON.stringify(agentDescribe.avatarUrl) : "undefined"},
      } as const;
`);
  }
  const agentChatDescribes = Object.entries(appDescribe.agentChats || {});
  const componentIds = Object.values(appDescribe.chatComponents || {}).map(
    (component) => component.chatComponentId
  );
  for (const [key, agentChatDescribe] of agentChatDescribes) {
    if (!agentChatDescribe.agentId) {
      continue;
    }
    const agentHarness = agentIdsToAgentDescribes.get(
      agentChatDescribe.agentId
    )?.harness;
    const agentName = Object.values(appDescribe.agents || {}).find(
      (agent) => agent.agentName === agentChatDescribe.agentId || agent.agentId === agentChatDescribe.agentId
    )?.agentName;
    const title = `${key}AgentChat`;
    const agentChatBlockId = agentChatDescribe.agentChatName;
    const agentBlockId = agentName;
    types.push(`
export const ${SchemaBasedTypesGenerator.formatTypeName(title)} = {
        agentChatId: "${agentChatBlockId}",
        agentId: ${agentBlockId ? `"${agentBlockId}"` : "undefined"},
        agentHarness: ${agentHarness ? `"${agentHarness}"` : "undefined"},
        componentIds: ${JSON.stringify(componentIds)},
      } as const;
`);
  }
  if (legacyAliasRequests.length) {
    const reserved = collectExportNames(types.join("\n"));
    for (const request of legacyAliasRequests) {
      const aliases = emitLegacyTypeAliases(
        request.code,
        request.instanceTypeName,
        request.legacyName,
        reserved
      );
      if (aliases) {
        types.push(aliases);
      }
    }
  }
  const allCode = types.join("\n");
  return allCode.replace(
    /(\s*)([0-9][a-zA-Z0-9]*[x×][0-9]+)(\s*):/g,
    '$1"$2"$3:'
  );
}
async function generateProductTypes(projectRoot, options = {}) {
  const productTypesPath = options.productTypesPath ?? path2.join(projectRoot, "src", "product-types.ts");
  const pages = await readPagesFromDirectory(projectRoot);
  const hasPagesFromDisk = Object.keys(pages).length > 0;
  let pageConstBlocks = [];
  if (!hasPagesFromDisk && !options.skipPagePreservation) {
    try {
      const existing = await fs2.readFile(productTypesPath, "utf-8");
      pageConstBlocks = extractPageConstBlocks(existing);
    } catch {
    }
  }
  const manifest = await readArtifactsFromDirectory(projectRoot);
  const describe = buildDescribeFromArtifacts(manifest);
  describe.pages = pages;
  describe.chatComponents = await readChatComponentsFromDirectory(projectRoot);
  const code = generateCodeFromDescribe(describe, { pageConstBlocks });
  if (options.write !== false) {
    await fs2.mkdir(path2.dirname(productTypesPath), { recursive: true });
    await fs2.writeFile(productTypesPath, code, "utf-8");
  }
  return {
    code,
    manifest,
    describe,
    pageConstBlocks,
    counts: {
      tables: Object.keys(describe.tables ?? {}).length,
      views: Object.keys(describe.views ?? {}).length,
      actions: Object.keys(describe.actions ?? {}).length,
      agents: Object.keys(describe.agents ?? {}).length,
      agentChats: Object.keys(describe.agentChats ?? {}).length,
      pages: hasPagesFromDisk ? Object.keys(pages).length : pageConstBlocks.length
    }
  };
}

// src/modules/code-gen/cli.ts
import path3 from "path";
import { fileURLToPath, pathToFileURL } from "url";
async function runCli(projectRoot) {
  const { counts } = await generateProductTypes(projectRoot);
  console.log(
    `Regenerated src/product-types.ts (tables: ${counts.tables}, views: ${counts.views}, actions: ${counts.actions}, agents: ${counts.agents}, agentChats: ${counts.agentChats}, pages: ${counts.pages}).`
  );
}
var isMain = process.argv[1] && pathToFileURL(path3.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const projectRoot = process.argv[2] ? path3.resolve(process.argv[2]) : path3.join(path3.dirname(fileURLToPath(import.meta.url)), "..");
  runCli(projectRoot).catch((error) => {
    console.error(
      `Error generating product-types: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
export {
  ARTIFACTS_DIR_NAME,
  ARTIFACT_PLACEHOLDER_PREFIX,
  ARTIFACT_SUBDIRS,
  SchemaBasedTypesGenerator,
  artifactTableToTableDescribe,
  artifactViewToViewDescribe,
  buildDescribeFromArtifacts,
  extractPageConstBlocks,
  generateCodeFromDescribe,
  generateProductTypes,
  isReservedArtifactColumnName,
  readArtifactsFromDirectory,
  readChatComponentsFromDirectory,
  readPagesFromDirectory,
  runCli
};
