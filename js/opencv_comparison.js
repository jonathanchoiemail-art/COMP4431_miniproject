(function(imageproc) {
    "use strict";

    // only grayscale
    imageproc.opencvClaheSimple = function(inputData, outputData, tileSize, clipLimit) {
        console.log("Simple OpenCV CLAHE");
        
        var stdInput = new ImageData(inputData.width, inputData.height);
        for (var i = 0; i < inputData.data.length; i++) {
            stdInput.data[i] = inputData.data[i];
        }

        var mat = cv.matFromImageData(stdInput);
        var gray = new cv.Mat();
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
        
        // here
        var clahe = new cv.CLAHE(clipLimit, new cv.Size(tileSize, tileSize));
        clahe.apply(gray, gray);
        clahe.delete();
        
        
        cv.cvtColor(gray, mat, cv.COLOR_GRAY2RGBA);
        
        
        var result = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
        for (var i = 0; i < result.data.length; i++) {
            outputData.data[i] = result.data[i];
        }
        

        mat.delete();
        gray.delete();
    };

}(window.imageproc = window.imageproc || {}));