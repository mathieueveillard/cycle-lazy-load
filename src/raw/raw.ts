import { Stream } from 'xstream';
import pairwise from 'xstream/extra/pairwise';
import makeDebounceAndAccumulate, { DebounceAndAccumulateSettings } from 'xstream-debounce-accumulate';
import { TimeSource } from '@cycle/time';
import { ResizeEvent } from 'cycle-resize';

export interface Events {
  scroll$?: Stream<WheelEvent>;
  resize$?: Stream<ResizeEvent>;
}

export type ContentHeightInPx = number;
export type BufferHeightInPx = number;
export type DebounceTimeInMs = number;
export type ThrottleTimeInMs = number;

type NumericalOption = ContentHeightInPx | BufferHeightInPx | DebounceTimeInMs | ThrottleTimeInMs;

interface TimeSettings {
  debounce?: DebounceTimeInMs;
  throttle?: ThrottleTimeInMs;
}

interface ContentHeightSetting {
  contentHeight?: ContentHeightInPx;
}

interface BufferSettings {
  contentHeight?: ContentHeightInPx;
  buffer?: BufferHeightInPx;
}

export type RawSettings = TimeSettings & ContentHeightSetting & BufferSettings;

const DEFAULT_SETTINGS: RawSettings = {
  contentHeight: 0,
  buffer: 0,
  debounce: 0,
  throttle: 0
};

export type Quantity = number;
type DeltaY = Quantity;

export interface RawLoadInstruction {
  quantity?: Quantity;
}

