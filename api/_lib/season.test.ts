import { describe, expect, it } from 'vitest';
import { isSameStarsPaymentReplay, validateStarsPayment } from './season';
import type { StarsPayment } from './season';

const invoice = { invoice_payload: 'season-pass:test:123:invoice-1', telegram_id: '123', stars_amount: 250 };
const payment: StarsPayment = {
  invoice_payload: invoice.invoice_payload,
  currency: 'XTR',
  total_amount: 250,
  telegram_payment_charge_id: 'charge-1',
};

describe('Telegram Stars season payments', () => {
  it('accepts only the exact XTR amount, payload, payer, and charge', () => {
    expect(validateStarsPayment(invoice, payment, '123')).toBe(true);
    expect(validateStarsPayment(invoice, { ...payment, currency: 'USD' }, '123')).toBe(false);
    expect(validateStarsPayment(invoice, { ...payment, total_amount: 249 }, '123')).toBe(false);
    expect(validateStarsPayment(invoice, { ...payment, invoice_payload: 'other' }, '123')).toBe(false);
    expect(validateStarsPayment(invoice, payment, '999')).toBe(false);
    expect(validateStarsPayment(invoice, { ...payment, telegram_payment_charge_id: '' }, '123')).toBe(false);
  });

  it('treats a repeated Telegram update as idempotent only for the same charge owner and invoice', () => {
    expect(isSameStarsPaymentReplay({ telegram_id: '123', invoice_payload: invoice.invoice_payload }, '123', payment)).toBe(true);
    expect(isSameStarsPaymentReplay({ telegram_id: '999', invoice_payload: invoice.invoice_payload }, '123', payment)).toBe(false);
    expect(isSameStarsPaymentReplay({ telegram_id: '123', invoice_payload: 'other' }, '123', payment)).toBe(false);
  });
});
