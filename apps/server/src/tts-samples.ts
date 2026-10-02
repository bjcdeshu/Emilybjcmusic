import type { VoicePreviewSample } from '@emily/shared';
/** Fixed, non-personal examples. Not generated from the listener's chat/history. */
export const VOICE_SAMPLES: Record<'zh' | 'en', Record<VoicePreviewSample, string>> = {
  zh: {
    transition: '好，那就听这一首。我先不替它写结论，也不急着安排后面。等这首放完，我们再看看，是接着这个方向，还是换一种选择。',
    bright: '选好了，那我们就开始吧。我喜欢选歌时这一点小小的悬念：下一次，会继续熟悉的选择，还是试一首没听过的？这回先把答案留给音乐。',
    reflective: '有时候，重新选一首熟悉的歌，也不必先找一个特别的理由。我倒想留一点余地，不急着用从前的印象给这次收听下结论。先听听看，后面的事，听完再说。'
  },
  en: {
    transition: 'Here is the next song. I will leave the introduction there and let it play. We can decide where to go next when it finishes.',
    bright: 'All right, let us begin. There is a little possibility in choosing the next song: something familiar, or something new? For now, here is this one.',
    reflective: 'A familiar song does not need a special occasion. I would rather leave a little room for this listen than decide in advance what it should mean. Here it is.'
  }
};
