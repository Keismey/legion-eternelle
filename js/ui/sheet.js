// Feuille modale du bas : une fonction de rendu, rafraîchie après chaque action.
const $ = (id) => document.getElementById(id);
let current = null;

export function openSheet(render) {
  current = typeof render === "function" ? render : () => render;
  $("sheetBody").innerHTML = current();
  $("sheet").hidden = false;
  $("sheetBody").scrollTop = 0;
  $("sheetBody").querySelector("button")?.focus({ preventScroll: true });
}

export function refreshSheet() {
  if (!current || $("sheet").hidden) return;
  const html = current();
  if (html == null) return closeSheet();
  const scroll = $("sheetBody").scrollTop;
  $("sheetBody").innerHTML = html;
  $("sheetBody").scrollTop = scroll;
}

export function closeSheet() {
  current = null;
  $("sheet").hidden = true;
}

export const sheetOpen = () => !$("sheet").hidden;
