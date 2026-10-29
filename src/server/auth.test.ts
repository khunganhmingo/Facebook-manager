import test from 'node:test';
import assert from 'node:assert/strict';
import { generateToken } from './middleware/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'socialagent_jwt_secret_default_key_2026';

test('generateToken creates valid JWT token with user role and plan', () => {
  const mockUser = {
    id: 1,
    email: 'khunganhredepmingo@gmail.com',
    ai_provider: 'gemini',
    role: 'admin',
    plan: 'enterprise',
  };

  const token = generateToken(mockUser);
  assert.ok(typeof token === 'string' && token.length > 20);

  const decoded = jwt.verify(token, JWT_SECRET) as any;
  assert.equal(decoded.id, 1);
  assert.equal(decoded.email, 'khunganhredepmingo@gmail.com');
  assert.equal(decoded.role, 'admin');
  assert.equal(decoded.plan, 'enterprise');
});

test('generateToken sets default role and plan if missing', () => {
  const mockUser = {
    id: 99,
    email: 'test@example.com',
    ai_provider: 'openai',
  };

  const token = generateToken(mockUser);
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  assert.equal(decoded.role, 'user');
  assert.equal(decoded.plan, 'pro');
});
