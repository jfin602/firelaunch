export function tvLayout(width, height) {
  const scale = Math.max(0.65, Math.min(1, height / 540));
  const horizontalInset = Math.max(28, Math.min(64, width * 0.045));
  const topInset = Math.max(12, Math.min(32, height * 0.035));
  const contentWidth = Math.max(320, width - horizontalInset * 2);
  const heroArtworkHeight = Math.min(height * 0.34, contentWidth * 0.58 * 9 / 16);
  const heroWidth = Math.min(contentWidth, heroArtworkHeight * 16 / 9 + 16 * scale);
  const cardArtworkHeight = Math.min(height * 0.17, contentWidth * 0.26 * 9 / 16);
  const cardWidth = Math.min(contentWidth, cardArtworkHeight * 16 / 9 + 16 * scale);
  return { scale, horizontalInset, topInset, heroArtworkHeight, heroWidth, cardWidth, cardArtworkHeight };
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
