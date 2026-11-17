import * as THREE from 'three';

// Our own neutral studio lookup. No textures or shaders from Ciao are reused.
// Two softboxes and a broad fill are baked into this small normal-space texture.
function makeStudioLookup(){
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=(x/(size-1)-.5)*2,ny=(y/(size-1)-.5)*2;
    const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
    const left=Math.exp(-((nx+.39)**2/.027+(ny-.12)**2/.65));
    const right=Math.exp(-((nx-.58)**2/.012+(ny-.2)**2/.37));
    const luminance=Math.min(1,.53+.23*nz+.055*ny+.30*left+.18*right);
    const value=Math.round(Math.max(0,luminance)*255),p=(y*size+x)*4;
    pixels[p]=pixels[p+1]=pixels[p+2]=value;pixels[p+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
const studio=makeStudioLookup();

export function applyProductMaterials(root,maxAnisotropy=4){
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const original=mesh.material,isLid=!original.map;
    if(original.map){
      original.map.colorSpace=THREE.SRGBColorSpace;
      original.map.anisotropy=Math.min(4,maxAnisotropy);
    }
    // Printed packaging is already color-authored. Display its source texture
    // directly: no light multiplier, white glaze, color tint or tone mapping.
    if(!isLid){
      const printed=new THREE.MeshBasicMaterial({map:original.map,color:0xffffff,side:original.side,toneMapped:false});
      printed.name='LENTICUP original print colors';mesh.material=printed;return;
    }
    const material=new THREE.MeshMatcapMaterial({
      map:original.map,matcap:studio,color:original.color,side:original.side,toneMapped:false
    });
    material.name='LENTICUP satin lid';
    // Only the lid retains the neutral studio reflections.
    material.onBeforeCompile=shader=>{
      const finish=`float lightLevel = matcapColor.r;
          float softReflection = smoothstep(0.64, 0.98, lightLevel);
          vec3 outgoingLight = diffuseColor.rgb * (0.82 + 0.58 * lightLevel);
          outgoingLight += vec3(0.025) * softReflection;`;
      const marker='vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;';
      if(!shader.fragmentShader.includes(marker))throw new Error('Unsupported Three.js matcap shader version');
      shader.fragmentShader=shader.fragmentShader.replace(marker,finish);
    };
    material.customProgramCacheKey=()=> 'lenticup-studio-lid-v2';
    mesh.material=material;
  });
}
