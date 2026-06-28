"use client"

import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react"
import { Pause, Play, RotateCcw } from "lucide-react"

// Injected into the iframe before any model script runs:
// - Overrides rAF to support pause/resume
// - Detects when rAF goes idle (animation ended) and notifies parent
// - Handles CSS animations via animationPlayState
// - Listens for 'pause'/'resume' postMessages from parent
const INJECT = `<script>
(function(){
  var paused=false,pending=[],idleTimer=null,active=false;
  var _raf=window.requestAnimationFrame.bind(window);
  function scheduleIdle(){
    if(!active)return;
    clearTimeout(idleTimer);
    idleTimer=setTimeout(function(){
      if(!paused)window.parent.postMessage('anim:ended','*');
    },800);
  }
  window.requestAnimationFrame=function(cb){
    if(paused){pending.push(cb);return 0;}
    active=true;
    scheduleIdle();
    return _raf(cb);
  };
  document.addEventListener('animationend',function(){
    if(!paused)window.parent.postMessage('anim:ended','*');
  },true);
  window.addEventListener('message',function(e){
    if(e.data==='pause'){
      paused=true;
      clearTimeout(idleTimer);
      document.querySelectorAll('*').forEach(function(el){
        if(el.style)el.style.animationPlayState='paused';
      });
    }else if(e.data==='resume'){
      paused=false;
      document.querySelectorAll('*').forEach(function(el){
        if(el.style)el.style.animationPlayState='running';
      });
      var cbs=pending.splice(0);
      cbs.forEach(function(cb){_raf(cb);});
      scheduleIdle();
    }
  });
})();
</script>`

function injectScript(html: string): string {
  const m = html.match(/<head[^>]*>/i)
  if (m) return html.replace(m[0], m[0] + INJECT)
  return INJECT + html
}

type Props = { html: string; title?: string }

export const AnimationBlock = memo(function AnimationBlock({ html, title }: Props) {
  const [key, setKey] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const injectedHtml = useMemo(() => injectScript(html), [html])

  const pause = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage("pause", "*")
    setIsPlaying(false)
  }, [])

  const resume = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage("resume", "*")
    setIsPlaying(true)
  }, [])

  const restart = useCallback(() => {
    setKey((k) => k + 1)
    setIsPlaying(true)
  }, [])

  // Auto-replay when iframe signals animation ended
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data === "anim:ended" && isPlaying) {
        setKey((k) => k + 1)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [isPlaying])

  return (
    <div className="my-1">
      {title && <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{title}</p>}
      <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
        <iframe
          key={key}
          ref={iframeRef}
          srcDoc={injectedHtml}
          sandbox="allow-scripts"
          width="100%"
          height="400"
          style={{ display: "block", border: "none" }}
          title={title || "animation"}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {isPlaying ? (
            <button
              onClick={pause}
              className="flex items-center gap-1 bg-black/40 hover:bg-black/60 text-white rounded-full px-2.5 py-1 transition-colors"
            >
              <Pause className="size-3" />
              <span className="text-[11px] font-medium">Pause</span>
            </button>
          ) : (
            <button
              onClick={resume}
              className="flex items-center gap-1 bg-black/40 hover:bg-black/60 text-white rounded-full px-2.5 py-1 transition-colors"
            >
              <Play className="size-3" />
              <span className="text-[11px] font-medium">Resume</span>
            </button>
          )}
          <button
            onClick={restart}
            className="flex items-center gap-1 bg-black/40 hover:bg-black/60 text-white rounded-full px-2.5 py-1 transition-colors"
          >
            <RotateCcw className="size-3" />
            <span className="text-[11px] font-medium">Restart</span>
          </button>
        </div>
      </div>
    </div>
  )
})
