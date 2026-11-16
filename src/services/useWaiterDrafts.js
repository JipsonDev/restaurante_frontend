import { useEffect, useRef, useState, useCallback } from 'react';
import * as storage from './draftStorage';
import { completedDraft, emptyDrafts, parseDrafts, newExpressDraft, patchExpressDraft, discardExpressDraft, savedDraftKeys } from '../utils/orderDrafts.mjs';

const queues = new Map();
function write(key, value) {
  const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => storage.setItem(key, JSON.stringify(value)));
  queues.set(key, task);
  return task;
}
export default function useWaiterDrafts(userId) {
  // Keep the storage key so existing users receive a lossless v1 → v2 migration.
  const key = `mm:waiter-drafts:v1:${userId}`;
  const ref = useRef(emptyDrafts());
  const [data, setData] = useState(ref.current);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const writeRevision = useRef(0);
  const [recovered, setRecovered] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError('');
    storage.getItem(key).then(raw => {
      if (!active) return;
      const restored = parseDrafts(raw);
      ref.current = restored; setData(restored);
      setRecovered(savedDraftKeys(restored).length > 0);
      setReady(true);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [key, attempt]);
  const persist = useCallback(next => {
    const revision = ++writeRevision.current;
    setSaving(true);
    return write(key, next).then(() => {
      if(revision===writeRevision.current){setSaving(false);setError('');}
    }, e => {
      if(revision===writeRevision.current){setSaving(false);setError('No se pudo guardar el borrador en este equipo.');}
      throw e;
    });
  }, [key]);
  const save = useCallback(next => {
    ref.current = next; setData(next);
    return persist(next);
  }, [persist]);
  const field = name => value => {
    const old = ref.current;
    const next = { ...old, [name]: typeof value === 'function' ? value(old[name]) : value };
    save(next).catch(() => {});
  };
  const prepare = async (destination, payload) => {
    const existing = ref.current.pending[destination];
    if (existing) { await persist(ref.current); return existing; }
    const requestId = globalThis.crypto?.randomUUID?.() || `order_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    const request = { ...payload, request_id: requestId };
    await save({ ...ref.current, pending: { ...ref.current.pending, [destination]: request } });
    return request;
  };
  const complete = async destination => {
    const before = ref.current;
    const next = completedDraft(before, destination);
    await persist(next);
    // Preserve any edits made to a different customer while storage was writing.
    if (ref.current !== before) return save(completedDraft(ref.current, destination));
    ref.current = next; setData(next); setError('');
  };
  const reject = destination => {
    const pending = { ...ref.current.pending }; delete pending[destination];
    return save({ ...ref.current, pending });
  };
  const createExpress = pickupType => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    const destination = `express-draft:${id}`;
    save(newExpressDraft(ref.current, destination, pickupType)).catch(() => {});
    return destination;
  };
  const updateExpress = (destination, patch) => {
    const old = ref.current;
    const next = patchExpressDraft(old, destination, patch);
    if (old !== next) save(next).catch(() => {});
  };
  const discardExpress = destination => save(discardExpressDraft(ref.current, destination));
  return { ...data, ready, error, saving, recovered, retryLoad: () => setAttempt(n => n + 1), dismissRecovery: () => setRecovered(false),
    setCarritos: field('carritos'), setOrderNotes: field('orderNotes'), createExpress, updateExpress, discardExpress, prepare, complete, reject };
}
