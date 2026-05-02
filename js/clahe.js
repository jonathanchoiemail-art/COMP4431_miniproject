// File: js/clahe.js
(function(imageproc) {
    "use strict";

    function clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function getLuminance(r, g, b) {
        return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    /**
     * Clip histogram to limit contrast amplification
     * @param {Array} histogram - The histogram array (256 values)
     * @param {number} clipLimit - Maximum allowed count per bin
     * @returns {Array} Clipped histogram
     */
    function clipHistogram(histogram, clipLimit) {
        var total = 0;
        var excess = 0;
        var i;
        
        // Calculate total pixels and clip excess
        for (i = 0; i < 256; i++) {
            if (histogram[i] > clipLimit) {
                excess += histogram[i] - clipLimit;
                histogram[i] = clipLimit;
            }
            total += histogram[i];
        }
        
        // Redistribute excess pixels evenly across all bins
        var step = Math.floor(excess / 256);
        var remainder = excess % 256;
        
        for (i = 0; i < 256; i++) {
            histogram[i] += step;
            if (i < remainder) {
                histogram[i]++;
            }
        }
        
        return histogram;
    }

    /**
     * Build lookup table for a single tile using clipped histogram
     */
    function buildTileLUT(tilePixels, clipLimit) {
        // Step 1: Build histogram for this tile
        var histogram = new Array(256).fill(0);
        // for (var i = 0; i < 256; i++) {
        //     histogram[i] = 0;
        // }
        
        for (var i = 0; i < tilePixels.length; i++) {
            histogram[tilePixels[i]]++;
        }
        
        // Step 2: Apply clipping to limit contrast
        var totalPixels = tilePixels.length;
        var actualClipLimit = Math.max(1, (totalPixels / 256) * clipLimit);
        histogram = clipHistogram(histogram, actualClipLimit);
        
        // Step 3: Build Cumulative Distribution Function (CDF)
        var cdf = new Array(256);
        var cumulative = 0;
        // var minCumulative = -1;
        
        // for (i = 0; i < 256; i++) {
        //     cumulative += histogram[i];
        //     cdf[i] = cumulative;
        //     if (minCumulative === -1 && histogram[i] > 0) {
        //         minCumulative = cumulative;
        //     }
        // }
        for (var i = 0; i < 256; i++){
            cumulative += histogram[i];
            cdf[i] = cumulative;
        }
        
        // Step 4: Create lookup table (maps old intensity → new intensity)
        var lut = new Array(256);
        var minCDF = -1;
        for (var i = 0; i < 256; i++){
            if (cdf[i] > 0){
                minCDF = cdf[i];
                break;
            }
        }
        
        if (minCDF === totalPixels) {
            // All pixels have same value
            for (i = 0; i < 256; i++) {
                lut[i] = i;
            }
        } else {
            for (i = 0; i < 256; i++) {
                // lut[i] = clamp((cdf[i] - minCumulative) * 255 / (totalPixels - minCumulative));
                lut[i] = Math.round((cdf[i] - minCDF) * 255 / (totalPixels - minCDF));
                lut[i] = Math.max(0, Math.min(255, lut[i]));
            }
        }
        
        
        return lut;
    }

    /**
     * Apply CLAHE to a single channel (for RGB mode)
     */
    function applyCLAHEtoChannel(channelData, width, height, tileSize, clipLimit) {
        // Calculate number of tiles
        var tilesX = Math.ceil(width / tileSize);
        var tilesY = Math.ceil(height / tileSize);
        
        // Create padded version for easy tile extraction
        var paddedWidth = tilesX * tileSize;
        var paddedHeight = tilesY * tileSize;
        
        // Create padded array
        var padded = new Array(paddedHeight);
        for (var y = 0; y < paddedHeight; y++) {
            padded[y] = new Array(paddedWidth);
        }
        
        // Fill padded array with original data
        for (y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                padded[y][x] = channelData[y * width + x];
            }
            // Pad right edge by repeating last pixel
            for (x = width; x < paddedWidth; x++) {
                padded[y][x] = channelData[y * width + (width - 1)];
            }
        }
        
        // Pad bottom edge by repeating last row
        for (y = height; y < paddedHeight; y++) {
            for (var x = 0; x < paddedWidth; x++) {
                padded[y][x] = padded[height - 1][x];
            }
        }
        
        // Build lookup tables for each tile
        var luts = new Array(tilesY);
        for (var ty = 0; ty < tilesY; ty++) {
            luts[ty] = new Array(tilesX);
            for (var tx = 0; tx < tilesX; tx++) {
                // Extract tile pixels
                var tilePixels = [];
                for (var yi = 0; yi < tileSize; yi++) {
                    for (var xi = 0; xi < tileSize; xi++) {
                        var px = tx * tileSize + xi;
                        var py = ty * tileSize + yi;
                        tilePixels.push(padded[py][px]);
                    }
                }
                // Create LUT for this tile
                luts[ty][tx] = buildTileLUT(tilePixels, clipLimit);
            }
        }
        
        // Apply CLAHE to each pixel with bilinear interpolation
        var result = new Uint8ClampedArray(width * height);
        
        for (y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                // Calculate tile coordinates (floating point for interpolation)
                var txFloat = (x + 0.5) / tileSize - 0.5;
                var tyFloat = (y + 0.5) / tileSize - 0.5;
                
                // Clamp to valid range
                txFloat = Math.max(0, Math.min(tilesX - 1, txFloat));
                tyFloat = Math.max(0, Math.min(tilesY - 1, tyFloat));
                
                // Get surrounding tile indices
                var tx1 = Math.floor(txFloat);
                var tx2 = Math.ceil(txFloat);
                var ty1 = Math.floor(tyFloat);
                var ty2 = Math.ceil(tyFloat);
                
                // Get interpolation weights
                var wx = txFloat - tx1;
                var wy = tyFloat - ty1;
                
                // Get original pixel value
                var oldValue = channelData[y * width + x];
                
                // Get values from 4 neighboring tile LUTs
                var v11 = luts[ty1][tx1][oldValue];
                var v21 = luts[ty2][tx1][oldValue];
                var v12 = luts[ty1][tx2][oldValue];
                var v22 = luts[ty2][tx2][oldValue];
                
                // Bilinear interpolation
                var v1 = v11 * (1 - wx) + v12 * wx;
                var v2 = v21 * (1 - wx) + v22 * wx;
                var newValue = Math.round(v1 * (1 - wy) + v2 * wy);
                
                result[y * width + x] = newValue;
            }
        }
        
        return result;
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
        
        // Extract luminance for all pixels
        var luminanceData = new Uint8ClampedArray(width * height);
        for (var i = 0; i < width * height; i++) {
            var idx = i * 4;
            luminanceData[i] = getLuminance(
                inputData.data[idx],
                inputData.data[idx + 1],
                inputData.data[idx + 2]
            );
        }
        
        // Apply CLAHE to luminance
        var resultLuminance = applyCLAHEtoChannel(luminanceData, width, height, tileSize, clipLimit);
        
        // Apply equalized luminance to all RGB channels (grayscale output)
        for (i = 0; i < width * height; i++) {
            var idx = i * 4;
            var newValue = resultLuminance[i];
            outputData.data[idx] = newValue;
            //outputData.data[idx] = newValue;
            outputData.data[idx + 1] = newValue;
            outputData.data[idx + 2] = newValue;
            outputData.data[idx + 3] = inputData.data[idx + 3];
        }
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
        
        // Extract R, G, B channels
        var rChannel = new Uint8ClampedArray(width * height);
        var gChannel = new Uint8ClampedArray(width * height);
        var bChannel = new Uint8ClampedArray(width * height);
        
        for (var i = 0; i < width * height; i++) {
            var idx = i * 4;
            rChannel[i] = inputData.data[idx]; 
            gChannel[i] = inputData.data[idx + 1];
            bChannel[i] = inputData.data[idx + 2];
        }
        
        // Apply CLAHE to each channel independently
        var resultR = applyCLAHEtoChannel(rChannel, width, height, tileSize, clipLimit);
        var resultG = applyCLAHEtoChannel(gChannel, width, height, tileSize, clipLimit);
        var resultB = applyCLAHEtoChannel(bChannel, width, height, tileSize, clipLimit);
        
        // Combine results
        for (i = 0; i < width * height; i++) {
            var idx = i * 4;
            // outputData.data[idx] = resultR[i];
            outputData.data[idx] = resultR[i];
            outputData.data[idx + 1] = resultG[i];
            outputData.data[idx + 2] = resultB[i];
            outputData.data[idx + 3] = inputData.data[idx + 3];
        }
    };
    
}(window.imageproc = window.imageproc || {}));