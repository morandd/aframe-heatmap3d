




/**
 * Terrain heatmap/heightmap model component for A-Frame.
 */
 AFRAME.registerComponent('aframe-heatmap3d', {
  schema: {
    src: {
      type: 'asset',
      default:''
    },
    srcMobile: {
      type: 'asset',
      default:''
    },
    palette: {
      type: 'string',
      default: 'redblue' // Taken from Color Brewer. Must be a valid JSON string (readable by JSON.parse())
    },
    opacityMin: {
      type: 'number',
      default: 0.2
    },
    opacityMax: {
      type: 'number',
      default: 1
    },
    renderMode: {
      type: 'string',
      default: 'surface' // 'surface' or 'particles'
    },
    particleSize: {
      type: 'number',
      default: 1.0
    },
    ignoreZeroValues: {
      type: 'boolean',
      default: true
    },
    stackBlurRadius: {
      type: 'number',
      default: null
    },
    stackBlurRadiusMobile: {
      type: 'number',
      default: null // Defaults to same as stackBlurRadius
    },
    scaleOpacity: {
      type: 'boolean',
      default: true
    },
    scaleOpacityMethod: {
      type: 'string',
      default: 'linear' // Can be 'log' or 'linear'
    },
    invertElevation: {
      type: 'boolean',
      default: false
    },
    height: {
      type: 'number'
    },
    width: {
      type: 'number'
    }
  },



  init: function() {
    this.data.stackBlurRadiusMobile  = this.data.stackBlurRadiusMobile || this.data.stackBlurRadius;
  },


  customVertexShader: '' +
    '     attribute float opacity;' +
    '     varying vec3 vColor;' +
    '     varying float vOpacity;' +
    '     void main() {' +
    '       vColor = color;' +
    '       vOpacity = opacity;' +
    '       gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );;' +
    '     }',

  customFragShader: '' +
    '     varying vec3 vColor;' +
    '     varying float vOpacity;' +
    '     void main() {' +
    '       gl_FragColor = vec4( vColor, vOpacity );' +
    '     }',


  customPointsVertexShader: '' +
    '     varying vec3 vColor;' +
    '     uniform float pointsize;' +
    '     void main() {' +
    '       vColor = color;' +
    '       gl_PointSize = pointsize;' +
    '       gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );;' +
    '     }',

  customPointsFragShader: '' +
    '     varying vec3 vColor;' +
    '     void main() {' +
    '       gl_FragColor = vec4( vColor, 1.0 );' +
    '     }',

  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   */
   update: function (oldData) {
    var thisComponent = this;
    var el = this.el;
    var data = this.data;

    data.src = data.src || ''; // If user does not specify, this is 'undefined' instead of ''. Fix here.
    data.srcMobile = data.srcMobile || ''; 

    var diff = AFRAME.utils.diff(data, oldData);



    if ("src" in diff && (data.src.length>0 || data.srcMobile.length>0)) {
      var img = document.querySelectorAll('[src="' + (AFRAME.utils.device.isMobile() ?  data.srcMobile : data.src) + '"]');
      img=img[0];
      if (img.complete) onImageLoaded(); else img.addEventListener("load",onImageLoaded);
      return;
      function onImageLoaded(){
        // Render the image into an invisible canvas
        data.canvas = document.createElement('canvas');
        data.canvas.setAttribute("width", img.width);
        data.canvas.setAttribute("height", img.height);
        data.canvas.style.display="none";
        document.body.appendChild(data.canvas);
        var context = data.canvas.getContext('2d');
        var blurRadius = AFRAME.utils.device.isMobile() ?  (data.stackBlurRadiusMobile || -1) : (data.stackBlurRadius || -1);
        context.drawImage(img, 0, 0);
        if (blurRadius>0) {
          console.time("aframe-heatmap3d: blur image");
          StackBlur.canvasRGBA(data.canvas, 0, 0, img.width,  img.height, blurRadius);
          console.timeEnd("aframe-heatmap3d: blur image");
        }
        data.canvasContext = context;

        thisComponent.update(data);  // Fire update() again so we can run the code below and actually generate the terrain mesh
      }// onImageLoaded
    } // "src" in diff?

    // Only (re-)generate the mesh if we have DEM data
    if (!data.canvasContext) { return; }

    if ("particles" === data.renderMode && data.scaleOpacity) console.warn('aframe-heatmap3d: renderMode=particles and scaleOpacity is True, may look strange');


    /*
     * Convert palette string into array of colors
     * We put built-in palettes here too.
     */
    if (!Array.isArray(data.palette)) {
      if ("greypurple" === data.palette) {
        data.palette=['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#6e016b'];
      } else if ("aquablues" === data.palette) {
        data.palette = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'];
      } else if ("reds" === data.palette) {
        data.palette = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000'];
      } else if ("redblue" === data.palette) {
        data.palette = ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"];  
      } else if ("grass" === data.palette) {
        data.palette = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];
      } else if ("greens" === data.palette) {
        data.palette = ['#78c679','#41ab5d','#238443','#006837','#004529'];
      } else if ("autumn" === data.palette) {
        data.palette = ['#ffffe5','#fff7bc','#fee391','#fec44f','#fe9929','#ec7014','#cc4c02','#993404','#662506'];
      } else {
        data.palette  = JSON.parse(data.palette.replace(/'/g ,'"'));
      }
    }

    // Create the plane geometry
    console.time("aframe-heatmap3d: base geometry");
    var geometry = new THREE.PlaneBufferGeometry(data.width, data.height, data.canvas.width-1, data.canvas.height-1);
    console.timeEnd("aframe-heatmap3d: base geometry");



    // Adjust each vertex in the plane to correspond to the height value in the DEM file.
    var verts = geometry.attributes.position;
    var NVERTS = verts.count;
    var vertexColors = new Float32Array( NVERTS * 3 );
    var vertexOpacities = new Float32Array( NVERTS);
    // We'll read the Red value from the image data to get height value for each pixel
    var imgBytes = data.canvasContext.getImageData(0, 0,data.canvas.width, data.canvas.height).data;

    // Use D3's color mapping functions to map values to the color palette
    var funcColorize  = null;
    if (vertexColors && d3) {
      funcColorize = d3.scaleQuantize().domain([0, 1]).range(data.palette);
    }


    // Now we can finally calculate the vertex heights, colors, and opacities
    var clr;
    var vi = 2; // Index of the "z" axis value for each vertex  (starting with the first vertex)
    var di = 0; // Index into the elevation data. Also used to index attributes that have only 1 value per vertex (not 3 values, like position)
    var ci = 1; // Index into the canvasContext.getImage2D data. This has to be incremented in steps of 4 since it is RGBA tuples
    var val=0; // Value from the elevation DEM
    var bigint; // Temp variable, used for colors
    var sm= data.scaleOpacity ? 0 : -1; // Shorthand value for scaleOpacityMethod
    var maxPixelVal=0, minPixelVal=255;
    if (data.scaleOpacityMethod==="log") sm=1;
    if (data.scaleOpacityMethod==="log10") sm=2;

    console.time("aframe-heatmap3d: calculate mesh");


    // In the image white=255 RGB but equals 0 elevation, and black=0=1 elevation
    // But maybe the user wants to invert this, so that black=0 elevation and white=1. We do that here.
    if (data.invertElevation) for (ci=0; ci<imgBytes.length; ci+=4) imgBytes[ci] = 255 - imgBytes[ci];


    // Get maximum pixel value from elevation image, so we can scale elevation into a 0-1 range
    for (ci=0; ci<imgBytes.length; ci+=4) {
      maxPixelVal = Math.max(maxPixelVal, imgBytes[ci]);
      minPixelVal = Math.min(minPixelVal, imgBytes[ci]);
    }

    for (vi=2, di=0, ci=0;    vi<NVERTS*3;   vi+=3, di++, ci+=4) {

      // Get this pixels' elevation, in the range 0-1. Do 1- so that white=0 and black=1
      val = 1 - (imgBytes[ci]*1.0-minPixelVal)/(maxPixelVal-minPixelVal); 

      // Set the Z-axis value. Range is 0-1
      verts.array[vi] = val;

      // Calculate opacity
      if (sm===-1) {
        vertexOpacities[di] = 1;
      } else if (sm===0) {
        vertexOpacities[di] = Math.max(data.opacityMin, val * data.opacityMax);
      } else if (sm===1) {
        vertexOpacities[di] = Math.max(data.opacityMin, Math.log(val+1) / Math.log(2) * data.opacityMax);
      } else if (sm===2) {
        vertexOpacities[di] = Math.max(data.opacityMin, Math.log10(val+1) / Math.log10(2) * data.opacityMax);
      }

      if (data.ignoreZeroValues && imgBytes[ci]===255) vertexOpacities[di] =0;

      // Calculate vertex color
      clr = funcColorize(val); // Returns a string like "#ff0000"
      // Using a fast hexToRgb method (https://jsperf.com/2014-09-16-hex-to-rgb)
      // See also discussion at http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
      bigint = parseInt(clr.substr(1), 16); // Trim leading "#"
      vertexColors[vi-2] = ((bigint >> 16) & 255) / 255.0;
      vertexColors[vi-1] = ((bigint >> 8) & 255) / 255.0;
      vertexColors[vi-0] = (bigint & 255) / 255.0;
    }

    // Add the vertex coloring and opacity data to the geometry
    geometry.addAttribute( 'color', new THREE.BufferAttribute( vertexColors, 3 ) );
    geometry.addAttribute( 'opacity', new THREE.BufferAttribute( vertexOpacities, 1 ) );
    // and let THREE know that we've updated the BufferGeometry data
    geometry.attributes.position.needsUpdate = true;

    console.timeEnd("aframe-heatmap3d: calculate mesh");



    /*
     * Create a material. To use RGBA for each vertex we must use a custom shader material:
     * See: https://github.com/mrdoob/three.js/issues/2118
     * If there is no transparency, we can use a normal Lambert material.
     */
    var material;
    if (data.scaleOpacity) {
      material = new THREE.ShaderMaterial({
        vertexShader:   this.customVertexShader,
        fragmentShader: this.customFragShader,
        blending:       THREE.NormalBlending,
        wireframe:      false,
        depthTest:      true,
        transparent:    true,
        vertexColors:THREE.VertexColors
      });
    } else {
      if ("surface" === data.renderMode) {
        material = new THREE.MeshLambertMaterial({
          transparent: false,
          vertexColors:THREE.VertexColors
        });
      } else {
        material = new THREE.ShaderMaterial({
          uniforms: {
            pointsize: {value: data.particleSize }
          },
          vertexShader:   this.customPointsVertexShader,
          fragmentShader: this.customPointsFragShader,
          blending:       THREE.NormalBlending,
          wireframe:      false,
          depthTest:      false,
          transparent:    false,
          vertexColors:THREE.VertexColors
        });

      }
    }


    // Create the surface mesh and register it under entity's object3DMap
    var surface;
    if ("surface" === data.renderMode) {
      surface = new THREE.Mesh(geometry, material);
    } else {
      geometry.removeAttribute('normal');
      geometry.removeAttribute('uv');
      geometry.removeAttribute('opacity');
      surface = new THREE.Points(geometry, material);//, material);

    }
    surface.rotation.x = -90 * Math.PI / 180;
    el.setObject3D('terrain-heatmap', surface);

  }, // end function update()




   remove: function () {
    this.el.removeObject3D('terrain-heatmap');
  }

});
