(function(imageproc) {
    "use strict";

    /*
     * Apply blur to the input data
     */
    imageproc.blur = function(inputData, outputData, kernelSize) {
        console.log("Applying blur...");

        // You are given a 3x3 kernel but you need to create a proper kernel
        // using the given kernel size
        //var kernel = [ [1, 1, 1], [1, 1, 1], [1, 1, 1] ];
        var kernel = [];
        for (var y = 0; y < kernelSize; y++) {
            kernel[y] = [];
            for (var x = 0; x < kernelSize; x++) {
                kernel[y][x] = 1;
            }
        }

        var divisor = kernelSize * kernelSize;
        var offset = Math.floor(kernelSize / 2);


        /**
         * TODO: You need to extend the blur effect to include different
         * kernel sizes and then apply the kernel to the entire image
         */

        // Apply the kernel to the whole image
        for (var y = 0; y < inputData.height; y++) {
            for (var x = 0; x < inputData.width; x++) {
                // Use imageproc.getPixel() to get the pixel values
                // over the kernel
                var sumR = 0, sumG = 0, sumB = 0;

                for (var j = -offset; j <= offset; j++) {
                    for (var i = -offset; i <= offset; i++) {
                        var pixel = imageproc.getPixel(inputData, x + i, y + j);
                        var weight = kernel[j + offset][i + offset];

                        sumR += pixel.r * weight;
                        sumG += pixel.g * weight;
                        sumB += pixel.b * weight;
                    }
                }

                
                // Then set the blurred result to the output data
                
                var index = (x + y * outputData.width) * 4;
                outputData.data[index]     = Math.round(sumR / divisor);
                outputData.data[index + 1] = Math.round(sumG / divisor);
                outputData.data[index + 2] = Math.round(sumB / divisor);
                outputData.data[index + 3] = inputData.data[index + 3];
            }
        }
    } 

}(window.imageproc = window.imageproc || {}));
