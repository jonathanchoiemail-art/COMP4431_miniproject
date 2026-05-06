(function(imageproc) {
    "use strict";

    function clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function luminance(r, g, b) {
        return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    function rgbToHsv(r, g, b) {
        r = r / 255;
        g = g / 255;
        b = b / 255;

        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var diff = max - min;

        var h = 0;
        var s = 0;
        var v = max;

        if (diff !== 0) {
            if (max === r) {
                h = 60 * (((g - b) / diff) % 6);
            }
            else if (max === g) {
                h = 60 * (((b - r) / diff) + 2);
            }
            else {
                h = 60 * (((r - g) / diff) + 4);
            }

            if (h < 0) {
                h += 360;
            }

            s = diff / max;
        }

        return {
            h: h,
            s: s,
            v: v
        };
    }

    function hsvToRgb(h, s, v) {
        h = ((h % 360) + 360) % 360;

        var c = v * s;
        var x = c * (1 - Math.abs((h / 60) % 2 - 1));
        var m = v - c;

        var rp = 0;
        var gp = 0;
        var bp = 0;

        if (h < 60) {
            rp = c;
            gp = x;
            bp = 0;
        }
        else if (h < 120) {
            rp = x;
            gp = c;
            bp = 0;
        }
        else if (h < 180) {
            rp = 0;
            gp = c;
            bp = x;
        }
        else if (h < 240) {
            rp = 0;
            gp = x;
            bp = c;
        }
        else if (h < 300) {
            rp = x;
            gp = 0;
            bp = c;
        }
        else {
            rp = c;
            gp = 0;
            bp = x;
        }

        return {
            r: clamp((rp + m) * 255),
            g: clamp((gp + m) * 255),
            b: clamp((bp + m) * 255)
        };
    }

    function isValueMode(mode) {
        return mode === "value" || mode === "v" || mode === "hsv-v";
    }


    function getChannelValue(imageData, index, channel) {
        switch (channel) {
            case "red":
                return imageData.data[index];
            case "green":
                return imageData.data[index + 1];
            case "blue":
                return imageData.data[index + 2];
            
            
            case "value":
                var hsv = rgbToHsv(imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]);
                return clamp(hsv.v * 255);


            case "gray":
            default:
                return luminance(
                    imageData.data[index],
                    imageData.data[index + 1],
                    imageData.data[index + 2]
                );
        }
    }

    /*
     * Build histogram for a given channel
     */
    imageproc.buildHistogram = function(imageData, channel) {
        var histogram = [];
        for (var i = 0; i < 256; i++) {
            histogram[i] = 0;
        }

        for (var p = 0; p < imageData.data.length; p += 4) {
            var value = getChannelValue(imageData, p, channel);
            histogram[value]++;
        }

        return histogram;
    };

    /*
     * Build normalized CDF from histogram
     */
    imageproc.buildCDF = function(histogram) {
        var cdf = [];
        var total = 0;
        var cumulative = 0;
        var i;

        for (i = 0; i < 256; i++) {
            total += histogram[i];
        }

        for (i = 0; i < 256; i++) {
            cumulative += histogram[i];
            cdf[i] = (total === 0) ? 0 : cumulative / total;
        }

        return cdf;
    };

    /*
     * Build equalization lookup table using:
     * new = (CDF[old] - min) * 255 / (max - min)
     * where CDF is cumulative count, min is first non-zero CDF, max is total pixels
     */
    function makeLookupTable(histogram) {
        var lut = [];
        var cdf = [];
        var total = 0;
        var cumulative = 0;
        var min = -1;
        var i;

        for (i = 0; i < 256; i++) {
            total += histogram[i];
        }

        if (total === 0) {
            for (i = 0; i < 256; i++) {
                lut[i] = i;
            }
            return lut;
        }

        for (i = 0; i < 256; i++) {
            cumulative += histogram[i];
            cdf[i] = cumulative;

            if (min === -1 && histogram[i] > 0) {
                min = cumulative;
            }
        }

        if (min === total) {
            for (i = 0; i < 256; i++) {
                lut[i] = i;
            }
            return lut;
        }

        for (i = 0; i < 256; i++) {
            lut[i] = clamp((cdf[i] - min) * 255 / (total - min));
        }

        return lut;
    }

    /*
     * Apply histogram equalization
     */
    imageproc.histogramEqualization = function(inputData, outputData, mode) {
        console.log("Applying histogram equalization...");

        var i;

        if (mode === "rgb") {
            var histR = imageproc.buildHistogram(inputData, "red");
            var histG = imageproc.buildHistogram(inputData, "green");
            var histB = imageproc.buildHistogram(inputData, "blue");

            var lutR = makeLookupTable(histR);
            var lutG = makeLookupTable(histG);
            var lutB = makeLookupTable(histB);

            for (i = 0; i < inputData.data.length; i += 4) {
                outputData.data[i]     = lutR[inputData.data[i]];
                outputData.data[i + 1] = lutG[inputData.data[i + 1]];
                outputData.data[i + 2] = lutB[inputData.data[i + 2]];
                outputData.data[i + 3] = inputData.data[i + 3];
            }
        }


        else if (isValueMode(mode)) {
            var histV = imageproc.buildHistogram(inputData, "value");
            var lutV = makeLookupTable(histV);

            for (i = 0; i < inputData.data.length; i += 4) {
                var r = inputData.data[i];
                var g = inputData.data[i + 1];
                var b = inputData.data[i + 2];

                var hsv = rgbToHsv(r, g, b);

                var oldV = clamp(hsv.v * 255);
                var newV = lutV[oldV];

                hsv.v = newV / 255;

                var rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

                outputData.data[i]     = rgb.r;
                outputData.data[i + 1] = rgb.g;
                outputData.data[i + 2] = rgb.b;
                outputData.data[i + 3] = inputData.data[i + 3];
            }
        }



        else {
            var histGray = imageproc.buildHistogram(inputData, "gray");
            var lutGray = makeLookupTable(histGray);

            for (i = 0; i < inputData.data.length; i += 4) {
                var gray = luminance(
                    inputData.data[i],
                    inputData.data[i + 1],
                    inputData.data[i + 2]
                );
                var equalized = lutGray[gray];

                outputData.data[i]     = equalized;
                outputData.data[i + 1] = equalized;
                outputData.data[i + 2] = equalized;
                outputData.data[i + 3] = inputData.data[i + 3];
            }
        }
    };

    function clearCanvas(ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    function drawAxes(ctx, yLabelMax) {
        var w = ctx.canvas.width;
        var h = ctx.canvas.height;
        var pad = 30;

        clearCanvas(ctx);

        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(pad, 10);
        ctx.lineTo(pad, h - pad);
        ctx.lineTo(w - 10, h - pad);
        ctx.stroke();

        ctx.fillStyle = "#333";
        ctx.font = "10px sans-serif";
        ctx.fillText("0", pad - 10, h - pad + 12);
        ctx.fillText("255", w - 25, h - pad + 12);

        if (yLabelMax !== undefined) {
            ctx.fillText(String(yLabelMax), 2, 14);
        }
    }

    /*
     * Draw histogram(s) into a canvas
     * histograms = [{ data: [...], color: "rgba(...)" }, ...]
     */
    imageproc.drawHistogram = function(canvasId, histograms) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        var ctx = canvas.getContext("2d");

        /*
         * no checkbox is selected, clear the canvas.
         */
        if (!histograms || histograms.length === 0) {
            clearCanvas(ctx);
            return;
        }

        var pad = 30;
        var plotW = canvas.width - pad - 10;
        var plotH = canvas.height - 10 - pad;
        var maxCount = 1;
        var i, k;

        for (k = 0; k < histograms.length; k++) {
            for (i = 0; i < 256; i++) {
                if (histograms[k].data[i] > maxCount) {
                    maxCount = histograms[k].data[i];
                }
            }
        }

        drawAxes(ctx, maxCount);

        for (k = 0; k < histograms.length; k++) {
            ctx.fillStyle = histograms[k].color;
            ctx.globalAlpha = 0.45;

            for (i = 0; i < 256; i++) {
                var x = pad + i * plotW / 256;
                var barH = histograms[k].data[i] / maxCount * plotH;
                var barW = Math.max(1, plotW / 256);

                ctx.fillRect(x, canvas.height - pad - barH, barW, barH);
            }
        }

        ctx.globalAlpha = 1;
    };

    /*
     * Draw CDF curve(s) into a canvas
     * curves = [{ data: [...], color: "rgba(...)" }, ...]
     */
    imageproc.drawCDF = function(canvasId, curves) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        var ctx = canvas.getContext("2d");

        /*
         * no checkbox is selected, clear the CDF canvas
         */
        if (!curves || curves.length === 0) {
            clearCanvas(ctx);
            return;
        }

        var pad = 30;
        var plotW = canvas.width - pad - 10;
        var plotH = canvas.height - 10 - pad;
        var i, k;

        drawAxes(ctx, 1.0);

        for (k = 0; k < curves.length; k++) {
            ctx.strokeStyle = curves[k].color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (i = 0; i < 256; i++) {
                var x = pad + i * plotW / 255;
                var y = canvas.height - pad - curves[k].data[i] * plotH;

                if (i === 0) {
                    ctx.moveTo(x, y);
                }
                else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();
        }
    };

    function isChecked(id) {
        var el = document.getElementById(id);
        return el ? el.checked : false;
    }

    function getSelectedChannels(prefix) {
        var channels = [];

        if (isChecked(prefix + "-red")) {
            channels.push({ key: "red", color: "rgba(255, 0, 0, 0.85)" });
        }
        if (isChecked(prefix + "-green")) {
            channels.push({ key: "green", color: "rgba(0, 160, 0, 0.85)" });
        }
        if (isChecked(prefix + "-blue")) {
            channels.push({ key: "blue", color: "rgba(0, 0, 255, 0.85)" });
        }
        if (isChecked(prefix + "-gray")) {
            channels.push({ key: "gray", color: "rgba(80, 80, 80, 0.95)" });
        }


        if (isChecked(prefix + "-value") || isChecked(prefix + "-v")) {
            channels.push({ key: "value", color: "rgba(255, 140, 0, 0.90)" });
        }




        return channels;
    }

    function getCanvasImageData(canvasId) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) {
            return null;
        }

        var ctx = canvas.getContext("2d");
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function renderGroup(imageData, checkboxPrefix, histogramCanvasId, cdfCanvasId) {
        if (!imageData) {
            imageproc.drawHistogram(histogramCanvasId, []);
            imageproc.drawCDF(cdfCanvasId, []);
            return;
        }

        var channels = getSelectedChannels(checkboxPrefix);

        /*
         * If no channel checkbox is selected, clear both graphs.
         */
        if (channels.length === 0) {
            imageproc.drawHistogram(histogramCanvasId, []);
            imageproc.drawCDF(cdfCanvasId, []);
            return;
        }

        var histograms = [];
        var cdfs = [];
        var i;

        for (i = 0; i < channels.length; i++) {
            var hist = imageproc.buildHistogram(imageData, channels[i].key);
            histograms.push({
                data: hist,
                color: channels[i].color
            });
            cdfs.push({
                data: imageproc.buildCDF(hist),
                color: channels[i].color
            });
        }

        imageproc.drawHistogram(histogramCanvasId, histograms);
        imageproc.drawCDF(cdfCanvasId, cdfs);
    }

    /*
     * Refresh both input/output histogram and CDF displays
     */
    imageproc.updateHistogramDisplays = function() {
        renderGroup(
            getCanvasImageData("input"),
            "input-hist",
            "input-histogram",
            "input-cdf"
        );

        renderGroup(
            getCanvasImageData("output"),
            "output-hist",
            "output-histogram",
            "output-cdf"
        );
    };

    $(document).ready(function() {
        $("#input-hist-red, #input-hist-green, #input-hist-blue, #input-hist-gray, #input-hist-value, #input-hist-v, " +
          "#output-hist-red, #output-hist-green, #output-hist-blue, #output-hist-gray, #output-hist-value, #output-hist-v")
            .on("change", function() {
                imageproc.updateHistogramDisplays();
            });

        imageproc.updateHistogramDisplays();
    });

}(window.imageproc = window.imageproc || {}));