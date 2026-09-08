/**
 * THE SCRIPT LIBRARY BARREL.
 *
 * The page imports from here, never from a file inside — the card and the panel
 * share one kind/provenance vocabulary and it travels with them.
 */

export {
  FILE_EXTENSION,
  KIND_META,
  LANGUAGE_LABEL,
  SCRIPT_KINDS,
  SOURCE_KINDS,
  SOURCE_META,
  ScriptCard,
  bareName,
  relatedSurface,
  scriptFilename,
  scriptReference,
  sourceHref,
  type KindMeta,
  type RelatedSurface,
  type ScriptCardProps,
  type ScriptSourceKind,
  type SourceMeta,
} from "./ScriptCard";

export {
  SCRIPT_TABS,
  ScriptDetail,
  readScriptTab,
  type ScriptDetailProps,
  type ScriptTab,
} from "./ScriptDetail";
