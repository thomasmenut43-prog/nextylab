import * as THREE from 'three';

// Only the other cups use this small offscreen buffer. The selected cup is
// drawn directly afterwards, with its original materials and print colors.
// The normal carousel keeps its single render pass; idle frames stay on demand.
export class ProductFocusRenderer{
  constructor(renderer){
    this.renderer=renderer;
    this.size=new THREE.Vector2();
    this.displaySize=new THREE.Vector2();
    this.target=new THREE.WebGLRenderTarget(1,1,{
      type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,
      minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true
    });
    this.material=new THREE.ShaderMaterial({
      uniforms:{image:{value:this.target.texture},stepSize:{value:new THREE.Vector2()}},
      vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader:`uniform sampler2D image;
        uniform vec2 stepSize;
        varying vec2 uvScreen;
        void main(){
          vec4 color=texture2D(image,uvScreen)*4.0;
          color+=texture2D(image,uvScreen+vec2(stepSize.x,0.0))*2.0;
          color+=texture2D(image,uvScreen-vec2(stepSize.x,0.0))*2.0;
          color+=texture2D(image,uvScreen+vec2(0.0,stepSize.y))*2.0;
          color+=texture2D(image,uvScreen-vec2(0.0,stepSize.y))*2.0;
          color+=texture2D(image,uvScreen+stepSize);
          color+=texture2D(image,uvScreen-stepSize);
          color+=texture2D(image,uvScreen+vec2(stepSize.x,-stepSize.y));
          color+=texture2D(image,uvScreen+vec2(-stepSize.x,stepSize.y));
          color/=16.0;
          // Unpremultiply before color conversion to avoid dark edge halos.
          if(color.a>0.0)color.rgb/=color.a;
          gl_FragColor=color;
          #include <colorspace_fragment>
          #include <premultiplied_alpha_fragment>
        }`,
      transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,toneMapped:false
    });
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    this.scene=new THREE.Scene();this.scene.add(this.quad);
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.rowKey=null;
  }
  render(scene,camera,products,index,amount,rowPosition){
    const renderer=this.renderer;
    if(amount<=0){this.rowKey=null;renderer.render(scene,camera);return;}
    renderer.getDrawingBufferSize(this.size);
    const scale=Math.min(.65,Math.sqrt(650000/(this.size.x*this.size.y)));
    const width=Math.max(1,Math.round(this.size.x*scale)),height=Math.max(1,Math.round(this.size.y*scale));
    if(this.target.width!==width||this.target.height!==height){this.target.setSize(width,height);this.rowKey=null;}
    const rowKey=`${index}:${amount}:${rowPosition}`;
    renderer.getSize(this.displaySize);
    this.material.uniforms.stepSize.value.set(2.6*amount/this.displaySize.x,2.6*amount/this.displaySize.y);
    const autoClear=renderer.autoClear,visibility=products.map(entry=>entry.group.visible);
    renderer.autoClear=false;
    try{
      if(this.rowKey!==rowKey){
        products[index].group.visible=false;
        renderer.setRenderTarget(this.target);renderer.clear();renderer.render(scene,camera);
        this.rowKey=rowKey;
      }
      renderer.setRenderTarget(null);renderer.clear();renderer.render(this.scene,this.camera);
      products.forEach((entry,i)=>{entry.group.visible=i===index&&visibility[i];});
      renderer.clearDepth();renderer.render(scene,camera);
    }finally{
      products.forEach((entry,i)=>{entry.group.visible=visibility[i];});
      renderer.setRenderTarget(null);renderer.autoClear=autoClear;
    }
  }
  invalidate(){this.rowKey=null;}
  dispose(){this.target.dispose();this.material.dispose();this.quad.geometry.dispose();}
}
