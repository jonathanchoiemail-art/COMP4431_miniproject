// File: js/clahe.js
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

    function clipHistogram(histogram, clipLimit) {
        var excess = 0;

        for (var i = 0; i < 256; i++) {
            if (histogram[i] > clipLimit) {
                excess += histogram[i] - clipLimit;
                histogram[i] = clipLimit;
            }
        }

        var step = Math.floor(excess / 256);
        var remainder = excess % 256;

        for (var j = 0; j < 256; j++) {
            histogram[j] += step;

            if (j < remainder) {
                histogram[j]++;
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

        return {
            cdf: cdf,
            firstNonZeroCdf: firstNonZeroCdf
        };
    }

    function buildLutFromCdf(cdfInfo, totalPixels) {
        var lut = new Array(256);

        if (cdfInfo.firstNonZeroCdf === totalPixels) {
            for (var i = 0; i < 256; i++) {
                lut[i] = i;
            }

            return lut;
        }

        for (var j = 0; j < 256; j++) {
            var mappedValue = (cdfInfo.cdf[j] - cdfInfo.firstNonZeroCdf) * 255 / (totalPixels - cdfInfo.firstNonZeroCdf);
            lut[j] = clampByte(mappedValue);
        }

        return lut;
    }

    function buildTileLUT(tilePixels, clipLimit) {
        var histogram = buildHistogram(tilePixels);
        var totalPixels = tilePixels.length;
        var actualClipLimit = Math.max(1, (totalPixels / 256) * clipLimit);
        var clippedHistogram = clipHistogram(histogram, actualClipLimit);
        var cdfInfo = buildCdf(clippedHistogram);

        return buildLutFromCdf(cdfInfo, totalPixels);
    }

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

        return {
            padded: padded,
            tilesX: tilesX,
            tilesY: tilesY
        };
    }

    function extractTilePixels(padded, tileSize, tx, ty) {
        var tilePixels = [];

        for (var yi = 0; yi < tileSize; yi++) {
            for (var xi = 0; xi < tileSize; xi++) {
                tilePixels.push(padded[ty * tileSize + yi][tx * tileSize + xi]);
            }
        }

        return tilePixels;
    }

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

    function interpolateChannel(channelData, width, height, tileSize, luts, tilesX, tilesY) {
        var result = new Uint8ClampedArray(width * height);

        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var txFloat = Math.max(0, Math.min(tilesX - 1, (x + 0.5) / tileSize - 0.5));
                var tyFloat = Math.max(0, Math.min(tilesY - 1, (y + 0.5) / tileSize - 0.5));

                var tx1 = Math.floor(txFloat);
                var tx2 = Math.ceil(txFloat);
                var ty1 = Math.floor(tyFloat);
                var ty2 = Math.ceil(tyFloat);

                var wx = txFloat - tx1;
                var wy = tyFloat - ty1;
                var oldValue = channelData[y * width + x];

                var v11 = luts[ty1][tx1][oldValue];
                var v21 = luts[ty2][tx1][oldValue];
                var v12 = luts[ty1][tx2][oldValue];
                var v22 = luts[ty2][tx2][oldValue];

                var top = v11 * (1 - wx) + v12 * wx;
                var bottom = v21 * (1 - wx) + v22 * wx;

                result[y * width + x] = Math.round(top * (1 - wy) + bottom * wy);
            }
        }

        return result;
    }

    function applyCLAHEtoChannel(channelData, width, height, tileSize, clipLimit) {
        var paddedInfo = padChannelData(channelData, width, height, tileSize);
        var luts = buildTileLUTGrid(paddedInfo, tileSize, clipLimit);

        return interpolateChannel(channelData, width, height, tileSize, luts, paddedInfo.tilesX, paddedInfo.tilesY);
    }

    function extractGrayscaleChannel(inputData) {
        var width = inputData.width;
        var height = inputData.height;
        var luminanceData = new Uint8ClampedArray(width * height);

        for (var i = 0; i < width * height; i++) {
            var idx = i * 4;
            luminanceData[i] = getLuminance(
                inputData.data[idx],
                inputData.data[idx + 1],
                inputData.data[idx + 2]
            );
        }

        return luminanceData;
    }

    function extractRgbChannels(inputData) {
        var width = inputData.width;
        var height = inputData.height;
        var rChannel = new Uint8ClampedArray(width * height);
        var gChannel = new Uint8ClampedArray(width * height);
        var bChannel = new Uint8ClampedArray(width * height);

        for (var i = 0; i < width * height; i++) {
            var idx = i * 4;
            rChannel[i] = inputData.data[idx];
            gChannel[i] = inputData.data[idx + 1];
            bChannel[i] = inputData.data[idx + 2];
        }

        return {
            r: rChannel,
            g: gChannel,
            b: bChannel
        };
    }

    function writeGrayscaleOutput(outputData, inputData, resultLuminance) {
        for (var i = 0; i < resultLuminance.length; i++) {
            var idx = i * 4;
            var value = resultLuminance[i];

            outputData.data[idx] = value;
            outputData.data[idx + 1] = value;
            outputData.data[idx + 2] = value;
            outputData.data[idx + 3] = inputData.data[idx + 3];
        }
    }

    function writeRgbOutput(outputData, inputData, resultR, resultG, resultB) {
        for (var i = 0; i < resultR.length; i++) {
            var idx = i * 4;

            outputData.data[idx] = resultR[i];
            outputData.data[idx + 1] = resultG[i];
            outputData.data[idx + 2] = resultB[i];
            outputData.data[idx + 3] = inputData.data[idx + 3];
        }
    }

    /**
     * Main CLAHE function for grayscale mode (processes luminance only)
     * @param {ImageData} inputData - Input image data
     * @param {ImageData} outputData - Output image data
     * @param {number} tileSize - Tile size (4, 8, or 16)
     * @param {number} clipLimit - Clip limit (1-10)
     */
    imageproc.claheGrayscale = function(inputData, outputData, tileSize, clipLimit) {
        console.log("CLAHE Grayscale: tileSize=" + tileSize + ", clipLimit=" + clipLimit);

        var width = inputData.width;
        var height = inputData.height;
        var luminanceData = extractGrayscaleChannel(inputData);
        var resultLuminance = applyCLAHEtoChannel(luminanceData, width, height, tileSize, clipLimit);

        writeGrayscaleOutput(outputData, inputData, resultLuminance);
    };

    /**
     * RGB CLAHE - processes each color channel independently
     * @param {ImageData} inputData - Input image data
     * @param {ImageData} outputData - Output image data
     * @param {number} tileSize - Tile size (4, 8, or 16)
     * @param {number} clipLimit - Clip limit (1-10)
     */
    imageproc.claheRGB = function(inputData, outputData, tileSize, clipLimit) {
        console.log("CLAHE RGB: tileSize=" + tileSize + ", clipLimit=" + clipLimit);

        var width = inputData.width;
        var height = inputData.height;
        var channels = extractRgbChannels(inputData);
        var resultR = applyCLAHEtoChannel(channels.r, width, height, tileSize, clipLimit);
        var resultG = applyCLAHEtoChannel(channels.g, width, height, tileSize, clipLimit);
        var resultB = applyCLAHEtoChannel(channels.b, width, height, tileSize, clipLimit);

        writeRgbOutput(outputData, inputData, resultR, resultG, resultB);
    };

}(window.imageproc = window.imageproc || {}));
