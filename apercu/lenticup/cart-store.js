import {recipes} from './catalog.js';

export const cartKey='lenticup-cart';
let memoryCart={};
export function readCart(){
  const cart={};
  try{
    const value=JSON.parse(localStorage.getItem(cartKey)||'null');
    if(value&&typeof value==='object'&&!Array.isArray(value))for(const recipe of recipes){
      const quantity=Number(value[recipe.id]);
      if(Number.isInteger(quantity)&&quantity>0)cart[recipe.id]=Math.min(99,quantity);
    }
  }catch{return {...memoryCart};}
  memoryCart={...cart};
  return cart;
}
export function adjustQuantity(id,delta){
  const cart=readCart();
  if(!recipes.some(recipe=>recipe.id===id)||!Number.isInteger(delta))return cart;
  const quantity=Math.max(0,Math.min(99,(cart[id]||0)+delta));
  if(quantity)cart[id]=quantity;else delete cart[id];
  memoryCart={...cart};
  try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{}
  return cart;
}
export const countCart=cart=>Object.values(cart).reduce((sum,quantity)=>sum+quantity,0);
