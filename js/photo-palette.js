export const SAMPLE_CANVAS_SIZE = 32;

export const DEFAULT_LUMINOUS_PALETTE = Object.freeze({
  primary: '#f6b8d0',
  secondary: '#b8d8f8',
  tertiary: '#fbd3a7',
  quaternary: '#d5bdf8',
  accent: '#e86f9a'
});

export const PASTEL_BOUNDS = Object.freeze({
  ambientLightnessMin: 69,
  ambientLightnessMax: 83,
  ambientSaturationMin: 66,
  ambientSaturationMax: 89,
  accentLightnessMin: 49,
  accentLightnessMax: 57,
  accentSaturationMin: 66,
  accentSaturationMax: 89
});

export function clamp(numericValue, minBound, maxBound) {
  return Math.max(minBound, Math.min(maxBound, numericValue));
}

export function rgbToHsl(redChannel, greenChannel, blueChannel) {
  const normRed = redChannel / 255;
  const normGreen = greenChannel / 255;
  const normBlue = blueChannel / 255;
  const maxChannel = Math.max(normRed, normGreen, normBlue);
  const minChannel = Math.min(normRed, normGreen, normBlue);
  const deltaChannel = maxChannel - minChannel;

  let hue = 0;
  let saturation = 0;
  const lightness = (maxChannel + minChannel) / 2;

  if (deltaChannel !== 0) {
    saturation = deltaChannel / (1 - Math.abs(2 * lightness - 1));
    switch (maxChannel) {
      case normRed:
        hue = ((normGreen - normBlue) / deltaChannel) % 6;
        break;
      case normGreen:
        hue = (normBlue - normRed) / deltaChannel + 2;
        break;
      default:
        hue = (normRed - normGreen) / deltaChannel + 4;
        break;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  return {
    h: hue,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

export function hslToHex(hue, saturation, lightness) {
  const normHue = ((hue % 360) + 360) % 360;
  const normSat = Math.max(0, Math.min(100, saturation)) / 100;
  const normLight = Math.max(0, Math.min(100, lightness)) / 100;

  const chroma = (1 - Math.abs(2 * normLight - 1)) * normSat;
  const secondComponent = chroma * (1 - Math.abs(((normHue / 60) % 2) - 1));
  const matchLightness = normLight - chroma / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (normHue < 60) {
    rPrime = chroma; gPrime = secondComponent; bPrime = 0;
  } else if (normHue < 120) {
    rPrime = secondComponent; gPrime = chroma; bPrime = 0;
  } else if (normHue < 180) {
    rPrime = 0; gPrime = chroma; bPrime = secondComponent;
  } else if (normHue < 240) {
    rPrime = 0; gPrime = secondComponent; bPrime = chroma;
  } else if (normHue < 300) {
    rPrime = secondComponent; gPrime = 0; bPrime = chroma;
  } else {
    rPrime = chroma; gPrime = 0; bPrime = secondComponent;
  }

  const channelToHex = (colorVal) => Math.round((colorVal + matchLightness) * 255).toString(16).padStart(2, '0');
  return `#${channelToHex(rPrime)}${channelToHex(gPrime)}${channelToHex(bPrime)}`;
}

export function parseHexColor(hexColor) {
  if (typeof hexColor !== 'string') return null;
  const hexDigits = hexColor.trim().replace(/^#/, '');
  if (hexDigits.length === 3) {
    return {
      r: parseInt(hexDigits[0] + hexDigits[0], 16),
      g: parseInt(hexDigits[1] + hexDigits[1], 16),
      b: parseInt(hexDigits[2] + hexDigits[2], 16)
    };
  }
  if (hexDigits.length === 6) {
    return {
      r: parseInt(hexDigits.slice(0, 2), 16),
      g: parseInt(hexDigits.slice(2, 4), 16),
      b: parseInt(hexDigits.slice(4, 6), 16)
    };
  }
  return null;
}

export function clampHslForRole(hslColor, role = 'primary') {
  const isAccentRole = role === 'accent';
  const saturation = clamp(hslColor.s, PASTEL_BOUNDS.ambientSaturationMin, PASTEL_BOUNDS.ambientSaturationMax);
  const lightness = isAccentRole
    ? clamp(hslColor.l, PASTEL_BOUNDS.accentLightnessMin, PASTEL_BOUNDS.accentLightnessMax)
    : clamp(hslColor.l, PASTEL_BOUNDS.ambientLightnessMin, PASTEL_BOUNDS.ambientLightnessMax);
  return hslToHex(hslColor.h, saturation, lightness);
}

function circularHueBucketDistance(bucketIdxA, bucketIdxB) {
  const bucketDiff = Math.abs(bucketIdxA - bucketIdxB);
  return Math.min(bucketDiff, 12 - bucketDiff);
}

function bucketToAverageHsl(hueBucket) {
  return rgbToHsl(
    hueBucket.rSum / hueBucket.weightSum,
    hueBucket.gSum / hueBucket.weightSum,
    hueBucket.bSum / hueBucket.weightSum
  );
}

function expandHslListToFourRoles(seedHslList) {
  const expandedHslList = [...seedHslList];
  const harmonicHueOffsets = [28, -28, 52];
  const lightnessOffsets = [5, -5, 8];

  while (expandedHslList.length < 4) {
    const stepIdx = expandedHslList.length - 1;
    const baseHsl = seedHslList[expandedHslList.length % seedHslList.length];
    expandedHslList.push({
      h: ((baseHsl.h + harmonicHueOffsets[stepIdx % harmonicHueOffsets.length]) % 360 + 360) % 360,
      s: baseHsl.s,
      l: clamp(
        baseHsl.l + lightnessOffsets[stepIdx % lightnessOffsets.length],
        PASTEL_BOUNDS.ambientLightnessMin,
        PASTEL_BOUNDS.ambientLightnessMax
      )
    });
  }

  return expandedHslList;
}

function buildClampedPalette(seedHslList, accentHsl = null) {
  const [primaryHsl, secondaryHsl, tertiaryHsl, quaternaryHsl] = expandHslListToFourRoles(seedHslList);
  const resolvedAccentHsl = accentHsl || {
    h: primaryHsl.h,
    s: Math.max(primaryHsl.s, 75),
    l: 53
  };

  return {
    primary: clampHslForRole(primaryHsl, 'primary'),
    secondary: clampHslForRole(secondaryHsl, 'secondary'),
    tertiary: clampHslForRole(tertiaryHsl, 'tertiary'),
    quaternary: clampHslForRole(quaternaryHsl, 'quaternary'),
    accent: clampHslForRole(resolvedAccentHsl, 'accent')
  };
}

export function extractPaletteFromPixels(rgbaPixels, fallbackPalette = DEFAULT_LUMINOUS_PALETTE) {
  const hueBuckets = Array.from({ length: 12 }, () => ({
    count: 0,
    rSum: 0,
    gSum: 0,
    bSum: 0,
    weightSum: 0
  }));

  for (let pixelOffset = 0; pixelOffset <= rgbaPixels.length - 4; pixelOffset += 4) {
    const red = rgbaPixels[pixelOffset];
    const green = rgbaPixels[pixelOffset + 1];
    const blue = rgbaPixels[pixelOffset + 2];
    const alpha = rgbaPixels[pixelOffset + 3];
    if (alpha < 128) continue;

    const { h, s, l } = rgbToHsl(red, green, blue);
    const vibrancyWeight = (s / 100) * (1 - Math.abs(l - 55) / 65) + 0.1;
    const bucketIdx = Math.floor(h / 30) % 12;
    const currentBucket = hueBuckets[bucketIdx];
    currentBucket.count += 1;
    currentBucket.rSum += red * vibrancyWeight;
    currentBucket.gSum += green * vibrancyWeight;
    currentBucket.bSum += blue * vibrancyWeight;
    currentBucket.weightSum += vibrancyWeight;
  }

  const rankedBuckets = hueBuckets
    .map((bucket, idx) => ({ ...bucket, idx }))
    .filter((bucket) => bucket.weightSum > 0)
    .sort((a, b) => b.weightSum - a.weightSum);

  if (rankedBuckets.length === 0) {
    return { ...fallbackPalette };
  }

  const dominantBucket = rankedBuckets[0];
  const viableBuckets = rankedBuckets.filter((bucket) => bucket.weightSum >= dominantBucket.weightSum * 0.03);
  const selectedBuckets = [dominantBucket];

  for (const candidateBucket of viableBuckets) {
    if (selectedBuckets.length >= 4) break;
    const isDistinctFromSelected = selectedBuckets.every(
      (chosenBucket) => circularHueBucketDistance(candidateBucket.idx, chosenBucket.idx) >= 2
    );
    if (isDistinctFromSelected) {
      selectedBuckets.push(candidateBucket);
    }
  }

  for (const candidateBucket of viableBuckets) {
    if (selectedBuckets.length >= 4) break;
    if (!selectedBuckets.includes(candidateBucket)) {
      selectedBuckets.push(candidateBucket);
    }
  }

  return buildClampedPalette(selectedBuckets.map(bucketToAverageHsl));
}

export function extractLuminousPalette(imageSource, fallbackPalette = DEFAULT_LUMINOUS_PALETTE) {
  if (!imageSource) {
    return { ...fallbackPalette };
  }

  if (imageSource.data && (imageSource.data instanceof Uint8ClampedArray || Array.isArray(imageSource.data))) {
    return extractPaletteFromPixels(imageSource.data, fallbackPalette);
  }

  if (typeof document !== 'undefined' && (
    (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement)
  )) {
    try {
      if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
        if (!imageSource.complete || imageSource.naturalWidth === 0) {
          return null;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_CANVAS_SIZE;
      canvas.height = SAMPLE_CANVAS_SIZE;
      const sampleContext = canvas.getContext('2d', { willReadFrequently: true });
      if (sampleContext) {
        sampleContext.drawImage(imageSource, 0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);
        const sampledImageData = sampleContext.getImageData(0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);
        return extractPaletteFromPixels(sampledImageData.data, fallbackPalette);
      }
    } catch {
      // Fallback if cross-origin or canvas extraction fails
    }
  }

  if (typeof imageSource === 'object' && imageSource !== null) {
    if (imageSource._extractedPalette) {
      return imageSource._extractedPalette;
    }
    const isSvg = !imageSource.dataUrl || imageSource.dataUrl.includes('data:image/svg+xml');
    if (isSvg && imageSource.palette && imageSource.palette.primary) {
      const roleHexStrings = [
        imageSource.palette.primary,
        imageSource.palette.secondary,
        imageSource.palette.tertiary,
        imageSource.palette.quaternary
      ].filter(Boolean);
      const parsedHslList = roleHexStrings
        .map(parseHexColor)
        .filter(Boolean)
        .map((rgbChannels) => rgbToHsl(rgbChannels.r, rgbChannels.g, rgbChannels.b));
      const accentRgb = parseHexColor(imageSource.palette.accent || imageSource.palette.primary);

      if (parsedHslList.length > 0 && accentRgb) {
        return buildClampedPalette(parsedHslList, rgbToHsl(accentRgb.r, accentRgb.g, accentRgb.b));
      }
    }
    if (typeof imageSource.dataUrl === 'string' && isSvg) {
      return extractLuminousPalette(imageSource.dataUrl, fallbackPalette);
    }
  }

  if (typeof imageSource === 'string') {
    const decodedUrl = imageSource.includes('%23') ? decodeURIComponent(imageSource) : imageSource;
    const hexColorMatches = decodedUrl.match(/#[0-9a-fA-F]{6}\b/g);
    if (hexColorMatches && hexColorMatches.length > 0) {
      const uniqueHexList = [...new Set(hexColorMatches.map((hex) => hex.toLowerCase()))].slice(0, 4);
      const parsedHslList = uniqueHexList
        .map(parseHexColor)
        .filter(Boolean)
        .map((rgbChannels) => rgbToHsl(rgbChannels.r, rgbChannels.g, rgbChannels.b));
      if (parsedHslList.length > 0) {
        return buildClampedPalette(parsedHslList);
      }
    }
  }

  return { ...fallbackPalette };
}
