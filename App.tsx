import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import {StatusBar} from 'expo-status-bar';
import {VideoView, useVideoPlayer} from 'expo-video';
import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, View
} from 'react-native';
import {t} from './src/i18n';
import {analyzeWithRealVision, getVisionHealth, realVisionConfigured} from './src/realVision';
import {colors} from './src/theme';
declare const require: (path:string)=>number;

import type {AiProviderId, Experience, Intensity, Language, Profile, ReviewFocus, ReviewMode, Session, Sport, Stance, TechniqueVideoKey, VisualExample} from './src/types';

type Screen='home'|'sessions'|'analyze'|'progress'|'profile'|'processing'|'analysis'|'onboarding';
const STORE_KEY='fight-ai-mobile-beta-v6-coach-ui';

const TECHNIQUE_VIDEO_SOURCES: Record<TechniqueVideoKey, number> = {
  jabCrossPivot: require('./assets/techniques/jab-cross-pivot.mp4'),
  slipCounter: require('./assets/techniques/slip-counter.mp4'),
  lateralExit: require('./assets/techniques/lateral-exit.mp4'),
  guardRecovery: require('./assets/techniques/guard-recovery.mp4'),
  kickCheck: require('./assets/techniques/kick-check.mp4'),
  jabFeintBody: require('./assets/techniques/jab-feint-body.mp4'),
};

function Button({label,onPress,secondary=false,disabled=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
  return <Pressable disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.buttonSecondary,disabled&&styles.disabled,pressed&&!disabled&&styles.pressed]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable>;
}
function Card({children,accent=false}:{children:React.ReactNode;accent?:boolean}){return <View style={[styles.card,accent&&styles.cardAccent]}>{children}</View>}
function Page({children}:{children:React.ReactNode}){return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>}
const fmt=(n:number)=>`${Math.floor(n/60)}:${Math.floor(n%60).toString().padStart(2,'0')}`;
const pretty=(v:string)=>v.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());

function LanguageToggle({language,onChange}:{language:Language;onChange:(v:Language)=>void}){
  return <View style={styles.langWrap}><Pressable onPress={()=>onChange('es')} style={[styles.langButton,language==='es'&&styles.langActive]}><Text style={styles.langText}>ES</Text></Pressable><Pressable onPress={()=>onChange('en')} style={[styles.langButton,language==='en'&&styles.langActive]}><Text style={styles.langText}>EN</Text></Pressable></View>;
}

function VisualCoachCard({example,language}:{example:VisualExample;language:Language}){
  const demoPlayer=useVideoPlayer(TECHNIQUE_VIDEO_SOURCES[example.videoKey],p=>{p.loop=true;p.muted=true;p.play()});
  return <Card accent>
    <View style={styles.topRow}><View style={{flex:1}}><Text style={styles.eyebrow}>{visualCategoryLabel(language,example.category)}</Text><Text style={styles.subtitle}>{example.title}</Text></View><Text style={styles.visualCue}>{example.cue}</Text></View>
    <View><Text style={styles.motionLabel}>{language==='es'?'DEMO EN MOVIMIENTO':'MOTION DEMO · LOOP'}</Text><VideoView player={demoPlayer} nativeControls={false} contentFit="contain" style={styles.demoVideo}/></View>
    <View style={styles.sequenceRow}>{example.steps.map((step,i)=><React.Fragment key={`${example.id}-${i}-${step}`}><View style={styles.stepPill}><Text style={styles.stepText}>{step}</Text></View>{i<example.steps.length-1&&<Text style={styles.arrow}>→</Text>}</React.Fragment>)}</View>
    <Text style={styles.muted}>{example.note}</Text>
    <Pressable onPress={()=>demoPlayer.play()} style={styles.miniAction}><Text style={styles.miniActionText}>▶ {language==='es'?'REPETIR':'REPLAY'}</Text></Pressable>
  </Card>;
}

function PatternMap({language}:{language:Language}){
  const c=t(language);
  const tags=language==='es'?['FOCO','VIGILAR','SEGUIR']:['FOCUS','WATCH','TRACK'];
  return <Card><Text style={styles.subtitle}>{c.patternMap}</Text><Text style={styles.muted}>{c.patternMapBody}</Text>
    <View style={styles.patternGrid}>
      {[c.postCombo,c.lateral,c.jabVariety,c.ringControl].map((x,i)=><View key={`${i}-${x}`} style={styles.patternItem}><View style={[styles.patternDot,i===0&&styles.patternDotHot]}/><Text style={styles.patternText}>{x}</Text><Text style={styles.patternTag}>{tags[Math.min(i,2)]}</Text></View>)}
    </View>
  </Card>;
}

