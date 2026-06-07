(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,85824,e=>{"use strict";var t=e.i(91788);let r=`#version 300 es
in vec3 aPos;      // play-zone pixels: x \u2208 [0, 2W], y \u2208 [0, H], z = depth px
in vec3 aNormal;
in vec2 aUv;
uniform vec2 uResolution;  // (2W, H + 2\xb7pad)
uniform float uDepth;      // depth range used to normalise z into clip space
out vec3 vNormal;
out vec2 vUv;
void main() {
  vec2 p = aPos.xy / uResolution;          // 0..1
  vec2 clip = vec2(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0);
  // Higher z (toward the viewer) \u2192 smaller clip z \u2192 drawn in front.
  float z = clamp(-aPos.z / uDepth, -1.0, 1.0);
  gl_Position = vec4(clip, z, 1.0);
  vNormal = aNormal;
  vUv = aUv;
}`,a=`#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUv;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform bool uHasBack;
uniform vec3 uLightDir;
uniform float uShadow;      // self-shadow strength on the curl (0\u20131, = shadowOpacity)
uniform vec3 uShadowColor;  // shadow tint (= shadowColor), default near-black
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  // Pick the face by which way the surface actually faces the viewer (robust
  // through the 3D deform + rotation, unlike gl_FrontFacing/winding): the part
  // still facing us shows the front; the wrapped-over part (facing away) shows
  // the back, mirrored so it reads correctly.
  bool front = N.z >= 0.0;
  vec3 Nl = front ? N : -N;                // lighting normal always toward viewer
  vec4 base;
  if (front) {
    base = texture(uFront, vUv);
  } else {
    base = uHasBack ? texture(uBack, vec2(1.0 - vUv.x, vUv.y)) : vec4(1.0, 1.0, 1.0, 1.0);
  }
  vec3 L = normalize(uLightDir);
  vec3 V = vec3(0.0, 0.0, 1.0);            // orthographic view, looking at +z
  float diff = max(dot(Nl, L), 0.0);
  vec3 R = reflect(-L, Nl);
  float spec = pow(max(dot(R, V), 0.0), 80.0);  // tight glossy ridge at the roll apex
  // Normalized to the FLAT-page response (a flat page facing the viewer has
  // diff = L.z): a page lying flat reads EXACTLY its base color \u2014 the same
  // value as the DOM face it hands off to at the start and end of a turn.
  // Without this the landed page sat at ~94% brightness and the handoff
  // popped ~6% brighter in one frame (read as "a shadow vanishing").
  float flatLight = 0.58 + 0.42 * max(L.z, 0.0);
  float light = (0.58 + 0.42 * diff) / flatLight;
  // Edge-on-ness: 0 when the surface lies flat (facing the viewer OR fully
  // turned over onto the far side), 1 at the vertical roll ridge. Both the back
  // darkening and the self-shadow scale by it, so they peak at the ridge and
  // fade to nothing as the page flattens onto either side \u2014 the wrapped-over
  // back no longer stays dark through the whole turn and then pops bright at the
  // DOM handoff. On the front face (N.z \u2265 0) this equals the previous (1 \u2212 N.z).
  float edge = 1.0 - abs(N.z);
  if (!front) {
    light *= mix(1.0, 0.82, edge);         // curled-under back darkens at the ridge, bright once flat
  }
  vec3 rgb = base.rgb * clamp(light, 0.0, 1.3) + vec3(spec * 0.6); // additive specular highlight
  // Self-shadow on the curling page, tinted TOWARD uShadowColor (= shadowColor),
  // the same quantity shadowOpacity shades on the lifted flap in the flat
  // variant. Peaks at the ridge, zero on the flat resting region. The default
  // shadowColor is near-black, so this matches the old darken-toward-black look.
  rgb = mix(rgb, uShadowColor, uShadow * 0.5 * edge);
  fragColor = vec4(rgb, base.a);
}`;function n(e,t,r){let a=e.createShader(t);if(e.shaderSource(a,r),e.compileShader(a),!e.getShaderParameter(a,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(a);throw e.deleteShader(a),Error(`Curl WebGL shader compile failed: ${t}`)}return a}function o(e){let t=e.createTexture();return e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([255,255,255,255])),t}let i=class e{constructor(e,t=56,i=40){this.hasBack=!1,this.W=1,this.H=1,this.padY=0;const l=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!0});if(!l)throw Error("WebGL2 not available");this.gl=l,this.cols=t,this.rows=i;const s=function(e,t){let r=e+1,a=t+1,n=r*a,o=new Float32Array(2*n);for(let n=0;n<a;n++)for(let a=0;a<r;a++){let i=n*r+a;o[2*i+0]=a/e,o[2*i+1]=n/t}let i=new Uint16Array(e*t*6),l=0;for(let a=0;a<t;a++)for(let t=0;t<e;t++){let e=a*r+t,n=e+1,o=e+r,s=o+1;i[l++]=e,i[l++]=n,i[l++]=o,i[l++]=n,i[l++]=s,i[l++]=o}return{texcoords:o,indices:i,vertexCount:n}}(t,i);this.texcoords=s.texcoords,this.indices=s.indices,this.scaledPos=new Float32Array(3*s.vertexCount),this.normals=new Float32Array(3*s.vertexCount);const u=n(l,l.VERTEX_SHADER,r),h=n(l,l.FRAGMENT_SHADER,a),c=l.createProgram();if(l.attachShader(c,u),l.attachShader(c,h),l.linkProgram(c),!l.getProgramParameter(c,l.LINK_STATUS))throw Error(`Curl WebGL link failed: ${l.getProgramInfoLog(c)}`);this.program=c,this.vao=l.createVertexArray(),l.bindVertexArray(this.vao);const f=l.getAttribLocation(c,"aPos"),d=l.getAttribLocation(c,"aNormal"),g=l.getAttribLocation(c,"aUv");this.posBuf=l.createBuffer(),l.bindBuffer(l.ARRAY_BUFFER,this.posBuf),l.bufferData(l.ARRAY_BUFFER,this.scaledPos.byteLength,l.DYNAMIC_DRAW),l.enableVertexAttribArray(f),l.vertexAttribPointer(f,3,l.FLOAT,!1,0,0),this.normBuf=l.createBuffer(),l.bindBuffer(l.ARRAY_BUFFER,this.normBuf),l.bufferData(l.ARRAY_BUFFER,this.normals.byteLength,l.DYNAMIC_DRAW),l.enableVertexAttribArray(d),l.vertexAttribPointer(d,3,l.FLOAT,!1,0,0);const m=l.createBuffer();l.bindBuffer(l.ARRAY_BUFFER,m),l.bufferData(l.ARRAY_BUFFER,this.texcoords,l.STATIC_DRAW),l.enableVertexAttribArray(g),l.vertexAttribPointer(g,2,l.FLOAT,!1,0,0);const p=l.createBuffer();l.bindBuffer(l.ELEMENT_ARRAY_BUFFER,p),l.bufferData(l.ELEMENT_ARRAY_BUFFER,this.indices,l.STATIC_DRAW),l.bindVertexArray(null),this.frontTex=o(l),this.backTex=o(l),l.pixelStorei(l.UNPACK_FLIP_Y_WEBGL,!1),l.pixelStorei(l.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),l.enable(l.DEPTH_TEST),l.depthFunc(l.LEQUAL),l.enable(l.BLEND),l.blendFunc(l.ONE,l.ONE_MINUS_SRC_ALPHA)}resize(t,r,a){let n=Math.round(r*e.PAD_RATIO),o=this.gl.canvas,i=Math.round(2*t*a),l=Math.round((r+2*n)*a);(this.W!==t||this.H!==r||o.width!==i||o.height!==l)&&(this.W=t,this.H=r,this.padY=n,o.width=i,o.height=l,this.gl.viewport(0,0,i,l))}clear(){let e=this.gl;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT)}upload(e,t){let r=this.gl;r.bindTexture(r.TEXTURE_2D,e),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,t)}setFront(e){this.upload(this.frontTex,e)}setBack(e){this.hasBack=null!==e,e&&this.upload(this.backTex,e)}computeNormals(){let e=this.scaledPos,t=this.indices,r=this.normals;r.fill(0);for(let a=0;a<t.length;a+=3){let n=3*t[a],o=3*t[a+1],i=3*t[a+2],l=e[o]-e[n],s=e[o+1]-e[n+1],u=e[o+2]-e[n+2],h=e[i]-e[n],c=e[i+1]-e[n+1],f=e[i+2]-e[n+2],d=s*f-u*c,g=u*h-l*f,m=l*c-s*h;r[n]+=d,r[n+1]+=g,r[n+2]+=m,r[o]+=d,r[o+1]+=g,r[o+2]+=m,r[i]+=d,r[i+1]+=g,r[i+2]+=m}for(let e=0;e<r.length;e+=3){let t=Math.hypot(r[e],r[e+1],r[e+2])||1;r[e]/=t,r[e+1]/=t,r[e+2]/=t}}render(e,t,r,a,n,o,i,l=[.1,.1,.12]){let s=this.gl,{W:u,H:h,padY:c}=this,f=Math.PI,d=Math.max(n,.05),g=this.texcoords,m=this.scaledPos,p=g.length/2;for(let n=0;n<p;n++){let i=o+g[2*n]*u,l=g[2*n+1]*h,s=(i-e)*r+(l-t)*a,p=i,R=l,E=0;if(s>0){let e=s/d;if(e<=f){let t=d*Math.sin(e)-s;p=i+r*t,R=l+a*t,E=d*(1-Math.cos(e))}else{let e=f*d-2*s;p=i+r*e,R=l+a*e,E=2*d}}m[3*n]=u+p,m[3*n+1]=c+R,m[3*n+2]=E}this.computeNormals(),s.bindBuffer(s.ARRAY_BUFFER,this.posBuf),s.bufferSubData(s.ARRAY_BUFFER,0,m),s.bindBuffer(s.ARRAY_BUFFER,this.normBuf),s.bufferSubData(s.ARRAY_BUFFER,0,this.normals),s.clearColor(0,0,0,0),s.clear(s.COLOR_BUFFER_BIT|s.DEPTH_BUFFER_BIT),s.useProgram(this.program),s.bindVertexArray(this.vao),s.uniform2f(s.getUniformLocation(this.program,"uResolution"),2*u,h+2*c),s.uniform1f(s.getUniformLocation(this.program,"uDepth"),2*d*2),s.uniform3f(s.getUniformLocation(this.program,"uLightDir"),o<0?-.3:.3,-.4,.85),s.uniform1f(s.getUniformLocation(this.program,"uShadow"),i),s.uniform3f(s.getUniformLocation(this.program,"uShadowColor"),l[0],l[1],l[2]),s.uniform1i(s.getUniformLocation(this.program,"uHasBack"),+!!this.hasBack),s.activeTexture(s.TEXTURE0),s.bindTexture(s.TEXTURE_2D,this.frontTex),s.uniform1i(s.getUniformLocation(this.program,"uFront"),0),s.activeTexture(s.TEXTURE1),s.bindTexture(s.TEXTURE_2D,this.backTex),s.uniform1i(s.getUniformLocation(this.program,"uBack"),1),s.drawElements(s.TRIANGLES,this.indices.length,s.UNSIGNED_SHORT,0),s.bindVertexArray(null)}dispose(){let e=this.gl;e.bindVertexArray(null),e.deleteVertexArray(this.vao),e.deleteBuffer(this.posBuf),e.deleteBuffer(this.normBuf),e.deleteTexture(this.frontTex),e.deleteTexture(this.backTex),e.deleteProgram(this.program)}loseContext(){this.dispose(),this.gl.getExtension("WEBGL_lose_context")?.loseContext()}};i.PAD_RATIO=.18;class l{constructor(e=e=>new i(e)){this.createRenderer=e,this.renderer=null,this.canvas=null,this.owner=null,this.failed=!1}acquire(e){if(this.failed)return null;if(!this.renderer){let e=document.createElement("canvas");try{this.renderer=this.createRenderer(e)}catch{return this.failed=!0,null}this.canvas=e}return this.owner=e,{renderer:this.renderer,canvas:this.canvas}}release(e){this.owner===e&&(this.owner=null,this.canvas?.remove())}dispose(){this.renderer?.loseContext(),this.canvas?.remove(),this.renderer=null,this.canvas=null,this.owner=null}}var s=e.i(71345);async function u(t,r,a){try{let{snapdom:n}=await e.A(74264),o=await n.toPng(t,{dpr:r,backgroundColor:a,embedFonts:!1});return o.complete||await new Promise((e,t)=>{o.onload=()=>e(),o.onerror=()=>t(Error("Curl snapshot image failed to load"))}),o}catch{return null}}let h=[.1,.1,.12];function c(e,t,r,a,n,o,i){if(!t)return!1;let l=-t.creaseDir.y,s=t.creaseDir.x,u=t.progress/100,h=Math.max(.05,n*(u<.8200000000000001?1-u:(1-u)*(1-u)/.18));return e.render(t.creaseMid.x,t.creaseMid.y,l,s,h,r?-a:0,o,i),!0}e.s(["CurlWebglLayer",0,function(e){let{width:r,height:a,active:n,fold:o,flipped:f,curlRadius:d,shadowOpacity:g,shadowColor:m,pageBackground:p,frontContent:R,backContent:E,onUnavailable:v,onReadyChange:A,warm:b=!0}=e,T=(0,t.useMemo)(()=>(function(e){if(!e||"u"<typeof document)return h;let t=document.createElement("canvas");t.width=1,t.height=1;let r=t.getContext("2d");if(!r)return h;r.fillStyle="#1a1b1e",r.fillStyle=e,r.fillRect(0,0,1,1);let[a,n,o]=r.getImageData(0,0,1,1).data;return[a/255,n/255,o/255]})(m),[m]),x=(0,t.useRef)(null),w=(0,t.useRef)(null),_=(0,t.useRef)(null),B=(0,t.useContext)(s.CurlWebglPoolContext),U=(0,t.useRef)({pool:null}),y=B??U.current,L=(0,t.useRef)(y);L.current=y;let F=(0,t.useRef)(Symbol("curl-page")),D=(0,t.useRef)(null),P=(0,t.useRef)({front:null,back:null}),k=(0,t.useRef)(!1),C=(0,t.useRef)(v);C.current=v;let N=(0,t.useRef)(A);N.current=A;let S=(0,t.useRef)(o);S.current=o;let I=(0,t.useRef)(f);I.current=f;let M=(0,t.useRef)(d);M.current=d;let O=(0,t.useRef)(g);O.current=g;let z=(0,t.useRef)(T);z.current=T;let W=null!=E,Y=(0,t.useRef)(W);Y.current=W;let G=`${r}x${a}|${W}|${f}`,X=(0,t.useRef)(null),H=(0,t.useRef)(G);H.current=G;let V=()=>{let e=D.current,t=P.current;e&&t.front&&X.current===H.current&&(e.renderer.setFront(t.front),e.renderer.setBack(Y.current?t.back:null),k.current=!0,c(e.renderer,S.current,I.current,r,M.current,O.current,z.current)&&N.current?.(!0))},$=(0,t.useRef)(V);$.current=V,(0,t.useLayoutEffect)(()=>{if(!n)return;let e=L.current,t=x.current;if(!t)return;e.pool??(e.pool=new l);let o=F.current,i=e.pool.acquire(o);if(!i)return void C.current?.();D.current=i;let{canvas:s}=i;s.setAttribute("aria-hidden","true"),s.style.display="block",s.style.width="100%",s.style.height="100%",t.appendChild(s);let u=Math.min(window.devicePixelRatio||1,2);return i.renderer.resize(r,a,u),i.renderer.clear(),$.current(),()=>{D.current=null,k.current=!1,N.current?.(!1),e.pool?.release(o)}},[n,r,a]),(0,t.useEffect)(()=>{let e=U.current;return()=>{B||(e.pool?.dispose(),e.pool=null)}},[]),(0,t.useEffect)(()=>{if(!b&&!n||X.current===G)return;let e=Math.min(window.devicePixelRatio||1,2),t=!1;return(async()=>{let r=w.current&&getComputedStyle(w.current).backgroundColor||"#ffffff",a=w.current?await u(w.current,e,r):null;if(t)return;if(!a)return C.current?.();let n=null;if(W&&_.current){if(n=await u(_.current,e,r),t)return;if(!n)return C.current?.()}P.current={front:a,back:n},X.current=G,$.current()})(),()=>{t=!0}},[G,b,n]),(0,t.useEffect)(()=>{b||n||(P.current={front:null,back:null},X.current=null)},[b,n]),(0,t.useEffect)(()=>{let e=D.current;e&&n&&k.current&&o&&c(e.renderer,o,f,r,d,g,T)&&N.current?.(!0)},[n,o,f,r,d,g,T]);let K={position:"absolute",top:0,left:-99999,width:r,height:a,overflow:"hidden",background:p??"var(--curl-page-background, white)",pointerEvents:"none"};return t.default.createElement(t.default.Fragment,null,(b||n)&&t.default.createElement(t.default.Fragment,null,t.default.createElement("div",{ref:w,style:K,"aria-hidden":"true"},R),W&&t.default.createElement("div",{ref:_,style:K,"aria-hidden":"true"},E)),t.default.createElement("div",{ref:x,"aria-hidden":"true",style:{position:"absolute",top:-Math.round(a*i.PAD_RATIO),left:0,width:2*r,height:a+2*Math.round(a*i.PAD_RATIO),pointerEvents:"none",display:n?"block":"none",zIndex:6}}))}],85824)},74264,e=>{e.v(t=>Promise.all(["static/chunks/0k4e5t-mhpx6l.js"].map(t=>e.l(t))).then(()=>t(83217)))}]);