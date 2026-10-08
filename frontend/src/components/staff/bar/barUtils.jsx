// Utilidades de Barra (CONTRATO §5).
import { forwardRef } from 'react';
import { Input } from '../../ui';
import { staffApi } from '../../../lib/api';
import { formatNumber } from '../../../lib/format';

/** Acento de color por categoría de producto. */
export const CATEGORY_COLOR = {
  cocteles: '#8b5cf6',
  licores: '#ff7a1a',
  cervezas: '#f5c04a',
  gatorade: '#22e584',
  electrolit: '#2dd4bf',
  agua: '#38bdf8',
  perfumes: '#f472b6',
  otros: '#a3a0ad',
};

export const MAX_QTY = 50;
export const MAX_ITEMS = 30;
export const LOW_STOCK = 5;

export const barApi = {
  products: (all, signal) => staffApi(`/api/bar/products${all ? '?all=1' : ''}`, { signal }),
  createProduct: (body) => staffApi('/api/bar/products', { method: 'POST', body }),
  updateProduct: (id, body) => staffApi(`/api/bar/products/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  deleteProduct: (id) => staffApi(`/api/bar/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  sell: (body) => staffApi('/api/bar/sales', { method: 'POST', body }),
  sales: (page, limit, includeVoided, signal) =>
    staffApi(`/api/bar/sales?page=${page}&limit=${limit}${includeVoided ? '&includeVoided=1' : ''}`, { signal }),
  voidSale: (id, reason) => staffApi(`/api/bar/sales/${encodeURIComponent(id)}/void`, { method: 'POST', body: { reason } }),
  summary: (signal) => staffApi('/api/bar/summary', { signal }),
};

/** "6000" ↔ "6.000": campo de dinero con separador de miles (entero COP). value: string de dígitos. */
export const MoneyInput = forwardRef(function MoneyInput({ value, onChange, ...props }, ref) {
  const shown = value === '' || value === null || value === undefined ? '' : formatNumber(value);
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      leading="$"
      value={shown}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9))}
      {...props}
    />
  );
});

const CART_KEY = 'fd_bar_cart';
export function loadCart() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.qty > 0) : [];
  } catch {
    return [];
  }
}
export function saveCart(cart) {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* sin almacenamiento */
  }
}
