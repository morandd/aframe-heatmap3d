// PlaneBufferGeometry


Heatmap3dPlaneBufferGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
Heatmap3dPlaneBufferGeometry.prototype.constructor = Heatmap3dPlaneBufferGeometry;


function Heatmap3dPlaneBufferGeometry( width, height, widthSegments, heightSegments, vals, skipZeros ) {

	THREE.BufferGeometry.call( this );

	var width_half = width / 2;
	var height_half = height / 2;

	var gridX = Math.floor( widthSegments ) || 1;
	var gridY = Math.floor( heightSegments ) || 1;

	var gridX1 = gridX + 1;
	var gridY1 = gridY + 1;

	var segment_width = width / gridX;
	var segment_height = height / gridY;

	var ix, iy;

	// buffers

	var indices = [];
	var vertices = [];
	var normals = [];
	var uvs = [];

	// generate vertices, normals and uvs

	for ( iy = 0; iy < gridY1; iy ++ ) {

		var y = iy * segment_height - height_half;

		for ( ix = 0; ix < gridX1; ix ++ ) {

			var x = ix * segment_width - width_half;

			vertices.push( x, - y,   vals[iy*gridY1 + ix ]  );

			normals.push( 0, 0, 1 );

			uvs.push( ix / gridX );
			uvs.push( 1 - ( iy / gridY ) );

		}

	}

	// indices

	for ( iy = 0; iy < gridY; iy ++ ) {

		for ( ix = 0; ix < gridX; ix ++ ) {


			var a = ix + gridX1 * iy;
			var b = ix + gridX1 * ( iy + 1 );
			var c = ( ix + 1 ) + gridX1 * ( iy + 1 );
			var d = ( ix + 1 ) + gridX1 * iy;

			// faces
			// If skipZeros is false we draw the face no matter what
			// If skipZeros is true, we draw the face only if we have one vertex.z>0

			if (!skipZeros || Math.max(vertices[a*3+2], vertices[b*3+2],vertices[d*3+2])>0)
			indices.push( a, b, d );

			if (!skipZeros || Math.max(vertices[b*3+2], vertices[c*3+2],vertices[d*3+2])>0)
			indices.push( b, c, d );

		}

	}

	// build geometry

	// Note: setIndex has different code in AFRAME 0.5.0 than at current THREE github.
	this.setIndex( new THREE.Uint32BufferAttribute( indices, 1) );
	this.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
	this.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
	this.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );



}
