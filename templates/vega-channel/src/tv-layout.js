export function tvLayout(width, height) {
  const scale = Math.max(0.65, Math.min(1, height / 540));
  const horizontalInset = Math.max(28, Math.min(64, width * 0.045));
  const topInset = Math.max(12, Math.min(32, height * 0.035));
  const contentWidth = Math.max(320, width - horizontalInset * 2);
  const heroArtworkHeight = Math.min(height * 0.24, contentWidth * 0.58 * 9 / 16);
  const heroWidth = Math.min(contentWidth, heroArtworkHeight * 16 / 9 + 16 * scale);
  const cardArtworkHeight = Math.min(height * 0.17, contentWidth * 0.26 * 9 / 16);
  const cardWidth = Math.min(contentWidth, cardArtworkHeight * 16 / 9 + 16 * scale);
  const headerHeight = 70 * scale;
  // One title line, card padding/art gap, one card title line, type and section margins.
  // Selector book art is contained inside the same bounded card-art frame.
  const selectorHeight = cardArtworkHeight + 80 * scale;
  const featureHeight = Math.max(160 * scale, Math.min(height * 0.52,
    height - topInset - headerHeight - selectorHeight - 32 * scale));
  return { scale, horizontalInset, topInset, contentWidth, heroArtworkHeight, heroWidth, cardWidth, cardArtworkHeight,
    headerHeight, selectorHeight, featureHeight };
}

export function featureArtworkFrame(layout, presentation) {
  const height = layout.featureHeight * 0.78;
  const ratio = presentation === 'information' ? 2 / 3 : presentation === 'audio' ? 1 : 16 / 9;
  const width = Math.min(height * ratio, layout.contentWidth * 0.42);
  return { width, height };
}

export function featureScrollTarget(layout, offset, viewportHeight, firstSelector) {
  return firstSelector ? 0 : scrollTarget(layout, offset, viewportHeight);
}

export function audioArtworkFrame(width, height, portrait) {
  const top = Math.max(50, Math.min(86, height * 0.16));
  const bottom = Math.max(70, Math.min(96, height * 0.18));
  const availableHeight = Math.max(0, height - top - bottom);
  const artworkHeight = Math.min(availableHeight * 0.78, height * 0.54,
    width * 0.55 * (portrait ? 1.5 : 1));
  return { top, bottom, width: portrait ? artworkHeight * 2 / 3 : artworkHeight,
    height: artworkHeight };
}

export function scrollTarget(layout, offset, viewportHeight) {
  if (!layout || viewportHeight <= 0) return offset;
  const margin = 12;
  if (layout.y < offset + margin) return Math.max(0, layout.y - margin);
  if (layout.height > viewportHeight - margin * 2) return Math.max(0, layout.y - margin);
  if (layout.y + layout.height > offset + viewportHeight - margin)
    return layout.y + layout.height - viewportHeight + margin;
  return offset;
}
