(function(imageproc) {
    "use strict";

    function clampByte(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function getLuminance(r, g, b) {
        return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    function buildHistogram(values) {
        var histogram = new Array(256).fill(0);
        for (var i = 0; i < values.length; i++) {
            histogram[values[i]]++;
        }
        return histogram;
    }

    /*
     * KEPT IDENTICAL to clahe2.js except one fix:
     * Guard remainder===0 before computing stride = floor(256/remainder),
     * which was dividing by zero and corrupting the histogram silently.
     * That corruption was the reason clahe2 never achieved a flat top.
     */
    function clipHistogram(histogram, clipLimit) {
        var excess = 0;
        for (var i = 0; i < 256; i++) {
            if (histogram[i] > clipLimit) {
                excess += histogram[i] - clipLimit;
                histogram[i] = clipLimit;
            }
        }
        var inc = Math.floor(excess / 256);
        var remainder = excess % 256;

        for (var i = 0; i < 256; i++) {
            histogram[i] += inc;
        }
        // FIX: guard remainder===0 to avoid floor(256/0) = Infinity
        if (remainder > 0) {
            var stride = Math.floor(256 / remainder);
            for (var i = 0; i < remainder; i++) {
                histogram[Math.min(i * stride, 255)]++;
            }
        }
        return histogram;
    }

    function clipHistogramFairly(histogram, clipLimit) {
        // clip the histogram and calculate total number of clipped pixels
        let clipped = 0;
        for (let i = 0; i < 256; i++) {
            if (histogram[i] > clipLimit) {
                clipped += histogram[i] - clipLimit;
                histogram[i] = clipLimit;
            }
        }
        // 1. baseline amont is distributed uniformly to all bins
        const redistBatch = Math.floor(clipped / 256);

        for (let i = 0; i < 256; i++) {
            histogram[i] += redistBatch;
        }
        // then the remainder distributed one by one 
        let residual = clipped % 256;

        if (residual !== 0){
            const residualStep = Math.max(Math.floor(256 / residual), 1);
            for (let i = 0; i < 256 && residual > 0; i += residualStep, residual--) {
                histogram[i]++;
            }
        }
        return histogram;
    }

    function buildCdf(histogram) {
        var cdf = new Array(256);
        var cumulative = 0;
        var firstNonZeroCdf = -1;
        

        for (var i = 0; i < 256; i++) {
            cumulative += histogram[i];
            cdf[i] = cumulative;
            if (firstNonZeroCdf === -1 && cumulative > 0) {
                firstNonZeroCdf = cumulative;
            }
        }

        return { cdf: cdf, firstNonZeroCdf: firstNonZeroCdf };
    }

    /*
     * CHANGED from clahe2.js's cdf[i] * (255/total).
     *
     * clahe2 used cdf/N*255 which never reaches 255 when the histogram
     * has empty bins at the low end (CDF starts above 0). That left the
     * output histogram bunched in the middle — not flat, not spreading
     * to the full 0-255 range.
     *
     * The correct formula is OpenCV's own:
     *   lut[i] = (cdf[i] - cdfMin) / (total - cdfMin) * 255
     *
     * This stretches the output to fill [0, 255] exactly.
     * It caused right-skew in previous attempts ONLY because the clip
     * was not working (remainder=0 corruption), so the CDF was still
     * steep. With clip working correctly, this formula produces the
     * flat-topped spread matching OpenCV.
     *
     * Degenerate case: all pixels same value → cdfMin == total → identity.
     */
    function buildLutFromCdf(cdfInfo, totalPixels) {
        var lut = new Uint8Array(256);
        var cdf = cdfInfo.cdf;
        var minCdf = cdfInfo.firstNonZeroCdf;

        if (minCdf < 0 || minCdf >= totalPixels) {
        // if (totalPixels === 0) {
            for (var i = 0; i < 256; i++) lut[i] = i;
            return lut;
        }

        var denom = totalPixels - minCdf;
        // var denom = totalPixels;
        for (var i = 0; i < 256; i++) {
            lut[i] = clampByte((cdf[i] - minCdf) * 255.0 / denom);
            // lut[i] = clampByte(cdf[i] * 255.0 / denom);
        }

        return lut;
    }

    /*
     * KEPT IDENTICAL to clahe2.js's active (non-commented) version:
     *   actualClipLimit = max(1, floor(clipLimit * averagePixelsPerBin))
     *
     * This is correct. For 8x8 tile (64px), slider=3:
     *   floor(3 * 64/256) = floor(0.75) = 0 → max(1,0) = 1
     * For 16x16 tile (256px), slider=3:
     *   floor(3 * 1.0) = 3
     * For 480x360 full image: irrelevant, tiles are subdivided.
     *
     * The slider is intentionally less effective at smaller tile sizes —
     * that is physically correct because a 64-pixel tile has so few pixels
     * that even clipLimit=1 is already meaningful clipping.
     * Do NOT change this to float or round() — that was what caused v3's
     * heavy right-skew by making the clip too loose.
     */
    function buildTileLUT(tilePixels, clipLimit) {
        var histogram = buildHistogram(tilePixels);
        var totalPixels = tilePixels.length;

        var averagePixelsPerBin = totalPixels / 256;
        // var actualClipLimit = Math.max(1, Math.floor(clipLimit * averagePixelsPerBin));
        // var actualClipLimit = clipLimit;
        var dampingFactor = 2.0;
        var actualClipLimit = Math.max(1, Math.floor((clipLimit*dampingFactor)*averagePixelsPerBin));

        // var clippedHistogram = clipHistogram(histogram, actualClipLimit);
        var clippedHistogram = clipHistogramFairly(histogram, actualClipLimit);
        var cdfInfo = buildCdf(clippedHistogram);

        return buildLutFromCdf(cdfInfo, totalPixels);
    }

    // KEPT IDENTICAL to clahe2.js
    function padChannelData(channelData, width, height, tileSize) {
        var tilesX = Math.ceil(width / tileSize);
        var tilesY = Math.ceil(height / tileSize);
        var paddedWidth = tilesX * tileSize;
        var paddedHeight = tilesY * tileSize;
        var padded = new Array(paddedHeight);

        for (var y = 0; y < paddedHeight; y++) {
            padded[y] = new Array(paddedWidth);
        }

        for (var row = 0; row < height; row++) {
            for (var x = 0; x < width; x++) {
                padded[row][x] = channelData[row * width + x];
            }
            for (var padX = width; padX < paddedWidth; padX++) {
                padded[row][padX] = channelData[row * width + (width - 1)];
            }
        }

        for (var padY = height; padY < paddedHeight; padY++) {
            for (var col = 0; col < paddedWidth; col++) {
                padded[padY][col] = padded[height - 1][col];
            }
        }

        return { padded: padded, tilesX: tilesX, tilesY: tilesY };
    }

    // KEPT IDENTICAL to clahe2.js
    function extractTilePixels(padded, tileSize, tx, ty) {
        var tilePixels = [];
        for (var yi = 0; yi < tileSize; yi++) {
            for (var xi = 0; xi < tileSize; xi++) {
                tilePixels.push(padded[ty * tileSize + yi][tx * tileSize + xi]);
            }
        }
        return tilePixels;
    }

    // KEPT IDENTICAL to clahe2.js
    function buildTileLUTGrid(paddedInfo, tileSize, clipLimit) {
        var luts = new Array(paddedInfo.tilesY);
        for (var ty = 0; ty < paddedInfo.tilesY; ty++) {
            luts[ty] = new Array(paddedInfo.tilesX);
            for (var tx = 0; tx < paddedInfo.tilesX; tx++) {
                var tilePixels = extractTilePixels(paddedInfo.padded, tileSize, tx, ty);
                luts[ty][tx] = buildTileLUT(tilePixels, clipLimit);
            }
        }
        return luts;
    }

    /*
     * CHANGED from clahe2.js: tx2/ty2 use min(tx1+1, max) not Math.ceil().
     *
     * Math.ceil(integer) === integer, so when txFloat lands exactly on
     * a tile boundary, tx1 === tx2 and wx=0 — no interpolation happens.
     * min(tx1+1, tilesX-1) always picks the next tile, letting wx blend
     * smoothly. Everything else is identical to clahe2.js.
     */
    function interpolateChannel(channelData, width, height, tileSize, luts, tilesX, tilesY) {
        var result = new Uint8ClampedArray(width * height);
        var invTileSize = 1.0 / tileSize;

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                // var txFloat = Math.max(0, Math.min(tilesX - 1, (x + 0.5) / tileSize - 0.5));
                // var tyFloat = Math.max(0, Math.min(tilesY - 1, (y + 0.5) / tileSize - 0.5));
                var txFloat = x * invTileSize - 0.5;
                var tyFloat = y * invTileSize - 0.5;
                txFloat = Math.max(0, Math.min(tilesX - 1, txFloat));
                tyFloat = Math.max(0, Math.min(tilesY - 1, tyFloat));
                
                var tx1 = Math.floor(txFloat);
                var tx2 = Math.min(tx1 + 1, tilesX - 1);
                var ty1 = Math.floor(tyFloat);
                var ty2 = Math.min(ty1 + 1, tilesY - 1);

                var wx = txFloat - tx1;
                var wy = tyFloat - ty1;

                var oldValue = channelData[y * width + x];

                var v11 = luts[ty1][tx1][oldValue];
                var v12 = luts[ty1][tx2][oldValue];
                var v21 = luts[ty2][tx1][oldValue];
                var v22 = luts[ty2][tx2][oldValue];

                var top    = v11 * (1 - wx) + v12 * wx;
                var bottom = v21 * (1 - wx) + v22 * wx;

                result[y * width + x] = Math.round(top * (1 - wy) + bottom * wy);
            }
        }

        return result;
    }

    // KEPT IDENTICAL to clahe2.js
    function applyCLAHEtoChannel(channelData, width, height, tileSize, clipLimit) {
        var paddedInfo = padChannelData(channelData, width, height, tileSize);
        var luts = buildTileLUTGrid(paddedInfo, tileSize, clipLimit);
        return interpolateChannel(channelData, width, height, tileSize, luts, paddedInfo.tilesX, paddedInfo.tilesY);
    }

    // KEPT IDENTICAL to clahe2.js
    function extractGrayscaleChannel(inputData) {
        var n = inputData.width * inputData.height;
        var luminanceData = new Uint8ClampedArray(n);
        for (var i = 0; i < n; i++) {
            var idx = i * 4;
            luminanceData[i] = getLuminance(inputData.data[idx], inputData.data[idx + 1], inputData.data[idx + 2]);
        }
        return luminanceData;
    }

    // KEPT IDENTICAL to clahe2.js
    function extractRgbChannels(inputData) {
        var n = inputData.width * inputData.height;
        var r = new Uint8ClampedArray(n);
        var g = new Uint8ClampedArray(n);
        var b = new Uint8ClampedArray(n);
        for (var i = 0; i < n; i++) {
            var idx = i * 4;
            r[i] = inputData.data[idx];
            g[i] = inputData.data[idx + 1];
            b[i] = inputData.data[idx + 2];
        }
        return { r: r, g: g, b: b };
    }

    // KEPT IDENTICAL to clahe2.js
    function writeGrayscaleOutput(outputData, inputData, resultLuminance) {
        for (var i = 0; i < resultLuminance.length; i++) {
            var idx = i * 4;
            var v = resultLuminance[i];
            outputData.data[idx]     = v;
            outputData.data[idx + 1] = v;
            outputData.data[idx + 2] = v;
            outputData.data[idx + 3] = inputData.data[idx + 3];
        }
    }

    // KEPT IDENTICAL to clahe2.js
    function writeRgbOutput(outputData, inputData, resultR, resultG, resultB) {
        for (var i = 0; i < resultR.length; i++) {
            var idx = i * 4;
            outputData.data[idx]     = resultR[i];
            outputData.data[idx + 1] = resultG[i];
            outputData.data[idx + 2] = resultB[i];
            outputData.data[idx + 3] = inputData.data[idx + 3];
        }
    }

    imageproc.claheGrayscale = function(inputData, outputData, tileSize, clipLimit) {
        console.log("CLAHE Grayscale: tileSize=" + tileSize + ", clipLimit=" + clipLimit);
        var w = inputData.width, h = inputData.height;
        var lum    = extractGrayscaleChannel(inputData);
        var result = applyCLAHEtoChannel(lum, w, h, tileSize, clipLimit);
        writeGrayscaleOutput(outputData, inputData, result);
    };

    imageproc.claheRGB = function(inputData, outputData, tileSize, clipLimit) {
        console.log("CLAHE RGB: tileSize=" + tileSize + ", clipLimit=" + clipLimit);
        var w = inputData.width, h = inputData.height;
        var ch = extractRgbChannels(inputData);
        var rResult = applyCLAHEtoChannel(ch.r, w, h, tileSize, clipLimit);
        var gResult = applyCLAHEtoChannel(ch.g, w, h, tileSize, clipLimit);
        var bResult = applyCLAHEtoChannel(ch.b, w, h, tileSize, clipLimit);
        writeRgbOutput(outputData, inputData, rResult, gResult, bResult);
    };

}(window.imageproc = window.imageproc || {}));