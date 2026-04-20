(function(imageproc) {
    "use strict";

    /*
     * Apply sobel edge to the input data
     */
    imageproc.sobelEdge = function(inputData, outputData, threshold) {
        console.log("Applying Sobel edge detection...");

        /* Initialize the two edge kernel Gx and Gy */
        var Gx = [
            [-1, 0, 1],
            [-2, 0, 2],
            [-1, 0, 1]
        ];
        var Gy = [
            [-1,-2,-1],
            [ 0, 0, 0],
            [ 1, 2, 1]
        ];

        /**
         * TODO: You need to write the code to apply
         * the two edge kernels appropriately
         */
        
        for (var y = 0; y < inputData.height; y++) {
            for (var x = 0; x < inputData.width; x++) {
                var i = (x + y * outputData.width) * 4;
                var sumX = 0;
                var sumY = 0;

                for (var j = -1; j <= 1; j++) {
                    for (var i = -1; i <= 1; i++) {
                        var pixel = imageproc.getPixel(inputData, x + i, y + j);

                        var value = pixel.r;

                        sumX += value * Gx[j + 1][i + 1];
                        sumY += value * Gy[j + 1][i + 1];
                    }
                }

                var magnitude = Math.hypot(sumX, sumY);
                var edge = (magnitude >= threshold) ? 255 : 0;

                var index = (x + y * outputData.width) * 4;
                outputData.data[index]     = edge;
                outputData.data[index + 1] = edge;
                outputData.data[index + 2] = edge;
                outputData.data[index + 3] = inputData.data[index + 3];
            }
        }
    } 

}(window.imageproc = window.imageproc || {}));
