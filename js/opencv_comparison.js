// (function(imageproc) {
//     "use strict";

//     // only grayscale
//     imageproc.opencvClahe = function(inputData, outputData, tileSize, clipLimit) {
//         console.log("Simple OpenCV CLAHE");
        
//         var stdInput = new ImageData(inputData.width, inputData.height);
//         for (var i = 0; i < inputData.data.length; i++) {
//             stdInput.data[i] = inputData.data[i];
//         }

//         var mat = cv.matFromImageData(stdInput);
//         var gray = new cv.Mat();
//         cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
        
//         // here
//         var clahe = new cv.CLAHE(clipLimit, new cv.Size(tileSize, tileSize));
//         clahe.apply(gray, gray);
//         clahe.delete();
        
        
//         cv.cvtColor(gray, mat, cv.COLOR_GRAY2RGBA);
        
        
//         var result = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
//         for (var i = 0; i < result.data.length; i++) {
//             outputData.data[i] = result.data[i];
//         }
        

//         mat.delete();
//         gray.delete();
//     };

// }(window.imageproc = window.imageproc || {}));
(function(imageproc) {
    "use strict";

    // CLAHE - 旧版本（有输出）
    imageproc.opencvClahe = function(inputData, outputData, tileSize, clipLimit, mode) {
        console.log(">>> OPENCV CLAHE WORKING <<<, mode=" + mode);
        
        var stdInput = new ImageData(inputData.width, inputData.height);
        for (var i = 0; i < inputData.data.length; i++) {
            stdInput.data[i] = inputData.data[i];
        }

        var mat = cv.matFromImageData(stdInput);
        
        if (mode === "gray") {
            var gray = new cv.Mat();
            cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
            
            var clahe = new cv.CLAHE(clipLimit, new cv.Size(tileSize, tileSize));
            clahe.apply(gray, gray);
            clahe.delete();
            
            cv.cvtColor(gray, mat, cv.COLOR_GRAY2RGBA);
            gray.delete();
        } else {
            var lab = new cv.Mat();
            var rgb = new cv.Mat();
            cv.cvtColor(mat, rgb, cv.COLOR_RGBA2RGB);
            cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);

            var channels = new cv.MatVector();
            cv.split(lab, channels);
            var l_channel = channels.get(0);

            var clahe = new cv.CLAHE(clipLimit, new cv.Size(tileSize, tileSize));
            clahe.apply(l_channel, l_channel);
            clahe.delete();

            cv.merge(channels, lab);

            cv.cvtColor(lab, rgb, cv.COLOR_Lab2RGB);
            cv.cvtColor(rgb, mat, cv.COLOR_RGB2RGBA);

            // cleanup
            lab.delete();
            rgb.delete();
            channels.delete();
        }
        
        var result = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
        for (var i = 0; i < result.data.length; i++) {
            outputData.data[i] = result.data[i];
        }
        
        mat.delete();
        
        console.log("✓ OpenCV CLAHE done");
    };

    // Histogram Equalization - 同样模式
    imageproc.opencvHistogramEqualization = function(inputData, outputData, mode) {
        console.log(">>> OPENCV EQUALIZATION WORKING <<<, mode=" + mode);
        
        var stdInput = new ImageData(inputData.width, inputData.height);
        for (var i = 0; i < inputData.data.length; i++) {
            stdInput.data[i] = inputData.data[i];
        }
        
        var mat = cv.matFromImageData(stdInput);
        
        if (mode === "gray") {
            var gray = new cv.Mat();
            cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
            cv.equalizeHist(gray, gray);
            cv.cvtColor(gray, mat, cv.COLOR_GRAY2RGBA);
            gray.delete();
        } else {
            var channels = new cv.MatVector();
            cv.split(mat, channels);
            for (var i = 0; i < 3; i++) {
                var channel = channels.get(i);
                cv.equalizeHist(channel, channel);
            }
            cv.merge(channels, mat);
            channels.delete();
        }
        
        var result = new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
        for (var i = 0; i < result.data.length; i++) {
            outputData.data[i] = result.data[i];
        }
        
        mat.delete();
        
        console.log("✓ OpenCV Equalization done");
    };

}(window.imageproc = window.imageproc || {}));