import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BASE_URL, useAuth } from './AuthContext';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime, watchConnection } from '../services/realtime';
import { addDays, dayOf, localStamp } from '../utils/reservationLogic.mjs';

const AdminContext = createContext(null);
const CLOSED_STATES = ['PAGADO', 'CANCELADO'];

function normalizeState(estado) {
  return String(estado || '').toUpperCase();
}

function upsertById(items, nextItem) {
  if (!nextItem?.id) return items;
  const exists = items.some((item) => Number(item.id) === Number(nextItem.id));
  return exists
    ? items.map((item) => (Number(item.id) === Number(nextItem.id) ? { ...item, ...nextItem } : item))
    : [nextItem, ...items];
}

export function AdminProvider({ children }) {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [inventoryAlert, setInventoryAlert] = useState(null); // último aviso de «queda poco» / repuesto
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [extras, setExtras] = useState([]);
  const [caja, setCaja] = useState(null);
  const [configuracion, setConfiguracion] = useState(null);
  const [auditoria, setAuditoria] = useState([]);
  const [reservas, setReservas] = useState([]);
  const reservasRange = useRef(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState('');
  const [syncStatus, setSyncStatus] = useState('connecting');
  const cajaReadVersion = useRef(0);
  const pedidosReadVersion = useRef(0);

  const fetchPedidos = useCallback(async () => {
    const version = ++pedidosReadVersion.current;
    try {
      const res = await axios.get(`${BASE_URL}/pedidos`);
      if (version === pedidosReadVersion.current) setPedidos(res.data);
    } catch {
      // Preserve the last confirmed accounts on a transient read failure.
      setReadError('No se pudieron actualizar los pedidos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchProductos = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/productos?includeInactive=1`);
      setProductos(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/productos/categorias?includeInactive=1`);
      setCategorias(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchMesas = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/mesas?includeInactive=1`);
      setMesas(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchUbicaciones = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/ubicaciones?includeInactive=1`);
      setUbicaciones(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchTrabajadores = useCallback(async () => {
    if (user?.rol !== 'admin') {
      setTrabajadores([]);
      return;
    }
    try {
      const res = await axios.get(`${BASE_URL}/trabajadores`);
      setTrabajadores(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, [user?.rol]);

  const fetchCaja = useCallback(async () => {
    const version = ++cajaReadVersion.current;
    try {
      const res = await axios.get(`${BASE_URL}/caja/resumen`);
      if (version === cajaReadVersion.current) setCaja(res.data);
      // La caja cargó, pero alguna parte secundaria falló en el servidor: se informa sin bloquear.
      const avisos = res.data?.avisos || [];
      if (avisos.length) setReadError(`La caja cargó sin ${avisos.map(a => a.parte).join(', ')}. Detalle: ${avisos[0].error}`);
    } catch (error) {
      const detail = error?.response?.data?.message;
      setReadError(detail ? `No se pudo actualizar la caja. ${detail}` : 'No se pudo actualizar la caja. Reintenta antes de operar.');
    }
  }, []);

  const fetchInventario = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/inventario`);
      setInventario(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchExtras = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/extras?includeInactive=1`);
      setExtras(res.data);
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
    }
  }, []);

  const fetchConfiguracion = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/configuracion`);
      setConfiguracion(res.data);
    } catch {
      setReadError('No se pudo cargar la configuración. Reintenta antes de editarla.');
    }
  }, []);

  const fetchAuditoria = useCallback(async (params = {}) => {
    if (user?.rol !== 'admin') {
      setAuditoria([]);
      return [];
    }
    try {
      const res = await axios.get(`${BASE_URL}/auditoria`, {
        params: { limit: 160, ...params },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setAuditoria(rows);
      return rows;
    } catch {
      setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
      return [];
    }
  }, [user?.rol]);

  // Reservas: se mantiene una ventana alrededor de hoy y se amplía cuando el panel pide otros días.
  const fetchReservas = useCallback(async (range) => {
    const today = dayOf(localStamp());
    const desde = range?.desde || reservasRange.current?.desde || addDays(today, -7);
    const hasta = range?.hasta || reservasRange.current?.hasta || addDays(today, 60);
    try {
      const res = await axios.get(`${BASE_URL}/reservas`, { params: { desde, hasta } });
      const inRange = r => dayOf(r.fecha_hora) >= desde && dayOf(r.fecha_hora) <= hasta;
      setReservas(current => [...current.filter(r => !inRange(r)), ...res.data].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora) || a.id - b.id));
      const known = reservasRange.current;
      reservasRange.current = { desde: !known || desde < known.desde ? desde : known.desde, hasta: !known || hasta > known.hasta ? hasta : known.hasta };
      return res.data;
    } catch (error) {
      if (error.response?.status !== 404) setReadError('No se pudieron actualizar algunos datos. Se conserva la última información recibida.');
      return [];
    }
  }, []);
  const putReserva = useCallback(reserva => setReservas(current => upsertById(current, reserva).sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora) || a.id - b.id)), []);
  const createReserva = async payload => { const { data } = await axios.post(`${BASE_URL}/reservas`, payload); putReserva(data); return data; };
  const updateReserva = async (id, payload) => { const { data } = await axios.put(`${BASE_URL}/reservas/${id}`, payload); putReserva(data); return data; };
  const setReservaEstado = async (id, estado) => { const { data } = await axios.put(`${BASE_URL}/reservas/${id}/estado`, { estado }); putReserva(data); return data; };
  const deleteReserva = async id => { await axios.delete(`${BASE_URL}/reservas/${id}`); setReservas(current => current.filter(r => Number(r.id) !== Number(id))); };

  const refreshAll = useCallback(async () => {
    setReadError('');
    await Promise.all([
      fetchPedidos(),
      fetchProductos(),
      fetchCategorias(),
      fetchMesas(),
      fetchUbicaciones(),
      fetchTrabajadores(),
      fetchCaja(),
      fetchInventario(),
      fetchExtras(),
      fetchConfiguracion(),
      fetchAuditoria(),
      fetchReservas(),
    ]);
  }, [fetchPedidos, fetchProductos, fetchCategorias, fetchMesas, fetchUbicaciones, fetchTrabajadores, fetchCaja, fetchInventario, fetchExtras, fetchConfiguracion, fetchAuditoria, fetchReservas]);

  useEffect(() => {
    (async () => {
      await refreshAll();
      setLoading(false);
    })();
  }, [refreshAll]);

  // Sincronización en segundo plano: el tiempo real cubre los cambios al instante;
  // además se refresca todo cada 45 s (15 s sin conexión) y al volver a la pestaña.
  const syncingRef = useRef(false);
  const lastSyncRef = useRef(Date.now());
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;
  useEffect(() => {
    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const sync = async (force = false) => {
      if (syncingRef.current || isHidden()) return;
      if (!force && Date.now() - lastSyncRef.current < 10000) return;
      syncingRef.current = true;
      try { await refreshAll(); lastSyncRef.current = Date.now(); } catch { /* se reintenta en el siguiente ciclo */ } finally { syncingRef.current = false; }
    };
    const tick = setInterval(() => {
      const every = syncStatusRef.current === 'connected' ? 45000 : 15000;
      if (Date.now() - lastSyncRef.current >= every) sync(true);
    }, 5000);
    const onVisible = () => { if (!isHidden()) sync(); };
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVisible);
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(tick);
      if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', onVisible);
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('focus', onVisible);
    };
  }, [refreshAll]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const stopWatching = watchConnection(setSyncStatus, { onReconnect: () => refreshAll() });

    const applyOrder = (payload = {}) => {
      fetchInventario();
      fetchProductos();
      if (payload.pedido) {
        pedidosReadVersion.current += 1;
        setPedidos((current) => upsertById(current, payload.pedido));
      } else {
        fetchPedidos();
      }
      if (payload.mesa) setMesas((current) => upsertById(current, payload.mesa));
      if (payload.transition || payload.action || CLOSED_STATES.includes(normalizeState(payload.pedido?.estado))) {
        fetchCaja();
      }
    };

    const applyTable = (payload = {}) => {
      if (payload.mesa) {
        setMesas((current) => upsertById(current, payload.mesa));
      } else {
        fetchMesas();
      }
    };

    const unsubscribers = [
      subscribeRealtime(REALTIME_EVENTS.ORDER_CREATED, applyOrder),
      subscribeRealtime(REALTIME_EVENTS.ORDER_UPDATED, applyOrder),
      subscribeRealtime(REALTIME_EVENTS.PAYMENT_CREATED, applyOrder),
      subscribeRealtime(REALTIME_EVENTS.SPLIT_REQUESTED, () => {
        fetchCaja();
        fetchPedidos();
      }),
      subscribeRealtime(REALTIME_EVENTS.CASH_UPDATED, () => {
        fetchCaja();
      }),
      subscribeRealtime(REALTIME_EVENTS.TABLE_OCCUPIED, applyTable),
      subscribeRealtime(REALTIME_EVENTS.TABLE_FREED, applyTable),
      subscribeRealtime(REALTIME_EVENTS.TABLE_UPDATED, applyTable),
      // Vigilante de stock: unidades al día, «queda poco» y lo que se repuso.
      subscribeRealtime(REALTIME_EVENTS.CATALOG_UPDATED, (payload = {}) => {
        if (payload.action === 'stock' && Array.isArray(payload.productos)) {
          const byId = new Map(payload.productos.map((p) => [Number(p.producto_id), Number(p.stock_disponible)]));
          setProductos((current) => current.map((p) => byId.has(Number(p.id)) ? { ...p, stock_disponible: byId.get(Number(p.id)) } : p));
        } else fetchProductos();
        fetchInventario();
      }),
      subscribeRealtime(REALTIME_EVENTS.INVENTORY_ALERT, (payload = {}) => {
        fetchInventario();
        setInventoryAlert({ ...payload, at: Date.now() });
      }),
      subscribeRealtime(REALTIME_EVENTS.RESERVATION_UPDATED, (payload = {}) => {
        if (!payload.reserva) { fetchReservas(); return; }
        if (payload.action === 'eliminada') setReservas(current => current.filter(r => Number(r.id) !== Number(payload.reserva.id)));
        else putReserva(payload.reserva);
      }),
    ];

    return () => {
      stopWatching();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [fetchCaja, fetchMesas, fetchPedidos, fetchInventario, fetchProductos, fetchReservas, putReserva, refreshAll]);

  const createProducto = async (payload) => {
    const res = await axios.post(`${BASE_URL}/productos`, payload);
    await fetchProductos();
    await fetchAuditoria();
    return res.data;
  };

  const updateProducto = async (id, payload) => {
    const res = await axios.put(`${BASE_URL}/productos/${id}`, payload);
    await fetchProductos();
    await fetchAuditoria();
    return res.data;
  };

  const deleteProducto = async (id) => {
    await axios.delete(`${BASE_URL}/productos/${id}`);
    await fetchProductos();
    await fetchAuditoria();
  };

  const createCategoria = async (payload) => {
    await axios.post(`${BASE_URL}/productos/categorias`, payload);
    await fetchCategorias();
  };

  const updateCategoria = async (id, payload) => {
    await axios.put(`${BASE_URL}/productos/categorias/${id}`, payload);
    await fetchCategorias();
    await fetchProductos();
  };

  const deleteCategoria = async (id) => {
    await axios.delete(`${BASE_URL}/productos/categorias/${id}`);
    await fetchCategorias();
    await fetchProductos();
  };

  const updateMesaEstado = async (id, estado) => {
    await axios.put(`${BASE_URL}/mesas/${id}/estado`, { estado });
    await fetchMesas();
  };

  const createMesa = async (payload) => {
    await axios.post(`${BASE_URL}/mesas`, payload);
    await fetchMesas();
    await fetchUbicaciones();
  };

  const updateMesa = async (id, payload) => {
    await axios.put(`${BASE_URL}/mesas/${id}`, payload);
    await fetchMesas();
    await fetchUbicaciones();
  };

  const deleteMesa = async (id) => {
    await axios.delete(`${BASE_URL}/mesas/${id}`);
    await fetchMesas();
    await fetchUbicaciones();
  };

  const abrirCaja = async (monto_inicial = 0, observacion = null) => {
    await axios.post(`${BASE_URL}/caja/abrir`, { monto_inicial, observacion });
    await fetchCaja();
    await fetchAuditoria();
  };

  const cobrarPedido = async (pedido_id, metodo = 'Efectivo', extra = {}) => {
    const res = await axios.post(`${BASE_URL}/caja/cobrar`, { pedido_id, metodo, ...extra });
    refreshAll().catch(() => {});
    return res.data;
  };

  const cerrarCaja = async (monto_final, observacion = null) => {
    await axios.post(`${BASE_URL}/caja/cerrar`, { caja_id: caja?.caja?.id, monto_final, observacion });
    await fetchCaja();
    await fetchAuditoria();
  };

  const createTrabajador = async (payload) => {
    await axios.post(`${BASE_URL}/trabajadores`, payload);
    await fetchTrabajadores();
  };

  const updateTrabajador = async (id, payload) => {
    await axios.put(`${BASE_URL}/trabajadores/${id}`, payload);
    await fetchTrabajadores();
  };

  const deleteTrabajador = async (id) => {
    await axios.delete(`${BASE_URL}/trabajadores/${id}`);
    await fetchTrabajadores();
  };

  const createInventarioItem = async (payload) => {
    await axios.post(`${BASE_URL}/inventario`, payload);
    await Promise.all([fetchInventario(), fetchProductos()]);
  };

  const updateInventarioItem = async (id, payload) => {
    await axios.put(`${BASE_URL}/inventario/${id}`, payload);
    await Promise.all([fetchInventario(), fetchProductos()]);
  };

  const movimientoInventario = async (id, payload) => {
    await axios.post(`${BASE_URL}/inventario/${id}/movimiento`, payload);
    await Promise.all([fetchInventario(), fetchProductos()]);
  };

  const deleteInventarioItem = async (id) => {
    await axios.delete(`${BASE_URL}/inventario/${id}`);
    await Promise.all([fetchInventario(), fetchProductos()]);
  };

  const createExtra = async (payload) => {
    await axios.post(`${BASE_URL}/extras`, payload);
    await fetchExtras();
  };

  const updateExtra = async (id, payload) => {
    await axios.put(`${BASE_URL}/extras/${id}`, payload);
    await fetchExtras();
  };

  const deleteExtra = async (id) => {
    await axios.delete(`${BASE_URL}/extras/${id}`);
    await fetchExtras();
  };

  const createUbicacion = async (payload) => {
    await axios.post(`${BASE_URL}/ubicaciones`, payload);
    await fetchUbicaciones();
  };

  const updateUbicacion = async (id, payload) => {
    await axios.put(`${BASE_URL}/ubicaciones/${id}`, payload);
    await fetchUbicaciones();
    await fetchMesas();
  };

  const deleteUbicacion = async (id) => {
    await axios.delete(`${BASE_URL}/ubicaciones/${id}`);
    await fetchUbicaciones();
    await fetchMesas();
  };

  const updateConfiguracion = async (payload) => {
    const res = await axios.put(`${BASE_URL}/configuracion`, payload);
    setConfiguracion(res.data);
    await fetchConfiguracion();
    await fetchAuditoria();
    return res.data;
  };

  const uploadLogoConfiguracion = async (fileOrData) => {
    const data = fileOrData instanceof FormData ? fileOrData : new FormData();
    if (!(fileOrData instanceof FormData)) data.append('logo', fileOrData);
    const res = await axios.post(`${BASE_URL}/configuracion/logo`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    setConfiguracion(res.data.config);
    await fetchAuditoria();
    return res.data;
  };

  return (
    <AdminContext.Provider
      value={{
        inventoryAlert,
        pedidos,
        productos,
        categorias,
        mesas,
        ubicaciones,
        trabajadores,
        inventario,
        extras,
        caja,
        configuracion,
        auditoria,
        reservas,
        loading,
        syncStatus,
        readError,
        fetchPedidos,
        fetchProductos,
        fetchCategorias,
        fetchMesas,
        fetchUbicaciones,
        fetchTrabajadores,
        fetchCaja,
        fetchInventario,
        fetchExtras,
        fetchConfiguracion,
        fetchAuditoria,
        fetchReservas,
        createReserva,
        updateReserva,
        setReservaEstado,
        deleteReserva,
        refreshAll,
        createProducto,
        updateProducto,
        deleteProducto,
        createCategoria,
        updateCategoria,
        deleteCategoria,
        updateMesaEstado,
        createMesa,
        updateMesa,
        deleteMesa,
        abrirCaja,
        cobrarPedido,
        cerrarCaja,
        createTrabajador,
        updateTrabajador,
        deleteTrabajador,
        createInventarioItem,
        updateInventarioItem,
        movimientoInventario,
        deleteInventarioItem,
        createExtra,
        updateExtra,
        deleteExtra,
        createUbicacion,
        updateUbicacion,
        deleteUbicacion,
        updateConfiguracion,
        uploadLogoConfiguracion,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
