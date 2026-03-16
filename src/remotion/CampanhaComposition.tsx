import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Img,
  spring,
} from 'remotion';

export type CampanhaProps = {
  assets: {
    url: string;
    tipo: string;
    aspectRatio: string;
    copy: string;
  }[];
};

export const CampanhaComposition: React.FC<CampanhaProps> = ({ assets }) => {
  const { fps } = useVideoConfig();
  
  if (!assets || assets.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', fontSize: '40px' }}>
        Aguardando assets visuais...
      </AbsoluteFill>
    );
  }

  // 4 seconds per image = 120 frames at 30 fps
  const framesPerAsset = 120; 

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505' }}>
      {assets.map((asset, index) => {
        const startFrame = index * framesPerAsset;
        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={framesPerAsset + 10} // 10 frames overlap for crossfade
          >
            <AssetScene asset={asset} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const AssetScene: React.FC<{ asset: CampanhaProps['assets'][0] }> = ({ asset }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Crossfade / Fade in
  const opacity = interpolate(
    frame,
    [0, 15],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  // Ken Burns scale effect (zoom slow and steady)
  const scale = interpolate(
    frame,
    [0, 120],
    [1, 1.05],
    { extrapolateRight: 'clamp' }
  );

  // Motion Tracking / Text entrance (Parallax setup)
  // Text will spring up
  const textY = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12 }
  });

  const textOpacity = interpolate(
    frame,
    [15, 30],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  // Glow sweep effect rolling over text
  const glowPosition = interpolate(
    frame,
    [45, 75],
    [-100, 200],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Background Image with Ken Burns */}
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img 
          src={asset.url} 
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover' 
          }} 
        />
        {/* Cinematic dark overlay to make text readable */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.4) 100%)'
        }} />
      </AbsoluteFill>

      {/* Foreground Typography */}
      {asset.copy && (
        <AbsoluteFill style={{ 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: '80px',
          zIndex: 10
        }}>
          <div style={{
            transform: `translateY(${interpolate(textY, [0, 1], [50, 0])}px)`,
            opacity: textOpacity,
            position: 'relative',
            overflow: 'hidden',
            padding: '20px'
          }}>
             <h1 style={{
               color: 'white',
               fontSize: '72px',
               fontWeight: 900,
               textAlign: 'center',
               fontFamily: 'Montserrat, system-ui, sans-serif',
               textTransform: 'uppercase',
               textShadow: '0 8px 30px rgba(0,0,0,0.8)',
               margin: 0,
               lineHeight: 1.1,
               letterSpacing: '-1px'
             }}>
               {asset.copy}
             </h1>
             {/* Text Glow / Sweep */}
             <div style={{
               position: 'absolute',
               top: 0,
               left: `${glowPosition}%`,
               width: '30%',
               height: '100%',
               background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)',
               transform: 'skewX(-20deg)'
             }} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
