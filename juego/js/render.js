// Render WebGL2: iluminación original (plana) o moderna (sol, cielo, sombras en tiempo real)
"use strict";
(function () {
  const BRR = window.BRR;
  const sh = (gl, t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = (gl, vs, fs, attrs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const uniforms = (gl, p, names) => { const U = {}; for (const n of names) U[n] = gl.getUniformLocation(p, n); return U; };

  BRR.Renderer = class {
    constructor(canvas) {
      const gl = this.gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
      if (!gl) throw new Error('Este navegador no tiene WebGL2');
      this.canvas = canvas;
      const VS = `#version 300 es
in vec3 p; in vec2 uv; in vec3 col; in float lay; in vec3 nrm; uniform mat4 VP; uniform mat4 W; uniform mat4 LVP; uniform vec3 cam; uniform float layK;
out vec2 vuv; out vec3 vcol; out vec3 wp; out vec4 lp; out float vwat; out vec3 vn;
void main(){ vec4 w=W*vec4(p,1.); vn=mat3(W)*nrm; vuv=uv; vcol=col; wp=w.xyz; lp=LVP*w; vwat=lay<-0.5?1.:0.;
  // capas: caras coplanarias posteriores se acercan un poco a la cámara (sustituye al orden de pintado del original)
  vec3 tc=cam-w.xyz; float d=length(tc); if(lay>0.) w.xyz+=tc/max(d,1e-3)*lay*layK*(0.003+d*0.00035);
  gl_Position=VP*w; }`;
      const FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec2 vuv; in vec3 vcol; in vec3 wp; in vec4 lp; in float vwat; in vec3 vn;
uniform float time; uniform vec3 animPal[16]; uniform int animN; uniform float animStep;
uniform sampler2D T; uniform sampler2DShadow SM; uniform int useTex; uniform int mode; uniform int shadows; uniform float smTexel;
uniform vec3 cam; uniform float far; uniform vec3 fogc; uniform vec3 L; uniform vec3 sunC; uniform vec3 skyC; uniform vec3 gndC; uniform float glow;
uniform float fogK; uniform float wet; uniform vec4 hlP[16]; uniform vec4 hlD[16]; uniform int hlN;
out vec4 o;
/* faros: focos que alumbran hacia delante (de noche, con niebla o lluvia) */
vec3 headl(vec3 n){ vec3 s=vec3(0.); for(int i=0;i<16;i++){ if(i>=hlN) break; vec3 v=wp-hlP[i].xyz; float dd=length(v); if(dd>48.) continue; vec3 l=v/max(dd,.01);
  float cone=smoothstep(.78,.94,dot(l,hlD[i].xyz)); float att=hlD[i].w*cone/(1.+dd*dd*.010); s+=vec3(1.,.94,.8)*att*(max(dot(n,-l),0.)*.75+.25); } return s; }
float shadow(vec3 n){
  if(shadows==0) return 1.;
  vec3 q=lp.xyz/lp.w*.5+.5; if(q.x<0.||q.x>1.||q.y<0.||q.y>1.||q.z>1.) return 1.;
  float b=0.00012+0.0005*(1.-max(dot(n,L),0.)); /* ~7-37 cm de 600 m: los coches en el suelo también dan sombra */ float s=0.;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) s+=texture(SM,vec3(q.xy+vec2(i,j)*smTexel,q.z-b));
  float fade=smoothstep(.85,1.,max(abs(q.x-.5),abs(q.y-.5))*2.);
  return mix(s/9.,1.,fade); }
void main(){ vec4 c = useTex==1 ? texture(T,vuv) : vec4(vcol,1.); if(c.a<.5) discard;
  // colores animados del original (palanim): el alfa guarda la posición en el ciclo
  if(useTex==1 && animN>0 && c.a<0.99){ int i=int(floor(c.a*255.+.5))-200; if(i>=0 && i<animN){ c.rgb=animPal[(i+int(animStep))%animN]; } c.a=1.; }
  // normal: suave si la malla la trae (terreno), si no la de la cara
  vec3 n; if(dot(vn,vn)>0.25) n=normalize(vn); else { n=normalize(cross(dFdx(wp),dFdy(wp))); if(dot(n,cam-wp)<0.) n=-n; }
  float d=length(wp-cam); vec3 rgb;
  if(glow>0.){ float f=clamp((d-far*.55)/(far*.45),0.,1.); o=vec4(mix(c.rgb*glow,fogc,f*.7),1.); return; }   // luces: sin sombreado
  if(mode==0){ float l=.66+.34*abs(dot(n,normalize(vec3(.4,.85,.3)))); rgb=c.rgb*l;
    float f=clamp((d-far*.55)/(far*.45),0.,1.); o=vec4(mix(rgb,fogc,f),1.); return; }
  // agua: olas que se mueven, brillo del sol y reflejo del cielo
  if(vwat>0.5){ vec2 q=wp.xz; float t=time;
    vec3 nw=normalize(vec3(sin(q.x*.55+t*1.6)*.07+sin((q.x+q.y)*1.3-t*2.3)*.04, 1., cos(q.y*.6+t*1.3)*.07+sin((q.x-q.y)*1.1+t*1.9)*.04));
    vec3 Vd=normalize(cam-wp); float fres=pow(1.-max(dot(nw,Vd),0.),3.), sp=pow(max(dot(reflect(-L,nw),Vd),0.),70.);
    c.rgb*=0.9+0.1*sin(q.x*.9+q.y*.7+t*2.);
    float ndl=max(dot(nw,L),0.), sh=shadow(n); vec3 hemi=mix(gndC,skyC,.9);
    vec3 col=c.rgb*(hemi*.4+sunC*ndl*sh*1.1)*1.25; col=mix(col,skyC*1.05,fres*.55+.08)+sunC*sp*1.4*sh;
    col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
    float f=1.-exp(-d*2.2*fogK/far); f=max(f*.75,clamp((d-far*.7)/(far*.3),0.,1.)); o=vec4(mix(col,fogc,f),1.); return; }
  float ndl=max(dot(n,L),0.), sh=shadow(n);
  vec3 hemi=mix(gndC,skyC,n.y*.5+.5);
  // más contraste entre caras al sol y a la sombra (volumen), oclusión aproximada en caras que miran abajo
  float occ=mix(.62,1.,clamp(n.y*.5+.75,0.,1.));
  vec3 light=hemi*.36*occ+sunC*ndl*sh*1.3+headl(n)*1.3;
  rgb=c.rgb*light*1.25*(1.-wet*.18*clamp(n.y,0.,1.));
  // tonemapping filmico (ACES aproximado) y algo de saturación
  rgb=clamp((rgb*(2.51*rgb+.03))/(rgb*(2.43*rgb+.59)+.14),0.,1.);
  float lu=dot(rgb,vec3(.299,.587,.114)); rgb=mix(vec3(lu),rgb,1.12);
  // niebla atmosférica + desvanecido al final de la distancia de dibujado
  float f=1.-exp(-d*2.2*fogK/far); f=max(f*.75,clamp((d-far*.7)/(far*.3),0.,1.));
  o=vec4(mix(rgb,fogc,f),1.); }`;
      this.pr = prog(gl, VS, FS, ['p', 'uv', 'col', 'lay', 'nrm']); gl.vertexAttrib3f(4, 0, 0, 0);
      this.U = uniforms(gl, this.pr, ['VP', 'W', 'LVP', 'T', 'SM', 'useTex', 'mode', 'shadows', 'smTexel', 'cam', 'far', 'fogc', 'layK', 'L', 'sunC', 'skyC', 'gndC', 'glow', 'time', 'animPal', 'animN', 'animStep', 'fogK', 'wet', 'hlP', 'hlD', 'hlN']);
      // pase de sombras (solo profundidad, con recorte por transparencia para árboles y vallas)
      this.dpr = prog(gl, `#version 300 es
in vec3 p; in vec2 uv; uniform mat4 LVP; uniform mat4 W; out vec2 vuv; void main(){ vuv=uv; gl_Position=LVP*W*vec4(p,1.); }`,
        `#version 300 es
precision mediump float; in vec2 vuv; uniform sampler2D T; uniform int useTex; out vec4 o; void main(){ if(useTex==1 && texture(T,vuv).a<.5) discard; o=vec4(1.); }`, ['p', 'uv']);
      this.DU = uniforms(gl, this.dpr, ['LVP', 'W', 'T', 'useTex']);
      // cielo con degradado y halo del sol
      this.spr = prog(gl, `#version 300 es
in vec2 p; uniform mat4 IVP; out vec3 dir; void main(){ vec4 a=IVP*vec4(p,1.,1.); dir=a.xyz/a.w; gl_Position=vec4(p,0.9999,1.); }`,
        `#version 300 es
precision highp float; in vec3 dir; uniform vec3 cam; uniform vec3 hor; uniform vec3 zen; uniform vec3 L; uniform int mode; out vec4 o;
uniform float night; uniform float cloudK; uniform vec3 cloudC; uniform float time; uniform vec3 sunCol;
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=vn(p)*a; p=p*2.03+vec2(17.1,9.3); a*=.5; } return s; }
void main(){ vec3 d=normalize(dir-cam); if(mode==0){ o=vec4(hor,1.); return; }
  float h=clamp(d.y,0.,1.); vec3 c=mix(hor,zen,pow(h,.55)); float sd=max(dot(d,L),0.);
  c+=sunCol*(pow(sd,180.)*.8*(1.-night)+pow(sd,8.)*.18);
  /* estrellas de noche */
  if(night>0.){ vec2 g=floor(vec2(atan(d.z,d.x)*180.,asin(clamp(d.y,-1.,1.))*180.)); float st=step(.996,hs(g))*smoothstep(.02,.25,d.y); c+=vec3(.9,.92,1.)*st*night*(.6+.4*sin(time*3.+hs(g+3.)*20.)); }
  /* nubes procedurales en una capa alta: más o menos cielo cubierto según el clima, iluminadas por el sol */
  if(cloudK>0. && d.y>0.01){ vec2 uv=d.xz/(d.y+.08)*.9+vec2(time*.012,time*.004); float n=fbm(uv)*.75+fbm(uv*3.1+5.)*.25;
    float cov=smoothstep(1.-cloudK*.9,1.15-cloudK*.75,n)*smoothstep(.01,.18,d.y); vec3 cc=cloudC*(.78+.32*fbm(uv*2.+11.))+sunCol*pow(sd,6.)*.25;
    c=mix(c,cc,cov*.95); }
  o=vec4(c,1.); }`, ['p']);
      this.SU = uniforms(gl, this.spr, ['IVP', 'cam', 'hor', 'zen', 'L', 'mode', 'night', 'cloudK', 'cloudC', 'time', 'sunCol']);
      this.skyVao = gl.createVertexArray(); gl.bindVertexArray(this.skyVao); const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
      this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      this.filter = 'nearest'; this.mode = 1; this.shadowSize = 2048; this.shadowRange = 110;
      this.L = [0.4, 0.8, 0.3];
    }
    setShadows(q) {   // 0 sin sombras, 1 media, 2 alta
      this.shadowQ = q; const size = q === 2 ? 4096 : 2048; this.shadowRange = q === 2 ? 130 : 100;
      if (!q) return; if (this.smTex && this.shadowSize === size) return;
      const gl = this.gl; this.shadowSize = size;
      if (this.smTex) { gl.deleteTexture(this.smTex); gl.deleteFramebuffer(this.smFbo); }
      const t = this.smTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.smFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.smFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // ambiente del circuito: dirección del sol (script "light") y colores de cielo/suelo
    setEnvironment(L, sky) {
      this.L = BRR.V.norm(L); this.sky = sky;
      const lum = sky[0] * .3 + sky[1] * .59 + sky[2] * .11;
      this.zen = sky.map(c => c * 0.78); this.hor = sky.map(c => Math.min(1, c * 0.85 + 0.2));
      this.skyC = sky.map(c => 0.6 + c * 0.55); this.gndC = [0.45, 0.4, 0.34]; this.sunC = [1.05, 0.98, 0.88].map(c => c * (0.85 + lum * 0.3));
      this.base = { L: this.L, zen: this.zen, hor: this.hor, skyC: this.skyC, gndC: this.gndC, sunC: this.sunC }; this.atmos = null;
    }
    // ambiente (hora del día y clima): cambia el sol, el cielo, la niebla y las nubes sobre la luz base del circuito
    setAtmos(A) {
      const B = this.base; if (!B) return; this.atmos = A;
      if (!A) { Object.assign(this, { L: B.L, zen: B.zen, hor: B.hor, skyC: B.skyC, gndC: B.gndC, sunC: B.sunC }); return; }
      this.L = BRR.V.norm(A.L || B.L); this.zen = A.zen || B.zen; this.hor = A.hor || B.hor; this.skyC = A.skyC || B.skyC; this.gndC = A.gndC || B.gndC; this.sunC = A.sunC || B.sunC;
    }
    // dibuja un modelo suelto en una imagen (caras de los pilotos para el menú)
    thumb(batches, { size = 160, yaw = 0, pitch = -0.1, dist = 3, target = [0, 0, 0], fov = 0.5, canvas = null, parts = null } = {}) {
      const gl = this.gl;
      if (!this.thFbo) {
        this.thFbo = gl.createFramebuffer(); this.thCol = gl.createTexture(); this.thDep = gl.createRenderbuffer();
      }
      gl.bindTexture(gl.TEXTURE_2D, this.thCol); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.thDep); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, size, size);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.thFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.thCol, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.thDep);
      const keep = [this.viewRect, this.shadowQ, this.mode, this.LVP], keepA = [this.atmos, this.headl, this.L, this.sunC, this.skyC]; this.atmos = null; this.headl = null; if (this.base) Object.assign(this, { L: this.base.L, sunC: this.base.sunC, skyC: this.base.skyC });   /* miniaturas: siempre con luz de día neutra */ this.viewRect = [0, 0, size, size]; this.shadowQ = 0; this.mode = 1; this.thumbMode = true;
      const eye = [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] - Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
      const view = BRR.M4.lookAt(eye, target, [0, 1, 0]), proj = BRR.M4.persp(fov, 1, 0.05, 100);
      this.begin(eye, view, proj, 1000, [0.5, 0.5, 0.5]); this.draw(batches); if (parts) for (const q of parts) this.draw(q.b, q.W);
      const px = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, this.target || null);
      [this.viewRect, this.shadowQ, this.mode, this.LVP] = keep; [this.atmos, this.headl, this.L, this.sunC, this.skyC] = keepA; this.thumbMode = false;
      const c = canvas || document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), im = g.createImageData(size, size);
      for (let y = 0; y < size; y++) im.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      g.putImageData(im, 0, 0); return canvas ? c : c.toDataURL();
    }
    upload(mb) {
      const gl = this.gl, texs = new Map(), out = [];
      for (const [key, g] of mb.groups) {
        if (!g.pos.length) continue;
        let tex = null;
        if (key !== 'COLOR') {
          const name = key.startsWith('tex:') ? key.slice(4) : key, img = mb.textures.get(name);
          if (!img) continue;
          if (!texs.has(name)) {
            const w = img.w || 256, h = img.h || 192, data = img.data || img;
            const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, img.terrain ? 3 : 2);
            gl.generateMipmap(gl.TEXTURE_2D);
            if (img.smooth) t._smooth = true; this.setFilter(t); texs.set(name, t);
          }
          tex = texs.get(name);
        }
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const put = (loc, arr, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); };
        put(0, g.pos, 3);
        if (g.uv) put(1, g.uv, 2); else gl.vertexAttrib2f(1, 0, 0);
        if (g.col) put(2, g.col, 3); else gl.vertexAttrib3f(2, 1, 1, 1);
        if (g.lay && g.lay.length) put(3, g.lay, 1); else gl.vertexAttrib1f(3, 0);
        if (g.nrm && g.nrm.length === g.pos.length) put(4, g.nrm, 3);
        out.push({ vao, n: g.pos.length / 3, tex });
      }
      gl.bindVertexArray(null);
      (this.allTex = this.allTex || []).push(...texs.values());
      return out;
    }
    setFilter(t) {
      const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, t);
      const smooth = this.filter === 'smooth' || t._smooth;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, smooth ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_LINEAR);
      if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, smooth ? Math.min(16, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 1);
    }
    setFilterAll(f) { this.filter = f; for (const t of this.allTex || []) this.setFilter(t); }
    // ---- sombras: caja ortográfica del sol que sigue a la cámara (ajustada a la rejilla para que no tiemble) ----
    shadowBegin(center) {
      const gl = this.gl, V = BRR.V, L = this.L, h = this.shadowRange, size = this.shadowSize;
      const up = Math.abs(L[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0], s = V.norm(V.cross(up, L)), u = V.cross(L, s), tex = 2 * h / size;
      const cx = V.dot(center, s), cy = V.dot(center, u), snap = v => Math.round(v / tex) * tex;
      const c = V.add(center, V.add(V.mul(s, snap(cx) - cx), V.mul(u, snap(cy) - cy)));
      const view = BRR.M4.lookAt(V.madd(c, L, 400), c, up), proj = BRR.M4.ortho(-h, h, -h, h, 100, 700);
      this.LVP = BRR.M4.mul(proj, view);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.smFbo); gl.viewport(0, 0, size, size); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
      gl.useProgram(this.dpr); gl.uniformMatrix4fv(this.DU.LVP, false, this.LVP); gl.uniform1i(this.DU.T, 0);
    }
    drawDepth(batches, W) {
      const gl = this.gl; gl.uniformMatrix4fv(this.DU.W, false, W || BRR.M4.I);
      for (const b of batches) { gl.uniform1i(this.DU.useTex, b.tex ? 1 : 0); if (b.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, b.tex); } gl.bindVertexArray(b.vao); gl.drawArrays(gl.TRIANGLES, 0, b.n); }
    }
    shadowEnd() { const gl = this.gl; gl.disable(gl.POLYGON_OFFSET_FILL); gl.bindFramebuffer(gl.FRAMEBUFFER, this.target || null); }
    // posproceso de toda la imagen: antialiasing FXAA, exposición y desenfoque por profundidad (modo foto)
    // frameBegin: si hace falta, se dibuja en una textura; frameEnd: se pasa a la pantalla con el filtro
    frameBegin(W, H) {
      const gl = this.gl, need = this.fxaa || this.exposure || this.dof; this.target = null; if (!need) return;
      if (!this.post) {
        const VS = `#version 300 es
out vec2 uv; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); uv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;
        const FS = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D C; uniform highp sampler2D D; uniform vec2 px; uniform int aa; uniform float expo; uniform float dof; uniform float focus; out vec4 o;
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
vec3 fxaa(vec2 p){ vec3 cM=texture(C,p).rgb; float lM=lum(cM), lN=lum(texture(C,p+vec2(0.,-px.y)).rgb), lS=lum(texture(C,p+vec2(0.,px.y)).rgb), lW=lum(texture(C,p+vec2(-px.x,0.)).rgb), lE=lum(texture(C,p+vec2(px.x,0.)).rgb);
  float mn=min(lM,min(min(lN,lS),min(lW,lE))), mx=max(lM,max(max(lN,lS),max(lW,lE))); if(mx-mn<max(.0312,mx*.125)) return cM;
  float lNW=lum(texture(C,p-px).rgb), lNE=lum(texture(C,p+vec2(px.x,-px.y)).rgb), lSW=lum(texture(C,p+vec2(-px.x,px.y)).rgb), lSE=lum(texture(C,p+px).rgb);
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)), (lNW+lSW)-(lNE+lSE)); float red=max((lNW+lNE+lSW+lSE)*.03125,1./128.), rc=1./(min(abs(dir.x),abs(dir.y))+red);
  dir=clamp(dir*rc,-8.,8.)*px;
  vec3 a=.5*(texture(C,p+dir*(1./3.-.5)).rgb+texture(C,p+dir*(2./3.-.5)).rgb), b=a*.5+.25*(texture(C,p-dir*.5).rgb+texture(C,p+dir*.5).rgb);
  float lb=lum(b); return (lb<mn||lb>mx)?a:b; }
