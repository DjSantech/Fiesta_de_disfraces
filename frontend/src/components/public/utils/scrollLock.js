// Bloqueo de scroll compartido: la intro y el susto se solapan, así que se cuenta cuántos lo piden
// y solo se devuelve el scroll cuando se cierra el último.
let locks = 0;
let saved = '';

export function lockScroll() {
  const root = document.documentElement;
  if (locks++ === 0) {
    saved = root.style.overflow;
    root.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) root.style.overflow = saved;
  };
}
