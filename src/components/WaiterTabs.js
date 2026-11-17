import React, { useId, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { WText } from './WaiterUI';

export default function WaiterTabs({tabs,value,onChange,colors:c,label,padding=14,children}) {
  const id=useId().replaceAll(':',''),buttons=useRef({});
  const move=(event,index)=>{
    const offset={ArrowRight:1,ArrowLeft:-1}[event.key];
    if(offset===undefined&&!['Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+offset+tabs.length)%tabs.length;
    onChange(tabs[next].key);buttons.current[tabs[next].key]?.focus();
  };
  return <>
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{flexDirection:'row',marginHorizontal:padding-6,padding:4,gap:4,borderRadius:999,backgroundColor:c.isDark?'rgba(255,255,255,0.06)':'rgba(16,24,40,0.05)'}}>
      {tabs.map(({key,label:caption,Icon},index)=>{
        const selected=value===key;
        return <Pressable key={key} ref={node=>{buttons.current[key]=node;}} nativeID={`${id}-tab-${key}`} accessibilityRole="tab" accessibilityState={{selected}}
          {...(Platform.OS==='web'?{'aria-selected':selected,'aria-controls':`${id}-panel`,tabIndex:selected?0:-1,onKeyDown:event=>move(event,index)}:{})}
          onPress={()=>onChange(key)} style={{minHeight:40,flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:999,backgroundColor:selected?c.surface:'transparent'}}>
          {Icon?<Icon size={16} color={selected?c.brand:c.muted}/>:null}<WText style={{color:selected?c.ink:c.muted,fontSize:14,fontWeight:selected?'800':'600'}}>{caption}</WText>
        </Pressable>;
      })}
    </View>
    <View nativeID={`${id}-panel`} {...(Platform.OS==='web'?{role:'tabpanel','aria-labelledby':`${id}-tab-${value}`}:{})} style={{flexShrink:1}}>{children}</View>
  </>;
}
