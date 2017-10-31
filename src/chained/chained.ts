import { Stream } from 'xstream';
import combineUnique from 'xstream-combine-unique';
import {
  RawSettings,
  RawLoadInstruction,
  ContentHeightInPx,
  Quantity,
  Events,
  default as buildGetRawLoadInstructionFunction
} from '../raw/raw';
import { TimeSource } from '@cycle/time';
import { startStream } from '../utils';

interface ContentHeightSetting {
  contentHeight: ContentHeightInPx;
}

interface MinQuantitySetting {
  minQuantity?: Quantity;
}

interface MaxQuantitySetting {
  maxQuantity?: Quantity;
}

export type Settings = RawSettings & ContentHeightSetting & MinQuantitySetting & MaxQuantitySetting;

type SortCriteria = any[];

export interface Content {
  sort: SortCriteria;
}

export interface ChainedLoadInstruction {
  quantity: Quantity;
  after: SortCriteria;
}

export default function build(timeSource: TimeSource) {
  const getRawLoadInstruction = buildGetRawLoadInstructionFunction(timeSource);

  return function getChainedLoadInstruction(
    events: Events,
    content$: Stream<Content[]>,
    settings$: Stream<Settings>
  ): Stream<ChainedLoadInstruction> {
    const invalidSettings$: Stream<Error> = spotInvalidSettings(settings$);
    const { minQuantity$, maxQuantity$ } = extractSettings(settings$);
    const quantityToAdd$: Stream<Quantity> = getQuantityToAdd(events, settings$);
    const loadInstructionImitation$: Stream<ChainedLoadInstruction> = Stream.create();
    const quantityToRemove$: Stream<Quantity> = getQuantityToRemove(loadInstructionImitation$);
    const remainingQuantityToLoad$: Stream<Quantity> = computeRemainingQuantityToLoad(
      quantityToAdd$,
      quantityToRemove$
    );
    const remainingQuantityToLoadWithMinQuantity$: Stream<Quantity> = applyMinQuantity(
      remainingQuantityToLoad$,
      minQuantity$
    );
    const after$: Stream<SortCriteria> = getAfter(content$);
    const loadInstruction$: Stream<ChainedLoadInstruction> = getLoadInstruction(
      remainingQuantityToLoadWithMinQuantity$,
      after$
    );
    const loadInstructionWithMaxQuantity$: Stream<ChainedLoadInstruction> = applyMaxQuantity(
      loadInstruction$,
      maxQuantity$
    );
    loadInstructionImitation$.imitate(loadInstructionWithMaxQuantity$);
    return Stream.merge(invalidSettings$ as Stream<any>, loadInstructionWithMaxQuantity$);
  };

  function spotInvalidSettings(settings$: Stream<Settings>): Stream<Error> {
    return settings$
      .filter(settingsAreInvalid)
      .map((error: any) => Stream.throw(error))
      .flatten();
  }

  function settingsAreInvalid(settings: Settings): boolean {
    return !settingsAreValid(settings);
  }

  function settingsAreValid({ contentHeight, minQuantity, maxQuantity }: Settings): boolean {
    return (
      isContentHeightValid(contentHeight) &&
      isMinQuantityValid(minQuantity) &&
      isMaxQuantityValid(maxQuantity) &&
      areMinAndMaxCompatible(minQuantity, maxQuantity)
    );
  }

  function isContentHeightValid(contentHeight: ContentHeightInPx): boolean {
    if (contentHeight === undefined) {
      throw 'contentHeight must be defined';
    }
    if (isNaN(contentHeight)) {
      throw 'contentHeight must be a number';
    }
    if (contentHeight <= 0) {
      throw 'contentHeight must be greater than 0';
    }
    return true;
  }

  function isMinQuantityValid(minQuantity: Quantity): boolean {
    if (minQuantity === undefined) {
      return true;
    }
    if (isNaN(minQuantity)) {
      throw 'minQuantity must be a number';
    }
    if (minQuantity < 0) {
      throw 'minQuantity must be greater than or equal to 0';
    }
    return true;
  }

  function isMaxQuantityValid(maxQuantity: Quantity): boolean {
    if (maxQuantity === undefined) {
      return true;
    }
    if (isNaN(maxQuantity)) {
      throw 'maxQuantity must be a number';
    }
    if (maxQuantity < 1) {
      throw 'maxQuantity must be greater than or equal to 1';
    }
    return true;
  }

  function areMinAndMaxCompatible(minQuantity: Quantity, maxQuantity: Quantity): boolean {
    if (minQuantity === undefined || maxQuantity === undefined) {
      return true;
    }
    if (minQuantity > maxQuantity) {
      throw 'minQuantity must be lesser than or equal to maxQuantity';
    }
    return true;
  }

  function extractSettings(settings$: Stream<Settings>) {
    const minQuantity$: Stream<MinQuantitySetting> = extractMinQuantity(settings$);
    const maxQuantity$: Stream<MaxQuantitySetting> = extractMaxQuantity(settings$);
    return { minQuantity$, maxQuantity$ };
  }

  function extractMinQuantity(settings$: Stream<Settings>): Stream<MinQuantitySetting> {
    return settings$.map(({ minQuantity }: Settings) => ({
      minQuantity
    }));
  }

  function extractMaxQuantity(settings$: Stream<Settings>): Stream<MaxQuantitySetting> {
    return settings$.map(({ maxQuantity }: Settings) => ({
      maxQuantity
    }));
  }

  function getQuantityToAdd(events: Events, settings$: Stream<Settings>): Stream<Quantity> {
    return getRawLoadInstruction(events, settings$)
      .map(extractQuantity)
      .filter(quantityIsPositive);
  }

  function extractQuantity({ quantity }: RawLoadInstruction): Quantity {
    return quantity;
  }

  function quantityIsPositive(quantity: Quantity) {
    return quantity > 0;
  }

  function getQuantityToRemove(loadInstruction$: Stream<ChainedLoadInstruction>): Stream<Quantity> {
    return loadInstruction$.map(({ quantity }: ChainedLoadInstruction) => -quantity);
  }

  function computeRemainingQuantityToLoad(
    quantityToAdd$: Stream<Quantity>,
    quantityToRemove$: Stream<Quantity>
  ): Stream<Quantity> {
    return Stream.merge(quantityToAdd$, quantityToRemove$)
      .fold(accumulateQuantities, 0)
      .filter(quantityIsPositive);
  }

  function accumulateQuantities(accumulator: Quantity, current: Quantity): Quantity {
    return accumulator + current;
  }

  function applyMinQuantity($: Stream<Quantity>, minQuantitySetting$: Stream<MinQuantitySetting>): Stream<Quantity> {
    const withMinQuantity$: Stream<Quantity> = minQuantitySetting$.map(filterStreamWithMinQuantity($)).flatten();
    // Help needed: I can't understand why this is necessary
    startStream($);
    startStream(withMinQuantity$);
    return withMinQuantity$;
  }

  function filterStreamWithMinQuantity($: Stream<Quantity>) {
    return function({ minQuantity }: MinQuantitySetting): Stream<Quantity> {
      if (minQuantity !== undefined) {
        return $.filter((quantity: Quantity) => quantity >= minQuantity);
      }
      return $;
    };
  }

  function getAfter(content$: Stream<Content[]>): Stream<SortCriteria> {
    return content$
      .filter(hasContent)
      .map(getLastContentSortAttribute)
      .filter(isValidSortAttribute)
      .startWith([]);
  }

  function hasContent(result: Content[]): boolean {
    return result.length > 0;
  }

  function getLastContentSortAttribute(result: Content[]): any[] {
    return result[result.length - 1].sort;
  }

  function isValidSortAttribute(sort: any[]): boolean {
    return sort.length > 0;
  }

  function makeLoadInstruction([quantity, sort]: [Quantity, SortCriteria]): ChainedLoadInstruction {
    return {
      quantity,
      after: sort
    };
  }

  function getLoadInstruction(
    remainingQuantityToLoad$: Stream<Quantity>,
    after$: Stream<SortCriteria>
  ): Stream<ChainedLoadInstruction> {
    return combineUnique(remainingQuantityToLoad$, after$).map(makeLoadInstruction);
  }

  function applyMaxQuantity(
    loadInstruction$: Stream<ChainedLoadInstruction>,
    maxQuantitySetting$: Stream<MaxQuantitySetting>
  ) {
    return maxQuantitySetting$.map(capStreamWithMaxQuantity(loadInstruction$)).flatten();
  }

  function capStreamWithMaxQuantity($: Stream<ChainedLoadInstruction>) {
    return function({ maxQuantity }: MaxQuantitySetting): Stream<ChainedLoadInstruction> {
      if (maxQuantity !== undefined) {
        return $.map(capWithQuantity(maxQuantity));
      }
      return $;
    };
  }

  function capWithQuantity(maxQuantity: Quantity) {
    return function(loadInstruction: ChainedLoadInstruction) {
      return {
        ...loadInstruction,
        quantity: Math.min(loadInstruction.quantity, maxQuantity)
      };
    };
  }
}
