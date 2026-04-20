(function(imageproc) {
    "use strict";

    /*
     * Apply Kuwahara filter to the input data
     */
    imageproc.kuwahara = function(inputData, outputData, size) {
        console.log("Applying Kuwahara filter...");

        /*
         * TODO: You need to extend the kuwahara function to include different
         * sizes of the filter
         *
         * You need to clearly understand the following code to make
         * appropriate changes
         */

        var regionRadius = Math.floor(size / 4);
        var regionSize = regionRadius * 2 + 1;
        var area = regionSize * regionSize;

        /*
         * An internal function to find the regional stat centred at (x, y)
         */
        function regionStat(x, y) {
            // Find the mean colour and brightness
            var meanR = 0, meanG = 0, meanB = 0;
            var meanValue = 0;
            for (var j = -regionRadius; j <= regionRadius; j++) {
                for (var i = -regionRadius; i <= regionRadius; i++) {
                    var pixel = imageproc.getPixel(inputData, x + i, y + j);

                    // For the mean colour
                    meanR += pixel.r;
                    meanG += pixel.g;
                    meanB += pixel.b;

                    // For the mean brightness
                    meanValue += (pixel.r + pixel.g + pixel.b) / 3;
                }
            }
            meanR /= area;
            meanG /= area;
            meanB /= area;
            meanValue /= area;

            // Find the variance
            var variance = 0;
            for (var j = -regionRadius; j <= regionRadius; j++) {
                for (var i = -regionRadius; i <= regionRadius; i++) {
                    var pixel = imageproc.getPixel(inputData, x + i, y + j);
                    var value = (pixel.r + pixel.g + pixel.b) / 3;

                    variance += Math.pow(value - meanValue, 2);
                }
            }
            variance /= area;

            // Return the mean and variance as an object
            return {
                mean: {r: meanR, g: meanG, b: meanB},
                variance: variance
            };
        }

        for (var y = 0; y < inputData.height; y++) {
            for (var x = 0; x < inputData.width; x++) {
                // Find the statistics of the four sub-regions
                var regionA = regionStat(x - regionRadius, y - regionRadius);
                var regionB = regionStat(x + regionRadius, y - regionRadius);
                var regionC = regionStat(x - regionRadius, y + regionRadius);
                var regionD = regionStat(x + regionRadius, y + regionRadius);


                // Get the minimum variance value
                var minV = Math.min(regionA.variance, regionB.variance,
                                    regionC.variance, regionD.variance);

                var i = (x + y * inputData.width) * 4;

                // Put the mean colour of the region with the minimum
                // variance in the pixel
                switch (minV) {
                case regionA.variance:
                    outputData.data[i]     = Math.round(regionA.mean.r);
                    outputData.data[i + 1] = Math.round(regionA.mean.g);
                    outputData.data[i + 2] = Math.round(regionA.mean.b);
                    break;
                case regionB.variance:
                    outputData.data[i]     = Math.round(regionB.mean.r);
                    outputData.data[i + 1] = Math.round(regionB.mean.g);
                    outputData.data[i + 2] = Math.round(regionB.mean.b);
                    break;
                case regionC.variance:
                    outputData.data[i]     = Math.round(regionC.mean.r);
                    outputData.data[i + 1] = Math.round(regionC.mean.g);
                    outputData.data[i + 2] = Math.round(regionC.mean.b);
                    break;
                case regionD.variance:
                    outputData.data[i]     = Math.round(regionD.mean.r);
                    outputData.data[i + 1] = Math.round(regionD.mean.g);
                    outputData.data[i + 2] = Math.round(regionD.mean.b);
                }
            }
        }
    }
 
}(window.imageproc = window.imageproc || {}));
