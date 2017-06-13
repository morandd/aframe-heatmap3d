




/**
 * Terrain heatmap/heightmap model component for A-Frame.
 */
 AFRAME.registerComponent('aframe-heatmap3d', {
  multiple: true,
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
    flipPalette: {
      type: 'boolean',
      default: false
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
    particleDepthTest: {
      type: 'boolean',
      default: false
    },
    ignoreZeroValues: {
      type: 'boolean',
      default: true
    },
    ignoreTransparentValues: {
      type: 'boolean',
      default: true,
    },
    stackBlurRadius: {
      type: 'number',
      default: -1
    },
    stackBlurRadiusMobile: {
      type: 'number',
      default: -1 // Defaults to same as stackBlurRadius
    },
    scaleOpacity: { // Per-vertex opacity scaling?
      type: 'boolean',
      default: true
    },
    scaleOpacityMethod: {
      type: 'string',
      default: 'linear' // Can be 'log' 'linear', or 'const'. If 'const' and scaleOpacity=false, we set 
    },
   stretch: {
       type: 'boolean',
      default: false
   },
    invertElevation: {
      type: 'boolean',
      default: false
    },
    height: {
      type: 'number',
      default: -1
    },
    width: {
      type: 'number',
      default: -1
    },
    material: {
      type: 'string', default:'default' // Can be "standard", "lambert", or "phong"
    },
    wireframe: {
      type: 'boolean', default:false
    },
    emissive: {
      type: 'color', default: '#000000'
    },
    emissiveIntensity: {
      type: 'number', default: 1
    },
    shininess: {
      type: 'number', default: 30
    }, 
    metalness: {
      type: 'number', default: 0.5
    },
    roughness: {
      type: 'number', default: 0.5
    },
    blending: {
      type: 'string', default: 'THREE.NormalBlending'
    },
    specular: { type: 'color', default: '#111111'}
  },



  init: function() {
    this.data.stackBlurRadiusMobile  = this.data.stackBlurRadiusMobile>=0 ?  this.data.stackBlurRadiusMobile : this.data.stackBlurRadius;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute("width", 0);
    this.canvas.setAttribute("height", 0);
    this.canvasContext =  this.canvas.getContext('2d');
    this.canvasReady=false;
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


    if ("src" in diff) { //} && (data.src.length>0 || data.srcMobile.length>0)) {
      //var img = document.querySelectorAll('[src="' + (AFRAME.utils.device.isMobile() ?  data.srcMobile : data.src) + '"]');
      //img=img[0];
      var img = AFRAME.utils.device.isMobile() ?  data.srcMobile : data.src;
      // This is handled differently by various versions of AFrame:
      if (typeof img === "string") { img = document.querySelectorAll('[src="' + img + '"]'); img=img[0]; }
      if (img.complete) onImageLoaded(); else img.addEventListener("load",onImageLoaded);
      return;
      function onImageLoaded(){
        // Render the image into an invisible canvas
        thisComponent.canvas = document.createElement('canvas');
        thisComponent.canvas.setAttribute("width", img.width);
        thisComponent.canvas.setAttribute("height", img.height);
        data.aspectRatio = img.width / img.height;
        thisComponent.canvas.style.display="none";
//        document.body.appendChild(data.canvas);
        var blurRadius = AFRAME.utils.device.isMobile() ?  data.stackBlurRadiusMobile  : data.stackBlurRadius;
        thisComponent.canvas.getContext('2d').drawImage(img, 0, 0);
        if (blurRadius>0) {
          console.time("aframe-heatmap3d: blur image");
          StackBlur.canvasRGBA(thisComponent.canvas, 0, 0, img.width,  img.height, blurRadius);
          console.timeEnd("aframe-heatmap3d: blur image");
        }
        thisComponent.canvasContext =  thisComponent.canvas.getContext('2d');
        thisComponent.canvasReady=true;
        data.updateGeometry=true;

        thisComponent.update(data);  // Fire update() again so we can run the code below and actually generate the terrain mesh
      }// onImageLoaded
    } // "src" in diff?






    // Only (re-)generate the mesh if we have DEM data
    if (!thisComponent.canvasReady) { return; }


    if ("particles" === data.renderMode && data.scaleOpacity) {
      data.scaleOpacity = false;
      console.warn('aframe-heatmap3d: Since renderMode=particles, forcing scaleOpacity=false');
    }


    /*
     * Convert palette string into array of colors
     * We put built-in palettes here too.
     */
    if ("palette" in diff || !Array.isArray(this.palette)) {
      if ("greypurple" === data.palette) {
        this.palette=['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#6e016b'];
      } else if ("aquablues" === data.palette) {
        this.palette = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'];
      } else if ("reds" === data.palette) {
        this.palette = ['#E5E5E5','#E6DEDE','#E7D7D7','#E7D0D0','#E8C9C9','#E9C2C2','#EABBBB','#EAB4B4','#EBADAD','#ECA6A6','#ED9F9F','#EE9898','#EE9292','#EF8B8B','#F08484','#F17D7D','#F17676','#F26F6F','#F36868','#F46161','#F45A5A','#F55353','#F64C4C','#F74545','#F83E3E','#F83737','#F93030','#FA2929','#FB2222','#FB1B1B','#FC1414','#FD0D0D','#FE0606','#FF0000','#FB0001','#F80103','#F50204','#F20206','#EF0307','#EC0409','#E9040A','#E6050C','#E3060D','#E0060F','#DD0710','#DA0812','#D70813','#D40915','#D10A16','#CE0A18','#CA0B1A','#C70C1B','#C40C1D','#C10D1E','#BE0E20','#BB0E21','#B80F23','#B51024','#B21026','#AF1127','#AC1229','#A9132A','#A6132C','#A3142D'];
        //this.palette = ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000'];
      } else if ("redblue" === data.palette) {
        this.palette = ["#2166ac", "#4393c3", "#92c5de", "#d1e5f0", "#fddbc7", "#f4a582", "#d6604d", "#b2182b"];  
      } else if ("RdYlBu" === data.palette) {
        this.palette = ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'];
      } else if ("purples" === data.palette) {
        this.palette = ['#EFEFEF','#F0E4F0','#F1D8F1','#F1CDF1','#F2C2F2','#F3B6F3','#F4ABF4','#F49FF4','#F594F5','#F688F6','#F67DF6','#F772F7','#F866F8','#F95BF9','#F94FF9','#FA44FA','#FB39FB','#FC2DFC','#FC22FC','#FD16FD','#FE0BFE','#FF00FF','#FB02FB','#F804F8','#F406F4','#F109F1','#EE0BEE','#EA0DEA','#E710E7','#E312E3','#E014E0','#DD16DD','#D919D9','#D61BD6','#D21DD2','#CF20CF','#CC22CC','#C824C8','#C527C5','#C129C1','#BE2BBE','#BB2DBB','#B730B7','#B432B4','#B034B0','#AD37AD','#AA39AA','#A63BA6','#A33DA3','#9F409F','#9C429C','#994499','#8C3F8C','#7F397F','#723372','#662D66','#592859','#4C224C','#3F1C3F','#331633','#261126','#190B19','#0C050C','#000000'];
     } else if ("grass" === data.palette) {
        this.palette = ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529'];
      } else if ("greens" === data.palette) {
        this.palette = ['#78c679','#41ab5d','#238443','#006837','#004529'];
      } else if ("winter" === data.palette) {
        this.palette = ['#0000FF','#0004FC','#0008FA','#000CF8','#0010F6','#0014F4','#0018F2','#001CF0','#0020EE','#0024EC','#0028EA','#002CE8','#0030E6','#0034E4','#0038E2','#003CE0','#0040DE','#0044DC','#0048DA','#004CD8','#0050D6','#0055D4','#0059D2','#005DD0','#0061CE','#0065CC','#0069CA','#006DC8','#0071C6','#0075C4','#0079C2','#007DC0','#0081BE','#0085BC','#0089BA','#008DB8','#0091B6','#0095B4','#0099B2','#009DB0','#00A1AE','#00A5AC','#00AAAA','#00AEA7','#00B2A5','#00B6A3','#00BAA1','#00BE9F','#00C29D','#00C69B','#00CA99','#00CE97','#00D295','#00D693','#00DA91','#00DE8F','#00E28D','#00E68B','#00EA89','#00EE87','#00F285','#00F683','#00FA81','#00FF7F'];
      } else if ("plasma" === data.palette) {
        this.palette =['#0C0786','#100787','#130689','#15068A','#18068B','#1B068C','#1D068D','#1F058E','#21058F','#230590','#250591','#270592','#290593','#2B0594','#2D0494','#2F0495','#310496','#330497','#340498','#360498','#380499','#3A049A','#3B039A','#3D039B','#3F039C','#40039C','#42039D','#44039E','#45039E','#47029F','#49029F','#4A02A0','#4C02A1','#4E02A1','#4F02A2','#5101A2','#5201A3','#5401A3','#5601A3','#5701A4','#5901A4','#5A00A5','#5C00A5','#5E00A5','#5F00A6','#6100A6','#6200A6','#6400A7','#6500A7','#6700A7','#6800A7','#6A00A7','#6C00A8','#6D00A8','#6F00A8','#7000A8','#7200A8','#7300A8','#7500A8','#7601A8','#7801A8','#7901A8','#7B02A8','#7C02A7','#7E03A7','#7F03A7','#8104A7','#8204A7','#8405A6','#8506A6','#8607A6','#8807A5','#8908A5','#8B09A4','#8C0AA4','#8E0CA4','#8F0DA3','#900EA3','#920FA2','#9310A1','#9511A1','#9612A0','#9713A0','#99149F','#9A159E','#9B179E','#9D189D','#9E199C','#9F1A9B','#A01B9B','#A21C9A','#A31D99','#A41E98','#A51F97','#A72197','#A82296','#A92395','#AA2494','#AC2593','#AD2692','#AE2791','#AF2890','#B02A8F','#B12B8F','#B22C8E','#B42D8D','#B52E8C','#B62F8B','#B7308A','#B83289','#B93388','#BA3487','#BB3586','#BC3685','#BD3784','#BE3883','#BF3982','#C03B81','#C13C80','#C23D80','#C33E7F','#C43F7E','#C5407D','#C6417C','#C7427B','#C8447A','#C94579','#CA4678','#CB4777','#CC4876','#CD4975','#CE4A75','#CF4B74','#D04D73','#D14E72','#D14F71','#D25070','#D3516F','#D4526E','#D5536D','#D6556D','#D7566C','#D7576B','#D8586A','#D95969','#DA5A68','#DB5B67','#DC5D66','#DC5E66','#DD5F65','#DE6064','#DF6163','#DF6262','#E06461','#E16560','#E26660','#E3675F','#E3685E','#E46A5D','#E56B5C','#E56C5B','#E66D5A','#E76E5A','#E87059','#E87158','#E97257','#EA7356','#EA7455','#EB7654','#EC7754','#EC7853','#ED7952','#ED7B51','#EE7C50','#EF7D4F','#EF7E4E','#F0804D','#F0814D','#F1824C','#F2844B','#F2854A','#F38649','#F38748','#F48947','#F48A47','#F58B46','#F58D45','#F68E44','#F68F43','#F69142','#F79241','#F79341','#F89540','#F8963F','#F8983E','#F9993D','#F99A3C','#FA9C3B','#FA9D3A','#FA9F3A','#FAA039','#FBA238','#FBA337','#FBA436','#FCA635','#FCA735','#FCA934','#FCAA33','#FCAC32','#FCAD31','#FDAF31','#FDB030','#FDB22F','#FDB32E','#FDB52D','#FDB62D','#FDB82C','#FDB92B','#FDBB2B','#FDBC2A','#FDBE29','#FDC029','#FDC128','#FDC328','#FDC427','#FDC626','#FCC726','#FCC926','#FCCB25','#FCCC25','#FCCE25','#FBD024','#FBD124','#FBD324','#FAD524','#FAD624','#FAD824','#F9D924','#F9DB24','#F8DD24','#F8DF24','#F7E024','#F7E225','#F6E425','#F6E525','#F5E726','#F5E926','#F4EA26','#F3EC26','#F3EE26','#F2F026','#F2F126','#F1F326','#F0F525','#F0F623','#EFF821'];
      } else if ("viridis" === data.palette) {
        this.palette = ['#440154','#440255','#440357','#450558','#45065A','#45085B','#46095C','#460B5E','#460C5F','#460E61','#470F62','#471163','#471265','#471466','#471567','#471669','#47186A','#48196B','#481A6C','#481C6E','#481D6F','#481E70','#482071','#482172','#482273','#482374','#472575','#472676','#472777','#472878','#472A79','#472B7A','#472C7B','#462D7C','#462F7C','#46307D','#46317E','#45327F','#45347F','#453580','#453681','#443781','#443982','#433A83','#433B83','#433C84','#423D84','#423E85','#424085','#414186','#414286','#404387','#404487','#3F4587','#3F4788','#3E4888','#3E4989','#3D4A89','#3D4B89','#3D4C89','#3C4D8A','#3C4E8A','#3B508A','#3B518A','#3A528B','#3A538B','#39548B','#39558B','#38568B','#38578C','#37588C','#37598C','#365A8C','#365B8C','#355C8C','#355D8C','#345E8D','#345F8D','#33608D','#33618D','#32628D','#32638D','#31648D','#31658D','#31668D','#30678D','#30688D','#2F698D','#2F6A8D','#2E6B8E','#2E6C8E','#2E6D8E','#2D6E8E','#2D6F8E','#2C708E','#2C718E','#2C728E','#2B738E','#2B748E','#2A758E','#2A768E','#2A778E','#29788E','#29798E','#287A8E','#287A8E','#287B8E','#277C8E','#277D8E','#277E8E','#267F8E','#26808E','#26818E','#25828E','#25838D','#24848D','#24858D','#24868D','#23878D','#23888D','#23898D','#22898D','#228A8D','#228B8D','#218C8D','#218D8C','#218E8C','#208F8C','#20908C','#20918C','#1F928C','#1F938B','#1F948B','#1F958B','#1F968B','#1E978A','#1E988A','#1E998A','#1E998A','#1E9A89','#1E9B89','#1E9C89','#1E9D88','#1E9E88','#1E9F88','#1EA087','#1FA187','#1FA286','#1FA386','#20A485','#20A585','#21A685','#21A784','#22A784','#23A883','#23A982','#24AA82','#25AB81','#26AC81','#27AD80','#28AE7F','#29AF7F','#2AB07E','#2BB17D','#2CB17D','#2EB27C','#2FB37B','#30B47A','#32B57A','#33B679','#35B778','#36B877','#38B976','#39B976','#3BBA75','#3DBB74','#3EBC73','#40BD72','#42BE71','#44BE70','#45BF6F','#47C06E','#49C16D','#4BC26C','#4DC26B','#4FC369','#51C468','#53C567','#55C666','#57C665','#59C764','#5BC862','#5EC961','#60C960','#62CA5F','#64CB5D','#67CC5C','#69CC5B','#6BCD59','#6DCE58','#70CE56','#72CF55','#74D054','#77D052','#79D151','#7CD24F','#7ED24E','#81D34C','#83D34B','#86D449','#88D547','#8BD546','#8DD644','#90D643','#92D741','#95D73F','#97D83E','#9AD83C','#9DD93A','#9FD938','#A2DA37','#A5DA35','#A7DB33','#AADB32','#ADDC30','#AFDC2E','#B2DD2C','#B5DD2B','#B7DD29','#BADE27','#BDDE26','#BFDF24','#C2DF22','#C5DF21','#C7E01F','#CAE01E','#CDE01D','#CFE11C','#D2E11B','#D4E11A','#D7E219','#DAE218','#DCE218','#DFE318','#E1E318','#E4E318','#E7E419','#E9E419','#ECE41A','#EEE51B','#F1E51C','#F3E51E','#F6E61F','#F8E621','#FAE622','#FDE724'];
      } else if ("inferno" === data.palette) {
        this.palette = ['#000003','#000004','#000006','#010007','#010109','#01010B','#02010E','#020210','#030212','#040314','#040316','#050418','#06041B','#07051D','#08061F','#090621','#0A0723','#0B0726','#0D0828','#0E082A','#0F092D','#10092F','#120A32','#130A34','#140B36','#160B39','#170B3B','#190B3E','#1A0B40','#1C0C43','#1D0C45','#1F0C47','#200C4A','#220B4C','#240B4E','#260B50','#270B52','#290B54','#2B0A56','#2D0A58','#2E0A5A','#300A5C','#32095D','#34095F','#350960','#370961','#390962','#3B0964','#3C0965','#3E0966','#400966','#410967','#430A68','#450A69','#460A69','#480B6A','#4A0B6A','#4B0C6B','#4D0C6B','#4F0D6C','#500D6C','#520E6C','#530E6D','#550F6D','#570F6D','#58106D','#5A116D','#5B116E','#5D126E','#5F126E','#60136E','#62146E','#63146E','#65156E','#66156E','#68166E','#6A176E','#6B176E','#6D186E','#6E186E','#70196E','#72196D','#731A6D','#751B6D','#761B6D','#781C6D','#7A1C6D','#7B1D6C','#7D1D6C','#7E1E6C','#801F6B','#811F6B','#83206B','#85206A','#86216A','#88216A','#892269','#8B2269','#8D2369','#8E2468','#902468','#912567','#932567','#952666','#962666','#982765','#992864','#9B2864','#9C2963','#9E2963','#A02A62','#A12B61','#A32B61','#A42C60','#A62C5F','#A72D5F','#A92E5E','#AB2E5D','#AC2F5C','#AE305B','#AF315B','#B1315A','#B23259','#B43358','#B53357','#B73456','#B83556','#BA3655','#BB3754','#BD3753','#BE3852','#BF3951','#C13A50','#C23B4F','#C43C4E','#C53D4D','#C73E4C','#C83E4B','#C93F4A','#CB4049','#CC4148','#CD4247','#CF4446','#D04544','#D14643','#D24742','#D44841','#D54940','#D64A3F','#D74B3E','#D94D3D','#DA4E3B','#DB4F3A','#DC5039','#DD5238','#DE5337','#DF5436','#E05634','#E25733','#E35832','#E45A31','#E55B30','#E65C2E','#E65E2D','#E75F2C','#E8612B','#E9622A','#EA6428','#EB6527','#EC6726','#ED6825','#ED6A23','#EE6C22','#EF6D21','#F06F1F','#F0701E','#F1721D','#F2741C','#F2751A','#F37719','#F37918','#F47A16','#F57C15','#F57E14','#F68012','#F68111','#F78310','#F7850E','#F8870D','#F8880C','#F88A0B','#F98C09','#F98E08','#F99008','#FA9107','#FA9306','#FA9506','#FA9706','#FB9906','#FB9B06','#FB9D06','#FB9E07','#FBA007','#FBA208','#FBA40A','#FBA60B','#FBA80D','#FBAA0E','#FBAC10','#FBAE12','#FBB014','#FBB116','#FBB318','#FBB51A','#FBB71C','#FBB91E','#FABB21','#FABD23','#FABF25','#FAC128','#F9C32A','#F9C52C','#F9C72F','#F8C931','#F8CB34','#F8CD37','#F7CF3A','#F7D13C','#F6D33F','#F6D542','#F5D745','#F5D948','#F4DB4B','#F4DC4F','#F3DE52','#F3E056','#F3E259','#F2E45D','#F2E660','#F1E864','#F1E968','#F1EB6C','#F1ED70','#F1EE74','#F1F079','#F1F27D','#F2F381','#F2F485','#F3F689','#F4F78D','#F5F891','#F6FA95','#F7FB99','#F9FC9D','#FAFDA0','#FCFEA4'];
      } else if ("parula" === data.palette) {
        this.palette = ['#3D26A8','#3F2AB4','#412EBF','#4332CA','#4536D5','#463BDE','#4641E5','#4746EB','#474CF0','#4752F4','#4757F7','#465DFA','#4463FC','#4269FD','#3E6FFE','#3875FE','#327BFC','#2E81F9','#2D86F6','#2C8CF2','#2B91EE','#2796EB','#259BE7','#23A0E4','#1FA4E2','#1CA9DF','#18ADDB','#11B1D6','#07B4D0','#00B7C9','#01BAC3','#0BBCBC','#18BFB5','#23C1AE','#2BC3A7','#31C59F','#37C797','#3EC98D','#4ACB84','#56CC7A','#63CC6F','#71CC63','#80CB58','#8FCA4D','#9DC842','#ABC638','#B8C430','#C5C129','#D1BF27','#DCBC28','#E6BA2D','#EFB935','#F8BA3D','#FDBD3C','#FEC338','#FDC933','#FCCF30','#F9D52D','#F6DC29','#F5E227','#F4E824','#F5EF20','#F7F41B','#F9FA14'];
      } else if ("hot" === data.palette) {
        this.palette = ['#0A0000','#150000','#1F0000','#2A0000','#350000','#3F0000','#4A0000','#550000','#5F0000','#6A0000','#740000','#7F0000','#8A0000','#940000','#9F0000','#AA0000','#B40000','#BF0000','#C90000','#D40000','#DF0000','#E90000','#F40000','#FF0000','#FF0A00','#FF1500','#FF1F00','#FF2A00','#FF3500','#FF3F00','#FF4A00','#FF5500','#FF5F00','#FF6A00','#FF7400','#FF7F00','#FF8A00','#FF9400','#FF9F00','#FFAA00','#FFB400','#FFBF00','#FFC900','#FFD400','#FFDF00','#FFE900','#FFF400','#FFFF00','#FFFF0F','#FFFF1F','#FFFF2F','#FFFF3F','#FFFF4F','#FFFF5F','#FFFF6F','#FFFF7F','#FFFF8F','#FFFF9F','#FFFFAF','#FFFFBF','#FFFFCF','#FFFFDF','#FFFFEF','#FFFFFF'];
      } else if ("cool" === data.palette) {
        this.palette = ['#00FFFF','#04FAFF','#08F6FF','#0CF2FF','#10EEFF','#14EAFF','#18E6FF','#1CE2FF','#20DEFF','#24DAFF','#28D6FF','#2CD2FF','#30CEFF','#34CAFF','#38C6FF','#3CC2FF','#40BEFF','#44BAFF','#48B6FF','#4CB2FF','#50AEFF','#55AAFF','#59A5FF','#5DA1FF','#619DFF','#6599FF','#6995FF','#6D91FF','#718DFF','#7589FF','#7985FF','#7D81FF','#817DFF','#8579FF','#8975FF','#8D71FF','#916DFF','#9569FF','#9965FF','#9D61FF','#A15DFF','#A559FF','#AA55FF','#AE50FF','#B24CFF','#B648FF','#BA44FF','#BE40FF','#C23CFF','#C638FF','#CA34FF','#CE30FF','#D22CFF','#D628FF','#DA24FF','#DE20FF','#E21CFF','#E618FF','#EA14FF','#EE10FF','#F20CFF','#F608FF','#FA04FF','#FF00FF'];
      } else if ("autumn" === data.palette) {
        this.palette = ['#FF0000','#FF0400','#FF0800','#FF0C00','#FF1000','#FF1400','#FF1800','#FF1C00','#FF2000','#FF2400','#FF2800','#FF2C00','#FF3000','#FF3400','#FF3800','#FF3C00','#FF4000','#FF4400','#FF4800','#FF4C00','#FF5000','#FF5500','#FF5900','#FF5D00','#FF6100','#FF6500','#FF6900','#FF6D00','#FF7100','#FF7500','#FF7900','#FF7D00','#FF8100','#FF8500','#FF8900','#FF8D00','#FF9100','#FF9500','#FF9900','#FF9D00','#FFA100','#FFA500','#FFAA00','#FFAE00','#FFB200','#FFB600','#FFBA00','#FFBE00','#FFC200','#FFC600','#FFCA00','#FFCE00','#FFD200','#FFD600','#FFDA00','#FFDE00','#FFE200','#FFE600','#FFEA00','#FFEE00','#FFF200','#FFF600','#FFFA00','#FFFF00'];
      } else if ("terrain" === data.palette) {
        this.palette = ['#333399','#31359b','#30389e','#2f3ba1','#2d3da3','#2c40a6','#2b43a9','#2945ab','#2848ae','#274bb1','#254db3','#2450b6','#2353b9','#2155bb','#2058be','#1f5bc1','#1d5dc3','#1c60c6','#1b63c9','#1965cb','#1868ce','#176bd1','#156dd3','#1470d6','#1373d9','#1175db','#1078de','#0f7be1','#0d7de3','#0c80e6','#0b83e9','#0985eb','#0888ee','#078bf1','#058df3','#0490f6','#0393f9','#0195fb','#0098fe','#009afa','#009cf4','#009eee','#00a0e8','#00a2e2','#00a4dc','#00a6d6','#00a8d0','#00aaca','#00acc4','#00aebe','#00b0b8','#00b2b2','#00b4ac','#00b6a6','#00b8a0','#00ba9a','#00bc94','#00be8e','#00c088','#00c282','#00c47c','#00c676','#00c870','#00ca6a','#01cc66','#05cd67','#09cd67','#0dce68','#11cf69','#15d06a','#19d16b','#1dd16b','#21d26c','#25d36d','#29d46e','#2dd56f','#31d56f','#35d670','#39d771','#3dd872','#41d973','#45d973','#49da74','#4ddb75','#51dc76','#55dd77','#59dd77','#5dde78','#61df79','#65e07a','#69e17b','#6de17b','#71e27c','#75e37d','#79e47e','#7de57f','#81e57f','#85e680','#89e781','#8de882','#91e983','#95e983','#99ea84','#9deb85','#a1ec86','#a5ed87','#a9ed87','#adee88','#b1ef89','#b5f08a','#b9f18b','#bdf18b','#c1f28c','#c5f38d','#c9f48e','#cdf58f','#d1f58f','#d5f690','#d9f791','#ddf892','#e1f993','#e5f993','#e9fa94','#edfb95','#f1fc96','#f5fd97','#f9fd97','#fdfe98','#fefd98','#fcfb97','#faf896','#f8f695','#f6f394','#f4f093','#f2ee91','#f0eb90','#eee98f','#ece68e','#eae48d','#e8e18c','#e6df8b','#e4dc8a','#e2d989','#e0d788','#ded487','#dcd286','#dacf85','#d8cd83','#d6ca82','#d4c781','#d2c580','#d0c27f','#cec07e','#ccbd7d','#cabb7c','#c8b87b','#c6b67a','#c4b379','#c2b078','#c0ae76','#beab75','#bca974','#baa673','#b8a472','#b6a171','#b49f70','#b29c6f','#b0996e','#ae976d','#ac946c','#aa926b','#a88f6a','#a68d68','#a48a67','#a28766','#a08565','#9e8264','#9c8063','#9a7d62','#987b61','#967860','#94765f','#92735e','#90705d','#8e6e5b','#8c6b5a','#8a6959','#886658','#866457','#846156','#825f55','#805c54','#815d56','#836058','#85625b','#87655e','#896760','#8b6a63','#8d6d66','#8f6f68','#91726b','#93746e','#957770','#977973','#997c76','#9b7f79','#9d817b','#9f847e','#a18681','#a38983','#a58b86','#a78e89','#a9908b','#ab938e','#ad9691','#af9893','#b19b96','#b39d99','#b5a09b','#b7a29e','#b9a5a1','#bba7a3','#bdaaa6','#bfada9','#c1afab','#c3b2ae','#c5b4b1','#c7b7b3','#c9b9b6','#cbbcb9','#cdbfbc','#cfc1be','#d1c4c1','#d3c6c4','#d5c9c6','#d7cbc9','#d9cecc','#dbd0ce','#ddd3d1','#dfd6d4','#e1d8d6','#e3dbd9','#e5dddc','#e7e0de','#e9e2e1','#ebe5e4','#ede7e6','#efeae9','#f1edec','#f3efee','#f5f2f1','#f7f4f4','#f9f7f6','#fbf9f9','#fdfcfc','#ffffff'];
      } else {
        this.palette  = JSON.parse(data.palette.replace(/'/g ,'"'));
      }
    }

    var vi, ci; // Used in for loops for vertex indexing

    data.updateGeometry = data.updateGeometry || ("invertElevation" in diff || "stretch" in diff || "ignoreTransparentValues" in diff || "ignoreZeroValues" in diff || "height" in diff || "width" in diff);

    if (data.updateGeometry) {
          // Figure out our dimensions
          // Case 1: User specified W and H
          if (data.width>0 && data.height>0) {
            // Do nothing. We're golden
          } else if (data.width>0 && data.height<0) {
            data.height = data.width / data.aspectRatio;
          } else if (data.height>0 && data.width<0) {
            data.width = data.height * data.aspectRatio;
          } else if (data.height,0 && data.width<0) {
            data.height = 1;
            data.width = data.height * data.aspectRatio;
          }

          // We'll read the Red value from the image data to get height value for each pixel
          this.imgBytes = this.canvasContext.getImageData(0, 0,this.canvas.width, this.canvas.height).data;
          this.heights = new Float32Array(this.imgBytes.length/4);


          // Do a pass over the data to get max and min values
          // We also do the invertElevation operation here. Normally black=100% elevation and white=0 elevation
          this.maxPixelVal=0;
          this.minPixelVal=255;
          if (data.stretch) {
           for (ci=0; ci<this.imgBytes.length; ci+=4) {
            if (data.invertElevation) this.imgBytes[ci]=255-this.imgBytes[ci];
             this.maxPixelVal = Math.max(this.maxPixelVal, this.imgBytes[ci]);
             this.minPixelVal = Math.min(this.minPixelVal, this.imgBytes[ci]);
           }
          } else {
           for (ci=0; ci<this.imgBytes.length; ci+=4) { if (data.invertElevation)this.imgBytes[ci]=255-this.imgBytes[ci];}
           this.maxPixelVal = 255; this.minPixelVal=0;
          }

          // Extract heights from image data
          // In the image white=255 RGB but equals 0 elevation, and black=0=1 elevation
          for (ci=0, di=0; ci<this.imgBytes.length; ci+=4) {
              this.heights[di++] = this.imgBytes[ci];
          }
          for (ci=0; ci<this.heights.length; ci++ ){
            this.heights[ci] = 1- (this.heights[ci]-this.minPixelVal) /(this.maxPixelVal-this.minPixelVal);
            //if (data.invertElevation) heights[ci]=1-heights[ci];
            //if (data.stackBlurRadius>0 && heights[ci]==1/255) heights[ci] = 0;
            if (data.ignoreTransparentValues && this.imgBytes[ci*4 + 3]===0 ) this.heights[ci]=-1;
          }


          /*
           Create the plane geometry
           */
          console.time("aframe-heatmap3d: base geometry");
          //var geometry = new THREE.PlaneBufferGeometry(data.width, data.height, data.canvas.width-1, data.canvas.height-1);
          this.geometry = new Heatmap3dPlaneBufferGeometry(data.width, data.height, this.canvas.width-1, this.canvas.height-1, this.heights, data.ignoreZeroValues, data.ignoreTransparentValues);
          console.timeEnd("aframe-heatmap3d: base geometry");


          //this.geometry.rotateX(-90 * Math.PI / 180 );
    } // end data.updateGeometry?



    /*
     Now we can finally calculate the vertex heights, colors, and opacities
     */
    var clr;
    var di = 0; // Index into the elevation data. Also used to index attributes that have only 1 value per vertex (not 3 values, like position)
    var val=0; // Value from the elevation DEM
    var NONZEROVERTS=0;
    var bigint; // Temp variable, used for colors
    var NVERTS = this.geometry.attributes.position.count;
    var vertexColors = new Float32Array( NVERTS * 3 );
    var vertexOpacities = new Float32Array( NVERTS);
    var sm= data.scaleOpacity ? 0 : -1; // Shorthand value for scaleOpacityMethod
    if (data.scaleOpacityMethod==="log") sm=1;
    if (data.scaleOpacityMethod==="log10") sm=2;
    if (data.scaleOpacityMethod==="const") sm=3;


    data.updateMaterial = (this.material===undefined || "emissive" in diff || "flipPalette" in diff || "roughness" in diff  || "metalness" in diff  || "shininess" in diff || "emissiveIntensity" in diff || "opacityMin" in diff || "opacityMax" in diff || "palette" in diff || "scaleOpacityMethod" in diff ||"scaleOpacity" in diff || "wireframe" in diff || "material" in diff  || "renderMode" in diff  || "particleSize" in diff  );

    if (data.updateMaterial ) {
        console.time("aframe-heatmap3d: update material");

        // Use D3's color mapping functions to map values to the color palette
        if (!this.funcColorize || "palette" in diff) {
          this.funcColorize = d3.scaleQuantize().domain([0, 1]).range(this.palette);
        }


        for (vi=2, di=0, ci=0;    vi<NVERTS*3;   vi+=3, di++, ci+=4) {
          // Get this pixels' elevation, in the range 0-1. Do 1- so that white=0 and black=1
          val = Math.max(0, this.heights[di]);

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

          if (data.ignoreZeroValues && val===0) vertexOpacities[di]=0;

          // Calculate vertex color
          clr = this.funcColorize(data.flipPalette ? (1-val) : val); // Returns a string like "#ff0000"
          // Using a fast hexToRgb method (https://jsperf.com/2014-09-16-hex-to-rgb)
          // See also discussion at http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
          bigint = parseInt(clr.substr(1), 16); // Trim leading "#"
          vertexColors[vi-2] = ((bigint >> 16) & 255) / 255.0;
          vertexColors[vi-1] = ((bigint >> 8) & 255) / 255.0;
          vertexColors[vi-0] = (bigint & 255) / 255.0;
        }


        // Add the vertex coloring and opacity data to the geometry
        this.geometry.addAttribute( 'color', new THREE.BufferAttribute( vertexColors, 3 ) );
        this.geometry.addAttribute( 'opacity', new THREE.BufferAttribute( vertexOpacities, 1 ) );




        /*
         * Create a material. To use per-vertex opacity we must use a custom shader material:
         * See: https://github.com/mrdoob/three.js/issues/2118
         * If there is no transparency, we can use a normal Lambert material.
         */
        if (data.scaleOpacity && data.scaleOpacityMethod!=="const" && data.material=="default" && !data.wireframe) {
          this.material = new THREE.ShaderMaterial({
            vertexShader:   this.customVertexShader,
            fragmentShader: this.customFragShader,
            depthTest:      true,
            side:           THREE.DoubleSide,
            transparent:    true,
            vertexColors:THREE.VertexColors
          });
        } else {
          if ("surface" === data.renderMode) {
            if (data.scaleOpacity && data.scaleOpacityMethod!="const" && data.material.toLowerCase() !="standard"){
              console.warn('scalOpacity=true and scaleOpacityMethod!=const, so ignoring material=' + data.material + " and using standard material instead");
              data.material="standard";
            }
            if (data.material.toLowerCase()==="lambert") {
                this.material = new THREE.MeshLambertMaterial({
                  transparent: data.scaleOpacity && data.scaleOpacityMethod==="const",
                  opacity:     data.opacityMin,
                  wireframe:   data.wireframe, 
                  emissive:    new THREE.Color(data.emissive),
                  blending:       eval(data.blending),
                  emissiveIntensity: data.emissiveIntensity,
                  side:        THREE.DoubleSide,
                  vertexColors:THREE.VertexColors
                });
              } else if (data.material.toLowerCase()=="phong") {
                this.material = new THREE.MeshPhongMaterial({
                  transparent: data.scaleOpacity && data.scaleOpacityMethod==="const",
                  opacity:     data.opacityMin,
                  emissive:    new THREE.Color(data.emissive),
                  emissiveIntensity: data.emissiveIntensity,
                  wireframe:   data.wireframe, 
                  blending:    eval(data.blending),
                  shininess:   data.shininess,
                  specular:    new THREE.Color(data.specular),
                  side:        THREE.DoubleSide,
                  vertexColors:THREE.VertexColors
                });

              } else {
                this.material = new THREE.MeshStandardMaterial({
                  transparent: data.scaleOpacity && data.scaleOpacityMethod==="const",
                  opacity:     data.scaleOpacity ? data.opacityMin : 1,
                  wireframe:   data.wireframe, 
                  emissive:    new THREE.Color(data.emissive),
                  emissiveIntensity: data.emissiveIntensity,
                  metalness:   data.metalness,
                  blending:    eval(data.blending),
                  color:       this.palette.length==1 ? this.palette[0] : '#ffffff', 
                  side:        THREE.DoubleSide,
                  vertexColors:this.palette.length==1 ? THREE.NoColors : THREE.VertexColors
                });

              }
          } else if (data.renderMode === "particles") {
            this.material = new THREE.ShaderMaterial({
              uniforms: {
                pointsize: {value: data.particleSize }
              },
              vertexShader:   this.customPointsVertexShader,
              fragmentShader: this.customPointsFragShader,
              blending:       THREE.NoBlending,
              wireframe:      false,
              depthTest:      data.particleDepthTest,
              transparent:    false,
              vertexColors:   THREE.VertexColors
            });

          }
        }

        console.timeEnd("aframe-heatmap3d: update material");
   } // data.updateMaterial?




    if (data.updateGeometry || data.updateMaterial) {
        // Create the surface mesh and register it under entity's object3DMap
        var surface;
        if ("surface" === data.renderMode) {
          surface = new THREE.Mesh(this.geometry, this.material);
        } else {
          this.geometry.removeAttribute('normal');
          this.geometry.removeAttribute('uv');
          this.geometry.removeAttribute('opacity');
          surface = new THREE.Points(this.geometry, this.material);

        }
        el.setObject3D('terrain-heatmap', surface);
    } /// Update geometry || material
  }, // end function update()




   remove: function () {
    this.el.removeObject3D('terrain-heatmap');
  }

});














// PlaneBufferGeometry




function Heatmap3dPlaneBufferGeometry( width, height, widthSegments, heightSegments, vals, skipZeros, skipNegative ) {

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

      // Note we bake in a rotateX(-90) operation here, as compared to THREE.PlaneBufferGeometry
      vertices.push( x,   vals[iy*gridX1 + ix ] , y );

      normals.push( 1,1, 1 );

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

      var drawFace = true;
      var x=Math.max(vertices[a*3+1], vertices[b*3+1],vertices[d*3+1]);
      if (skipZeros && x===0) drawFace=false;
      if (skipNegative && x<0) drawFace=false;
      if (drawFace) 
        indices.push( a, b, d );

      drawFace = true;
      x=Math.max(vertices[b*3+1], vertices[c*3+1],vertices[d*3+1]);
      if (skipZeros &&x===0) drawFace=false;
      if (skipNegative && x<0) drawFace=false;
      if (drawFace) 
        indices.push( b, c, d );

    }

  }


  // Normalize the normal vectors to be unit vectors
  for (ix=0;ix<normals.length; ix+=3){
    var x = normals[ix+0]; var y=normals[ix+1]; var z=normals[ix+2];
    var l =Math.sqrt(x^2 + y^2 + z^2);
    normals[ix+0] /= l;
    normals[ix+1] /= l;
    normals[ix+2] /= l;
    vertices[ix+1] = Math.max(0, vertices[ix+1]); // Convert any -1 Y value vertices (those with alpha=0) to 0. 
  }

  // build geometry

  // Note: setIndex has different code in AFRAME 0.5.0 than at current THREE github.
  this.setIndex( new THREE.Uint32BufferAttribute( indices, 1) );
  this.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
  //this.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
  this.computeVertexNormals();

  //this.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );



}
Heatmap3dPlaneBufferGeometry.prototype = Object.create( THREE.BufferGeometry.prototype );
Heatmap3dPlaneBufferGeometry.prototype.constructor = Heatmap3dPlaneBufferGeometry;
