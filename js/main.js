import { createJacket } from './jacket.js';
import { setLang, initialLang, texts } from './i18n.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const COLORS = [
  { photo: 'C-01', jacket: '#ee6a0c', c: '#d9600d', deep: '#8f3c05', soft: '#ffa23f' },
  { photo: 'C-02', jacket: '#1d3fc4', c: '#1f3fb8', deep: '#0f1f66', soft: '#5f86f2' },
  { photo: 'C-03', jacket: '#3d3a36', c: '#4e4a44', deep: '#24211e', soft: '#8b857b' },
  { photo: 'C-04', jacket: '#7d9275', c: '#5f7258', deep: '#34432f', soft: '#a3b599' },
];

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 820px)').matches;
document.documentElement.classList.toggle('is-reduced', reduced);
const root = document.documentElement;

// A second "order" button on phones, placed under the sizes
{
  const cta = document.querySelector('.shop__left .btn').cloneNode(true);
  cta.classList.add('shop__mobileCta');
  document.querySelector('.shop').append(cta);
}

let jacket = null;
try {
  jacket = createJacket(document.querySelector('.stage'), { isSmall });
} catch (err) {
  // Without WebGL the shop text and buttons still work
  document.querySelector('.stage').remove();
  console.warn('WebGL is unavailable', err);
}
const state = jacket ? jacket.state : {};

// Feed tiles: photos and short text posts
const TILES = [
  { code: 'C-01', alt: 'alt.C-01' },
  { code: 'C-13', alt: 'alt.C-13' },
  { text: 'tile.1', bg: 1 },
  { code: 'C-08', alt: 'alt.C-08' },
  { text: 'tile.2', bg: 3 },
  { code: 'C-12', alt: 'alt.C-12' },
  { code: 'C-10', alt: 'alt.C-10' },
  { text: 'tile.3', bg: 0 },
  { code: 'C-11', alt: 'alt.C-11' },
];
document.querySelector('.feed__grid').innerHTML = TILES.map((t) => (t.text
  ? `<div class="tile tile--text" style="background:${COLORS[t.bg].c}" data-i18n="${t.text}"></div>`
  : `<div class="tile"><img src="assets/img/${t.code}.webp" data-i18n-alt="${t.alt}" loading="lazy"></div>`)).join('');

// Colour switching
let colorIndex = 0;
let lang = initialLang();
const colorLabel = document.querySelector('.shop__color');
const nextThumb = document.querySelector('.next img');
function showColor(index, animate = true) {
  colorIndex = (index + COLORS.length) % COLORS.length;
  const c = COLORS[colorIndex];
  const time = animate && !reduced ? 0.7 : 0;
  gsap.to(root, { '--c': c.c, '--c-deep': c.deep, '--c-soft': c.soft, duration: time, ease: 'power2.inOut' });
  if (jacket) {
    const target = gsap.utils.splitColor(c.jacket).map((v) => Math.pow(v / 255, 2.2));
    gsap.to(jacket.tint, { r: target[0], g: target[1], b: target[2], duration: time, ease: 'power2.inOut' });
    if (animate && !reduced) {
      // A little deflate and refill, so the change feels physical
      gsap.fromTo(state, { inflate: 0.1 }, { inflate: 1, duration: 0.9, ease: 'elastic.out(1, 0.6)', overwrite: false });
      gsap.fromTo(state, { rotY: state.rotY }, { rotY: state.rotY + Math.PI * 2, duration: 0.9, ease: 'power3.out', onComplete: () => { state.rotY %= Math.PI * 2; } });
    }
  }
  colorLabel.textContent = texts[lang][`color.${colorIndex}`];
  nextThumb.src = `assets/img/${COLORS[(colorIndex + 1) % COLORS.length].photo}.webp`;
}
document.querySelectorAll('[data-step]').forEach((btn) => {
  btn.addEventListener('click', () => showColor(colorIndex + Number(btn.dataset.step)));
});
showColor(0, false);

function applyLang(next) {
  lang = next;
  setLang(lang);
  colorLabel.textContent = texts[lang][`color.${colorIndex}`];
}
applyLang(lang);
document.querySelectorAll('[data-lang]').forEach((btn) => {
  btn.addEventListener('click', () => {
    applyLang(btn.dataset.lang);
    ScrollTrigger.refresh();
  });
});

document.querySelector('.btn--direct').addEventListener('click', () => {
  document.querySelector('.order__status').textContent = texts[lang]['order.sent'];
});

// Story viewer
const dialog = document.querySelector('.story');
const bars = dialog.querySelector('.story__bars');
const storyBody = dialog.querySelector('.story__body');
let slides = [];
let slideIndex = 0;
let storyTimer = null;

