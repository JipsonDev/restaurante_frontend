import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { BASE_URL, useAuth } from './AuthContext';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime } from '../services/realtime';

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
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/pedidos`);
      setPedidos(res.data);
    } catch {
      setPedidos([]);
    }
  }, []);

  const fetchProductos = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/productos?includeInactive=1`);
      setProductos(res.data);
    } catch {
      setProductos([]);
    }
  }, []);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/productos/categorias?includeInactive=1`);
      setCategorias(res.data);
    } catch {
      setCategorias([]);
    }
  }, []);

  const fetchMesas = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/mesas?includeInactive=1`);
      setMesas(res.data);
    } catch {
      setMesas([]);
    }
  }, []);

  const fetchUbicaciones = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/ubicaciones?includeInactive=1`);
      setUbicaciones(res.data);
    } catch {
      setUbicaciones([]);
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
      setTrabajadores([]);
    }
  }, [user?.rol]);

  const fetchCaja = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/caja/resumen`);
      setCaja(res.data);
    } catch {
      setCaja(null);
    }
  }, []);

  const fetchInventario = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/inventario`);
      setInventario(res.data);
    } catch {
      setInventario([]);
    }
  }, []);

  const fetchExtras = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/extras?includeInactive=1`);
      setExtras(res.data);
    } catch {
      setExtras([]);
    }
  }, []);

  const fetchConfiguracion = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/configuracion`);
      setConfiguracion(res.data);
    } catch {
      setConfiguracion(null);
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
      setAuditoria([]);
      return [];
    }
  }, [user?.rol]);

  const refreshAll = useCallback(async () => {
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
    ]);
  }, [fetchPedidos, fetchProductos, fetchCategorias, fetchMesas, fetchUbicaciones, fetchTrabajadores, fetchCaja, fetchInventario, fetchExtras, fetchConfiguracion, fetchAuditoria]);

  useEffect(() => {
    (async () => {
      await refreshAll();
      setLoading(false);
    })();
  }, [refreshAll]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const handleConnect = () => setSyncStatus('connected');
    const handleDisconnect = () => setSyncStatus('disconnected');
    const handleError = () => setSyncStatus('error');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);
    setSyncStatus(socket.connected ? 'connected' : 'connecting');

    const applyOrder = (payload = {}) => {
      if (payload.pedido) {
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
    ];

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [fetchCaja, fetchMesas, fetchPedidos]);

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
    await refreshAll();
    return res.data;
  };

  const cerrarCaja = async (monto_final, observacion = null) => {
    await axios.post(`${BASE_URL}/caja/cerrar`, { monto_final, observacion });
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
    await fetchInventario();
  };

  const updateInventarioItem = async (id, payload) => {
    await axios.put(`${BASE_URL}/inventario/${id}`, payload);
    await fetchInventario();
  };

  const movimientoInventario = async (id, payload) => {
    await axios.post(`${BASE_URL}/inventario/${id}/movimiento`, payload);
    await fetchInventario();
  };

  const deleteInventarioItem = async (id) => {
    await axios.delete(`${BASE_URL}/inventario/${id}`);
    await fetchInventario();
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

  const uploadLogoConfiguracion = async (file) => {
    const data = new FormData();
    data.append('logo', file);
    const res = await axios.post(`${BASE_URL}/configuracion/logo`, data);
    setConfiguracion(res.data.config);
    await fetchAuditoria();
    return res.data;
  };

  return (
    <AdminContext.Provider
      value={{
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
        loading,
        syncStatus,
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
