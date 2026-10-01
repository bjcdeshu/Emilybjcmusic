/** RMS of non-overlapping actual time-domain windows. No frequency bias or synthetic peaks. */
export function waveformLevels(samples: Uint8Array, count: number): number[] {
  const bars=Math.max(0,Math.min(Math.floor(count),samples.length));
  return Array.from({length:bars},(_,i)=>{
    const start=Math.floor(i*samples.length/bars),end=Math.floor((i+1)*samples.length/bars);
    let sum=0;for(let n=start;n<end;n++){const amplitude=(samples[n]!-128)/128;sum+=amplitude*amplitude;}
    return Math.min(1,Math.sqrt(sum/Math.max(1,end-start)));
  });
}
