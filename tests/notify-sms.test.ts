import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsConfigured, sendAgreementSms } from '../lib/notify/sms';

test('SMS module no-ops safely without Twilio credentials', async () => {
  const old = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM_NUMBER };
  try {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    assert.equal(smsConfigured(), false);
    const result = await sendAgreementSms('+15555550123', 'Deal agreed at $50.');
    assert.deepEqual(result, { sent: false, reason: 'not_configured' });
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    assert.equal(smsConfigured(), false, 'still missing TWILIO_FROM_NUMBER');
    process.env.TWILIO_FROM_NUMBER = '+15555550000';
    assert.equal(smsConfigured(), true);
  } finally {
    for (const [key, value] of Object.entries({ TWILIO_ACCOUNT_SID: old.sid, TWILIO_AUTH_TOKEN: old.token, TWILIO_FROM_NUMBER: old.from })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
