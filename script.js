"use strict";
const cases = window.HAIRFLOW_CASES || [];
const rows = document.querySelector("#results-rows");
const paginations = [...document.querySelectorAll(".result-pagination")];
const pageCount = Math.ceil(cases.length/4);
paginations.forEach(nav => {
  nav.innerHTML = `<p class="page-summary" role="status"></p><div class="page-buttons">
    <button type="button" data-step="-1" aria-label="Previous results page">← <span>Previous</span></button>
    ${Array.from({length:pageCount},(_,page)=>`<button type="button" data-page="${page}" aria-label="Page ${page+1}, examples ${page*4+1} to ${Math.min(page*4+4,cases.length)}"><strong>${page+1}</strong><small>${page*4+1}–${Math.min(page*4+4,cases.length)}</small></button>`).join("")}
    <button type="button" data-step="1" aria-label="Next results page"><span>Next</span> →</button>
    </div>`;
  nav.addEventListener("click",event=>{
    const button = event.target.closest("button");
    if(!button || button.disabled)return;
    const next = button.dataset.page !== undefined ? Number(button.dataset.page)
      : currentPage + Number(button.dataset.step);
    if(next === currentPage)return;
    renderPage(next);
    if(nav.hasAttribute("data-bottom")) {
      paginations[0].scrollIntoView({behavior:"instant",block:"start"});
      paginations[0].querySelector('[aria-current="page"]').focus({preventScroll:true});
    }
  });
});
let currentPage = 0;
const cache = new Map();
function sheets(item) {
  if (!cache.has(item.id)) {
    const promise = Promise.all(item.sheets.map(source => new Promise((resolve,reject) => {
      const image = new Image();
      image.onload = async () => {
        try { await image.decode(); resolve(image); } catch (error) { reject(error); }
      };
      image.onerror = reject;
      image.src = source;
    }))).catch(error => {cache.delete(item.id);throw error;});
    cache.set(item.id,promise);
  }
  return cache.get(item.id);
}
// Warm only near-visible rows, one pair at a time rather than all 12 examples.
let warmQueue = Promise.resolve();
const viewObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    viewObserver.unobserve(entry.target);
    warmQueue = warmQueue.then(async () => {
      if (!entry.target.isConnected) return;
      const item = cases.find(item => item.id === entry.target.dataset.case);
      try { await sheets(item); } catch { /* Interaction offers a retry. */ }
    });
  }
}, {rootMargin: "250px"});
function renderPage(page) {
  viewObserver.disconnect();
  currentPage = Math.max(0,Math.min(pageCount-1,page));
  paginations.forEach(nav=>{
    nav.querySelector(".page-summary").textContent = `Examples ${currentPage*4+1}–${Math.min(currentPage*4+4,cases.length)} of ${cases.length} · Page ${currentPage+1} of ${pageCount}`;
    nav.querySelector('[data-step="-1"]').disabled = currentPage===0;
    nav.querySelector('[data-step="1"]').disabled = currentPage===pageCount-1;
    nav.querySelectorAll("[data-page]").forEach(button=>{
      if(Number(button.dataset.page)===currentPage)button.setAttribute("aria-current","page");
      else button.removeAttribute("aria-current");
    });
  });
  rows.innerHTML = cases.slice(currentPage*4,currentPage*4+4).map((item, index) => {
  const captions = ["Input image", "3D mesh", "Sketch", "Strands"];
  const columns = [item.input,item.posters[0],item.sketch,item.posters[1]].map((source,column) => {
    const isView = column === 1 || column === 3;
    return `<figure>${isView
      ? `<div class="image-view" tabindex="0" role="group" aria-label="${item.name}: drag to change ${captions[column].toLowerCase()} view"><img src="${source}" alt="${item.name}: ${captions[column]}" loading="lazy" width="${item.frameSize}" height="${item.frameSize}"><canvas width="${item.frameSize}" height="${item.frameSize}" hidden aria-hidden="true"></canvas></div>`
      : `<a href="${source}" data-lightbox data-caption="${item.name} · ${captions[column]}"><img src="${source}" alt="${item.name}: ${captions[column]}" loading="lazy" width="760" height="760"></a>`}<figcaption>${captions[column]}</figcaption></figure>`;
  });
  return `<article class="sample-row" data-case="${item.id}">
    <div class="sample-grid">${columns.join("")}</div>
    <div class="sample-controls"><span class="sample-name">${String(currentPage*4+index+1).padStart(2,"0")} · ${item.name}</span>
      <div class="sample-actions"><span class="sample-status" role="status"></span><label class="angle-control">View <input type="range" class="angle-slider" min="0" max="${item.frames-1}" step="1" value="0" aria-label="${item.name} view angle"></label><button type="button" class="reset-view">Reset</button></div>
    </div></article>`;
  }).join("");
  rows.querySelectorAll(".sample-row").forEach(row => {
    const item = cases.find(item=>item.id===row.dataset.case);
    const views = [...row.querySelectorAll(".image-view")];
    const slider = row.querySelector(".angle-slider");
    const status = row.querySelector(".sample-status");
    let frame = 0, loaded = null, waiting = false;
    function draw() {
      if (!loaded) return;
      views.forEach((view,index) => {
        const canvas = view.querySelector("canvas");
        if (canvas.width !== item.frameSize) canvas.width = canvas.height = item.frameSize;
        canvas.getContext("2d").drawImage(loaded[index],
          (frame%item.columns)*item.frameSize,Math.floor(frame/item.columns)*item.frameSize,
          item.frameSize,item.frameSize,0,0,item.frameSize,item.frameSize);
        canvas.hidden = false;
        view.dataset.frame = frame;
      });
      status.textContent = `${Math.round(frame*360/item.frames)}°`;
    }
    async function change(value) {
      frame = ((Math.round(value)%item.frames)+item.frames)%item.frames;
      slider.value = frame;
      if (!loaded && !waiting) {
        waiting = true;status.textContent = "Loading views…";
        try {loaded = await sheets(item);}
        catch {status.textContent="Views unavailable. Drag again to retry.";return;}
        finally {waiting=false;}
      }
      draw();
    }
    slider.addEventListener("input",()=>change(Number(slider.value)));
    row.querySelector(".reset-view").addEventListener("click",()=>change(0));
    viewObserver.observe(row);
    views.forEach(view => {
      let start = null;
      view.addEventListener("pointerdown",event=>{
        if(event.button>0)return;
        start={x:event.clientX,frame,id:event.pointerId};
        view.setPointerCapture(event.pointerId);
      });
      view.addEventListener("pointermove",event=>{
        if(!start || start.id!==event.pointerId)return;
        change(start.frame+Math.round((start.x-event.clientX)/24));
      });
      for(const name of ["pointerup","pointercancel","lostpointercapture"])view.addEventListener(name,()=>start=null);
      view.addEventListener("dblclick",()=>change(0));
      view.addEventListener("keydown",event=>{
        if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
          event.preventDefault();change(frame+(event.key==="ArrowLeft"?-1:1));
        }else if(event.key==="Home"){event.preventDefault();change(0);}
      });
    });
  });
}
// Explicit page buttons are separate from per-sample rotation gestures.
renderPage(0);
document.querySelectorAll("video").forEach(video => {
  video.addEventListener("play", () => document.querySelectorAll("video").forEach(other => {
    if (other !== video) other.pause();
  }));
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) document.querySelectorAll("video").forEach(video => video.pause());
});

const lightbox = document.querySelector("#lightbox");
const viewport = lightbox.querySelector(".lightbox-viewport");
const zoom = document.querySelector("#zoom-toggle");
let lastFocused;
document.addEventListener("click", event => {
  const link = event.target.closest("a[data-lightbox]");
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (typeof lightbox.showModal !== "function") return;
  event.preventDefault();
  lastFocused = link;
  const image = document.querySelector("#lightbox-image");
  image.src = link.href;
  image.alt = link.querySelector("img")?.alt || "Paper figure";
  document.querySelector("#lightbox-original").href = link.href;
  document.querySelector("#lightbox-caption").textContent = link.dataset.caption || image.alt;
  viewport.classList.remove("actual-size");
  zoom.textContent = "Actual size";
  lightbox.showModal();
  document.body.style.overflow = "hidden";
});
zoom.addEventListener("click", () => {
  zoom.textContent = viewport.classList.toggle("actual-size") ? "Fit to screen" : "Actual size";
});
document.querySelector("#lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("close", () => {
  document.body.style.overflow = "";
  lastFocused?.focus({preventScroll:true});
});
