export { Events, RawSettings, RawLoadInstruction } from './raw';
export { Content, Settings, ChainedLoadInstruction } from './chained';

import { TimeSource } from '@cycle/time';
import getRawLoadInstructionBuilder from './raw';
import getChainedLoadInstructionBuilder from './chained';
import { Stream } from 'xstream';
import { Events, RawSettings, RawLoadInstruction } from './raw';
import { Content, Settings, ChainedLoadInstruction } from './chained';

export default function build(
  timeSource: TimeSource
): {
  getRawLoadInstruction: ({ scroll$, resize$ }: Events, settings$?: Stream<RawSettings>) => Stream<RawLoadInstruction>;
  getChainedLoadInstruction: (
    events: Events,
    content$: Stream<Content[]>,
    settings$: Stream<Settings>
  ) => Stream<ChainedLoadInstruction>;
} {
  return {
    getRawLoadInstruction: getRawLoadInstructionBuilder(timeSource),
    getChainedLoadInstruction: getChainedLoadInstructionBuilder(timeSource)
  };
}
