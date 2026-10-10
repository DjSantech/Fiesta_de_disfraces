// Modelos Mongoose. Las respuestas de la API se arman en services/serializers.js (nunca se expone _id/__v).
import mongoose from 'mongoose';
import {
  GENDERS, ORDER_KINDS, ORDER_PAYMENT_METHODS, MANUAL_METHODS, ORDER_STATUSES, TICKET_KINDS, PHASES,
  TICKET_STATUSES, DOOR_CATEGORIES, POS_METHODS, VEHICLE_TYPES, PRODUCT_CATEGORIES, EXPENSE_CATEGORIES, ROLES,
} from '../constants.js';

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;
const opts = { timestamps: true, versionKey: false };
const sub = (def) => new Schema(def, { _id: false });

// ---------- Ajustes (singleton _id = 'main') ----------
const pair = { mujer: Number, hombre: Number };
export const Settings = mongoose.model('Settings', new Schema({
  _id: { type: String },
  eventStartsAt: Date,
  presaleEndsAt: Date,
  salesOpen: Boolean,
  capacity: Number,
  prices: { preventa: pair, puerta: pair },
  guestPresaleDiscount: Number,
  guestGeneralDiscount: Number,
  parking: { carro: Number, moto: Number, casco: Number },
  paymentAccounts: { type: [sub({ label: String, number: String, holder: String })], default: undefined },
  transferInstructions: String,
  contact: { whatsapp: String, instagram: String, adminName: String },
  location: { revealed: Boolean, name: String, mapsUrl: String, notes: String },
  publicCounter: Boolean,
}, { ...opts, minimize: false, collection: 'settings' }));

// ---------- Habitaciones ----------
export const Room = mongoose.model('Room', new Schema({
  number: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 },
  minPeople: { type: Number, default: 1, min: 1 },
  price: { type: Number, required: true, min: 0 }, // precio normal (fase general)
  presalePrice: { type: Number, default: null, min: 0 }, // precio en preventa; null = legacy sin migrar
  beds: { type: String, default: '' },
  privateBathroom: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false },
  booked: { type: Boolean, default: false },
  orderId: { type: ObjectId, default: null }, // orden que la aparta o la reservó
  holdExpiresAt: { type: Date, default: null }, // null + orderId = apartada sin vencimiento (comprobante en revisión)
}, opts));

// ---------- Órdenes ----------
const orderSchema = new Schema({
  token: { type: String, required: true, unique: true },
  kind: { type: String, enum: ORDER_KINDS, required: true },
  status: { type: String, enum: ORDER_STATUSES, required: true },
  paymentMethod: { type: String, enum: ORDER_PAYMENT_METHODS, required: true },
  manualMethod: { type: String, enum: MANUAL_METHODS, default: null },
  amount: { type: Number, required: true, min: 0 },
  breakdown: { type: sub({ phase: String, base: Number, isGuest: Boolean, discountPercent: Number, discount: Number, total: Number }), required: true },
  gender: { type: String, enum: GENDERS, default: null },
  room: { type: sub({ number: Number, name: String, capacity: Number, minPeople: Number, beds: String, privateBathroom: Boolean }), default: null },
  buyer: { type: sub({ name: String, cedula: String, phone: String, instagram: { type: String, default: '' }, email: { type: String, default: '' } }), required: true },
  companions: { type: [sub({ name: String, cedula: { type: String, default: null } })], default: [] },
  guestId: { type: ObjectId, default: null },
  guestName: { type: String, default: null },
  transfer: {
    type: sub({ receiptId: { type: ObjectId, default: null }, reference: { type: String, default: null }, uploadedAt: { type: Date, default: null } }),
    default: () => ({}),
  },
  mp: {
    type: sub({
      preferenceId: { type: String, default: null }, paymentId: { type: String, default: null },
      status: { type: String, default: null }, statusDetail: { type: String, default: null }, lastCheckedAt: { type: Date, default: null },
    }),
    default: () => ({}),
  },
  holdExpiresAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  rejectReason: { type: String, default: null },
  notes: { type: String, default: '' },
  reviewedBy: { type: ObjectId, default: null },
  reviewedByName: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  ticketsIssued: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
}, opts);
orderSchema.index({ 'buyer.cedula': 1, status: 1 });
orderSchema.index({ 'buyer.phone': 1 });
orderSchema.index({ status: 1, expiresAt: 1 });
orderSchema.index({ createdAt: -1 });
export const Order = mongoose.model('Order', orderSchema);

// ---------- Comprobantes (aparte para que las órdenes queden livianas) ----------
export const Receipt = mongoose.model('Receipt', new Schema({
  orderId: { type: ObjectId, required: true, index: true },
  contentType: { type: String, required: true },
  size: Number,
  sha256: String,
  data: { type: Buffer, required: true },
}, opts));

