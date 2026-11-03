/**
 * select.js — CategorySelect custom dropdown
 * -----------------------------------------
 * Enhances a native <select> into a custom popover without changing any
 * consumer code. The native select stays in the DOM as the source of truth
 * (hidden from view); programmatic `value` writes and `change` events keep
 * working exactly as before.
 *
 *   const sel = CategorySelect.enhance(document.getElementById('catSelect'));
 *   // sel.open(); sel.close(); sel.rebuild(); sel.destroy();
 */
(function (global) {
  'use strict';

  let uid = 0;

  function enhance(select, options) {
    if (!select || select.tagName !== 'SELECT') {
      console.warn('CategorySelect.enhance() expects a <select> element');
      return null;
    }
    if (select._catSelectInstance) return select._catSelectInstance;

    const opts = Object.assign({ placeholder: 'Select a category…' }, options || {});
    const baseId = select.id || `cat-select-${++uid}`;
    const triggerId = `${baseId}-trigger`;
    const menuId = `${baseId}-menu`;

    // Hide the native select — it still holds state, still fires events
    select.style.display = 'none';
    select.setAttribute('aria-hidden', 'true');
    select.setAttribute('tabindex', '-1');

    // ---------- Trigger ----------
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cat-select-trigger';
    trigger.id = triggerId;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menuId);
    trigger.innerHTML = [
      '<span class="cat-trigger-icon" aria-hidden="true"></span>',
      '<span class="cat-trigger-label"></span>',
      '<svg class="cat-trigger-caret" viewBox="0 0 24 24" fill="none"',
      '     stroke="currentColor" stroke-width="2.5" stroke-linecap="round"',
      '     stroke-linejoin="round" aria-hidden="true">',
      '  <path d="m6 9 6 6 6-6"/>',
      '</svg>',
    ].join('');
    const trigLabel = trigger.querySelector('.cat-trigger-label');

    // Insert right after native select
    select.parentNode.insertBefore(trigger, select.nextSibling);

    // ---------- Menu ----------
    const menu = document.createElement('div');
    menu.className = 'cat-menu';
    menu.id = menuId;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Choose a category');
    menu.hidden = true;

    const list = document.createElement('div');
    list.className = 'cat-menu-list';
    menu.appendChild(list);
    document.body.appendChild(menu);

    // ---------- State ----------
    let open = false;
    let activeIndex = -1;
    let optionEls = [];
    let itemSnapshot = [];

    // ---------- Render ----------
    function readItems() {
      return Array.from(select.options).map((o) => ({
        value: o.value,
        label: (o.textContent || '').trim(),
      }));
    }

    function rebuild() {
      itemSnapshot = readItems();
      list.innerHTML = '';
      optionEls = [];

      itemSnapshot.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'cat-option';
        el.id = `${menuId}-opt-${i}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', 'false');
        el.dataset.value = item.value;
        el.dataset.index = String(i);
        el.innerHTML = [
          '<span class="cat-option-icon" aria-hidden="true"></span>',
          '<span class="cat-option-label"></span>',
          '<svg class="cat-option-check" viewBox="0 0 24 24" fill="none"',
          '     stroke="currentColor" stroke-width="3" stroke-linecap="round"',
          '     stroke-linejoin="round" aria-hidden="true">',
          '  <path d="M20 6 9 17l-5-5"/>',
          '</svg>',
        ].join('');
        el.querySelector('.cat-option-label').textContent = item.label;
        list.appendChild(el);
        optionEls.push(el);
      });

      renderTrigger();
      if (open) {
        syncSelected();
        applyActive();
      }
    }

    function renderTrigger() {
      const current = select.value;
      const match = itemSnapshot.find((x) => x.value === current);
      trigLabel.textContent = match ? match.label : opts.placeholder;
      trigLabel.title = match ? match.label : '';
    }

    function syncSelected() {
      const current = select.value;
      optionEls.forEach((el) => {
        const isSel = el.dataset.value === current;
        el.classList.toggle('is-selected', isSel);
        el.setAttribute('aria-selected', isSel ? 'true' : 'false');
      });
    }

    function applyActive() {
      optionEls.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
      const active = optionEls[activeIndex];
      if (active) {
        trigger.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
      } else {
        trigger.removeAttribute('aria-activedescendant');
      }
    }

    // ---------- Positioning ----------
    function position() {
      const r = trigger.getBoundingClientRect();
      const gap = 6;
      const vh = window.innerHeight;
      const spaceBelow = vh - r.bottom - gap;
      const spaceAbove = r.top - gap;
      const wantMax = 320;
      const preferBelow = spaceBelow >= spaceAbove;
      const maxH = Math.min(wantMax, preferBelow ? spaceBelow : spaceAbove);
      const top = preferBelow ? r.bottom + gap : r.top - maxH - gap;

      list.style.maxHeight = `${Math.max(120, maxH)}px`;
      menu.style.left = `${r.left}px`;
      menu.style.width = `${r.width}px`;
      menu.style.top = `${top}px`;
    }

    // ---------- Open / close ----------
    function openMenu() {
      if (open) return;
      open = true;
      trigger.focus();
      activeIndex = optionEls.findIndex((el) => el.classList.contains('is-selected'));
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      position();
      syncSelected();
      applyActive();
      document.addEventListener('mousedown', onDocMouseDown, true);
      document.addEventListener('keydown', onDocKeyDown, true);
      window.addEventListener('resize', position);
      window.addEventListener('scroll', position, true);
    }

    function closeMenu(returnFocus) {
      if (!open) return;
      open = false;
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onDocKeyDown, true);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      if (returnFocus) trigger.focus();
    }

    function pick(value) {
      if (value !== select.value) {
        select.value = value;                                 // intercepted setter
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closeMenu(true);
    }

    // ---------- Event handlers ----------
    function onTriggerClick(e) {
      if (open) closeMenu(true);
      else openMenu();
    }

    function onTriggerKeyDown(e) {
      if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openMenu();
      }
    }

    function onListMouseDown(e) {
      const el = e.target.closest('.cat-option');
      if (!el) return;
      e.preventDefault();                                     // keep focus on trigger
      activeIndex = Number(el.dataset.index);
      pick(el.dataset.value);
    }

    function onListMouseOver(e) {
      const el = e.target.closest('.cat-option');
      if (!el) return;
      const idx = Number(el.dataset.index);
      if (idx === activeIndex) return;
      activeIndex = idx;
      applyActive();
    }

    function onDocMouseDown(e) {
      if (menu.contains(e.target) || trigger.contains(e.target)) return;
      closeMenu(false);
    }

    function onDocKeyDown(e) {
      if (!open) return;
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeMenu(true);
          return;
        case 'Tab':
          closeMenu(false);
          return;
        case 'ArrowDown':
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, optionEls.length - 1);
          applyActive();
          return;
        case 'ArrowUp':
          e.preventDefault();
          activeIndex = Math.max(activeIndex - 1, 0);
          applyActive();
          return;
        case 'Home':
          e.preventDefault();
          activeIndex = 0;
          applyActive();
          return;
        case 'End':
          e.preventDefault();
          activeIndex = optionEls.length - 1;
          applyActive();
          return;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && optionEls[activeIndex]) {
            pick(optionEls[activeIndex].dataset.value);
          }
          return;
      }
    }

    // ---------- Wire events ----------
    trigger.addEventListener('click', onTriggerClick);
    trigger.addEventListener('keydown', onTriggerKeyDown);
    list.addEventListener('mousedown', onListMouseDown);
    list.addEventListener('mouseover', onListMouseOver);

    // ---------- Intercept programmatic .value writes ----------
    const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() { return proto.get.call(this); },
      set(v) {
        proto.set.call(this, v);
        renderTrigger();
        if (open) syncSelected();
      },
    });

    // ---------- Initial render ----------
    rebuild();

    // ---------- Instance ----------
    const instance = {
      open: openMenu,
      close: () => closeMenu(false),
      rebuild,
      destroy() {
        closeMenu(false);
        trigger.removeEventListener('click', onTriggerClick);
        trigger.removeEventListener('keydown', onTriggerKeyDown);
        list.removeEventListener('mousedown', onListMouseDown);
        list.removeEventListener('mouseover', onListMouseOver);
        trigger.remove();
        menu.remove();
        select.style.display = '';
        select.removeAttribute('aria-hidden');
        select.removeAttribute('tabindex');
        delete select.value;                                  // restore native descriptor
        delete select._catSelectInstance;
      },
    };
    select._catSelectInstance = instance;
    return instance;
  }

  global.CategorySelect = { enhance };
})(typeof window !== 'undefined' ? window : this);