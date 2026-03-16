import React from 'react';
import { Composition } from 'remotion';
import { CampanhaComposition } from './CampanhaComposition';

export type CampanhaProps = {
  assets: {
    url: string;
    tipo: string;
    aspectRatio: string;
    copy: string;
  }[];
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CampanhaVideo"
        component={CampanhaComposition}
        durationInFrames={300} // Will be overridden by the player dynamically
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          assets: []
        }}
      />
    </>
  );
};
