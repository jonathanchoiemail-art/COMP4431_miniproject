# COMP4431_miniproject


## Image Histogram Equalization and Histogram Visualization


Description

In this project, we will add histogram equalization and histogram visualization to the existing image processing lab. The GUI will be adjusted to accommodate this feature on top of the image processing lab framework.

This project will provide histogram equalization on RGB channels and grayscale for input image. Techniques from the OpenCV documentation on histogram equalization and lecture notes on image histograms will be applied. 
https://opencv24-python-tutorials.readthedocs.io/en/latest/py_tutorials/py_imgproc/py_histograms/py_histogram_equalization/py_histogram_equalization.html

https://en.wikipedia.org/wiki/Histogram_equalization

For equalization, the image intensity histogram will be computed first, and the CDF (cumulative distribution function) will be used to remap each intensity level to a new value.

Standard histogram equalization can over-amplify noise in homogeneous regions. As an advanced option, we will implement regional histogram equalization using CLAHE as an advanced option to address this.

We will provide a visualization of the histograms and CDF curves of the input and output images. This allows users to observe how the pixel intensity distribution changes before and after the equalization.


Functionalities


Features called “Histogram Equalization” and “CLAHE” will be added to the new dropdown list, and “Histogram Visualization” will be added to the bottom of the page. The following functionalities/ features will be added to the image processing lab program.

1. Basic Histogram Equalization:
Basic Parameters:
A dropdown list to choose Equalization mode:
Grayscale Equalization
RGB Channel Equalization (equalize R, G, B channels independently)


Pressing the “update output” performs the following actions:
Applies histogram equalization to the current image using the selected mode
Updates the output image display area

2. CLAHE (Advanced Feature):
Basic Parameters:
Located under the same "Histogram Equalization" dropdown menu
User selects "CLAHE (Regional Equalization)" from the dropdown

User controls:
Clip limit slider (range 1–10, default 3)
Tile size selector (4×4, 8×8, 16×16, default 8×8)
Mode selector (dropdown):
Grayscale CLAHE (process luminance only)
RGB Channel CLAHE (process each channel independently)

Pressing the “update output” performs the following actions:
Executes CLAHE and updates output canvas
Histogram and CDF visualizations also work for CLAHE results

3. Histogram Visualization 
Basic Parameters:
A separate panel that displays histograms and CDF curves for both input and output images

Pressing the “update output” performs the following actions
Display Layout:
Left side: input image histograms and CDFs
Right side: Output image histograms and CDFs

Channel Selection (independent for input and output):
A checkbox group to select which histogram(s) to display:
 ☐ Red Channel    ☐ Green Channel    ☐ Blue Channel    ☐ Grayscale

Visualization Types:
A canvas area showing the selected histograms (bar chart, 256 bins)
A canvas area showing the CDF curve (line chart, range 0-1)

Automatic Update:
Displays automatically refresh after applying processing
Visualization panel remains visible while using other operations



