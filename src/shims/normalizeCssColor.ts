type ColorInput = string | number | null | undefined;

export default function normalizeCssColor(color: ColorInput): string | null {
  if (color == null) {
    return null;
  }

  if (typeof color === "number") {
    const channel = color >>> 0;
    const alpha = ((channel >>> 24) & 255) / 255;
    const red = (channel >> 16) & 255;
    const green = (channel >> 8) & 255;
    const blue = channel & 255;

    if (alpha === 1) {
      return `rgb(${red}, ${green}, ${blue})`;
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const value = color.trim();
  return value || null;
}
