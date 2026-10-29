import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptData, decryptData, maskToken } from './encryption';
import { interpolatePrompt, analyzeIntentAndSafety, getFallbackReply } from './promptTemplate';

test('AES-256-GCM encryption and decryption roundtrip', () => {
  const secretKey = 'EAAGNO41x9bQ...super_sensitive_token';
  const encrypted = encryptData(secretKey);
  assert.notEqual(encrypted, secretKey);
  assert.equal(encrypted.split(':').length, 3, 'Payload should have iv, auth tag, and ciphertext');

  const decrypted = decryptData(encrypted);
  assert.equal(decrypted, secretKey, 'Decrypted text should strictly match original');
});

test('Token masking shows leading and trailing characters only', () => {
  const token = 'EAAK4B1234567890XYZ';
  const masked = maskToken(token);
  assert.ok(masked.startsWith('EAAK4B'));
  assert.ok(masked.endsWith('0XYZ'));
  assert.ok(masked.includes('••••'));
});

test('Prompt template variable interpolation', () => {
  const template = 'Xin chào {{customer_name}}, cảm ơn đã ghé thăm {{page_name}}. Chúng tôi chuyên {{product_list}} với phong cách {{tone}}.';
  const result = interpolatePrompt(template, {
    customer_name: 'Minh Hoàng',
    page_name: 'Thời Trang GenZ',
    product_list: 'quần áo và phụ kiện unisex',
    tone: 'trẻ trung năng động'
  });

  assert.equal(
    result,
    'Xin chào Minh Hoàng, cảm ơn đã ghé thăm Thời Trang GenZ. Chúng tôi chuyên quần áo và phụ kiện unisex với phong cách trẻ trung năng động.'
  );
});

test('Intent and safety analysis detects customer complaints and triggers human handoff', () => {
  const complaintMsg = 'Sản phẩm giao bị vỡ hỏng, tôi muốn khiếu nại và yêu cầu hoàn tiền ngay lập tức!';
  const result = analyzeIntentAndSafety(complaintMsg);

  assert.equal(result.intent, 'complaint');
  assert.equal(result.sentiment, 'negative');
  assert.equal(result.needsHuman, true, 'Complaints must set needsHuman to true');
});

test('Intent classification correctly identifies price inquiries', () => {
  const inquiry = 'Shop ơi áo polo này xin giá bao nhiêu vậy ạ?';
  const result = analyzeIntentAndSafety(inquiry);

  assert.equal(result.intent, 'price_inquiry');
  assert.equal(result.needsHuman, false);
});

test('Fallback reply generation returns tailored messages', () => {
  const reply = getFallbackReply('price_inquiry', 'Shop Mingo', 'Anh Nam');
  assert.ok(reply.includes('Shop Mingo'));
  assert.ok(reply.includes('Anh Nam'));
  assert.ok(reply.includes('báo giá'));
});