export default function build(timeSource: TimeSource) {
  return function getRawLoadInstruction(
    { scroll$, resize$ }: Events,
    settings$?: Stream<RawSettings>
  ): Stream<RawLoadInstruction> {
    const validSettings$: Stream<RawSettings> = makeValidSettings(settings$);
    const { timeSettings$, contentHeightSetting$, bufferSettings$ } = extractSettings(validSettings$);

    const scrollOrResize$: Stream<WheelEvent | ResizeEvent> = makeValidScrollOrResize(scroll$, resize$);
    const scrollOrResizeDelta$: Stream<DeltaY> = getScrollOrResizeDelta(scrollOrResize$, timeSettings$);

    const loadInstructionFromScrollOrResize$: Stream<RawLoadInstruction> = computeLoadInstruction(
      scrollOrResizeDelta$,
      contentHeightSetting$
    );

    const bufferDelta$: Stream<DeltaY> = getBufferDelta(bufferSettings$);
    const loadInstructionFromBuffer$: Stream<RawLoadInstruction> = computeLoadInstruction(
      bufferDelta$,
      contentHeightSetting$.drop(1)
    );

    return Stream.merge(loadInstructionFromScrollOrResize$, loadInstructionFromBuffer$);
  };

  function makeValidSettings(settings$?: Stream<RawSettings>): Stream<RawSettings> {
    if (settings$) {
      const accumulatedSettings$: Stream<RawSettings> = settings$.fold(accumulateSettings, {}).drop(1);
      return mergeSettingsStreamWithDefaults(accumulatedSettings$);
    }
    return makeStreamOfDefaultSettings();
  }

  function accumulateSettings(accumulator: RawSettings, current: RawSettings): RawSettings {
    return {
      ...accumulator,
      ...current
    };
  }

  function mergeSettingsStreamWithDefaults(settings$: Stream<RawSettings>): Stream<RawSettings> {
    const settingsWithDefaults$ = settings$.map(mergeAndValidateSettings).startWith(DEFAULT_SETTINGS);
    return settingsWithDefaults$.remember();
  }

  function mergeAndValidateSettings(settings: RawSettings): RawSettings {
    const mergeAndValidate = mergeAndValidateSingleOption(settings, DEFAULT_SETTINGS);
    return {
      contentHeight: mergeAndValidate('contentHeight'),
      buffer: mergeAndValidate('buffer'),
      debounce: mergeAndValidate('debounce'),
      throttle: mergeAndValidate('throttle')
    };
  }

  function mergeAndValidateSingleOption(settings: RawSettings, defaults: RawSettings) {
    return function(optionName: string): NumericalOption {
      return Math.max(0, settings[optionName]) || defaults[optionName];
    };
  }

  function makeStreamOfDefaultSettings(): Stream<RawSettings> {
    return Stream.of(DEFAULT_SETTINGS).remember();
  }

  function extractSettings(settings$: Stream<RawSettings>) {
    const timeSettings$: Stream<TimeSettings> = extractTimeSettings(settings$);
    const contentHeightSetting$: Stream<ContentHeightSetting> = extractContentHeightSetting(settings$);
    const bufferSettings$: Stream<BufferSettings> = extractBufferSettings(settings$);
    return { timeSettings$, contentHeightSetting$, bufferSettings$ };
  }

  function extractTimeSettings(settings$: Stream<RawSettings>): Stream<TimeSettings> {
    return settings$.map(({ debounce, throttle }: RawSettings) => ({
      debounce,
      throttle
    }));
  }

  function extractContentHeightSetting(settings$: Stream<RawSettings>): Stream<ContentHeightSetting> {
    return settings$.map(({ contentHeight }: RawSettings) => ({
      contentHeight
    }));
  }

  function extractBufferSettings(settings$: Stream<RawSettings>): Stream<BufferSettings> {
    return settings$.map(({ contentHeight, buffer }: RawSettings) => ({
      contentHeight,
      buffer
    }));
  }

  function makeValidScrollOrResize(
    scroll$: Stream<WheelEvent>,
    resize$: Stream<ResizeEvent>
  ): Stream<WheelEvent | ResizeEvent> {
    return Stream.merge(scroll$ || Stream.never(), resize$ || Stream.never());
  }

  function getScrollOrResizeDelta(
    event$: Stream<WheelEvent | ResizeEvent>,
    timeSettings$: Stream<TimeSettings>
  ): Stream<DeltaY> {
    const scrollDownOrResizeToTallerDelta$: Stream<DeltaY> = event$
      .filter(isScrollingDownOrResizingToTallerWindow)
      .map(makeDelta);
    const debounceAndThrottle = debounceAndThrottleAsPerSettings(scrollDownOrResizeToTallerDelta$);
    return timeSettings$.map(debounceAndThrottle).flatten();
  }

  function isScrollingDownOrResizingToTallerWindow(event: WheelEvent | ResizeEvent): boolean {
    return event.deltaY > 0;
  }

  function getBufferDelta(bufferSettings$: Stream<BufferSettings>): Stream<DeltaY> {
    const buffer$ = bufferSettings$
      .filter(settingsAreValid)
      .map(extractBuffer)
      .startWith(0);
    return buffer$
      .compose(pairwise)
      .map(computeDelta)
      .filter(bufferIsGreater)
      .compose(timeSource.delay(20));
  }

  function settingsAreValid({ contentHeight, buffer }: RawSettings): boolean {
    return contentHeight > 0 && buffer > 0;
  }

  function extractBuffer({ buffer }: RawSettings): BufferHeightInPx {
    return buffer;
  }

  function computeDelta([first, second]: [number, number]): DeltaY {
    return Math.max(0, second - first);
  }

  function bufferIsGreater(deltaY: DeltaY): boolean {
    return deltaY > 0;
  }

  function debounceAndThrottleAsPerSettings($: Stream<number>) {
    return function({ debounce, throttle }: RawSettings): Stream<number> {
      const debounceAndAccumulate = makeDebounceAndAccumulate<number>(timeSource);
      const debounceSettings: DebounceAndAccumulateSettings<number> = {
        period: debounce,
        accumulate: (accumulator: number, current: number) => accumulator + current,
        seed: 0
      };
      return $.compose(debounceAndAccumulate(debounceSettings)).compose(timeSource.throttle(throttle));
    };
  }

  function makeDelta(event: WheelEvent | ResizeEvent): DeltaY {
    return event.deltaY;
  }

  function computeLoadInstruction(
    $: Stream<DeltaY>,
    contentHeightSetting$: Stream<ContentHeightSetting>
  ): Stream<RawLoadInstruction> {
    return contentHeightSetting$.map(applySettingToStream($)).flatten();
  }

  function applySettingToStream($: Stream<DeltaY>) {
    return function(contentHeightSetting: ContentHeightSetting): Stream<RawLoadInstruction> {
      return $.map(applySettingToValue(contentHeightSetting));
    };
  }

  function applySettingToValue({ contentHeight }: ContentHeightSetting) {
    return function(deltaY: DeltaY): RawLoadInstruction {
      const loadInstruction: RawLoadInstruction = {};
      if (contentHeight > 0) {
        loadInstruction.quantity = Math.ceil(deltaY / contentHeight);
      }
      return loadInstruction;
    };
  }
}
