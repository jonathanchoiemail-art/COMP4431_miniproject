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
        maxAttempts = maxAttempts || 50; // 最多尝试5秒
        var attempts = 0;
        
        function check() {
            if (isOpenCVReady()) {
                opencvReady = true;
                console.log("✓ OpenCV loaded and ready!");
                if (callback) callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                console.log("Waiting for OpenCV... attempt " + attempts);
                setTimeout(check, 100);
            } else {
                console.warn("✗ OpenCV failed to load after " + (maxAttempts * 100) + "ms");
            }
        }
        check();
    }
    
    // 页面加载后开始等待OpenCV
    waitForOpenCV();

    imageproc.opencvHistogramEqualization = function(inputData, outputData, mode) {
        console.log("OpenCV equalization called, ready=" + opencvReady);
        
        if (!opencvReady) {
            console.warn("OpenCV not ready, using custom implementation");
            imageproc.histogramEqualization(inputData, outputData, mode);
            return;
        }
        
        // ... 其余代码保持不变
    };
    
    // ... 其他函数
}(window.imageproc = window.imageproc || {}));