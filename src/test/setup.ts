import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  // テストごとに空のDBから始める
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => cleanup());
