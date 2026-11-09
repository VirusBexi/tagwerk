/* ==================================================================== MORPH
   Views are plain HTML strings. Instead of replacing the DOM, this patches it,
   so existing elements survive a render and CSS transitions keep playing.
   Children with data-k keep their identity even when they move. */

const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute('data-k') : null);

function morphAttrs(a, b) {
  for (let i = b.attributes.length - 1; i >= 0; i--) {
    const { name, value } = b.attributes[i];
    if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  }
  for (let i = a.attributes.length - 1; i >= 0; i--) {
    const { name } = a.attributes[i];
    if (!b.hasAttribute(name)) a.removeAttribute(name);
  }
}

function morphNode(a, b) {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  morphAttrs(a, b);
  const tag = a.nodeName;
  if (tag === 'INPUT') {
    if (document.activeElement !== a) {
      if (a.type === 'checkbox') a.checked = b.hasAttribute('checked');
      else if (a.value !== (b.getAttribute('value') || '')) a.value = b.getAttribute('value') || '';
    }
    return;
  }
  if (tag === 'SELECT') {
    morphChildren(a, b);
    const chosen = b.querySelector('option[selected]');
    if (chosen && document.activeElement !== a) a.value = chosen.getAttribute('value');
    return;
  }
  morphChildren(a, b);
}

function morphChildren(parent, next) {
  const keyed = new Map();
  for (let c = parent.firstChild; c; c = c.nextSibling) {
    const k = keyOf(c);
    if (k != null) keyed.set(k, c);
  }
  let cur = parent.firstChild;
  let n = next.firstChild;
  while (n) {
    const following = n.nextSibling;
    const k = keyOf(n);
    let match = null;
    if (k != null) {
      match = keyed.get(k) || null;
      if (match) keyed.delete(k);
    } else {
      let c = cur;
      while (c && keyOf(c) != null) c = c.nextSibling;
      if (c && c.nodeType === n.nodeType && c.nodeName === n.nodeName) match = c;
    }
    if (match) {
      if (match === cur) cur = cur.nextSibling;
      else parent.insertBefore(match, cur);
      morphNode(match, n);
    } else {
      parent.insertBefore(n, cur);
    }
    n = following;
  }
  while (cur) {
    const after = cur.nextSibling;
    parent.removeChild(cur);
    cur = after;
  }
}

function morph(el, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(el, tpl.content);
}

/* FLIP: rows glide to their new place instead of jumping. */
function captureFlip(root) {
  const map = new Map();
  for (const el of $$('[data-flip]', root)) map.set(el, el.getBoundingClientRect().top);
  return map;
}
function playFlip(map) {
  if (!motionOK()) return;
  for (const [el, top] of map) {
    if (!el.isConnected) continue;
    const dy = top - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
      duration: 420,
      easing: 'cubic-bezier(.2,.9,.25,1)',
    });
  }
}