function showSlide(i) {
  if (i < 0) i = 0;
  if (i >= slides.length) {
    dialog.close();
    return;
  }
  slideIndex = i;
  storyBody.innerHTML = slides[i];
  const fills = [...bars.querySelectorAll('b')];
  storyTimer?.kill();
  fills.forEach((b, n) => gsap.set(b, { scaleX: n < i ? 1 : 0 }));
  if (reduced) {
    gsap.set(fills[i], { scaleX: 1 });
  } else {
    storyTimer = gsap.to(fills[i], { scaleX: 1, duration: 6, ease: 'none', onComplete: () => showSlide(slideIndex + 1) });
  }
}
document.querySelectorAll('[data-story]').forEach((btn) => {
  btn.addEventListener('click', () => {
    slides = texts[lang].stories[btn.dataset.story];
    bars.innerHTML = slides.map(() => '<span><b></b></span>').join('');
    dialog.showModal();
    showSlide(0);
  });
});
dialog.querySelector('.story__close').addEventListener('click', () => dialog.close());
dialog.querySelector('.story__tap--next').addEventListener('click', () => showSlide(slideIndex + 1));
dialog.querySelector('.story__tap--prev').addEventListener('click', () => showSlide(slideIndex - 1));
dialog.addEventListener('close', () => storyTimer?.kill());

// Poses
const pose = isSmall
  ? {
      hero: { x: 0, y: 0.1, rotY: -0.14, rotX: 0.03, camZ: 10 },
      a: { x: 0, y: 1.2, rotY: 0.75, rotX: 0.05, camZ: 9.6 },
      b: { x: 0, y: 1.2, rotY: 3.6, rotX: 0.05, camZ: 9.6 },
      c: { x: 0, y: 1.2, rotY: 6.28, rotX: 0.03, camZ: 9.6 },
    }
  : {
      hero: { x: 0, y: -0.02, rotY: -0.14, rotX: 0.03, camZ: 6.1 },
      a: { x: 0.8, y: 0, rotY: 0.75, rotX: 0.05, camZ: 5.8 },
      b: { x: 0.8, y: 0, rotY: 3.6, rotX: 0.05, camZ: 5.5 },
      c: { x: 0.8, y: -0.02, rotY: 6.28, rotX: 0.03, camZ: 5.9 },
    };
Object.assign(state, pose.hero);

let pinEnd = null;
if (jacket) {
  gsap.ticker.add((time) => {
    if (pinEnd && window.scrollY > pinEnd.end + window.innerHeight) return;
    jacket.frame(reduced ? 0 : time);
  });
}

if (!reduced) {
  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(a.getAttribute('href') === '#top' ? 0 : a.getAttribute('href'));
    });
  });
  // The page shouldn't scroll behind an open story
  const stopScroll = () => lenis.stop();
  document.querySelectorAll('[data-story]').forEach((btn) => btn.addEventListener('click', stopScroll));
  dialog.addEventListener('close', () => lenis.start());

  intro();
  coldDown();
}

// The one load moment: the jacket fills up with down
function intro() {
  if (jacket) gsap.fromTo(state, { inflate: 0 }, { inflate: 1, duration: 1.6, ease: 'elastic.out(1, 0.5)', delay: 0.15 });
  gsap.from('.shop__left > *, .shop__right > *', { opacity: 0, y: 14, duration: 0.8, delay: 0.5, stagger: 0.05, ease: 'power2.out' });
}

// Scrolling takes the temperature down, and the snow comes with it
function coldDown() {
  const panels = gsap.utils.toArray('.panel');
  const value = document.querySelector('.temp__value');
  const degrees = { t: 5 };
  const renderTemp = () => {
    const t = Math.round(degrees.t);
    value.textContent = t > 0 ? `+${t}` : t === 0 ? '0' : `−${Math.abs(t)}`;
  };

  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: '.scene__pin', start: 'top top', end: '+=420%', pin: true, scrub: 0.6 },
  });
  pinEnd = tl.scrollTrigger;

  const show = (el, at) => tl.fromTo(el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at);
  const hide = (el, at) => tl.to(el, { autoAlpha: 0, y: -20, duration: 0.35 }, at);
  const fly = (from, to, at) => tl.fromTo(state, { ...from }, { ...to, duration: 1, immediateRender: false }, at);

  tl.to('.shop', { autoAlpha: 0, duration: 0.3 }, 0);
  tl.to('.nav', { autoAlpha: 0, duration: 0.3 }, 0);
  tl.to('.frame', { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0, duration: 0.6 }, 0);
  tl.fromTo('.temp', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 0.2);
  fly(pose.hero, pose.a, 0);
  tl.to(state, { shadow: 0, duration: 0.4 }, 0);

  // +5 down to -25 across the whole pin
  tl.to(degrees, { t: -25, duration: 3.6, ease: 'none', onUpdate: renderTemp }, 0.2);
  tl.fromTo('.frost', { opacity: 0 }, { opacity: 1, duration: 3.6, ease: 'none', immediateRender: false }, 0.2);
  tl.fromTo(state, { snow: 0, wind: 0.1 }, { snow: 1, wind: 1.6, duration: 3.6, ease: 'none', immediateRender: false }, 0.2);

  show(panels[0], 0.6);
  hide(panels[0], 1.5);
  fly(pose.a, pose.b, 1.4);
  show(panels[1], 1.9);
  hide(panels[1], 2.8);
  fly(pose.b, pose.c, 2.7);
  show(panels[2], 3.2);
  tl.to({}, { duration: 0.5 }, 3.8);
}
