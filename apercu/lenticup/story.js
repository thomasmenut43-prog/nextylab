import {recipes} from './catalog.js';
import {readCart,adjustQuantity,countCart,cartKey} from './cart-store.js';

const $=selector=>document.querySelector(selector);
const dialog=$('#cart-dialog'),image=$('#story-product-image');
let selected=2,quantity=1,activeTab='description',focusReturn;
const fromURL=new URLSearchParams(location.search).get('recette');
if(recipes.some(recipe=>recipe.id===fromURL))selected=recipes.findIndex(recipe=>recipe.id===fromURL);
const flavors=$('#story-flavors');
recipes.forEach((recipe,index)=>{
  const label=document.createElement('label');label.className='flavor-choice';label.style.setProperty('--flavor',recipe.color);
  const radio=document.createElement('input');radio.type='radio';radio.name='recipe';radio.value=recipe.id;radio.checked=index===selected;
  const text=document.createElement('span');text.textContent=recipe.name;
  radio.addEventListener('change',()=>{if(radio.checked)selectRecipe(index);});
  label.append(radio,text);flavors.append(label);
});
function selectRecipe(index){selected=index;$('#story-cart-feedback').textContent='';renderProduct();}
function renderProduct(){
  const recipe=recipes[selected];
  $('#story-product-title').textContent=recipe.name;$('#story-product-flavor').textContent=recipe.flavor;
  $('#story-product-intro').textContent=recipe.description;
  image.src=`./assets/story/pot-${recipe.id}.webp`;image.alt=`${recipe.name}, cup de lentilles ${recipe.flavor}`;
  $('#story-product-visual').style.setProperty('--flavor',recipe.color);
  $('.product-disc').style.background=`color-mix(in srgb, ${recipe.color} 30%, #fff7e6)`;
  $('#story-add').setAttribute('aria-label',`Ajouter ${quantity} pot${quantity>1?'s':''} de ${recipe.name} au panier`);
  flavors.querySelectorAll('input').forEach((input,index)=>{input.checked=index===selected;});renderPanel();
}
function renderPanel(){
  const recipe=recipes[selected],panel=$('#story-product-panel');
  document.querySelectorAll('[data-tab]').forEach(button=>{const active=button.dataset.tab===activeTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  panel.setAttribute('aria-labelledby',`story-tab-${activeTab}`);
  if(activeTab==='composition')panel.innerHTML=`<h4>${recipe.complete?'Composition':'Ingrédients principaux'}</h4><ul class="ingredient-list">${recipe.ingredients.map(ingredient=>`<li>${ingredient}</li>`).join('')}</ul><p class="ingredient-note">${recipe.complete?'Consultez le pot pour les informations relatives aux allergènes.':'Retrouvez la liste complète des ingrédients et les allergènes sur le pot.'}</p>`;
  else if(activeTab==='preparation')panel.innerHTML='<p>Ouvrez le pot, ajoutez de l’eau chaude et suivez les quantités et le temps indiqués sur votre cup. Mélangez avant de déguster.</p>';
  else panel.innerHTML=`<p>${recipe.description}</p><p>Une recette de lentilles à réhydrater, à garder sous la main pour votre prochaine pause.</p>`;
}
const tabs=[...document.querySelectorAll('[data-tab]')];
tabs.forEach((button,index)=>{
  button.addEventListener('click',()=>{activeTab=button.dataset.tab;renderPanel();});
  button.addEventListener('keydown',event=>{
    const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
    if(next===null)return;event.preventDefault();activeTab=tabs[next].dataset.tab;renderPanel();tabs[next].focus();
  });
});
function renderQuantity(){
  $('#story-quantity').value=quantity;$('#quantity-minus').disabled=quantity<=1;$('#quantity-plus').disabled=quantity>=99;
  $('#story-add').setAttribute('aria-label',`Ajouter ${quantity} pot${quantity>1?'s':''} de ${recipes[selected].name} au panier`);
}
$('#quantity-minus').addEventListener('click',()=>{quantity=Math.max(1,quantity-1);renderQuantity();});
$('#quantity-plus').addEventListener('click',()=>{quantity=Math.min(99,quantity+1);renderQuantity();});
$('#story-add').addEventListener('click',()=>{
  const recipe=recipes[selected],before=readCart()[recipe.id]||0,cart=adjustQuantity(recipe.id,quantity),added=(cart[recipe.id]||0)-before;
  $('#story-cart-feedback').textContent=added?`${added} pot${added>1?'s':''} de ${recipe.name} ajouté${added>1?'s':''} au panier.`:'La quantité maximale de cette recette est déjà dans votre panier.';
  updateCartBadge();
});
image.addEventListener('error',()=>{$('#story-image-error').hidden=false;image.hidden=true;});
image.addEventListener('load',()=>{$('#story-image-error').hidden=true;image.hidden=false;});

function updateCartBadge(){
  const count=countCart(readCart()),badge=$('#selection-count');badge.hidden=!count;badge.textContent=count;
  $('#story-cart-open').setAttribute('aria-label',`Ouvrir le panier${count?`, ${count} pot${count>1?'s':''}`:''}`);
}
function renderCart(){
  const cart=readCart(),count=countCart(cart),list=$('#cart-list');
  $('#cart-total').textContent=count?`${count} pot${count>1?'s':''}`:'À vous de choisir.';list.replaceChildren();
  if(!count){list.innerHTML='<p class="selection-empty">Votre panier est encore vide. Choisissez une recette pour commencer.</p>';return;}
  recipes.forEach((recipe,index)=>{
    const amount=cart[recipe.id];if(!amount)return;
    const row=document.createElement('div');row.className='cart-row';row.style.setProperty('--swatch',recipe.color);
    row.innerHTML=`<button class="cart-recipe" aria-label="Voir ${recipe.name}"><span class="swatch" aria-hidden="true"></span><span><strong>${recipe.name}</strong><small>${recipe.flavor}</small></span></button><div class="quantity-control"><button aria-label="Diminuer la quantité de ${recipe.name}"><i class="ph ph-minus" aria-hidden="true"></i></button><span aria-label="Quantité">${amount}</span><button aria-label="Augmenter la quantité de ${recipe.name}" ${amount===99?'disabled':''}><i class="ph ph-plus" aria-hidden="true"></i></button></div><button class="remove-cart" aria-label="Retirer ${recipe.name} du panier"><i class="ph ph-trash" aria-hidden="true"></i></button>`;
    row.querySelector('.cart-recipe').addEventListener('click',()=>{selectRecipe(index);dialog.close();goToProduct();});
    const buttons=row.querySelectorAll('.quantity-control button');
    const change=delta=>{adjustQuantity(recipe.id,delta);updateCartBadge();renderCart();};
    buttons[0].addEventListener('click',()=>change(-1));buttons[1].addEventListener('click',()=>change(1));
    row.querySelector('.remove-cart').addEventListener('click',()=>change(-amount));list.append(row);
  });
}
function goToProduct(){requestAnimationFrame(()=>{$('#choisir').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
$('#story-cart-open').addEventListener('click',()=>{focusReturn=document.activeElement;renderCart();dialog.showModal();document.documentElement.style.overflow='hidden';});
dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.documentElement.style.overflow='';focusReturn?.focus({preventScroll:true});});
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
$('#story-cart-continue').addEventListener('click',()=>{dialog.close();goToProduct();});
window.addEventListener('storage',event=>{if(event.key===cartKey){updateCartBadge();if(dialog.open)renderCart();}});
window.addEventListener('pageshow',event=>{updateCartBadge();if(dialog.open)renderCart();if(event.persisted)document.querySelectorAll('.reveal').forEach(element=>element.classList.add('is-visible'));});

// Native scrolling stays intact; reveals only run as each section enters view.
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let observer;
if(!reduced.matches&&'IntersectionObserver'in window){
  document.documentElement.classList.add('motion-ready');
  observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
  document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
}
reduced.addEventListener('change',()=>{if(reduced.matches){observer?.disconnect();document.querySelectorAll('.reveal').forEach(element=>element.classList.add('is-visible'));}});
window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
renderProduct();renderQuantity();updateCartBadge();
import './journey.js';