// ---------- Tickets ----------
const ticketSchema = new Schema({
  token: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  orderId: { type: ObjectId, required: true },
  seq: { type: Number, required: true },
  holderName: { type: String, required: true },
  holderCedula: { type: String, default: null },
  buyerName: { type: String, default: '' },
  kind: { type: String, enum: TICKET_KINDS, required: true },
  gender: { type: String, enum: GENDERS, default: null },
  phase: { type: String, enum: PHASES, default: null },
  isGuest: { type: Boolean, default: false },
  roomNumber: { type: Number, default: null },
  status: { type: String, enum: TICKET_STATUSES, default: 'valid' },
  checkedInAt: { type: Date, default: null },
  checkedInBy: { type: ObjectId, default: null },
  checkedInByName: { type: String, default: null },
  entryId: { type: ObjectId, default: null },
  voidReason: { type: String, default: null },
  voidedAt: { type: Date, default: null },
}, opts);
ticketSchema.index({ orderId: 1, seq: 1 }, { unique: true }); // emisión idempotente
ticketSchema.index({ holderCedula: 1, status: 1 });
ticketSchema.index({ status: 1, kind: 1 });
ticketSchema.index({ createdAt: -1 });
export const Ticket = mongoose.model('Ticket', ticketSchema);

// ---------- Lista de invitados ----------
const guestSchema = new Schema({
  name: { type: String, required: true },
  cedula: { type: String, default: null, index: true },
  phone: { type: String, default: null, index: true },
  instagram: { type: String, default: null, index: true },
  discountPercent: { type: Number, default: null, min: 0, max: 100 },
  note: { type: String, default: '' },
  redeemed: { type: Boolean, default: false },
  redeemedOrderId: { type: ObjectId, default: null },
  redeemedEntryId: { type: ObjectId, default: null },
  redeemedAt: { type: Date, default: null },
}, opts);
export const Guest = mongoose.model('Guest', guestSchema);

// ---------- Gastos ----------
export const Expense = mongoose.model('Expense', new Schema({
  concept: { type: String, required: true },
  category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
  amount: { type: Number, required: true, min: 0 },
  paid: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  responsible: { type: String, default: '' },
  notes: { type: String, default: '' },
}, opts));

// ---------- Usuarios de staff ----------
export const User = mongoose.model('User', new Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  passwordHash: { type: String, required: true, select: false },
  active: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 }, // sube al cambiar clave/desactivar → invalida sesiones
  lastLoginAt: { type: Date, default: null },
}, opts));

// ---------- Entradas de portería ----------
const doorSchema = new Schema({
  source: { type: String, enum: ['ticket', 'door_sale'], required: true },
  ticket: { type: sub({ id: ObjectId, code: String, kind: String, roomNumber: Number }), default: null },
  name: { type: String, required: true },
  cedula: { type: String, default: null },
  phone: { type: String, default: null },
  category: { type: String, enum: DOOR_CATEGORIES, required: true },
  gender: { type: String, enum: GENDERS, default: null },
  guestListMatch: { type: Boolean, default: false },
  guestId: { type: ObjectId, default: null },
  paymentMethod: { type: String, enum: POS_METHODS, required: true },
  entryAmount: { type: Number, default: 0 },
  vehicle: { type: sub({ type: { type: String, enum: VEHICLE_TYPES }, plate: { type: String } }), default: null },
  parkingAmount: { type: Number, default: 0 },
  helmet: { type: sub({ stored: Boolean, tag: { type: String, default: null }, returned: { type: Boolean, default: false }, returnedAt: { type: Date, default: null } }), default: null },
  helmetAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  createdBy: { type: ObjectId, default: null },
  createdByName: { type: String, default: '' },
  voided: { type: Boolean, default: false },
  voidReason: { type: String, default: null },
  voidedAt: { type: Date, default: null },
}, opts);
doorSchema.index({ createdAt: -1 });
doorSchema.index({ voided: 1, category: 1 });
doorSchema.index({ 'ticket.id': 1 });
export const DoorEntry = mongoose.model('DoorEntry', doorSchema);

// ---------- Barra ----------
export const Product = mongoose.model('Product', new Schema({
  name: { type: String, required: true },
  category: { type: String, enum: PRODUCT_CATEGORIES, required: true },
  price: { type: Number, required: true, min: 0 },
  cost: { type: Number, default: null },
  stock: { type: Number, default: null }, // null = sin control de inventario
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  soldQty: { type: Number, default: 0 },
  deleted: { type: Boolean, default: false }, // borrado lógico
}, opts));

export const Sale = mongoose.model('Sale', new Schema({
  number: { type: Number, required: true, unique: true },
  items: [sub({ productId: ObjectId, name: String, category: String, price: Number, qty: Number, subtotal: Number })],
  total: { type: Number, required: true },
  courtesyValue: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: POS_METHODS, required: true },
  note: { type: String, default: '' },
  createdBy: { type: ObjectId, default: null },
  createdByName: { type: String, default: '' },
  voided: { type: Boolean, default: false },
  voidedAt: { type: Date, default: null },
  voidReason: { type: String, default: null },
}, opts).index({ createdAt: -1 }));

// Contadores atómicos (número consecutivo de ventas).
export const Counter = mongoose.model('Counter', new Schema({ _id: String, seq: Number }, { versionKey: false }));

export async function nextSequence(name) {
  for (let i = 0; ; i++) {
    try {
      const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).lean();
      return c.seq;
    } catch (err) {
      if (err?.code !== 11000 || i >= 3) throw err;
    }
  }
}

export const allModels = [Settings, Room, Order, Receipt, Ticket, Guest, Expense, User, DoorEntry, Product, Sale, Counter];
