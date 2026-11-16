import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { refreshServiceAlerts } from '../utils/serviceAlerts.mjs';

export default function useServiceAlerts(userId, onNotice) {
  const [state,setState] = useState({items:[],limits:{enabled:true,espera:20,lista:5},loading:true,error:'',updatedAt:null});
  const notice = useRef(onNotice), refreshRef = useRef(()=>{});
  notice.current = onNotice;
  const refresh = useCallback(()=>refreshRef.current(),[]);
  useEffect(()=>{
    if (!userId) return undefined;
    let active=true,timer,controller,busy=false;
    setState({items:[],limits:{enabled:true,espera:20,lista:5},loading:true,error:'',updatedAt:null});
    const visible=()=> (typeof document==='undefined'||document.visibilityState!=='hidden')&&!['background','inactive'].includes(AppState.currentState);
    const poll=async()=>{
      if (!active||busy||!visible()) return;
      clearTimeout(timer);busy=true;controller=new AbortController();
      try {
        const options={signal:controller.signal,timeout:12000};
        const next=await refreshServiceAlerts({get:()=>axios.get(`${BASE_URL}/pedidos/alertas-demora`,options).then(res=>res.data),claim:ids=>axios.post(`${BASE_URL}/pedidos/alertas-demora/avisar`,{ids},options).then(res=>res.data)});
        if(active&&visible()){
          setState({...next,loading:false,updatedAt:Date.now()});
          if(next.newItems.length)notice.current?.(next.newItems);
        }
      } catch(error){if(active&&!axios.isCancel(error))setState(previous=>({...previous,loading:false,error:'No se pudieron actualizar las demoras. Revisa la conexión.'}));}
      finally{busy=false;if(active&&visible())timer=setTimeout(poll,30000);}
    };
    const visibility=()=>{clearTimeout(timer);if(visible())poll();else controller?.abort();};
    refreshRef.current=poll;poll();
    const subscription=AppState.addEventListener('change',visibility);
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility);
    return()=>{active=false;clearTimeout(timer);controller?.abort();subscription.remove();refreshRef.current=()=>{};if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);};
  },[userId]);
  return {...state,refresh};
}
