# aframe-heatmap3d
Terrain-like heatmap data viz component for AFrame

![alt text](http://img "Example image")




# API #

Attribute | Description | Default
--- | --- | ---
src | Data to visualize  | |
srcMobile | Alternative URL to use when viewing on mobile devices | |
palette | Color palette | redblue |
opacityMin | Minimum opacity | 0.2 
opacityMax | Max opacity | 1
ignoreZeroValues | If true, zero values in the data will not be rendered | true
stackBlurRadius | Blur effect. See below. | null
stackBlurRadiusMobile | Blur effect. See below. | =stackBlurRadius
scaleOpacity | Scale opacity of peaks? | true
scaleOpacityMethod | "log" or "linear" scaling of opacity | "linear"
invertElevation | Default: white=1, black=0. If this is true, white=0, black=1 | false
width | width of component, in AFrame units | 1
height | depth of component (on Z axis, not Y axis), in AFrame units. Note that the height (Y axis) is always 1 | =width


### Color Palettes ###
There are a few built-in palettes: `greypurple`, `aquablues`, `reds`, `redblue`, `grass`, `greens`, and `autumn`. These are taken from
[ColorBrewer](http://colorbrewer2.org). You can also specify a palette as a JSON array, as shown in the example.

## Blurring ##

You shou
You should blur the data before 

Blurring is computationally expensive



# Using #
```
	<script src="aframe-heatmap3d.js"></script>

   <!-- Optional: (only needed if you want to use StackBlur) -->
	<script src="stackblur.min.js"></script>

```

