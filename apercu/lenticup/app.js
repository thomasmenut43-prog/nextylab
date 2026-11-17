import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyProductMaterials } from './product-materials.js';
import { ProductFocusRenderer } from './product-focus-renderer.js';

import { recipes } from './catalog.js';
import { readCart, adjustQuantity, countCart, cartKey } from './cart-store.js';

const $ = selector => document.querySelector(selector);
const hero=$('#hero'),stage=$('#products-stage'),canvas=$('#products-canvas');
const narrow=matchMedia('(max-width: 700px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const origin=2,cupHeight=3.7,products=[],hitboxes=[];
const shadows=[...document.querySelectorAll('.product-shadows span')];
const dialogs=[...document.querySelectorAll('dialog')];
const grassLayers=[$('#grass-mid'),$('#grass-front')];
const smooth={offset:origin,scenery:origin};
let selected=origin,focusedProduct=origin,activePanel=null;
const productFocus={active:false,amount:0,turn:0,rotation:0};
let logicalScroll=0,lastPhysicalScroll=0,scrollRange=1,scrollInitialized=false;
let renderer,scene,camera,focusRenderer;
const decorRay=new THREE.Raycaster(),decorPointer=new THREE.Vector2();
let decorPress=null;
let raf=0,lastFrame=0,visible=true,paused=reduced.matches,focusReturn,dragStart,suppressClickUntil=0;
let pixelBudget=1400000,frameAverage=16,frameSamples=0,idleQuality=false,idleTimer=0;
const detailCache=new Map(),detailLoads=new Map();
let cart=readCart();
const modulo=value=>THREE.MathUtils.euclideanModulo(value,recipes.length);
const wrapDistance=value=>modulo(value+recipes.length/2)-recipes.length/2;
const spacing=()=>narrow.matches?3.15:2.85;
const worldWidth=()=>narrow.matches?5:14.4;
const pixelsPerProduct=()=>Math.max(300,hero.clientHeight*.56);
const carouselTarget=()=>origin+logicalScroll/pixelsPerProduct();
const anyDialogOpen=()=>dialogs.some(dialog=>dialog.open);

// The native scroll runway is recentered before either edge. Its reset is excluded
// from the logical distance, so both the products and the grass remain continuous.
function recenterRunway(){
  scrollRange=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  lastPhysicalScroll=scrollRange/2;window.scrollTo({top:lastPhysicalScroll,behavior:'instant'});
  lastPhysicalScroll=window.scrollY;scrollInitialized=true;
}
function readNativeScroll(){
  if(!scrollInitialized||anyDialogOpen()||productFocus.active||productFocus.amount>0||!visible)return;
  const next=window.scrollY,delta=next-lastPhysicalScroll;if(!delta)return;
  logicalScroll+=delta;lastPhysicalScroll=next;
  if(next<scrollRange*.18||next>scrollRange*.82)recenterRunway();
  hideTooltip();requestRender();
}
function advancePixels(delta){logicalScroll+=delta;hideTooltip();requestRender();}
function choose(index){
  const next=modulo(index);logicalScroll+=wrapDistance(next-carouselTarget())*pixelsPerProduct();
  selected=next;updateCurrentRecipe();renderRecipe();requestRender();
}
function updateCurrentRecipe(){
  $('#mobile-current').innerHTML=`<strong>${recipes[selected].name}</strong><span>${recipes[selected].flavor}</span>`;
  stage.setAttribute('aria-label',`Les pots LENTICUP en 3D. ${recipes[selected].name} au centre.`);
}
function openDialog(name){
  const target=$(`#${name}-dialog`);if(!target)return;
  const current=dialogs.find(dialog=>dialog.open);if(!current)focusReturn=document.activeElement;
  current?.close();if(name==='cart')renderCart();if(name==='recipes')renderRecipe();
  target.showModal();document.documentElement.style.overflow='hidden';
  cancelAnimationFrame(raf);clearTimeout(idleTimer);raf=0;
  $('#menu-button').setAttribute('aria-expanded',String(name==='menu'));hideTooltip();
}
dialogs.forEach(dialog=>{
  dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    if(!anyDialogOpen()){
      document.documentElement.style.overflow=productFocus.active?'hidden':'';$('#menu-button').setAttribute('aria-expanded','false');
      recenterRunway();focusReturn?.focus({preventScroll:true});requestRender();
    }
  });
});
document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>openDialog(el.dataset.open)));
document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>openDialog(el.dataset.route)));
$('#menu-button').addEventListener('click',()=>openDialog('menu'));
$('.brand').addEventListener('click',event=>{event.preventDefault();closeProduct();choose(origin);});
const recipeList=$('#recipe-list');
recipes.forEach((recipe,index)=>{
  const button=document.createElement('button');button.type='button';button.className='recipe-tab';button.style.setProperty('--swatch',recipe.color);
  button.innerHTML=`<span class="swatch" aria-hidden="true"></span><strong>${recipe.name}</strong>`;
  button.addEventListener('click',()=>{choose(index);renderRecipe();});recipeList.append(button);
  const hit=document.createElement('button');hit.type='button';hit.className='product-hit';hit.hidden=true;
  hit.setAttribute('aria-label',`${recipe.name}, ${recipe.flavor}. Ouvrir le produit en grand.`);
  hit.addEventListener('pointerenter',()=>{if(!narrow.matches)showTooltip(index);});hit.addEventListener('pointerleave',hideTooltip);
  hit.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;showProduct(index);});
  $('#product-hitboxes').append(hit);hitboxes.push(hit);
});
function renderRecipe(){
  [...recipeList.children].forEach((el,index)=>el.setAttribute('aria-pressed',String(index===selected)));
  const recipe=recipes[selected];
  $('#recipe-detail').innerHTML=`<div><p class="recipe-name">Lentilles instantanées</p><h3>${recipe.flavor}</h3><p>${recipe.description}</p></div><button class="pill" id="view-recipe">Voir le produit<i class="ph ph-arrow-up-right" aria-hidden="true"></i></button>`;
  $('#view-recipe').addEventListener('click',()=>showProduct(selected));
}
function showProduct(index){
  if(!products.length)return;
  focusReturn=document.activeElement;
  dialogs.filter(dialog=>dialog.open).forEach(dialog=>dialog.close());
  focusedProduct=modulo(index);activePanel=null;productFocus.active=true;productFocus.turn=0;productFocus.rotation=0;
  // Freeze the visible row while this very same group leaves it.
  logicalScroll=(smooth.offset-origin)*pixelsPerProduct();
  $('#product-focus').hidden=false;$('#product-focus').inert=false;hero.classList.add('is-focusing');
  stage.inert=true;$('.hero-bottom').inert=true;$('.mobile-product-nav').inert=true;
  document.documentElement.style.overflow='hidden';hideTooltip();updateProductInfo();
  $('#product-close').focus({preventScroll:true});
  loadDetailedProduct(focusedProduct);requestRender();
}
function closeProduct(){
  if(!productFocus.active)return;
  productFocus.active=false;$('#product-focus').inert=true;activePanel=null;renderProductPanel();
  $('#focus-status').textContent='Le pot retrouve sa place dans la prairie.';
  requestRender();
}
function finishProductReturn(){
  $('#product-focus').hidden=true;hero.classList.remove('is-focusing');
  stage.inert=false;$('.hero-bottom').inert=false;$('.mobile-product-nav').inert=false;
  if(!anyDialogOpen())document.documentElement.style.overflow='';
  productFocus.turn=0;productFocus.rotation=0;recenterRunway();
  requestAnimationFrame(()=>{if(!anyDialogOpen())(focusReturn?.getClientRects().length?focusReturn:hitboxes[focusedProduct]).focus({preventScroll:true});});
}
function updateProductInfo(){
  const recipe=recipes[focusedProduct];$('#product-title').textContent=recipe.name;$('#product-flavor').textContent=recipe.flavor;
  $('#product-focus').style.setProperty('--recipe-color',recipe.color);
  $('#product-turn span').textContent='Voir le verso';$('#product-turn').setAttribute('aria-label','Tourner le pot pour voir le verso');
  $('#focus-status').textContent=`${recipe.name} sort de la rangée et se rapproche. Utilisez les boutons autour du pot pour l’explorer, ou Échap pour revenir.`;
  $('#product-add').setAttribute('aria-label',`Ajouter ${recipe.name} au panier`);$('#cart-feedback').textContent='';renderProductPanel();
}
function renderProductPanel(){
  const recipe=recipes[focusedProduct];
  $('#focus-information').hidden=!activePanel;
  $('#product-description').setAttribute('aria-pressed',String(activePanel==='description'));
  $('#product-composition').setAttribute('aria-pressed',String(activePanel==='composition'));
  if(!activePanel){$('#product-panel').replaceChildren();return;}
  $('#product-panel').innerHTML=activePanel==='composition'
    ?`<h3>${recipe.complete?'Composition':'Ingrédients principaux'}</h3><ul class="ingredient-list">${recipe.ingredients.map(item=>`<li>${item}</li>`).join('')}</ul>${recipe.complete?'':'<p class="ingredient-note">Retrouvez la liste complète et les allergènes sur le pot.</p>'}`
    :`<h3>À découvrir dans votre cup.</h3><p>${recipe.description}</p><p class="product-preparation">Ajoutez de l’eau chaude et suivez les indications de préparation sur le pot.</p>`;
}
$('#product-description').addEventListener('click',()=>{activePanel=activePanel==='description'?null:'description';renderProductPanel();});
$('#product-composition').addEventListener('click',()=>{activePanel=activePanel==='composition'?null:'composition';renderProductPanel();});
$('#product-close').addEventListener('click',closeProduct);
hero.addEventListener('pointerdown',event=>{
  decorPress=productFocus.active&&!anyDialogOpen()&&event.button===0?{x:event.clientX,y:event.clientY}:null;
});
hero.addEventListener('pointercancel',()=>{decorPress=null;});
hero.addEventListener('click',event=>{
  const press=decorPress;decorPress=null;
  if(!press||!productFocus.active||anyDialogOpen()||event.detail===0)return;
  if(event.target.closest('button,a,input,textarea,select,.focus-information,.focus-heading'))return;
  if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>12)return;
  const bounds=hero.getBoundingClientRect();
  decorPointer.set((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
  decorRay.setFromCamera(decorPointer,camera);
  if(decorRay.intersectObject(products[focusedProduct].group,true).length)return;
  closeProduct();
});
$('#product-panel-close').addEventListener('click',()=>{const button=activePanel==='composition'?$('#product-composition'):$('#product-description');activePanel=null;renderProductPanel();button.focus({preventScroll:true});});
$('#product-turn').addEventListener('click',()=>{productFocus.turn+=Math.PI;const back=Math.round(productFocus.turn/Math.PI)%2;$('#product-turn span').textContent=back?'Voir le recto':'Voir le verso';$('#product-turn').setAttribute('aria-label',`Tourner le pot pour voir le ${back?'recto':'verso'}`);requestRender();});
$('#product-add').addEventListener('click',()=>{const recipe=recipes[focusedProduct];changeQuantity(recipe.id,1);$('#cart-feedback').textContent=`${recipe.name} ajoutée au panier.`;});
function cartCount(){return countCart(cart);}
function updateCartCount(){
  const count=cartCount(),badge=$('#selection-count');badge.hidden=!count;badge.textContent=count;
  $('.selection-button').setAttribute('aria-label',`Ouvrir le panier${count?`, ${count} pot${count>1?'s':''}`:''}`);
}
function changeQuantity(id,delta){
  cart=adjustQuantity(id,delta);
  updateCartCount();if($('#cart-dialog').open)renderCart();
}
window.addEventListener('storage',event=>{if(event.key===cartKey){cart=readCart();updateCartCount();if($('#cart-dialog').open)renderCart();}});
function renderCart(){
  const count=cartCount();$('#cart-total').textContent=count?`${count} pot${count>1?'s':''}`:'À vous de choisir.';
  const target=$('#cart-list');target.replaceChildren();
  if(!count){target.innerHTML='<p class="selection-empty">Votre panier est encore vide. Choisissez une recette pour commencer.</p>';return;}
  for(const recipe of recipes){
    const quantity=cart[recipe.id];if(!quantity)continue;
    const row=document.createElement('div');row.className='cart-row';row.style.setProperty('--swatch',recipe.color);
    row.innerHTML=`<button class="cart-recipe" aria-label="Voir ${recipe.name}"><span class="swatch" aria-hidden="true"></span><span><strong>${recipe.name}</strong><small>${recipe.flavor}</small></span></button><div class="quantity-control"><button aria-label="Diminuer la quantité de ${recipe.name}"><i class="ph ph-minus" aria-hidden="true"></i></button><span aria-label="Quantité">${quantity}</span><button aria-label="Augmenter la quantité de ${recipe.name}" ${quantity===99?'disabled':''}><i class="ph ph-plus" aria-hidden="true"></i></button></div><button class="remove-cart" aria-label="Retirer ${recipe.name} du panier"><i class="ph ph-trash" aria-hidden="true"></i></button>`;
    row.querySelector('.cart-recipe').addEventListener('click',()=>showProduct(recipes.indexOf(recipe)));
    const controls=row.querySelectorAll('.quantity-control button');controls[0].addEventListener('click',()=>changeQuantity(recipe.id,-1));controls[1].addEventListener('click',()=>changeQuantity(recipe.id,1));
    row.querySelector('.remove-cart').addEventListener('click',()=>changeQuantity(recipe.id,-quantity));target.append(row);
  }
}
$('#previous-product').addEventListener('click',()=>choose(selected-1));
$('#next-product').addEventListener('click',()=>choose(selected+1));
$('#mobile-current').addEventListener('click',()=>showProduct(selected));
$('#scroll-hint').addEventListener('click',()=>choose(selected+1));
function updateMotionButton(){
  const button=$('#motion-button');button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Activer la parallaxe':'Mettre la parallaxe en pause');button.innerHTML=`<i class="ph ph-${paused?'play':'pause'}" aria-hidden="true"></i>`;
}
$('#motion-button').addEventListener('click',()=>{paused=!paused;updateMotionButton();requestRender();});
reduced.addEventListener('change',()=>{paused=reduced.matches;updateMotionButton();requestRender();});
// Pointer movement does not control any scene transform.
hero.addEventListener('wheel',event=>{
  if(anyDialogOpen()||productFocus.active||productFocus.amount>0||event.ctrlKey||event.metaKey)return;
  const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);
  const delta=horizontal?event.deltaX:event.deltaY;if(!delta)return;
  event.preventDefault();
  const unit=event.deltaMode===1?18:event.deltaMode===2?(horizontal?hero.clientWidth:hero.clientHeight):1;
  advancePixels(delta*unit);
},{passive:false});
stage.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')dragStart={x:event.clientX,y:event.clientY};});
stage.addEventListener('pointerup',event=>{
  if(!dragStart)return;const dx=event.clientX-dragStart.x,dy=event.clientY-dragStart.y;dragStart=null;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){suppressClickUntil=performance.now()+500;choose(selected+(dx<0?1:-1));}
});
stage.addEventListener('pointercancel',()=>{dragStart=null;});
document.addEventListener('keydown',event=>{
  if(anyDialogOpen()||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select'))return;
  if(productFocus.active){if(event.key==='Escape'){event.preventDefault();closeProduct();}return;}
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();choose(selected+(event.key==='ArrowRight'?1:-1));}
});
function hideTooltip(){$('#product-tooltip').classList.remove('visible');}
function showTooltip(index){
  const tip=$('#product-tooltip'),r=hitboxes[index].getBoundingClientRect(),h=hero.getBoundingClientRect();tip.textContent=recipes[index].flavor;tip.style.left=`${r.left-h.left+r.width/2}px`;tip.style.top=`${r.top-h.top-37}px`;tip.style.transform='translateX(-50%)';tip.classList.add('visible');
}
for(const layer of grassLayers)for(let tile=0;tile<=2;tile++){
  const img=document.createElement('img');img.className='grass-tile';img.src='./assets/grass.webp';img.alt='';img.width=2560;img.height=853;img.style.setProperty('--tile',tile);if(tile%2)img.style.transform='scaleX(-1)';layer.querySelector('.grass-track').append(img);
}
function grassMetrics(){
  const width=hero.clientWidth*(narrow.matches?2.1:1.14),period=width;
  for(const layer of grassLayers){layer.style.setProperty('--tile-width',`${width}px`);layer.style.setProperty('--tile-period',`${period}px`);}
}
function paintScenery(){
  const travel=(smooth.scenery-origin)*spacing()*hero.clientWidth/worldWidth(),period=hero.clientWidth*(narrow.matches?2.1:1.14)*2;
  grassLayers.forEach((layer,index)=>{const phase=THREE.MathUtils.euclideanModulo(travel*(index===0?.16:.28),period);layer.querySelector('.grass-track').style.transform=`translate3d(${-phase}px,0,0)`;});
  const hillsX=Math.sin((smooth.scenery-origin)*.22)*14;$('#hills-motion').style.transform=`translate3d(${-hillsX}px,0,0) scale(1.015)`;
}
function createRenderer(targetCanvas){
  const output=new THREE.WebGLRenderer({canvas:targetCanvas,alpha:true,antialias:true,powerPreference:'high-performance'});output.setClearColor(0x000000,0);output.outputColorSpace=THREE.SRGBColorSpace;output.toneMapping=THREE.NeutralToneMapping;output.toneMappingExposure=1;return output;
}
function sizeHeroRenderer(still=false){
  const width=hero.clientWidth,height=hero.clientHeight;
  const budget=still?3000000:pixelBudget;
  renderer.setPixelRatio(Math.min(devicePixelRatio,still?1.5:1.25,Math.sqrt(budget/(width*height))));renderer.setSize(width,height,false);
}
function configureCamera(){
  grassMetrics();
  if(renderer&&camera){
    const width=hero.clientWidth,height=hero.clientHeight,worldHeight=worldWidth()/(width/height),centerY=worldHeight*(narrow.matches?.17:.29);
    camera.left=-worldWidth()/2;camera.right=worldWidth()/2;camera.top=worldHeight/2;camera.bottom=-worldHeight/2;
    camera.position.set(0,centerY+1.3,24);camera.lookAt(0,centerY,0);camera.updateProjectionMatrix();sizeHeroRenderer();focusRenderer.invalidate();
  }
  if(!anyDialogOpen())recenterRunway();requestRender();
}
function screenAtDepth(x,y,z){
  const point=new THREE.Vector3(x*2-1,1-y*2,0).unproject(camera),direction=camera.getWorldDirection(new THREE.Vector3());
  return point.addScaledVector(direction,(z-point.z)/direction.z);
}
function layoutProducts(){
  const amount=productFocus.amount,worldHeight=camera.top-camera.bottom;
  const destination=screenAtDepth(narrow.matches?.5:.47,narrow.matches?.625:.79,5.7);
  const zoom=worldHeight*(narrow.matches?.44:.62)/cupHeight;
  products.forEach((entry,index)=>{
    const distance=wrapDistance(index-smooth.offset),baseX=distance*spacing(),rotation=THREE.MathUtils.clamp(distance*.29,-.65,.65);
    if(index===focusedProduct&&amount>0){
      entry.group.position.set(THREE.MathUtils.lerp(baseX,destination.x,amount),THREE.MathUtils.lerp(-.38,destination.y,amount),destination.z*amount);
      entry.group.scale.setScalar(THREE.MathUtils.lerp(1,zoom,amount));
      entry.group.rotation.set(0,THREE.MathUtils.lerp(rotation,productFocus.rotation,amount),0);
    }else{
      const direction=Math.sign(baseX)||1;
      entry.group.position.set(baseX+direction*amount*1.8,-.38-amount*.15,-amount*1.5);
      entry.group.scale.setScalar(1-amount*.13);entry.group.rotation.set(0,rotation,0);
    }
    // Do not render both meshes: the detailed geometry replaces the LOD after the approach.
    const detailed=index===focusedProduct&&productFocus.active&&amount===1&&entry.detailModel;
    entry.model.visible=!detailed;if(entry.detailModel)entry.detailModel.visible=Boolean(detailed);
  });
}
function updateHitboxes(){
  camera.updateMatrixWorld();
  products.forEach((entry,index)=>{
    const center=entry.group.position.clone(),lower=center.clone().add(new THREE.Vector3(0,.13,0)).project(camera),upper=center.clone().add(new THREE.Vector3(0,cupHeight,0)).project(camera);
    const left=center.clone().add(new THREE.Vector3(-1.2,0,0)).project(camera),right=center.clone().add(new THREE.Vector3(1.2,0,0)).project(camera);
    const x=(left.x+1)/2*hero.clientWidth,y=(1-upper.y)/2*hero.clientHeight,width=(right.x-left.x)/2*hero.clientWidth,onScreen=x+width>0&&x<hero.clientWidth;
    Object.assign(hitboxes[index].style,{left:`${x}px`,top:`${y}px`,width:`${width}px`,height:`${(upper.y-lower.y)/2*hero.clientHeight}px`});hitboxes[index].hidden=productFocus.amount>0||productFocus.active||!onScreen||(narrow.matches&&index!==selected);
    const foot=center.project(camera);Object.assign(shadows[index].style,{left:`${(foot.x+1)/2*hero.clientWidth}px`,top:`${(1-foot.y)/2*hero.clientHeight}px`,width:`${width*1.1}px`});shadows[index].hidden=!onScreen||(index===focusedProduct&&productFocus.amount>0);
  });
}
function requestRender(){
  clearTimeout(idleTimer);
  if(!raf&&visible&&!anyDialogOpen()){
    if(renderer&&idleQuality){idleQuality=false;sizeHeroRenderer();}
    raf=requestAnimationFrame(render);
  }
}
function renderStillFrame(){
  if(!renderer||raf||!visible||anyDialogOpen())return;
  idleQuality=true;sizeHeroRenderer(true);drawProducts();
}
function drawProducts(){focusRenderer.render(scene,camera,products,focusedProduct,productFocus.amount,smooth.offset);}
function render(now){
  raf=0;if(!visible||anyDialogOpen())return;
  const gap=now-lastFrame,dt=Math.min(gap/1000||.016,.12);lastFrame=now;
  if(renderer&&gap>0&&gap<1000&&Math.abs(carouselTarget()-smooth.offset)>.02){
    frameAverage=frameAverage*.85+gap*.15;frameSamples++;
    if(frameSamples>=12&&frameAverage>42&&pixelBudget>520000){pixelBudget=Math.max(520000,Math.round(pixelBudget*.72));sizeHeroRenderer();frameAverage=16;frameSamples=0;}
  }
  const ease=reduced.matches?1:1-Math.exp(-dt*9),target=carouselTarget();smooth.offset+=(target-smooth.offset)*ease;if(!paused)smooth.scenery+=(target-smooth.scenery)*ease;
  const focusTarget=productFocus.active?1:0;
  productFocus.amount+=(focusTarget-productFocus.amount)*ease;
  productFocus.rotation+=(productFocus.turn-productFocus.rotation)*ease;
  if(Math.abs(focusTarget-productFocus.amount)<.001)productFocus.amount=focusTarget;
  if(Math.abs(productFocus.turn-productFocus.rotation)<.001)productFocus.rotation=productFocus.turn;
  if(!productFocus.active&&productFocus.amount===0&&!$('#product-focus').hidden)finishProductReturn();
  $('#product-focus').dataset.state=productFocus.active?(productFocus.amount===1?'focused':'approaching'):'returning';
  const centered=modulo(Math.round(target));if(centered!==selected){selected=centered;updateCurrentRecipe();if($('#recipes-dialog').open)renderRecipe();}
  paintScenery();layoutProducts();if(renderer&&camera){drawProducts();updateHitboxes();}
  if(Math.abs(target-smooth.offset)>.001||(!paused&&Math.abs(target-smooth.scenery)>.001)||productFocus.amount!==focusTarget||productFocus.rotation!==productFocus.turn)requestRender();
  else if(renderer){clearTimeout(idleTimer);idleTimer=setTimeout(renderStillFrame,240);}
}
async function initScene(){
  try{
    renderer=createRenderer(canvas);focusRenderer=new ProductFocusRenderer(renderer);scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-9,9,5,-5,.1,100);configureCamera();
    const loader=new GLTFLoader(),loaded=await Promise.all(recipes.map(recipe=>loader.loadAsync(`./assets/models/pot_${recipe.id}.glb`)));
    loaded.forEach(gltf=>{
      const model=gltf.scene,bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=cupHeight/size.y;
      model.position.set(-center.x,-bounds.min.y,-center.z).multiplyScalar(scale);model.scale.setScalar(scale);
      applyProductMaterials(model,renderer.capabilities.getMaxAnisotropy());
      const group=new THREE.Group();group.add(model);scene.add(group);products.push({group,model});
    });
    hero.classList.add('is-ready');stage.setAttribute('aria-busy','false');$('#loading-state').setAttribute('aria-hidden','true');requestRender();
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();hero.classList.remove('is-ready');$('#error-state').hidden=false;$('#loading-state').hidden=true;});
  }catch(error){console.error('Unable to initialize LENTICUP 3D:',error);$('#error-state').hidden=false;$('#loading-state').hidden=true;stage.setAttribute('aria-busy','false');renderer?.dispose();}
}
async function loadDetailedProduct(index){
  $('#product-focus').dataset.detail='loading';
  try{
    if(!detailCache.has(index)){
      if(!detailLoads.has(index))detailLoads.set(index,new GLTFLoader().loadAsync(`./assets/models-detail/pot_${recipes[index].id}.glb`).then(gltf=>{
        const model=gltf.scene,bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=cupHeight/size.y;
        model.position.set(-center.x,-bounds.min.y,-center.z).multiplyScalar(scale);model.scale.setScalar(scale);applyProductMaterials(model,4);detailCache.set(index,model);return model;
      }).catch(error=>{detailLoads.delete(index);throw error;}));
      await detailLoads.get(index);
    }
    if(!products[index].detailModel){products[index].detailModel=detailCache.get(index);products[index].detailModel.visible=false;products[index].group.add(products[index].detailModel);}
    if(productFocus.active&&focusedProduct===index){$('#product-focus').dataset.detail='ready';requestRender();}
  }catch(error){
    // Keep the real LOD in place if the optional detailed asset cannot load.
    console.warn('Using the lightweight product model:',error);
    if(productFocus.active&&focusedProduct===index)$('#product-focus').dataset.detail='fallback';
  }
}
$('#retry-button').addEventListener('click',()=>location.reload());
new ResizeObserver(configureCamera).observe(hero);narrow.addEventListener('change',configureCamera);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestRender();}).observe(hero);
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible)requestRender();});
let scrollWatcher=setInterval(readNativeScroll,24);
window.addEventListener('pagehide',event=>{
  clearInterval(scrollWatcher);clearTimeout(idleTimer);cancelAnimationFrame(raf);raf=0;visible=false;
  if(!event.persisted){focusRenderer?.dispose();renderer?.dispose();}
});
window.addEventListener('pageshow',event=>{
  if(event.persisted){visible=!document.hidden;lastFrame=0;scrollWatcher=setInterval(readNativeScroll,24);cart=readCart();updateCartCount();if($('#cart-dialog').open)renderCart();recenterRunway();requestRender();}
});
updateCartCount();updateCurrentRecipe();renderRecipe();updateMotionButton();configureCamera();initScene();
