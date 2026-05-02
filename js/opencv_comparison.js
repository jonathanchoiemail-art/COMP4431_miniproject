(function(imageproc) {
    "use strict";

    // 等待OpenCV加载完成的标志
    var opencvReady = false;
    
    // 检查OpenCV是否真正可用
    function isOpenCVReady() {
        return typeof cv !== 'undefined' && cv.Mat && typeof cv.equalizeHist === 'function';
    }
    
    // 尝试等待OpenCV加载
    function waitForOpenCV(callback, maxAttempts) {
        maxAttempts = maxAttempts || 100; // 增加到10秒
        var attempts = 0;
        
        function check() {
            if (isOpenCVReady()) {
                opencvReady = true;
                console.log("✓ OpenCV loaded and ready!");
                if (callback) callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                if (attempts % 10 === 0) { // 每1秒打印一次
                    console.log("Waiting for OpenCV... attempt " + attempts);
                }
                setTimeout(check, 100);
            } else {
                console.warn("✗ OpenCV failed to load after " + (maxAttempts * 100) + "ms");
                console.warn("Please check network or download opencv.js locally");
            }
        }
        check();
    }
    
    // 页面加载后开始等待OpenCV
    waitForOpenCV();

    // Convert ImageData to OpenCV Mat
    function imageDataToMat(imageData) {
        var mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
        mat.data.set(imageData.data);
        return mat;
    }

    /**
     * OpenCV Histogram Equalization
     */
    imageproc.opencvHistogramEqualization = function(inputData, outputData, mode) {
        console.log("OpenCV equalization called, ready=" + opencvReady + ", mode=" + mode);
        
        if (!opencvReady) {
            console.warn("OpenCV not ready, using custom implementation");
            imageproc.histogramEqualization(inputData, outputData, mode);
            return;
        }

        try {
            var mat = imageDataToMat(inputData);
            
            if (mode === "gray") {
                // Grayscale mode - convert to single channel
                var gray = new cv.Mat();
                cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
                
                // Apply OpenCV's equalizeHist
                var equalized = new cv.Mat();
                cv.equalizeHist(gray, equalized);
                
                // Convert back to RGBA
                cv.cvtColor(equalized, mat, cv.COLOR_GRAY2RGBA);
                
                // Cleanup
                gray.delete();
                equalized.delete();
                
            } else { 
                // RGB mode - equalize each channel separately
                var channels = new cv.MatVector();
                cv.split(mat, channels);
                
                // Equalize R, G, B channels independently
                for (var i = 0; i < 3; i++) {
                    var channel = channels.get(i);
                    var eqChannel = new cv.Mat();
                    cv.equalizeHist(channel, eqChannel);
                    channels.set(i, eqChannel);
                    channel.delete();
                    eqChannel.delete();
                }
                
                // Merge back
                var merged = new cv.Mat();
                cv.merge(channels, merged);
                
                // Copy to mat (preserving alpha channel)
                for (var y = 0; y < mat.rows; y++) {
                    for (var x = 0; x < mat.cols; x++) {
                        var idx = (y * mat.cols + x) * 4;
                        var mergedIdx = (y * mat.cols + x) * 3;
                        mat.data[idx] = merged.data[mergedIdx];
                        mat.data[idx + 1] = merged.data[mergedIdx + 1];
                        mat.data[idx + 2] = merged.data[mergedIdx + 2];
                        // Alpha channel stays unchanged
                    }
                }
                
                channels.delete();
                merged.delete();
            }
            
            // Copy result to output
            outputData.data.set(mat.data);
            
            // Cleanup
            mat.delete();
            
            console.log("✓ OpenCV histogram equalization completed");
            
        } catch (err) {
            console.error("OpenCV equalization error:", err);
            console.log("Falling back to custom implementation");
            imageproc.histogramEqualization(inputData, outputData, mode);
        }
    };

    /**
     * OpenCV CLAHE
     */
    imageproc.opencvClahe = function(inputData, outputData, tileSize, clipLimit) {
        console.log("OpenCV CLAHE called, ready=" + opencvReady + ", tileSize=" + tileSize + ", clipLimit=" + clipLimit);
        
        if (!opencvReady) {
            console.warn("OpenCV not ready, using custom implementation");
            var mode = document.getElementById("clahe-mode").value;
            if (mode === "rgb") {
                imageproc.claheRGB(inputData, outputData, tileSize, clipLimit);
            } else {
                imageproc.claheGrayscale(inputData, outputData, tileSize, clipLimit);
            }
            return;
        }

        try {
            var mat = imageDataToMat(inputData);
            var mode = document.getElementById("clahe-mode").value;
            
            if (mode === "gray") {
                // Grayscale mode - convert to LAB and apply CLAHE on L channel
                var lab = new cv.Mat();
                cv.cvtColor(mat, lab, cv.COLOR_RGBA2LAB);
                
                var labChannels = new cv.MatVector();
                cv.split(lab, labChannels);
                
                // Create CLAHE object and apply to L channel
                var clahe = cv.createCLAHE(clipLimit, new cv.Size(tileSize, tileSize));
                var lChannel = labChannels.get(0);
                var lEqualized = new cv.Mat();
                clahe.apply(lChannel, lEqualized);
                
                // Put back and convert to RGBA
                labChannels.set(0, lEqualized);
                var labResult = new cv.Mat();
                cv.merge(labChannels, labResult);
                cv.cvtColor(labResult, mat, cv.COLOR_LAB2RGBA);
                
                // Cleanup
                lab.delete();
                labChannels.delete();
                lChannel.delete();
                lEqualized.delete();
                labResult.delete();
                clahe.delete();
                
            } else {
                // RGB mode - apply CLAHE to each channel separately
                var channels = new cv.MatVector();
                cv.split(mat, channels);
                
                // Apply CLAHE to R, G, B channels independently
                for (var i = 0; i < 3; i++) {
                    var channel = channels.get(i);
                    var clahe = cv.createCLAHE(clipLimit, new cv.Size(tileSize, tileSize));
                    var equalizedChannel = new cv.Mat();
                    clahe.apply(channel, equalizedChannel);
                    channels.set(i, equalizedChannel);
                    channel.delete();
                    equalizedChannel.delete();
                    clahe.delete();
                }
                
                // Merge back
                cv.merge(channels, mat);
                channels.delete();
            }
            
            // Copy result to output
            outputData.data.set(mat.data);
            
            // Cleanup
            mat.delete();
            
            console.log("✓ OpenCV CLAHE completed");
            
        } catch (err) {
            console.error("OpenCV CLAHE error:", err);
            console.log("Falling back to custom implementation");
            var mode = document.getElementById("clahe-mode").value;
            if (mode === "rgb") {
                imageproc.claheRGB(inputData, outputData, tileSize, clipLimit);
            } else {
                imageproc.claheGrayscale(inputData, outputData, tileSize, clipLimit);
            }
        }
    };

}(window.imageproc = window.imageproc || {}));