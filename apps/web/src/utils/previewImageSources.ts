// Owns live-preview image source materialization for local Markdown files.
// The renderer only creates custom asset URLs; Electron enforces workspace access.

const LOCAL_ASSET_PROTOCOL_URL = "draftport-asset://local/";
const URI_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

/**
 * Converts rendered Markdown image tags that point to relative local files into
 * Electron asset URLs rooted at the current Markdown file's directory.
 */
export function materializePreviewImageSources(
  html: string,
  currentFilePath?: string | null,
  buildAssetUrl = buildPreviewAssetUrl,
): string {
  if (!currentFilePath || !html.includes("<img")) {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  template.content
    .querySelectorAll<HTMLImageElement>("img[src]")
    .forEach((image) => {
      const source = image.getAttribute("src");
      if (!source || shouldPreserveImageSource(source)) {
        return;
      }

      const resolvedPath = resolveImagePathFromMarkdownFile(
        currentFilePath,
        source,
      );
      image.setAttribute("src", buildAssetUrl(resolvedPath));
    });

  return template.innerHTML;
}

/**
 * Builds the custom protocol URL consumed by the desktop shell's workspace
 * asset handler.
 */
export function buildPreviewAssetUrl(filePath: string): string {
  return `${LOCAL_ASSET_PROTOCOL_URL}${encodeURIComponent(filePath)}`;
}

/** Returns true when a Markdown image source is already browser-resolvable. */
function shouldPreserveImageSource(source: string): boolean {
  const trimmed = source.trim();
  return (
    trimmed === "" ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    URI_SCHEME_PATTERN.test(trimmed)
  );
}

/** Resolves a relative Markdown image path without depending on Node path APIs. */
function resolveImagePathFromMarkdownFile(
  markdownFilePath: string,
  imageSource: string,
): string {
  const normalizedFilePath = markdownFilePath.replace(/\\/g, "/");
  const lastSlash = normalizedFilePath.lastIndexOf("/");
  const fileDirectory =
    lastSlash >= 0 ? normalizedFilePath.slice(0, lastSlash) : "";
  const decodedSource = decodeImageSourcePath(imageSource);

  return normalizeLocalPath(`${fileDirectory}/${decodedSource}`);
}

/** Decodes Markdown URL escaping while tolerating literal percent characters. */
function decodeImageSourcePath(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

/** Collapses dot segments for local absolute paths and Windows drive paths. */
function normalizeLocalPath(pathValue: string): string {
  const hasLeadingSlash = pathValue.startsWith("/");
  const segments = pathValue.split("/");
  const driveSegment =
    segments.length > 0 && /^[A-Za-z]:$/.test(segments[0])
      ? segments.shift()
      : undefined;
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  const body = normalized.join("/");

  if (driveSegment) {
    return body ? `${driveSegment}/${body}` : driveSegment;
  }
  return hasLeadingSlash ? `/${body}` : body;
}
