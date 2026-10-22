/* Geometry shared by touch gestures and their regression checks. */
(function(root){
const limit=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function constrain(state,width,height){const scale=limit(state.scale,1,5);return {scale,x:limit(state.x,width*(1-scale),0),y:limit(state.y,height*(1-scale),0)}}
function at(state,point,scale,width,height){scale=limit(scale,1,5);const ratio=scale/state.scale;return constrain({scale,x:point.x-(point.x-state.x)*ratio,y:point.y-(point.y-state.y)*ratio},width,height)}
function pinch(start,initial,current,width,height){const distance=p=>Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),mid=p=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});const a=mid(initial),b=mid(current),scale=limit(start.scale*distance(current)/Math.max(1,distance(initial)),1,5);return constrain({scale,x:b.x-(a.x-start.x)/start.scale*scale,y:b.y-(a.y-start.y)/start.scale*scale},width,height)}
const api={constrain,at,pinch};if(typeof module==='object'&&module.exports)module.exports=api;else root.ZoomGeometry=api;
})(typeof window==='object'?window:this);
