/* Split at word boundaries; keep source offsets so resizing preserves your place. */
(function(root){
function paginate(blocks,fits){const pages=[];let parts=[];const flush=()=>{if(parts.length){pages.push({source:parts[0].source,block:parts[0].block,word:parts[0].from,parts});parts=[]}};
blocks.forEach((block,index)=>{const words=block.text.trim().split(/\s+/).filter(Boolean);if(!words.length)return;let start=0;
if(block.type==='h'&&parts.length){const heading={...block,block:index,from:0,to:words.length,text:words.join(' ')},next=blocks[index+1],sample=next?{...next,text:next.text.split(/\s+/).slice(0,12).join(' ')}:null;if(!fits([...parts,heading,...(sample?[sample]:[])]))flush()}
while(start<words.length){const make=end=>({...block,block:index,from:start,to:end,text:words.slice(start,end).join(' '),continued:start>0});let part=make(words.length);if(fits([...parts,part])){parts.push(part);break}let lo=0,hi=words.length-start;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(fits([...parts,make(start+mid)]))lo=mid;else hi=mid-1}if(lo===0&&parts.length){flush();continue}const end=start+Math.max(1,lo);parts.push(make(end));start=end;flush()}
});flush();return pages}
const api={paginate};if(typeof module==='object'&&module.exports)module.exports=api;else root.ReaderPagination=api;
})(typeof window==='object'?window:this);