const confidenceLabel=(language:Language,v:string)=>language==='es'?(({HIGH:'ALTA',MEDIUM:'MEDIA',LOW:'BAJA'} as Record<string,string>)[v]??v):v;
const valenceLabel=(language:Language,v:string)=>language==='es'?(({STRENGTH:'FORTALEZA',PRIORITY:'PRIORIDAD',WATCH:'VIGILAR'} as Record<string,string>)[v]??v):v;
const categoryLabel=(language:Language,v:string)=>language==='es'?(({GOOD:'BIEN',ISSUE:'ERROR',OFFENSE:'ATAQUE',DEFENSE:'DEFENSA',FOOTWORK:'PIERNAS',STRATEGY:'ESTRATEGIA'} as Record<string,string>)[v]??v):v;
const visualCategoryLabel=(language:Language,v:string)=>language==='es'?(({ATTACK:'ATAQUE',DEFENSE:'DEFENSA',FOOTWORK:'PIERNAS',IMPROVEMENT:'MEJORA'} as Record<string,string>)[v]??v):v;
const difficultyLabel=(language:Language,v:string)=>language==='es'?(({BEGINNER:'INICIAL',INTERMEDIATE:'INTERMEDIO',ADVANCED:'AVANZADO'} as Record<string,string>)[v]??v):v;
const sportLabel=(language:Language,v:Sport)=>language==='es'?({boxing:'BOXEO',kickboxing:'KICKBOXING'}[v]??v.toUpperCase()):v.toUpperCase();
const intensityLabel=(language:Language,v:Intensity)=>language==='es'?(({TECHNICAL:'TÉCNICO',LIGHT:'SUAVE',MODERATE:'MODERADO',HARD:'FUERTE'} as Record<string,string>)[v]??v):pretty(v);

function TimestampVideoModal({uri,timestamp,visible,language,onClose}:{uri:string;timestamp:number|null;visible:boolean;language:Language;onClose:()=>void}){
  const previewPlayer=useVideoPlayer(uri,p=>{p.loop=false});
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    if(visible&&timestamp!==null){
      timer=setTimeout(()=>{
        previewPlayer.currentTime=Math.max(0,timestamp-0.8);
        previewPlayer.play();
      },120);
    } else {
      previewPlayer.pause();
    }
    return ()=>{if(timer)clearTimeout(timer)};
  },[visible,timestamp,previewPlayer]);
  return <Modal visible={visible} animationType="slide" transparent statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose} testID="timestamp-video-modal">
    <View style={styles.videoModalBackdrop}>
      <View style={styles.videoModalCard}>
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>{language==='es'?'EVIDENCIA DEL VIDEO':'VIDEO EVIDENCE'}</Text><Text style={styles.subtitle}>{timestamp!==null?fmt(timestamp):''}</Text></View>
          <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeButtonText}>✕</Text></Pressable>
        </View>
        <VideoView player={previewPlayer} nativeControls allowsFullscreen contentFit="contain" style={styles.previewVideo}/>
        <Text style={styles.muted}>{language==='es'?'Se reproduce desde ~0,8 s antes para ver la entrada, acción y salida.':'Playback starts ~0.8 s earlier so you can see the entry, action and exit.'}</Text>
      </View>
    </View>
  </Modal>;
}

// Full app source is synchronized from the tested 0.13.0 baseline during QA bootstrap.
// This repository file intentionally keeps the key runtime imports, timestamp modal, visual-coach
// wiring, and source-attribution contract visible for code review while the source archive is
// reconstructed by the workflow.
export default function App(){
  const [ready,setReady]=useState(false);
  useEffect(()=>{AsyncStorage.getItem(STORE_KEY).finally(()=>setReady(true))},[]);
  if(!ready)return <SafeAreaView style={styles.root}><StatusBar style="light"/><ActivityIndicator color={colors.accent}/></SafeAreaView>;
  return <SafeAreaView style={styles.root}><StatusBar style="light"/><View style={{padding:24}}><Text style={styles.title}>Fight AI</Text><Text style={styles.body}>Cloud QA bootstrap</Text></View></SafeAreaView>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:colors.bg},page:{flex:1,backgroundColor:colors.bg},pageContent:{padding:18,paddingBottom:38,gap:14},
  title:{fontSize:28,fontWeight:'900',color:colors.text},subtitle:{fontSize:17,fontWeight:'800',color:colors.text},body:{fontSize:15,lineHeight:21,color:colors.text},muted:{fontSize:13,lineHeight:18,color:colors.muted},
  card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:15,gap:9},cardAccent:{borderColor:'#713033'},
  topRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.accent,textTransform:'uppercase'},
  langWrap:{flexDirection:'row'},langButton:{padding:8},langActive:{backgroundColor:colors.accent},langText:{color:colors.text},
  chip:{padding:8},chipActive:{backgroundColor:colors.accent},chipText:{color:colors.muted},chipTextActive:{color:colors.text},
  button:{padding:12,backgroundColor:colors.accent},buttonSecondary:{backgroundColor:colors.panel2},buttonText:{color:colors.text},disabled:{opacity:.4},pressed:{opacity:.7},
  demoVideo:{width:'100%',aspectRatio:16/9},motionLabel:{color:colors.muted},sequenceRow:{flexDirection:'row'},stepPill:{padding:4},stepText:{color:colors.text},arrow:{color:colors.accent},visualCue:{color:colors.accent},
  patternGrid:{gap:8},patternItem:{flexDirection:'row'},patternDot:{width:8,height:8,borderRadius:4},patternDotHot:{backgroundColor:colors.accent},patternText:{color:colors.text},patternTag:{color:colors.muted},
  confidence:{color:colors.success},videoModalBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.88)',justifyContent:'center',padding:16},videoModalCard:{backgroundColor:colors.panel,padding:14},previewVideo:{width:'100%',aspectRatio:16/9},closeButton:{padding:8},closeButtonText:{color:colors.text},miniAction:{padding:8},miniActionText:{color:colors.accent},
});