float lin(float z){ return 0.6/(1.0001-z); }
void main(){ vec3 c = aa==1 ? fxaa(uv) : texture(C,uv).rgb;
  if(dof>0.){ float d=lin(texture(D,uv).r), f=lin(focus), k=clamp((abs(d-f)/max(f,1.)-.15)*dof*.7,0.,1.); if(k>.02){ vec3 acc=vec3(0.); float n=0.;
      for(int i=-3;i<=3;i++) for(int j=-3;j<=3;j++){ vec2 q=uv+vec2(float(i),float(j))*px*k*3.; acc+=texture(C,q).rgb; n+=1.; } c=mix(c,acc/n,k); } }
  c*=exp2(expo); o=vec4(c,1.); }`;
        this.post = prog(gl, VS, FS, []); this.PU = {}; for (const n of ['C', 'D', 'px', 'aa', 'expo', 'dof', 'focus']) this.PU[n] = gl.getUniformLocation(this.post, n);
        this.postVao = gl.createVertexArray();
      }
      if (!this.ppFbo || this.ppW !== W || this.ppH !== H) {
        if (this.ppFbo) { gl.deleteFramebuffer(this.ppFbo); gl.deleteTexture(this.ppC); gl.deleteTexture(this.ppD); }
        const tex = (ifmt, fmt, type) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, type, null);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
        this.ppC = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE); this.ppD = tex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
        gl.bindTexture(gl.TEXTURE_2D, this.ppD); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        this.ppFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.ppFbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.ppC, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.ppD, 0);
        this.ppW = W; this.ppH = H;
      }
      this.target = this.ppFbo; gl.bindFramebuffer(gl.FRAMEBUFFER, this.ppFbo);
    }
    frameEnd() {
      const gl = this.gl; if (!this.target) return; this.target = null;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.viewport(0, 0, this.ppW, this.ppH); gl.useProgram(this.post); const U = this.PU;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.ppC); gl.uniform1i(U.C, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.ppD); gl.uniform1i(U.D, 1); gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(U.px, 1 / this.ppW, 1 / this.ppH); gl.uniform1i(U.aa, this.fxaa ? 1 : 0); gl.uniform1f(U.expo, this.exposure || 0); gl.uniform1f(U.dof, this.dof || 0); gl.uniform1f(U.focus, this.focusZ || 0.99);
      gl.bindVertexArray(this.postVao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    }
    begin(camPos, view, proj, far, fog) {
      const gl = this.gl, modern = this.mode === 1, VP = BRR.M4.mul(proj, view);
      const fogc = modern && this.hor ? this.hor : fog;
      const vr = this.viewRect || [0, 0, this.canvas.width, this.canvas.height];   // pantalla partida: rectángulo de la vista
      gl.viewport(vr[0], vr[1], vr[2], vr[3]);
      if (this.viewRect) { gl.enable(gl.SCISSOR_TEST); gl.scissor(vr[0], vr[1], vr[2], vr[3]); } else gl.disable(gl.SCISSOR_TEST);
      if (this.thumbMode) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
      else gl.clearColor(fogc[0], fogc[1], fogc[2], 1), gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // cielo
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(this.spr);
      gl.uniformMatrix4fv(this.SU.IVP, false, BRR.M4.inv(VP)); gl.uniform3fv(this.SU.cam, camPos);
      gl.uniform3fv(this.SU.hor, fogc); gl.uniform3fv(this.SU.zen, this.zen || fog); gl.uniform3fv(this.SU.L, this.L); gl.uniform1i(this.SU.mode, modern ? 1 : 0);
      { const A = this.atmos || {}; gl.uniform1f(this.SU.night, A.night || 0); gl.uniform1f(this.SU.cloudK, A.cloudK || 0); gl.uniform3fv(this.SU.cloudC, A.cloudC || [1, 1, 1]); gl.uniform1f(this.SU.time, (performance.now() / 1000) % 10000); gl.uniform3fv(this.SU.sunCol, A.sunCol || [1, .9, .7]); }
      if (!this.thumbMode) { gl.bindVertexArray(this.skyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.enable(gl.DEPTH_TEST); gl.useProgram(this.pr);
      if (this.cull !== false) { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); } else gl.disable(gl.CULL_FACE);
      const U = this.U;
      gl.uniformMatrix4fv(U.VP, false, VP); gl.uniformMatrix4fv(U.LVP, false, this.LVP || BRR.M4.I);
      gl.uniform3fv(U.cam, camPos); gl.uniform1f(U.far, far); gl.uniform3fv(U.fogc, fogc); gl.uniform1i(U.T, 0); gl.uniform1f(U.layK, this.layers === false ? 0 : 1);
      gl.uniform1i(U.mode, modern ? 1 : 0); gl.uniform1i(U.shadows, modern && this.shadowQ && this.LVP ? 1 : 0); gl.uniform1f(U.smTexel, 1 / this.shadowSize);
      { const A = this.atmos || {}; gl.uniform1f(U.fogK, A.fogK || 1); gl.uniform1f(U.wet, A.wet || 0); const H = this.headl || []; gl.uniform1i(U.hlN, Math.min(16, H.length)); if (H.length) { const P = new Float32Array(64), D = new Float32Array(64); H.slice(0, 16).forEach((q, i) => { P.set([q.p[0], q.p[1], q.p[2], 0], i * 4); D.set([q.d[0], q.d[1], q.d[2], q.k], i * 4); }); gl.uniform4fv(U.hlP, P); gl.uniform4fv(U.hlD, D); } }
      gl.uniform3fv(U.L, this.L); gl.uniform3fv(U.sunC, this.sunC || [1, 1, 1]); gl.uniform3fv(U.skyC, this.skyC || [.8, .8, .8]); gl.uniform3fv(U.gndC, this.gndC || [.4, .4, .4]);
      gl.uniform1f(U.glow, 0); const tnow = performance.now() / 1000; gl.uniform1f(U.time, tnow % 3600);
      const PA = this.palAnim; gl.uniform1i(U.animN, PA ? PA.n : 0); if (PA) { gl.uniform3fv(U.animPal, PA.cols); gl.uniform1f(U.animStep, Math.floor(tnow * PA.rate) % PA.n); }
      gl.uniform1i(U.SM, 1); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.smTex || null); gl.activeTexture(gl.TEXTURE0);
      this.fogUsed = fogc;
    }
    // palanim del nivel: [velocidad, primero, último] con la paleta (bytes 0-255)
    setPalAnim(pa, pal) { if (!pa) { this.palAnim = null; return; } const n = pa[2] - pa[1] + 1, cols = new Float32Array(48);
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) cols[i * 3 + k] = pal[(pa[1] + i) * 3 + k] / 255; this.palAnim = { n, cols, rate: 24 / Math.max(1, pa[0]) }; }
    drawGlow(batches, W, g = 1) { this.gl.uniform1f(this.U.glow, g); this.draw(batches, W); this.gl.uniform1f(this.U.glow, 0); }
    draw(batches, W) {
      const gl = this.gl; gl.uniformMatrix4fv(this.U.W, false, W || BRR.M4.I);
      for (const b of batches) {
        gl.uniform1i(this.U.useTex, b.tex ? 1 : 0);
        if (b.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, b.tex); }
        gl.bindVertexArray(b.vao); gl.drawArrays(gl.TRIANGLES, 0, b.n);
      }
    }
  };
  // matrices 4x4 en orden de columnas (WebGL)
  const M4 = BRR.M4 = {
    I: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + i] * b[j * 4 + k]; r[j * 4 + i] = s; } return r; },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
    ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; },
    lookAt(e, c, up) {
      const V = BRR.V, f = V.norm(V.sub(c, e)), s = V.norm(V.cross(f, up)), u = V.cross(s, f);
      return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -V.dot(s, e), -V.dot(u, e), V.dot(f, e), 1];
    },
    fromRT(R, t) { return [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, t[0], t[1], t[2], 1]; },
    inv(m) {   // inversa general 4x4
      const a = m, r = new Array(16);
      const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
      const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
      const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
      r[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; r[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det; r[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; r[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
      r[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; r[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det; r[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; r[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
      r[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; r[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det; r[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; r[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
      r[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; r[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det; r[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; r[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
      return r;
    },
  };
})();
