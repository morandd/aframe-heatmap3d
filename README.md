# aframe-heatmap3d
Terrain-like heatmap data viz component for AFrame. Provide your data as an greyscale image, then choose a palette, opacity settings, and blur radius.


<img src="https://morandd.github.io/aframe-heatmap3d/example/example.png" width="400px"/>
<img src="https://morandd.github.io/aframe-heatmap3d/example/example2.png" width="400px"/>


[Examples](https://morandd.github.io/aframe-heatmap3d/example/)

[GitHub](https://github.com/morandd/aframe-heatmap3d/)

This component is totally indebted to [Bryik's terrain component](https://github.com/bryik/aframe-terrain-model-component) and the work by others that went into that. This component is separated from that one because the usage and internals have totally changed, but the basic approach is the same.


# API #

Attribute | Description | Default
--- | --- | ---
src | Data to visualize: image URL or AFrame asset (e.g. '#myImage')  | |
srcMobile | Alternative URL to use when viewing on mobile devices | |
palette | Color palette | redblue |
scaleOpacity | Scale opacity of peaks? | true
scaleOpacityMethod | "log" or "linear" scaling of opacity | "linear"
opacityMin | Minimum opacity | 0.2 
opacityMax | Max opacity | 1
ignoreZeroValues | If true, zero values in the data will not be rendered | true
stretch | If true, we will stretch the image values so they fill the range 0-255. | false
stackBlurRadius | Blur effect. See below. | null
stackBlurRadiusMobile | Blur effect. See below. | =stackBlurRadius
invertElevation | Default: white=1, black=0. If this is true, white=0, black=1 | false
renderMode | "surface" or "particles" | surface
particleSize | Particle size, for renderMode=particles | 1.0
width | width of component, in AFrame units | 1
height | depth of component (on Z axis, not Y axis), in AFrame units. Note that the height (Y axis) is always 1 | =width

## Using ##
Supply a greyscale image (or a color image, in which case the Red pixel value is taken). Normally white=0 elevation and black=1 elevation, or use invertElevation to switch this. Greyscale values are respected, or use `stretch:true` to stretch the values
so it fully covers elevation 0 to elevation 1. The component is always 1 aframe unit high, so adjust the entity's "scale" Y axis attribute to adjust the height.

### Color Palettes ###
There are a few built-in palettes: `greypurple`, `aquablues`, `reds`, `redblue`, `grass`, `greens`, and `autumn`. These are taken from
[ColorBrewer](http://colorbrewer2.org). You can also specify a palette as a JSON array, as shown in the example. To make a mono-colored surface, supply palette with a single entry, e.g `"...;  palette: ['#ff0000']; ..."`

### Particle mode ###
To render the map as particles instead of a continuous surface, specify renderMode:particles and optionally adjust the particleSize. It may be nice to fix the camera position if you use particle mode, because particles are always the same size regardless of how close/far the camera is from them. So when viewed from afar, we see a dense cloud, but when zoomed in, individual particles become hard to see as they are still small but now widely spaced.


## Blurring ##
You should generate the heap maps properly and feed them as images to this component to display. However a poor man's way of building heatmaps is to plonk down the data in an image, then blur it.

Health warning: Blurring the data at the client is hacky. It's slow, and if you're displaying scientific data, not so denfensible/transparent. That said, it can be a useful shortcut. To blur we can use the StackBlur javascript library. You can provide a sharp image as the `src` then specify a stackBlur value, and the StackBlur library will be invoked. Note it is a bit slow: in the example, blurring takes 0.6s on a modern Macbook Pro, which slows page load time. So it is better to blur the source image. 


# Using #
D3 is required.

```
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/4.4.1/d3.min.js"></script> 
<script src="aframe-heatmap3d.js"></script>

<!-- Optional: (only needed if you want to use StackBlur) -->
<script src="stackblur.min.js"></script>

```

## TODO ##
- Improve handling of load sequence, use Promises and onload events properly.
- Allow JSON input. To implement this, the user can specify a 2-dimensional array as JSON, or set of x/y/value points, which are drawn to a canvas then blurred.


