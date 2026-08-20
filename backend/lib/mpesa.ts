import { secrets } from './secrets';
import { db } from './neon';
import crypto from 'node:crypto';
import type { MpesaTransaction } from './types';

async function hasRealCredentials(): Promise<boolean> {
  try {
    const names = await secrets.listSecretNames();
    return names.includes('MPESA_CONSUMER_KEY') && names.includes('MPESA_CONSUMER_SECRET') && names.includes('MPESA_PASSKEY') && names.includes('MPESA_SHORTCODE');
  } catch {
    return false;
  }
}

async function getAccessToken(): Promise<string> {
  const key = await secrets.readSecret('MPESA_CONSUMER_KEY');
  const secretVal = await secrets.readSecret('MPESA_CONSUMER_SECRET');
  const authHeader = Buffer.from(`${key}:${secretVal}`).toString('base64');
  const res = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${authHeader}` },
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function initiateStkPush(phone: string, amount: number, saleId: string, accountRef: string): Promise<MpesaTransaction> {
  const merchantRequestId = `MR-${crypto.randomBytes(6).toString('hex')}`;
  const checkoutRequestId = `ws_CO_${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
  const live = await hasRealCredentials();

  const record = {
    saleId,
    phone,
    amount,
    merchantRequestId,
    checkoutRequestId,
    resultCode: '',
    resultDesc: live ? 'Request sent to Safaricom Daraja API' : 'Sandbox simulation: no live Daraja credentials configured yet',
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const [id] = await db.add('mpesaTransactions', [record]);

  if (live) {
    try {
      const shortcode = await secrets.readSecret('MPESA_SHORTCODE');
      const passkey = await secrets.readSecret('MPESA_PASSKEY');
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
      const token = await getAccessToken();
      let callbackUrl = '';
      try {
        callbackUrl = await secrets.readSecret('MPESA_CALLBACK_URL');
      } catch {
        callbackUrl = '';
      }
      await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl || 'https://example.com/api/mpesa/callback',
          AccountReference: accountRef,
          TransactionDesc: 'Star Electronics Purchase',
        }),
      });
    } catch (e) {
      console.error('M-Pesa STK push dispatch failed', e);
    }
  }

  return { id: id as string, ...record };
}

export async function resolveIfDue(txn: MpesaTransaction): Promise<MpesaTransaction> {
  if (txn.status !== 'pending') return txn;
  const live = await hasRealCredentials();
  if (live) return txn;
  const elapsed = Date.now() - new Date(txn.createdAt).getTime();
  if (elapsed < 4000) return txn;
  const updated: MpesaTransaction = { ...txn, status: 'successful', resultCode: '0', resultDesc: 'The service request is processed successfully. (Sandbox simulation)', updatedAt: new Date().toISOString() };
  await db.update('mpesaTransactions', [{ id: txn.id, record: updated }]);
  return updated;
}
